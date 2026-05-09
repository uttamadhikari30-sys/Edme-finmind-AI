"use client";

import { useRouter } from "next/navigation";

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

  function setPeriod(id: string) {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
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
