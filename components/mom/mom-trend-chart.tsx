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
  Cell,
} from "recharts";

type Pt = { month: string; value: number; isFuture: boolean; isCurrent: boolean };

export default function MoMTrendChart({
  revenueData,
  expenseData,
}: {
  revenueData: Pt[];
  expenseData: Pt[];
}) {
  return (
    <div className="bg-white rounded-[14px] border border-[var(--border)] shadow-soft overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[var(--border-2)]">
        <h3 className="font-serif text-[15.5px] font-bold text-navy flex-1">
          Monthly Revenue vs Expense Trend
        </h3>
        <span className="pill pill-navy">Actual vs AOP vs PY</span>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <SubChart title="📊 Revenue Trend" data={revenueData} color="#1C3687" />
        <SubChart title="💰 Expense Trend" data={expenseData} color="#e07b1a" />
      </div>
    </div>
  );
}

function SubChart({ title, data, color }: { title: string; data: Pt[]; color: string }) {
  return (
    <div>
      <div className="font-semibold text-[12.5px] text-navy mb-2">{title}</div>
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,54,135,0.08)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#7888aa" }} />
            <YAxis tick={{ fontSize: 9, fill: "#7888aa" }} />
            <Tooltip contentStyle={{ borderRadius: 10, fontSize: 11 }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.isFuture ? "#cbd5e1" : d.isCurrent ? color : `${color}b3`} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              opacity={0.4}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
