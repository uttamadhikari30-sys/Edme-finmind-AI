"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useCurrency, formatCurrencyLakhs } from "@/lib/currency";

type Account = { id: string; account_code: string; account_name: string; account_type: string };
type Period = { id: string; period_label: string; start_date: string; end_date: string; status: string };
type Upload = {
  id: string;
  filename: string;
  data_type: string;
  row_count: number;
  status: string;
  uploaded_at: string;
};
type BU = { id: string; code: string; name: string };

type Mode = "sunsystem" | "revenue";

type SunRow = {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  vertical_code?: string;
  description?: string;
  mapped: boolean;
  category?: string;
};

type RevRow = {
  date?: string;
  vertical_code: string;
  client?: string;
  brokerage: number;
  trail: number;
  advisory: number;
  description?: string;
  mapped: boolean;
};

const MODE_INFO: Record<Mode, { title: string; subtitle: string; tone: "navy" | "gold" }> = {
  sunsystem: {
    title: "Infor SunSystem GL Export",
    subtitle: "Trial-balance or GL extract — one row per account, with Debit/Credit",
    tone: "navy",
  },
  revenue: {
    title: "Revenue System Export",
    subtitle: "Brokerage / CRM extract — one row per vertical or policy",
    tone: "gold",
  },
};

const SUN_TEMPLATE =
  "Account Code,Account Name,Debit,Credit,Vertical Code,Description\n" +
  "1000,Bank - HDFC Current,3600000,0,,Cash inflow\n" +
  "4000,Brokerage Income,0,1842000,CORP,Corporate brokerage\n" +
  "4100,Trail Commission,0,324000,CORP,Corporate trail\n" +
  "4200,Advisory Fees,0,98000,HEALTH,Advisory billing\n" +
  "5000,Salaries & Wages,684000,0,,Monthly payroll\n" +
  "5100,Office Rent,250000,0,,Office rent\n" +
  "5200,Marketing,82000,0,,Q3 campaigns\n";

const REV_TEMPLATE =
  "Date,Vertical Code,Client,Brokerage,Trail,Advisory,Description\n" +
  "2025-10-12,CORP,Acme Industries,500000,75000,0,Marine renewal\n" +
  "2025-10-15,SME,Cellpoint Pvt Ltd,180000,28000,0,Liability cover\n" +
  "2025-10-22,HEALTH,Krishna Health Group,0,0,120000,Annual advisory retainer\n" +
  "2025-10-28,RETAIL,Walk-in HNI book,310000,42000,0,HNW book\n";

