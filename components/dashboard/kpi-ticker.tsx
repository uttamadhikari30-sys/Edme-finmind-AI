export type TickerItem = {
  label: string;
  value: string;
  delta?: string;
  up?: boolean;
};

/**
 * Live KPI ticker — a stock-ticker-style marquee of the current headline
 * numbers that scrolls continuously (pauses on hover). Pure-CSS animation.
 */
export default function KpiTicker({
  items,
  label = "YTD Update",
}: {
  items: TickerItem[];
  label?: string;
}) {
  if (!items.length) return null;
  // Duplicate the list so the -50% translate loops seamlessly.
  const doubled = [...items, ...items];

  return (
    <div className="kpi-ticker mb-4 animate-fade-up">
      <div className="kpi-ticker-badge">
        <span
          className="w-1.5 h-1.5 rounded-full bg-edgreen inline-block"
          style={{ animation: "blink 1.5s infinite" }}
        />
        {label}
      </div>
      <div className="kpi-ticker-scroll">
        <div className="kpi-ticker-inner">
          {doubled.map((it, i) => (
            <span key={i} className="kti">
              <span className="kti-lbl">{it.label}</span>
              <span className="kti-val">{it.value}</span>
              {it.delta && (
                <span className={`kti-delta ${it.up ? "up" : "dn"}`}>
                  {it.up ? "▲" : "▼"} {it.delta}
                </span>
              )}
              <span className="kti-sep">|</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
