"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";

export type AopRow = {
  id: string;
  section: string;
  line_item: string;
  sort_order: number;
  is_total: boolean;
  is_cost: boolean;
  fy_actual: number;
  m_apr: number; m_may: number; m_jun: number; m_jul: number;
  m_aug: number; m_sep: number; m_oct: number; m_nov: number;
  m_dec: number; m_jan: number; m_feb: number; m_mar: number;
};

const MONTHS: Array<{ key: keyof AopRow; label: string }> = [
  { key: "m_apr", label: "Apr" }, { key: "m_may", label: "May" }, { key: "m_jun", label: "Jun" },
  { key: "m_jul", label: "Jul" }, { key: "m_aug", label: "Aug" }, { key: "m_sep", label: "Sep" },
  { key: "m_oct", label: "Oct" }, { key: "m_nov", label: "Nov" }, { key: "m_dec", label: "Dec" },
  { key: "m_jan", label: "Jan" }, { key: "m_feb", label: "Feb" }, { key: "m_mar", label: "Mar" },
];

export default function AopStatementTable({
  title,
  fyLabel,
  rows,
  sectionLabels,
}: {
  title: string;
  fyLabel: string;
  rows: AopRow[];
  sectionLabels: Record<string, string>;
}) {
  const currency = useCurrency();

  // Group by section preserving sort_order
  const grouped = new Map<string, AopRow[]>();
  rows.forEach((r) => {
    if (!grouped.has(r.section)) grouped.set(r.section, []);
    grouped.get(r.section)!.push(r);
  });

  const fyTotal = (r: AopRow) =>
    MONTHS.reduce((s, m) => s + Number(r[m.key] ?? 0), 0);

  return (
    <Card>
      <CardHeader title={title} tag={{ label: fyLabel, tone: "green" }} />
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="fm-table">
            <thead>
              <tr>
                <th className="sticky left-0 bg-navy z-10" style={{ minWidth: 280 }}>Particulars</th>
                <th className="r">FY 2025-26 Actual</th>
                {MONTHS.map((m) => (
                  <th key={m.key as string} className="r">{m.label}</th>
                ))}
                <th className="r bg-navy-800">FY Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(grouped.entries()).map(([section, sectionRows]) => (
                <>
                  <tr key={`sec-${section}`}>
                    <td colSpan={15} className="bg-navy-50 text-[10.5px] font-bold uppercase tracking-[1.5px] text-navy py-2">
                      {sectionLabels[section] ?? section}
                    </td>
                  </tr>
                  {sectionRows.map((r) => {
                    const total = fyTotal(r);
                    const fyVar = total - Number(r.fy_actual ?? 0);
                    return (
                      <tr
                        key={r.id}
                        className={r.is_total ? "bg-navy-50/40 font-bold border-y border-navy/15" : ""}
                      >
                        <td
                          className={`sticky left-0 z-10 ${
                            r.is_total ? "bg-navy-50 text-navy" : "bg-white text-ink-muted pl-4"
                          }`}
                        >
                          {r.line_item}
                        </td>
                        <td className={`r font-mono ${r.is_total ? "text-navy font-bold" : "text-ink-subtle"}`}>
                          {formatCurrencyLakhs(Number(r.fy_actual) * 1e5, currency)}
                        </td>
                        {MONTHS.map((m) => {
                          const v = Number(r[m.key] ?? 0);
                          return (
                            <td
                              key={m.key as string}
                              className={`r font-mono ${r.is_total ? "font-bold text-navy" : "text-navy"} ${
                                v < 0 ? "text-edred" : ""
                              }`}
                            >
                              {v === 0 ? "—" : compactLakhs(v * 1e5, currency)}
                            </td>
                          );
                        })}
                        <td
                          className={`r font-mono font-bold ${
                            total < 0 ? "text-edred" : "text-navy"
                          } bg-navy-50/30`}
                        >
                          {formatCurrencyLakhs(total * 1e5, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
