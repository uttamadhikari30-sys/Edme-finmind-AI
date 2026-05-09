"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";

type Account = { id: string; account_code: string; account_name: string; account_type: string };
type Period = { id: string; period_label: string; start_date: string; end_date: string; status: string };
type BU = { id: string; code: string; name: string };

type Line = {
  account_id: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  business_unit_id: string | null;
};

const blankLine = (): Line => ({
  account_id: "",
  description: "",
  debit_amount: 0,
  credit_amount: 0,
  business_unit_id: null,
});

export default function JournalEntryForm({
  orgId,
  accounts,
  periods,
  businessUnits,
}: {
  orgId: string;
  accounts: Account[];
  periods: Period[];
  businessUnits: BU[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const defaultPeriod = periods.find(
    (p) => p.start_date <= today && p.end_date >= today && p.status === "open"
  )?.id || periods[0]?.id || "";

  const [entryDate, setEntryDate] = useState(today);
  const [periodId, setPeriodId] = useState(defaultPeriod);
  const [businessUnitId, setBusinessUnitId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { ...blankLine(), debit_amount: 0 },
    { ...blankLine(), credit_amount: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const dr = lines.reduce((a, l) => a + (Number(l.debit_amount) || 0), 0);
    const cr = lines.reduce((a, l) => a + (Number(l.credit_amount) || 0), 0);
    return { dr, cr, diff: +(dr - cr).toFixed(2), balanced: +dr.toFixed(2) === +cr.toFixed(2) && dr > 0 };
  }, [lines]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((prev) => [...prev, blankLine()]); }
  function removeLine(idx: number) { setLines((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev)); }

  async function save(post: boolean) {
    setError(null);
    if (!periodId) return setError("Select a fiscal period");
    if (lines.some((l) => !l.account_id)) return setError("Each line must have an account");
    if (lines.some((l) => Number(l.debit_amount) > 0 && Number(l.credit_amount) > 0))
      return setError("A line cannot have both a debit and a credit");
    if (post && !totals.balanced) return setError("Debits and credits must balance to post");

    setSubmitting(true);
    const ts = new Date();
    const entryNumber = `JE-${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getTime()).slice(-5)}`;

    const { data: created, error: jeErr } = await supabase
      .from("journal_entries")
      .insert({
        org_id: orgId,
        entry_number: entryNumber,
        entry_date: entryDate,
        period_id: periodId,
        business_unit_id: businessUnitId || null,
        description,
        status: "draft",
      })
      .select()
      .single();
    if (jeErr || !created) {
      setSubmitting(false);
      return setError(jeErr?.message ?? "Could not save");
    }

    const linesRows = lines.map((l, i) => ({
      journal_entry_id: created.id,
      line_number: i + 1,
      account_id: l.account_id,
      business_unit_id: l.business_unit_id || businessUnitId || null,
      description: l.description || null,
      debit_amount: Number(l.debit_amount) || 0,
      credit_amount: Number(l.credit_amount) || 0,
    }));
    const { error: linesErr } = await supabase.from("journal_entry_lines").insert(linesRows);
    if (linesErr) {
      setSubmitting(false);
      return setError(linesErr.message);
    }

    if (post) {
      const { error: postErr } = await supabase.rpc("fn_post_journal_entry", { p_je_id: created.id });
      if (postErr) {
        setSubmitting(false);
        return setError(postErr.message);
      }
    }

    router.push("/journal-entries");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Header" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Date">
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inp} />
            </Field>
            <Field label="Period">
              <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className={inp}>
                {periods.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.status === "closed"}>
                    {p.period_label} {p.status === "closed" ? "(closed)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Business Unit">
              <select value={businessUnitId} onChange={(e) => setBusinessUnitId(e.target.value)} className={inp}>
                <option value="">— None —</option>
                {businessUnits.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description" wide>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. October brokerage commission"
                className={inp}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Lines" tag={{ label: totals.balanced ? "Balanced" : `Diff ${formatINR(totals.diff, { compact: true })}`, tone: totals.balanced ? "green" : "red" }} />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Account</th>
                  <th>Description</th>
                  <th>BU</th>
                  <th className="r">Debit</th>
                  <th className="r">Credit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <select value={l.account_id} onChange={(e) => updateLine(i, { account_id: e.target.value })} className={inpSm}>
                        <option value="">— Select account —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_code} · {a.account_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} className={inpSm} placeholder="Memo" />
                    </td>
                    <td>
                      <select value={l.business_unit_id ?? ""} onChange={(e) => updateLine(i, { business_unit_id: e.target.value || null })} className={inpSm}>
                        <option value="">—</option>
                        {businessUnits.map((b) => (
                          <option key={b.id} value={b.id}>{b.code}</option>
                        ))}
                      </select>
                    </td>
                    <td className="r">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={l.debit_amount || ""}
                        onChange={(e) => updateLine(i, { debit_amount: Number(e.target.value), credit_amount: 0 })}
                        className={`${inpSm} text-right font-mono`}
                      />
                    </td>
                    <td className="r">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={l.credit_amount || ""}
                        onChange={(e) => updateLine(i, { credit_amount: Number(e.target.value), debit_amount: 0 })}
                        className={`${inpSm} text-right font-mono`}
                      />
                    </td>
                    <td>
                      <button onClick={() => removeLine(i)} className="text-edred text-xs px-2" disabled={lines.length <= 2} title="Remove">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-navy-50/40 font-bold">
                  <td colSpan={3} className="text-right text-[11px] uppercase tracking-wider text-navy">Totals</td>
                  <td className="r font-mono text-navy">{formatINR(totals.dr, { compact: true })}</td>
                  <td className="r font-mono text-navy">{formatINR(totals.cr, { compact: true })}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 flex items-center gap-3 border-t border-[var(--border-2)]">
            <button onClick={addLine} className="text-xs font-semibold text-navy hover:underline">+ Add line</button>
            <div className="flex-1" />
            {error && <div className="text-xs font-medium text-edred">{error}</div>}
            <button
              onClick={() => save(false)}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-bg-alt text-ink-muted text-sm font-semibold border border-[var(--border)] hover:border-navy hover:text-navy transition disabled:opacity-60"
            >
              Save as draft
            </button>
            <button
              onClick={() => save(true)}
              disabled={submitting || !totals.balanced}
              className="px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-800 transition disabled:opacity-60"
            >
              {submitting ? "Posting…" : "Save & Post →"}
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

const inp = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-navy focus:bg-white outline-none";
const inpSm = "w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] focus:border-navy outline-none";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-1" : ""}>
      <label className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
