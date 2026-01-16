import * as XLSX from "xlsx";
import { canonicalUnderlierKey, toNum, toStr, fmtDateIso } from "./utils";

export type MarketSnapshot = {
  structureLabel: string | null;
  asOf: string | null; // YYYY-MM-DD
  basketCouponMap: Record<string, number>; // key = canonicalUnderlierKey, value = coupon (decimal)
  basketParticipationMap: Record<string, number>; // key = canonicalUnderlierKey, value = participation (e.g., 1.5 = 150%)
};

/**
 * Parses the provided pricing workbook.
 * Supports:
 * - Sheet: "Broad Based Historical Pricing" for income note coupons
 * - Sheet: "Growth Pricing" for participation rates (optional)
 *
 * Format for income (Broad Based Historical Pricing):
 *   Row0 col1: structure label
 *   Row1: header with Date + basket columns (e.g. "SPX,RTY,NDX")
 *   Remaining rows: time series; latest row is used as the current market.
 *
 * Format for growth (Growth Pricing):
 *   Row0: Header with basket columns
 *   Row1: Participation rates (e.g., 1.5 for 150%)
 */
export function parseMarketSnapshotFromXlsx(buffer: Buffer): MarketSnapshot | null {
  const wb = XLSX.read(buffer, { type: "buffer" });

  // Parse income pricing (coupons)
  const incomeSheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes("broad based")) ?? wb.SheetNames[0];
  const incomeWs = wb.Sheets[incomeSheetName];
  if (!incomeWs) return null;

  const rows = XLSX.utils.sheet_to_json(incomeWs, { header: 1, raw: true }) as any[][];
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

  // Parse growth pricing (participation rates) if sheet exists
  const basketParticipationMap: Record<string, number> = {};
  const growthSheetName = wb.SheetNames.find((s) =>
    s.toLowerCase().includes("growth") || s.toLowerCase().includes("participation")
  );

  if (growthSheetName) {
    const growthWs = wb.Sheets[growthSheetName];
    if (growthWs) {
      const growthRows = XLSX.utils.sheet_to_json(growthWs, { header: 1, raw: true }) as any[][];
      if (growthRows.length >= 2) {
        const growthHeader = growthRows[0] as any[];
        const growthData = growthRows[1] as any[];

        for (let c = 0; c < growthHeader.length; c++) {
          const colName = toStr(growthHeader[c]);
          if (!colName) continue;
          if (colName.toLowerCase() === "date" || colName.toLowerCase().includes("label")) continue;

          const v = toNum(growthData[c]);
          if (v === null) continue;

          const key = canonicalUnderlierKey(colName.split(","));
          // Normalize: if value is > 5, assume it's a percentage (e.g., 150 = 150%)
          basketParticipationMap[key] = v > 5 ? v / 100 : v;
        }
      }
    }
  }

  return { structureLabel, asOf, basketCouponMap, basketParticipationMap };
}
