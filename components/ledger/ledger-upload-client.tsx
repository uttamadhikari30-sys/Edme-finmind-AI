"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatINRUnit } from "@/lib/utils";

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

type ParsedRow = {
  code: string;
  name: string;
  debit: number;
  credit: number;
  net: number;
  category: string;
  mapped: boolean;
  account_id?: string;
};

export default function LedgerUploadClient({
  orgId,
  accounts,
  periods,
  history,
}: {
  orgId: string;
  accounts: Account[];
  periods: Period[];
  history: Upload[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [dataType, setDataType] = useState("trial_balance");
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function parseCSV(text: string): ParsedRow[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const sep = text.includes("\t") ? "\t" : ",";
    const dataLines = lines.slice(1); // skip header

    return dataLines
      .map((line): ParsedRow | null => {
        const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cells.length < 2) return null;
        const code = cells[0]?.trim() ?? "";
        const name = cells[1]?.trim() ?? "";
        const debit = parseFloat(cells[2]?.replace(/[,]/g, "") || "0") || 0;
        const credit = parseFloat(cells[3]?.replace(/[,]/g, "") || "0") || 0;
        const net = debit - credit;

        const matched = accounts.find(
          (a) => a.account_code === code || a.account_name.toLowerCase() === name.toLowerCase()
        );
        return {
          code,
          name,
          debit,
          credit,
          net,
          category: matched?.account_type ?? "unmapped",
          mapped: !!matched,
          account_id: matched?.id,
        };
      })
      .filter((r): r is ParsedRow => r !== null && (r.debit > 0 || r.credit > 0));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    setSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const text = await file.text();
    try {
      const parsed = parseCSV(text);
      setRows(parsed);
    } catch (e: any) {
      setErr(`Failed to parse: ${e.message}`);
    }
  }

  async function process() {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    const { error } = await supabase.from("ledger_uploads").insert({
      org_id: orgId,
      filename: filename ?? "uploaded.csv",
      data_type: dataType,
      row_count: rows.length,
      status: "mapped",
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSuccess(
      `${rows.filter((r) => r.mapped).length}/${rows.length} rows mapped successfully. Upload logged.`
    );
    router.refresh();
  }

  const summary = {
    revenue: rows.filter((r) => r.category === "revenue").reduce((s, r) => s + r.net, 0),
    expense: rows.filter((r) => r.category === "expense").reduce((s, r) => s + r.net, 0),
    asset: rows.filter((r) => r.category === "asset").reduce((s, r) => s + r.net, 0),
    liability: rows.filter((r) => r.category === "liability").reduce((s, r) => s + r.net, 0),
    unmapped: rows.filter((r) => !r.mapped).length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Upload File" tag={{ label: "CSV / TSV / Excel", tone: "navy" }} />
          <CardBody>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">
                  Data Type
                </label>
                <select
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
                >
                  <option value="trial_balance">Trial Balance</option>
                  <option value="gl_export">GL Export (Journal Entries)</option>
                  <option value="budget">Budget / AOP</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">
                  Period
                </label>
                <select
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.period_label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center justify-center w-full px-4 py-8 rounded-lg border-2 border-dashed border-navy/30 bg-navy-50/30 text-navy font-semibold text-sm cursor-pointer hover:bg-navy-50/60 transition">
                📁 {filename ? filename : "Browse Files"}
                <input
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls,.txt"
                  onChange={onFile}
                  className="hidden"
                />
              </label>
              {err && (
                <div className="text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}
              {success && (
                <div className="text-[11.5px] font-medium text-edgreen bg-edgreen-50 border border-edgreen/20 rounded-lg px-3 py-2">
                  {success}
                </div>
              )}
              <button
                onClick={process}
                disabled={busy || rows.length === 0}
                className="w-full rounded-lg bg-edgreen text-white font-semibold text-sm py-3 hover:brightness-110 disabled:opacity-60 shadow-soft"
              >
                {busy ? "Processing…" : "✅ Process & Map to FINMIND"}
              </button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="📋 Expected Format" tag={{ label: "Spec", tone: "navy" }} />
          <CardBody>
            <div className="text-[12px] text-ink-muted space-y-1.5">
              <div><b>Column A:</b> Account Code</div>
              <div><b>Column B:</b> Account Name</div>
              <div><b>Column C:</b> Debit Amount</div>
              <div><b>Column D:</b> Credit Amount</div>
              <div><b>Column E:</b> Net Balance <span className="text-ink-subtle">(optional)</span></div>
              <div><b>Column F:</b> Cost Centre / Vertical <span className="text-ink-subtle">(optional)</span></div>
            </div>
            <a
              href="data:text/csv,Account%20Code,Account%20Name,Debit,Credit,Net,Vertical%0A4000,Brokerage%20Income,0,1842000,1842000,Corporate%0A5000,Salaries,682000,0,-682000,%0A"
              download="finmind-template.csv"
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-bg-alt text-[11.5px] font-semibold text-ink-muted hover:border-navy hover:text-navy"
            >
              ⬇ Download Template
            </a>
          </CardBody>
        </Card>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader
                title="Parsed Rows"
                tag={{ label: `${rows.length} rows`, tone: "navy" }}
              />
              <CardBody className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="fm-table">
                    <thead className="sticky top-0">
                      <tr>
                        <th>Account</th>
                        <th className="r">Debit</th>
                        <th className="r">Credit</th>
                        <th className="r">Net</th>
                        <th>Category</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className={!r.mapped ? "bg-edred-50/30" : ""}>
                          <td className="font-semibold">
                            <span className="font-mono text-[11px] text-ink-subtle mr-2">{r.code}</span>
                            {r.name}
                          </td>
                          <td className="r font-mono">{r.debit ? formatINRUnit(r.debit) : "—"}</td>
                          <td className="r font-mono">{r.credit ? formatINRUnit(r.credit) : "—"}</td>
                          <td className={`r font-mono font-bold ${r.net >= 0 ? "text-edgreen" : "text-edred"}`}>
                            {formatINRUnit(r.net)}
                          </td>
                          <td>
                            <span
                              className={`pill ${
                                r.category === "revenue"
                                  ? "pill-green"
                                  : r.category === "expense"
                                  ? "pill-red"
                                  : r.category === "unmapped"
                                  ? "pill-red"
                                  : "pill-navy"
                              }`}
                            >
                              {r.category}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`pill ${r.mapped ? "pill-green" : "pill-red"}`}
                            >
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
              title="📊 Reconciliation Summary"
              tag={{ label: summary.unmapped > 0 ? `${summary.unmapped} unmapped` : "Clean", tone: summary.unmapped > 0 ? "red" : "green" }}
            />
            <CardBody className="p-0">
              <table className="fm-table">
                <tbody>
                  <SumRow label="Revenue" value={summary.revenue} tone="green" />
                  <SumRow label="Expense" value={summary.expense} tone="red" />
                  <SumRow label="Assets" value={summary.asset} tone="navy" />
                  <SumRow label="Liabilities" value={summary.liability} tone="navy" />
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title="Upload History" tag={{ label: `${history.length} files`, tone: "navy" }} />
        <CardBody className="p-0">
          {history.length === 0 ? (
            <div className="px-5 py-6 text-sm text-ink-subtle text-center">
              No uploads yet.
            </div>
          ) : (
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Type</th>
                  <th className="r">Rows</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {history.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.filename}</td>
                    <td className="text-ink-muted">{u.data_type.replace("_", " ")}</td>
                    <td className="r font-mono">{u.row_count}</td>
                    <td>
                      <span className={`pill ${u.status === "imported" || u.status === "mapped" ? "pill-green" : "pill-gold"}`}>
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

function SumRow({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "navy" }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="r font-mono">{formatINRUnit(value)}</td>
      <td>
        <span
          className={`pill ${
            value >= 0 && tone === "green"
              ? "pill-green"
              : tone === "red"
              ? "pill-red"
              : "pill-navy"
          }`}
        >
          ✅
        </span>
      </td>
    </tr>
  );
}