export default function LedgerUploadClient({
  orgId,
  accounts,
  periods,
  history,
  bus,
}: {
  orgId: string;
  accounts: Account[];
  periods: Period[];
  history: Upload[];
  bus: BU[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const currency = useCurrency();
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = periods.find((p) => p.start_date <= today && p.end_date >= today);

  const [mode, setMode] = useState<Mode>("sunsystem");
  const [periodId, setPeriodId] = useState(currentPeriod?.id ?? periods[0]?.id ?? "");
  const [filename, setFilename] = useState<string | null>(null);
  const [sunRows, setSunRows] = useState<SunRow[]>([]);
  const [revRows, setRevRows] = useState<RevRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    title: string;
    detail: string;
    counts: { left: string; right: string }[];
  } | null>(null);

  const accountByCode = useMemo(
    () => new Map(accounts.map((a) => [a.account_code, a])),
    [accounts]
  );
  const buByCode = useMemo(() => new Map(bus.map((b) => [b.code.toUpperCase(), b])), [bus]);

  function parseCSV(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const sep = lines[0]?.includes("\t") ? "\t" : ",";
    return lines.map((line) =>
      line
        .split(sep)
        .map((c) => c.trim().replace(/^"|"$/g, ""))
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    setSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const text = await file.text();
    try {
      const rows = parseCSV(text);
      if (rows.length < 2) {
        setErr("File appears empty.");
        return;
      }
      const headers = rows[0]!.map((h) => h.toLowerCase());
      const dataRows = rows.slice(1);

      if (mode === "sunsystem") {
        const colCode    = headers.findIndex((h) => /account.?code/.test(h));
        const colName    = headers.findIndex((h) => /account.?name|description/.test(h));
        const colDebit   = headers.findIndex((h) => /debit/.test(h));
        const colCredit  = headers.findIndex((h) => /credit/.test(h));
        const colVert    = headers.findIndex((h) => /vertical|cost.?cent|bu/.test(h));
        const colDesc    = headers.findIndex((h) => /description|narration|memo/.test(h));

        if (colCode < 0 || (colDebit < 0 && colCredit < 0)) {
          setErr("Could not detect required columns. Need at least: Account Code, Debit, Credit.");
          return;
        }

        const parsed: SunRow[] = dataRows
          .map((r): SunRow | null => {
            const code = r[colCode]?.trim() ?? "";
            if (!code) return null;
            const debit = parseFloat((r[colDebit] ?? "0").replace(/[,]/g, "")) || 0;
            const credit = parseFloat((r[colCredit] ?? "0").replace(/[,]/g, "")) || 0;
            if (debit === 0 && credit === 0) return null;
            const acct = accountByCode.get(code);
            return {
              account_code: code,
              account_name: acct?.account_name ?? r[colName]?.trim() ?? "(unknown)",
              debit,
              credit,
              vertical_code: colVert >= 0 ? r[colVert]?.trim().toUpperCase() : undefined,
              description: colDesc >= 0 ? r[colDesc]?.trim() : undefined,
              mapped: !!acct,
              category: acct?.account_type,
            };
          })
          .filter((r): r is SunRow => r !== null);
        setSunRows(parsed);
        setRevRows([]);
      } else {
        const colDate    = headers.findIndex((h) => /date/.test(h));
        const colVert    = headers.findIndex((h) => /vertical|cost.?cent|bu/.test(h));
        const colClient  = headers.findIndex((h) => /client|policy|customer/.test(h));
        const colBrok    = headers.findIndex((h) => /brokerage/.test(h));
        const colTrail   = headers.findIndex((h) => /trail/.test(h));
        const colAdv     = headers.findIndex((h) => /advisory|fee/.test(h));
        const colDesc    = headers.findIndex((h) => /description|memo|narration/.test(h));

        if (colVert < 0 || colBrok < 0) {
          setErr("Could not detect required columns. Need at least: Vertical Code, Brokerage.");
          return;
        }

        const parsed: RevRow[] = dataRows
          .map((r): RevRow | null => {
            const code = (colVert >= 0 ? r[colVert] : "")?.trim().toUpperCase() ?? "";
            if (!code) return null;
            const brok = parseFloat((r[colBrok] ?? "0").replace(/[,]/g, "")) || 0;
            const trail = colTrail >= 0 ? parseFloat((r[colTrail] ?? "0").replace(/[,]/g, "")) || 0 : 0;
            const adv = colAdv >= 0 ? parseFloat((r[colAdv] ?? "0").replace(/[,]/g, "")) || 0 : 0;
            if (brok === 0 && trail === 0 && adv === 0) return null;
            return {
              date: colDate >= 0 ? r[colDate]?.trim() : undefined,
              vertical_code: code,
              client: colClient >= 0 ? r[colClient]?.trim() : undefined,
              brokerage: brok,
              trail,
              advisory: adv,
              description: colDesc >= 0 ? r[colDesc]?.trim() : undefined,
              mapped: buByCode.has(code),
            };
          })
          .filter((r): r is RevRow => r !== null);
        setRevRows(parsed);
        setSunRows([]);
      }
    } catch (e: any) {
      setErr(`Failed to parse: ${e?.message ?? "Unknown error"}`);
    }
  }

  async function processBatch() {
    setBusy(true);
    setErr(null);
    setSuccess(null);
    if (!periodId) {
      setBusy(false);
      setErr("Pick a fiscal period first.");
      return;
    }

    if (mode === "sunsystem") {
      if (sunRows.length === 0) {
        setBusy(false);
        setErr("No rows parsed.");
        return;
      }
      const payload = sunRows
        .filter((r) => r.mapped)
        .map((r) => ({
          account_code: r.account_code,
          debit: r.debit,
          credit: r.credit,
          vertical_code: r.vertical_code || null,
          description: r.description || null,
        }));

      const { data, error } = await supabase.rpc("fn_import_sunsystem_gl", {
        p_org_id: orgId,
        p_period_id: periodId,
        p_filename: filename ?? "sunsystem.csv",
        p_lines: payload,
      });
      setBusy(false);
      if (error) {
        setErr(error.message);
        return;
      }
      const d = data as any;
      setSuccess({
        title: "✅ SunSystem GL imported · MIS updated",
        detail: `Entry ${d.entry_number} posted. All P&L, Dashboard, Cash Flow, Variance and Vertical reports now reflect these numbers.`,
        counts: [
          { left: "Lines imported", right: `${d.lines_imported}` },
          { left: "Total debits",   right: formatCurrencyLakhs(Number(d.total_debit), currency) },
          { left: "Total credits",  right: formatCurrencyLakhs(Number(d.total_credit), currency) },
          { left: "Unmapped (skipped)", right: `${d.unmapped_accounts}` },
        ],
      });
      setSunRows([]);
      setFilename(null);
      router.refresh();
    } else {
      if (revRows.length === 0) {
        setBusy(false);
        setErr("No rows parsed.");
        return;
      }
      const payload = revRows
        .filter((r) => r.mapped)
        .map((r) => ({
          date: r.date || null,
          vertical_code: r.vertical_code,
          brokerage: r.brokerage,
          trail: r.trail,
          advisory: r.advisory,
          description: r.description || (r.client ? `Revenue · ${r.client}` : null),
        }));

      const { data, error } = await supabase.rpc("fn_import_revenue_batch", {
        p_org_id: orgId,
        p_period_id: periodId,
        p_filename: filename ?? "revenue.csv",
        p_rows: payload,
      });
      setBusy(false);
      if (error) {
        setErr(error.message);
        return;
      }
      const d = data as any;
      setSuccess({
        title: "✅ Revenue imported · MIS updated",
        detail: `${d.journal_entries_created} vertical-level journal entries posted. Dashboards, Vertical Performance, MoM and LE are now live.`,
        counts: [
          { left: "JEs created",       right: `${d.journal_entries_created}` },
          { left: "Total revenue",     right: formatCurrencyLakhs(Number(d.total_revenue), currency) },
          { left: "Rows skipped",      right: `${d.rows_skipped}` },
        ],
      });
      setRevRows([]);
      setFilename(null);
      router.refresh();
    }
  }

  const sunSummary = useMemo(() => {
    const rev = sunRows.filter((r) => r.category === "revenue").reduce((s, r) => s + (r.credit - r.debit), 0);
    const exp = sunRows.filter((r) => r.category === "expense").reduce((s, r) => s + (r.debit - r.credit), 0);
    const dr = sunRows.reduce((s, r) => s + r.debit, 0);
    const cr = sunRows.reduce((s, r) => s + r.credit, 0);
    const unmapped = sunRows.filter((r) => !r.mapped).length;
    return { rev, exp, dr, cr, unmapped, balanced: Math.abs(dr - cr) < 0.01 };
  }, [sunRows]);

  const revSummary = useMemo(() => {
    const total = revRows.reduce((s, r) => s + r.brokerage + r.trail + r.advisory, 0);
    const byVertical = new Map<string, number>();
    revRows.forEach((r) => {
      const t = r.brokerage + r.trail + r.advisory;
      byVertical.set(r.vertical_code, (byVertical.get(r.vertical_code) ?? 0) + t);
    });
    const unmapped = revRows.filter((r) => !r.mapped).length;
    return { total, byVertical, unmapped };
  }, [revRows]);

  const rowsParsed = mode === "sunsystem" ? sunRows.length : revRows.length;

  return (
    <div className="space-y-4">
      {/* Workflow strip */}
      <Card>
        <CardBody className="py-3 flex items-center gap-3 flex-wrap text-[12px]">
          <span className="pill pill-navy">Step 1</span>
          <span className="text-ink">Upload Ledger / Revenue file</span>
          <span className="text-ink-subtle">→</span>
          <span className="pill pill-gold">Step 2</span>
          <span className="text-ink-muted">Review parsed rows + auto-mapping</span>
          <span className="text-ink-subtle">→</span>
          <span className="pill pill-green">Step 3</span>
          <span className="text-ink-muted">Click <b>Process & Map to FINMIND</b></span>
          <span className="text-ink-subtle">→</span>
          <span className="pill pill-purple">Step 4</span>
          <span className="text-edpurple font-semibold">All Reports auto-update with Actual numbers</span>
        </CardBody>
      </Card>

      {/* Mode selector */}
      <Card>
        <CardBody className="py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {(["sunsystem", "revenue"] as Mode[]).map((m) => {
            const info = MODE_INFO[m];
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-left rounded-xl border-2 p-4 transition ${
                  isActive
                    ? info.tone === "navy"
                      ? "border-navy bg-navy-50/40 shadow-soft"
                      : "border-gold bg-gold-50 shadow-soft"
                    : "border-[var(--border)] bg-white hover:border-navy/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[20px]">{m === "sunsystem" ? "🏦" : "💰"}</span>
                  <span className="font-serif text-[16px] font-bold text-navy">{info.title}</span>
                  {isActive && <span className="ml-auto pill pill-green">Selected</span>}
                </div>
                <div className="text-[12px] text-ink-muted">{info.subtitle}</div>
              </button>
            );
          })}
        </CardBody>
      </Card>

      {/* Upload + Format spec */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title={`Upload ${MODE_INFO[mode].title}`}
            tag={{ label: "CSV / TSV", tone: MODE_INFO[mode].tone === "navy" ? "navy" : "gold" }}
          />
          <CardBody>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">Period</label>
                <select
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.status === "closed"}>
                      {p.period_label} {p.status === "closed" ? "(closed)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center justify-center w-full px-4 py-8 rounded-lg border-2 border-dashed border-navy/30 bg-navy-50/30 text-navy font-semibold text-sm cursor-pointer hover:bg-navy-50/60 transition">
                📁 {filename ? filename : "Browse Files"}
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={onFile}
                  className="hidden"
                />
              </label>
              {err && (
                <div className="text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}
              <button
                onClick={processBatch}
                disabled={busy || rowsParsed === 0 || (mode === "sunsystem" && !sunSummary.balanced)}
                className="w-full rounded-lg bg-edgreen text-white font-semibold text-sm py-3 hover:brightness-110 disabled:opacity-50 shadow-soft"
              >
                {busy ? "Processing…" : `✅ Process & Map to FINMIND${rowsParsed > 0 ? ` (${rowsParsed} rows)` : ""}`}
              </button>
              {mode === "sunsystem" && sunRows.length > 0 && !sunSummary.balanced && (
                <div className="text-[11px] font-medium text-edred">
                  ⚠ Debit ≠ Credit. Total Dr {formatCurrencyLakhs(sunSummary.dr, currency)} vs Cr{" "}
                  {formatCurrencyLakhs(sunSummary.cr, currency)}. Cannot post.
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="📋 Expected Format" tag={{ label: "Spec", tone: "navy" }} />
          <CardBody>
            {mode === "sunsystem" ? (
              <div className="text-[12px] text-ink-muted space-y-1.5">
                <div><b>Account Code</b> — must match your Chart of Accounts (e.g. 4000)</div>
                <div><b>Account Name</b> — for reference only</div>
                <div><b>Debit</b> — debit amount in INR (no symbols/commas needed)</div>
                <div><b>Credit</b> — credit amount in INR</div>
                <div><b>Vertical Code</b> — optional (CORP/SME/HEALTH/RETAIL/MOTOR)</div>
                <div><b>Description</b> — optional narration</div>
                <div className="mt-2 text-[11px] text-ink-subtle italic">
                  Must balance: total debits = total credits.
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-ink-muted space-y-1.5">
                <div><b>Date</b> — transaction date (YYYY-MM-DD) · optional</div>
                <div><b>Vertical Code</b> — CORP/SME/HEALTH/RETAIL/MOTOR · <span className="text-edred">required</span></div>
                <div><b>Client</b> — client / policy name · optional</div>
                <div><b>Brokerage</b> — main brokerage income in INR · <span className="text-edred">required</span></div>
                <div><b>Trail</b> — trail commission (renewal) · optional</div>
                <div><b>Advisory</b> — advisory fees · optional</div>
                <div><b>Description</b> — narration · optional</div>
                <div className="mt-2 text-[11px] text-ink-subtle italic">
                  Creates one JE per row: <b>Dr</b> Trade Receivables, <b>Cr</b> Brokerage/Trail/Advisory.
                </div>
              </div>
            )}
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(mode === "sunsystem" ? SUN_TEMPLATE : REV_TEMPLATE)}`}
              download={mode === "sunsystem" ? "finmind-sunsystem-template.csv" : "finmind-revenue-template.csv"}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-bg-alt text-[11.5px] font-semibold text-ink-muted hover:border-navy hover:text-navy"
            >
              ⬇ Download Template
            </a>
          </CardBody>
        </Card>
      </div>

      {/* Success state */}
      {success && (
        <Card>
          <CardBody className="bg-edgreen-50/50">
            <div className="font-serif text-[20px] font-bold text-edgreen">{success.title}</div>
            <div className="text-[13px] text-ink-muted mt-1.5">{success.detail}</div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {success.counts.map((c, i) => (
                <div key={i} className="rounded-lg bg-white border border-edgreen/20 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{c.left}</div>
                  <div className="font-mono text-[16px] font-bold text-navy mt-1">{c.right}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-navy text-white text-[12.5px] font-semibold hover:bg-navy-800">
                View Dashboard →
              </Link>
              <Link href="/pl" className="px-4 py-2 rounded-lg border border-[var(--border)] bg-white text-[12.5px] font-semibold text-ink hover:border-navy hover:text-navy">
                P&L Statement
              </Link>
              <Link href="/vertical" className="px-4 py-2 rounded-lg border border-[var(--border)] bg-white text-[12.5px] font-semibold text-ink hover:border-navy hover:text-navy">
                Vertical Performance
              </Link>
              <Link href="/mom" className="px-4 py-2 rounded-lg border border-[var(--border)] bg-white text-[12.5px] font-semibold text-ink hover:border-navy hover:text-navy">
                MoM P&L
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Preview tables */}
      {mode === "sunsystem" && sunRows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader
                title="Parsed Rows"
                tag={{ label: `${sunRows.length} rows`, tone: sunSummary.balanced ? "green" : "red" }}
              />
              <CardBody className="p-0">
                <div className="max-h-[440px] overflow-y-auto">
                  <table className="fm-table">
                    <thead className="sticky top-0">
                      <tr>
                        <th>Account</th>
                        <th>BU</th>
                        <th className="r">Debit</th>
                        <th className="r">Credit</th>
                        <th>Category</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sunRows.slice(0, 80).map((r, i) => (
                        <tr key={i} className={!r.mapped ? "bg-edred-50/30" : ""}>
                          <td>
                            <span className="font-mono text-[11px] text-ink-subtle mr-2">{r.account_code}</span>
                            {r.account_name}
                          </td>
                          <td>
                            {r.vertical_code ? <span className="pill pill-navy">{r.vertical_code}</span> : <span className="text-ink-subtle text-[10.5px]">—</span>}
                          </td>
                          <td className="r font-mono">{r.debit ? formatCurrencyLakhs(r.debit, currency) : "—"}</td>
                          <td className="r font-mono">{r.credit ? formatCurrencyLakhs(r.credit, currency) : "—"}</td>
                          <td>
                            {r.category && (
                              <span
                                className={`pill ${
                                  r.category === "revenue"
                                    ? "pill-green"
                                    : r.category === "expense"
                                    ? "pill-red"
                                    : "pill-navy"
                                }`}
                              >
                                {r.category}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`pill ${r.mapped ? "pill-green" : "pill-red"}`}>
                              {r.mapped ? "✅ Mapped" : "⚠ Unmapped"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader
              title="📊 Reconciliation"
              tag={{ label: sunSummary.balanced ? "Balanced" : "Unbalanced", tone: sunSummary.balanced ? "green" : "red" }}
            />
            <CardBody>
              <div className="space-y-2 text-[12.5px]">
                <Row label="Total Debits" value={formatCurrencyLakhs(sunSummary.dr, currency)} tone="navy" />
                <Row label="Total Credits" value={formatCurrencyLakhs(sunSummary.cr, currency)} tone="navy" />
                <Row label="Revenue (net)" value={formatCurrencyLakhs(sunSummary.rev, currency)} tone="green" />
                <Row label="Expense (net)" value={formatCurrencyLakhs(sunSummary.exp, currency)} tone="red" />
                <Row label="EBITDA estimate" value={formatCurrencyLakhs(sunSummary.rev - sunSummary.exp, currency)} tone={sunSummary.rev - sunSummary.exp >= 0 ? "green" : "red"} />
                <Row label="Unmapped accounts" value={`${sunSummary.unmapped}`} tone={sunSummary.unmapped > 0 ? "red" : "green"} />
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {mode === "revenue" && revRows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader
                title="Parsed Rows"
                tag={{ label: `${revRows.length} rows · ${formatCurrencyLakhs(revSummary.total, currency)}`, tone: "green" }}
              />
              <CardBody className="p-0">
                <div className="max-h-[440px] overflow-y-auto">
                  <table className="fm-table">
                    <thead className="sticky top-0">
                      <tr>
                        <th>Date</th>
                        <th>Vertical</th>
                        <th>Client</th>
                        <th className="r">Brokerage</th>
                        <th className="r">Trail</th>
                        <th className="r">Advisory</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revRows.slice(0, 80).map((r, i) => (
                        <tr key={i} className={!r.mapped ? "bg-edred-50/30" : ""}>
                          <td className="text-ink-subtle">{r.date ?? "—"}</td>
                          <td>
                            <span className="pill pill-navy">{r.vertical_code}</span>
                          </td>
                          <td className="text-ink-muted">{r.client ?? "—"}</td>
                          <td className="r font-mono text-edgreen">{r.brokerage ? formatCurrencyLakhs(r.brokerage, currency) : "—"}</td>
                          <td className="r font-mono">{r.trail ? formatCurrencyLakhs(r.trail, currency) : "—"}</td>
                          <td className="r font-mono">{r.advisory ? formatCurrencyLakhs(r.advisory, currency) : "—"}</td>
                          <td>
                            <span className={`pill ${r.mapped ? "pill-green" : "pill-red"}`}>
                              {r.mapped ? "✅ Mapped" : "⚠ Unknown vertical"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="📊 Revenue Summary" tag={{ label: "By Vertical", tone: "gold" }} />
            <CardBody>
              <div className="space-y-2 text-[12.5px]">
                <Row label="Total Revenue" value={formatCurrencyLakhs(revSummary.total, currency)} tone="green" />
                <Row label="Rows / JEs" value={`${revRows.length}`} tone="navy" />
                <Row label="Unmapped" value={`${revSummary.unmapped}`} tone={revSummary.unmapped > 0 ? "red" : "green"} />
              </div>
              <div className="mt-3 border-t border-[var(--border-2)] pt-3 space-y-1.5">
                {[...revSummary.byVertical.entries()].sort((a, b) => b[1] - a[1]).map(([code, total]) => (
                  <div key={code} className="flex items-center text-[12px]">
                    <span className="pill pill-navy mr-2">{code}</span>
                    <span className="text-ink-muted">{buByCode.get(code)?.name ?? "(unknown)"}</span>
                    <span className="ml-auto font-mono font-bold text-navy">{formatCurrencyLakhs(total, currency)}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Upload history */}
      <Card>
        <CardHeader title="Upload History" tag={{ label: `${history.length} files`, tone: "navy" }} />
        <CardBody className="p-0">
          {history.length === 0 ? (
            <div className="px-5 py-6 text-sm text-ink-subtle text-center">No uploads yet.</div>
          ) : (
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Source</th>
                  <th className="r">Rows / JEs</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {history.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.filename}</td>
                    <td className="text-ink-muted">
                      {u.data_type === "sunsystem_gl"
                        ? "🏦 SunSystem GL"
                        : u.data_type === "revenue_system"
                        ? "💰 Revenue System"
                        : u.data_type.replace("_", " ")}
                    </td>
                    <td className="r font-mono">{u.row_count}</td>
                    <td>
                      <span className={`pill ${
                        u.status === "imported" ? "pill-green"
                          : u.status === "failed" ? "pill-red"
                          : "pill-gold"
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="text-ink-muted">{new Date(u.uploaded_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "navy" | "green" | "red" }) {
  return (
    <div className="flex items-center">
      <span className="text-ink-muted">{label}</span>
      <span className={`ml-auto font-mono font-bold ${tone === "green" ? "text-edgreen" : tone === "red" ? "text-edred" : "text-navy"}`}>
        {value}
      </span>
    </div>
  );
}
