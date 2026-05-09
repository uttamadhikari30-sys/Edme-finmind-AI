import Link from "next/link";

export default function EmptyState({
  icon = "📊",
  title,
  body,
  cta,
}: {
  icon?: string;
  title: string;
  body?: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="text-center py-12 px-6">
      <div className="text-4xl mb-3 opacity-70">{icon}</div>
      <div className="font-serif text-lg font-bold text-navy">{title}</div>
      {body && <p className="text-sm text-ink-muted mt-1.5 max-w-md mx-auto">{body}</p>}
      {cta && (
        <Link
          href={cta.href}
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-800 transition"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}
