"use client";

/**
 * Lightweight export utilities — work without external libs by generating
 * Excel/CSV/PDF from any HTML table element. No npm packages required.
 *
 * Excel: uses HTML Table → Excel-compatible XML markup, downloaded as .xls
 * CSV:   plain comma-separated, properly quoted
 * PDF:   uses window.print() with a printable styled wrapper
 */

function tableToRows(table: HTMLTableElement): string[][] {
  const rows: string[][] = [];
  table.querySelectorAll("tr").forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll("th, td").forEach((cell) => {
      const text = (cell as HTMLElement).innerText.trim().replace(/\s+/g, " ");
      cells.push(text);
    });
    if (cells.length) rows.push(cells);
  });
  return rows;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportTableToCSV(reportName: string, table: HTMLTableElement | null) {
  if (!table) {
    alert("No table found to export on this page.");
    return;
  }
  const rows = tableToRows(table);
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(",")
    )
    .join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `${reportName}-${stamp}.csv`, "text/csv;charset=utf-8");
}

export function exportTableToExcel(reportName: string, table: HTMLTableElement | null) {
  if (!table) {
    alert("No table found to export on this page.");
    return;
  }
  const rows = tableToRows(table);
  // Build minimal Excel XML (SpreadsheetML) — opens cleanly in Excel/Google Sheets/Numbers
  const xmlRows = rows
    .map(
      (r) =>
        `<Row>${r
          .map((cell) => {
            const num = cell.replace(/[₹$£,\sLCrM]/g, "");
            const isNum = num !== "" && !isNaN(Number(num)) && /^-?\d/.test(num);
            const type = isNum ? "Number" : "String";
            const value = isNum ? Number(num) : cell.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<Cell><Data ss:Type="${type}">${value}</Data></Cell>`;
          })
          .join("")}</Row>`
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${reportName.slice(0, 30)}">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`;
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(xml, `${reportName}-${stamp}.xls`, "application/vnd.ms-excel");
}

export function exportTableToPDF(reportName: string, table: HTMLTableElement | null) {
  if (!table) {
    alert("No table found to export on this page.");
    return;
  }
  const tableHtml = table.outerHTML;
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${reportName} — FINMIND AI</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #11192d; }
  h1 { font-family: 'Cormorant Garamond', Georgia, serif; color: #1C3687; margin: 0 0 4px; }
  .sub { color: #7888aa; font-size: 11px; margin-bottom: 20px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .mark { width: 4px; height: 28px; background: linear-gradient(180deg, #1C3687, #ED1B2F); border-radius: 2px; }
  table { border-collapse: collapse; width: 100%; font-size: 10px; }
  th { background: #1C3687; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; }
  td { padding: 5px 8px; border-bottom: 1px solid rgba(0,0,0,0.05); }
  tr:nth-child(even) td { background: rgba(28,54,135,0.02); }
  .footer { margin-top: 16px; font-size: 9px; color: #7888aa; }
</style>
</head>
<body>
  <div class="brand">
    <div class="mark"></div>
    <div>
      <h1>${reportName}</h1>
      <div class="sub">FINMIND AI · Edme Insurance Brokers Limited · Generated ${today}</div>
    </div>
  </div>
  ${tableHtml}
  <div class="footer">Confidential · For internal use only</div>
  <script>window.addEventListener('load', () => { setTimeout(() => window.print(), 300); });</script>
</body>
</html>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    alert("Pop-up blocked — allow pop-ups for this site to export PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
