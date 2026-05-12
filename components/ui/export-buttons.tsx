"use client";

import { useRef } from "react";
import { exportTableToExcel, exportTableToCSV, exportTableToPDF } from "@/lib/export";

/**
 * Drop-in export button bar. Wraps any children in a div with a ref.
 * Finds the first <table> inside the wrapped content and exports it.
 */
export default function ExportButtons({
  reportName,
  containerRef,
}: {
  reportName: string;
  containerRef?: React.RefObject<HTMLElement>;
}) {
  const internalRef = useRef<HTMLDivElement>(null);

  function getTable(): HTMLTableElement | null {
    const root = containerRef?.current ?? internalRef.current;
    if (!root) return document.querySelector("table");
    return root.querySelector("table");
  }

  return (
    <div ref={internalRef} className="flex items-center gap-1.5">
      <button
        onClick={() => exportTableToExcel(reportName, getTable())}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[11.5px] font-semibold text-ink-muted hover:border-edgreen hover:text-edgreen"
      >
        📊 Excel
      </button>
      <button
        onClick={() => exportTableToCSV(reportName, getTable())}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[11.5px] font-semibold text-ink-muted hover:border-navy hover:text-navy"
      >
        📄 CSV
      </button>
      <button
        onClick={() => exportTableToPDF(reportName, getTable())}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[11.5px] font-semibold text-ink-muted hover:border-edred hover:text-edred"
      >
        📑 PDF
      </button>
    </div>
  );
}
