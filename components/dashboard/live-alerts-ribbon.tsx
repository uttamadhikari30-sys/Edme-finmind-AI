type Alert = { dot: "amber" | "green" | "red" | "navy"; text: string };

/**
 * Scrolling live-alerts ribbon — the second marquee on the dashboard
 * (the dark KPI ticker is the first). Alerts scroll continuously and
 * pause on hover. Items are doubled so the loop is seamless.
 */
export default function LiveAlertsRibbon({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  const dotColor = {
    amber: "bg-gold",
    green: "bg-edgreen",
    red: "bg-edred",
    navy: "bg-navy",
  } as const;
  const doubled = [...alerts, ...alerts];

  return (
    <div className="rounded-xl bg-gradient-to-r from-gold-50 via-white to-edgreen-50 border border-[var(--border)] px-4 py-2.5 mb-4 flex items-center gap-3 overflow-hidden">
      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-gold flex items-center gap-1.5 flex-shrink-0">
        ⚡ FTM Update
      </span>
      <div className="alert-marquee">
        <div className="alert-marquee-inner">
          {doubled.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-ink-muted px-4"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor[a.dot]} flex-shrink-0`} />
              {a.text}
              <span className="text-ink-subtle/50 ml-3">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
