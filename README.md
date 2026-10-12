# Learning Management System

A course platform built with Next.js 14 (App Router), Prisma and PostgreSQL: a course catalog, an HLS/MP4 video player with resume, a server-graded quiz engine, and verifiable certificates.

## What it does

| Area | Details |
|---|---|
| **Accounts** | Register and sign in (bcrypt passwords, signed httpOnly session cookie). Roles: student, instructor, admin. Self-service sign-up can only create students or instructors |
| **Catalog** | Public list of published courses with search, category and level filters, paging, discounts |
| **Teaching** | Instructors create courses, add/edit/reorder/delete lessons (video URL, length, description), build quizzes, set price and discount, publish or unpublish. Drafts are visible only to their instructor |
| **Learning** | Enroll (free, or paid through a simulated checkout), watch lessons, resume where you left off, auto-complete at 90% watched or mark complete by hand, see course progress |
| **Video** | Plays HLS (`.m3u8`) with hls.js, or MP4/WebM natively; Safari uses its built-in HLS. Video URLs are only sent to people who may watch them (enrolled students, the instructor, admins) |
| **Quizzes** | Single- and multiple-answer questions, pass mark, unlimited attempts, graded on the server (a question is right only if the selected options are exactly the correct ones). Students never receive the answer key before answering; afterwards they see the correct options and your explanation |
| **Certificates** | Issued only when every lesson is done and every quiz passed. One per student and course, with a code like `K7QW-2MRD-9XPF`, a printable page, and a public verification page and API |

### Rules worth knowing

- **A course can only be published with at least one lesson.** A published course always keeps at least one.
- **Deleting a lesson recalculates every student's progress.** A course with enrolled students cannot be deleted; unpublish it instead.
- **Enrollment is unique per student and course**, enforced by the database, so simultaneous requests cannot double-enroll or double-charge.
- **Sign-in attempts are rate limited** (10 per 15 minutes per IP and email). The limiter is in-memory, so it is per server process; use a shared store before running several instances.

### What is simulated or not included

- **Payments are simulated.** `lib/lms.ts` validates the card (Luhn, expiry) and approves or declines by test number; nothing is charged. Card numbers are never stored or logged; a purchase keeps only the amount in cents and the last four digits. Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, `4000 0000 0000 9995` has insufficient funds. Swap `chargeSimulatedCard` for a real processor (Stripe, Razorpay) to take real payments.
- **Video hosting is not included.** A lesson holds a URL; host the files on your CDN or video platform (the seed uses public sample streams).
- **No email.** There is no password reset or notification email yet.
- **Not verified in a browser.** The API, pages and database were run end to end over HTTP against PostgreSQL, and the app type-checks, lints and builds, but the player and the interactive screens were not clicked through in a real browser, and the Docker image was not built here.

## Run it

### With Docker

```bash
cp .env.example .env     # set SESSION_SECRET (32+ characters) and SEED_PASSWORD
docker compose up --build
docker compose --profile seed run --rm seed     # optional demo course and users
```

Open http://localhost:3000. The seed creates `instructor@example.com` and `student@example.com` (password from `SEED_PASSWORD`) and a published demo course with two lessons and a quiz.

### Locally

Requirements: Node 20+, PostgreSQL 14+.

```bash
cp .env.example .env     # point DATABASE_URL at your database
npm ci
npx prisma migrate deploy
npm run db:seed          # optional demo data
npm run dev              # http://localhost:3000
```

Scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`, `npm test` (vitest, the pure logic in `app/services.ts`).

## Try it

1. Sign in as the instructor, open **Teach**, create a course, add lessons (paste an HLS or MP4 URL), add a quiz, publish.
2. Sign in as a student, enroll, watch the lessons, take the quiz.
3. Once everything is done, **Get certificate** appears; open it, print it, or verify it at `/api/certificates/<code>`.

## API

All routes are under `/api`; errors are `{ "error": "..." }` with `400`, `401`, `402` (payment problem), `403`, `404`, `409` or `429`.

| Route | Purpose |
|---|---|
| `POST /auth/register`, `/auth/login`, `/auth/logout`; `GET /auth/me` | session |
| `GET /courses` (`q`, `category`, `level`, `page`, `mine=1`); `POST /courses` | catalog; create (instructor) |
| `GET/PATCH/DELETE /courses/:id` | detail (video URLs only if you may watch); edit; delete |
| `POST /courses/:id/lessons`, `/lessons/reorder`; `PATCH/DELETE /lessons/:id` | lesson management |
| `POST /courses/:id/enroll` | enroll; body `{ cardNumber, expMonth, expYear }` for paid courses |
| `GET /courses/:id/progress`; `POST /lessons/:id/progress` | progress; save position or completion |
| `POST /courses/:id/quizzes`; `GET/PUT/DELETE /quizzes/:id`; `POST /quizzes/:id/attempts` | quizzes |
| `POST /courses/:id/certificate`; `GET /certificates/:code` | issue; public verification |

## Project layout

```
app/                 pages (catalog, course, learn, quiz, my-learning, instructor, certificates, login) and app/api routes
app/services.ts      pure logic (progress, discounts) with its own spec in tests/
components/          player (hls.js), course player, quiz runner and builder, editors, forms
lib/                 auth (sessions), lms (progress, grading, certificates, simulated payments), validation (zod), http helpers
prisma/              schema, migrations, seed
```

Data model: `User`, `Course`, `Lesson`, `Enrollment`, `LessonProgress`, `Quiz` (+ `Question`, `Option`, `QuizAttempt`), `Certificate`, `Purchase`.
