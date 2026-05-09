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
} from "recharts";
import { formatINR } from "@/lib/utils";

export default function MonthlyPLChart({
  data,
}: {
  data: { period_label: string; revenue: number; expense: number; net_income: number }[];
}) {
  if (!data?.length) {
    return (
      <div className="text-center py-10 text-ink-subtle text-sm">
        No data yet. Post journal entries to see this chart populate.
      </div>
    );
  }
  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,54,135,0.08)" />
          <XAxis dataKey="period_label" tick={{ fontSize: 10, fill: "#7888aa" }} />
          <YAxis tick={{ fontSize: 10, fill: "#7888aa" }} tickFormatter={(v) => formatINR(v, { compact: true })} />
          <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="revenue" name="Revenue" fill="#1C3687" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#ED1B2F" radius={[4, 4, 0, 0]} />
          <Line dataKey="net_income" name="Net Income" stroke="#00a878" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
