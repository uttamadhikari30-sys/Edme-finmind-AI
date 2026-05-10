"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

type Row = {
  month: string;
  actual: number | null;
  le: number | null;
  aop: number;
  py: number;
  isFuture: boolean;
};

export default function LERevenueChart({ data, periodLabel }: { data: Row[]; periodLabel: string }) {
  const currentIdx = data.findIndex((d) => d.isFuture);

  return (
    <div className="bg-white rounded-[14px] border border-[var(--border)] shadow-soft overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[var(--border-2)]">
        <h3 className="font-serif text-[15.5px] font-bold text-navy flex-1">
          📊 Revenue vs AOP vs Prior Year — Full Year
        </h3>
        <span className="text-[11px] text-ink-subtle">{periodLabel}</span>
      </div>
      <div className="p-5">
        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,54,135,0.08)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#3a4d70" }} />
              <YAxis tick={{ fontSize: 10, fill: "#7888aa" }} />
              <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {/* Reference line at the actual→LE boundary */}
              {currentIdx > 0 && (
                <ReferenceLine x={data[currentIdx - 1]?.month} stroke="#7888aa" strokeDasharray="4 4" />
              )}
              <Bar dataKey="actual" name="Actual" fill="#1C3687" radius={[4, 4, 0, 0]} barSize={28} />
              <Bar dataKey="le" name="LE" fill="#00a878" radius={[4, 4, 0, 0]} barSize={28} fillOpacity={0.55} />
              <Line dataKey="aop" name="AOP" stroke="#ED1B2F" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: "#ED1B2F" }} />
              <Line dataKey="py" name="Prior Year" stroke="#7888aa" strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2, fill: "#7888aa" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
