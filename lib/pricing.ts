import * as XLSX from "xlsx";
import { canonicalUnderlierKey, toNum, toStr, fmtDateIso } from "./utils";

export type MarketSnapshot = {
  structureLabel: string | null;
  asOf: string | null; // YYYY-MM-DD
  basketCouponMap: Record<string, number>; // key = canonicalUnderlierKey
};

/**
 * Parses the provided pricing workbook.
 * Currently supports the template shown in: "Pricing Analysis 01-12-2026.xlsx"
 * Sheet: "Broad Based Historical Pricing"
 * Row0 col1: structure label
 * Row1: header with Date + basket columns (e.g. "SPX,RTY,NDX")
 * Remaining rows: time series; latest row is used as the current market.
 */
export function parseMarketSnapshotFromXlsx(buffer: Buffer): MarketSnapshot | null {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes("broad based")) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
  if (rows.length < 5) return null;

  const structureLabel = toStr(rows?.[0]?.[1]);
  const headerRow = rows?.[1] as any[] | undefined;
  if (!headerRow || headerRow.length < 3) return null;

  // Build latest non-empty data row (by scanning from bottom)
  let latest: any[] | null = null;
  for (let i = rows.length - 1; i >= 2; i--) {
    const r = rows[i];
    if (!r) continue;
    const dateCell = r[0];
    if (dateCell instanceof Date || typeof dateCell === "string" || typeof dateCell === "number") {
      // Require at least one coupon value
      const hasVal = r.slice(1, 11).some((x) => toNum(x) !== null);
      if (hasVal) {
        latest = r;
        break;
      }
    }
  }
  if (!latest) return null;

  const dateCell = latest[0];
  const asOf = dateCell instanceof Date ? fmtDateIso(dateCell) : null;

  const basketCouponMap: Record<string, number> = {};
  for (let c = 1; c < headerRow.length; c++) {
    const colName = toStr(headerRow[c]);
    if (!colName) continue;
    if (colName.toLowerCase().includes("treasury")) continue;
    if (colName.toLowerCase() === "date") continue;

    const v = toNum(latest[c]);
    if (v === null) continue;

    // Columns are like "SPX,RTY,NDX" (no spaces)
    const key = canonicalUnderlierKey(colName.split(","));
    basketCouponMap[key] = v;
  }

  return { structureLabel, asOf, basketCouponMap };
}
