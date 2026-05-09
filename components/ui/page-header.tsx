export default function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end gap-4">
      <div className="flex-1">
        <h2 className="font-serif text-[23px] font-bold text-navy leading-tight">{title}</h2>
        {subtitle && <p className="text-[11.5px] text-ink-subtle mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
