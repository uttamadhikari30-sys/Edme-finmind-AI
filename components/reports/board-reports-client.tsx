"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  fetchBoardData,
  generateBoardPPT,
  generateBoardPDF,
  generateBoardExcel,
} from "@/lib/reports/board-pack";

type Format = "pptx" | "pdf" | "xlsx";

export default function BoardReportsClient({
  orgId,
  reports,
}: {
  orgId: string;
  reports: any[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<Format | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  async function logReport(title: string, format: Format) {
    await supabase.from("board_reports").insert({
      org_id: orgId,
      title,
      format,
      status: "ready",
    });
    router.refresh();
  }

  async function handle(format: Format) {
    setBusy(format);
    setErr(null);
    setLastSuccess(null);
    try {
      const data = await fetchBoardData();
      const title = `Board Pack · ${data.periodLabel}`;
      if (format === "pptx") {
        await generateBoardPPT(data);
      } else if (format === "pdf") {
        generateBoardPDF(data);
      } else {
        generateBoardExcel(data);
      }
      await logReport(title, format);
      setLastSuccess(
        format === "pptx"
          ? "PowerPoint deck downloaded."
          : format === "pdf"
          ? "PDF print dialog opened (save as PDF to download)."
          : "Excel workbook downloaded."
      );
    } catch (e: any) {
      setErr(e?.message ?? "Generation failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {err && (
        <div className="mb-3 px-4 py-2 rounded-lg bg-edred-50 border border-edred/30 text-[12px] text-edred font-medium">
          {err}
        </div>
      )}
      {lastSuccess && (
        <div className="mb-3 px-4 py-2 rounded-lg bg-edgreen-50 border border-edgreen/30 text-[12px] text-edgreen font-medium">
          ✓ {lastSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <ReportTile
          title="Board PPT"
          icon="📊"
          desc="20-slide CFO-ready deck: cover · KPIs · monthly trend chart · vertical performance table · closing. Branded with Edme + FINMIND AI."
          format="PPTX"
          tone="navy"
          loading={busy === "pptx"}
          onClick={() => handle("pptx")}
        />
        <ReportTile
          title="MIS PDF"
          icon="📄"
          desc="Print-ready monthly MIS book: executive summary · KPI grid · key insights · monthly trend · vertical performance. Auto-print dialog."
          format="PDF"
          tone="red"
          loading={busy === "pdf"}
          onClick={() => handle("pdf")}
        />
        <ReportTile
          title="MIS Excel"
          icon="📗"
          desc="Multi-sheet workbook: Summary · Insights · Monthly Trend · Vertical Performance. Open in Excel, Google Sheets, or Numbers."
          format="XLSX"
          tone="green"
          loading={busy === "xlsx"}
          onClick={() => handle("xlsx")}
        />
      </div>

      <div className="text-[11px] text-ink-subtle italic px-2 mb-4">
        All reports pull live numbers from your posted journal entries at the moment of generation —
        no stale exports. Brand colours and Edme MIS layout are baked in.
      </div>
    </>
  );
}

function ReportTile({
  title,
  icon,
  desc,
  format,
  tone,
  loading,
  onClick,
}: {
  title: string;
  icon: string;
  desc: string;
  format: string;
  tone: "navy" | "red" | "green";
  loading: boolean;
  onClick: () => void;
}) {
  const btnColors = {
    navy: "bg-navy hover:bg-navy-800",
    red: "bg-edred hover:bg-edred-600",
    green: "bg-edgreen hover:brightness-110",
  } as const;

  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden hover:shadow-card transition-all">
      <div className={`kpi-accent ${tone}`} />
      <div className="text-[36px] mb-2">{icon}</div>
      <div className="font-serif text-[16px] font-bold text-navy">{title}</div>
      <div className="text-[11.5px] text-ink-muted mt-1.5 leading-relaxed min-h-[60px]">{desc}</div>
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onClick}
          disabled={loading}
          className={`px-3.5 py-1.5 rounded-lg text-white text-[11.5px] font-semibold shadow-soft disabled:opacity-60 ${btnColors[tone]}`}
        >
          {loading ? "Generating…" : `⚡ Generate ${format}`}
        </button>
        <span className="text-[10.5px] text-ink-subtle">~ {format === "PPTX" ? "5" : format === "PDF" ? "3" : "2"} sec</span>
      </div>
    </div>
  );
}
