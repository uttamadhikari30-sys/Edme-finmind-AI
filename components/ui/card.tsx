import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("bg-white rounded-[14px] border border-[var(--border)] shadow-soft overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  tag,
  right,
}: {
  title: string;
  tag?: { label: string; tone?: "navy" | "green" | "red" | "gold" | "purple" };
  right?: React.ReactNode;
}) {
  const toneCls = {
    navy: "pill-navy",
    green: "pill-green",
    red: "pill-red",
    gold: "pill-gold",
    purple: "pill-navy",
  } as const;
  return (
    <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[rgba(28,54,135,0.05)]">
      <h3 className="font-serif text-[15.5px] font-bold text-navy flex-1">{title}</h3>
      {tag && <span className={cn("pill", toneCls[tag.tone || "navy"])}>{tag.label}</span>}
      {right}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
