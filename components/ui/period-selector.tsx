"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function PeriodSelector({
  periods,
  active,
  basePath,
}: {
  periods: { id: string; period_label: string }[];
  active: string;
  basePath: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setPeriod(id: string) {
    const params = new URLSearchParams(sp);
    params.set("period", id);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <select
      value={active}
      onChange={(e) => setPeriod(e.target.value)}
      className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-navy outline-none"
    >
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          {p.period_label}
        </option>
      ))}
    </select>
  );
}
