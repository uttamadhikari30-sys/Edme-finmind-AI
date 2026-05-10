type Alert = { dot: "amber" | "green" | "red" | "navy"; text: string };

export default function LiveAlertsRibbon({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  const dotColor = {
    amber: "bg-gold",
    green: "bg-edgreen",
    red: "bg-edred",
    navy: "bg-navy",
  } as const;
  return (
    <div className="rounded-xl bg-gradient-to-r from-gold-50 via-white to-edgreen-50 border border-[var(--border)] px-4 py-2.5 mb-4 flex items-center gap-3 overflow-x-auto">
      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-gold flex items-center gap-1.5 flex-shrink-0">
        ⚡ Live Alerts
      </span>
      <div className="flex items-center gap-4 text-[11.5px] text-ink-muted">
        {alerts.map((a, i) => (
          <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor[a.dot]}`} />
            {a.text}
          </span>
        ))}
      </div>
    </div>
  );
}
