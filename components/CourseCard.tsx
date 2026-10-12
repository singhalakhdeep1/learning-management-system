import Link from 'next/link';
import { money } from '@/lib/format';

export interface CourseCardData {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  price: number;
  finalPrice: number;
  instructor: string;
  lessonCount: number;
  isPublished?: boolean;
}

export default function CourseCard({ course, href }: { course: CourseCardData; href?: string }) {
  const discounted = course.finalPrice < course.price;

  return (
    <Link href={href ?? `/courses/${course.id}`} className="card course-card">
      <div className="tags">
        <span className="tag">{course.category}</span>
        <span className="tag">{course.level}</span>
        {course.isPublished === false && <span className="tag">Draft</span>}
      </div>
      <h3>{course.title}</h3>
      <p className="muted small" style={{ flex: 1 }}>
        {course.description.length > 120 ? `${course.description.slice(0, 120)}…` : course.description}
      </p>
      <div className="split small">
        <span className="muted">
          {course.instructor} · {course.lessonCount} lessons
        </span>
        <span className="price">
          {discounted && <s>{money(course.price)}</s>}
          {money(course.finalPrice)}
        </span>
      </div>
    </Link>
  );
}
