import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** An expected failure with an HTTP status; its message is safe to show to the caller. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler so validation errors, HttpErrors and crashes all become tidy JSON responses. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error instanceof ZodError) {
        const first = error.issues[0];
        const where = first.path.length ? `${first.path.join('.')}: ` : '';
        return NextResponse.json(
          { error: `${where}${first.message}`, issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
          { status: 400 },
        );
      }
      console.error('Unhandled error in route handler', error);
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
  };
}

export function json(data: unknown, status = 200): Response {
  return NextResponse.json(data, { status });
}

/** Reads and parses a JSON body; a missing or malformed body is a 400, not a crash. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}
