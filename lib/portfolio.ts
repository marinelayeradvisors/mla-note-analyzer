import * as XLSX from "xlsx";
import { headerLooksLikePII, valueLooksLikePII } from "./pii";
import { canonicalUnderlierKey, parseFreqToMonths, safeIdFromRow, toNum, toStr } from "./utils";

export type NormalizedNote = {
  id: string;
  issuer: string | null;
  cusip: string | null;
  returnType: "Income" | "Growth" | "Other";
  structureType: string | null;
  underliers: string[];

  notionalUsd: number | null;
  m2m: number | null;
  intrinsic: number | null;

  couponPa: number | null;
  timeToMaturityMonths: number | null;
  issueDate: Date | null;
  maturityDate: Date | null;

  callObsFreq: string | null;
  numNoCallPeriods: number | null;
  couponBarrierPct: number | null;
  principalBarrierPct: number | null;

  activeUnderlierSymbol: string | null;
  activeUnderlierSpot: number | null;
  activeUnderlierPrincipalBarrier: number | null;
  activeUnderlierCouponBarrier: number | null;
};

function detectHeaderRow(rows: any[][]): number {
  const targets = ["Structure Type", "Return Type", "Cusip", "Issuer Abbr"];
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const r = rows[i] ?? [];
    const asStrings = r.map((x) => (x === null || x === undefined ? "" : String(x).trim()));
    const hit = targets.every((t) => asStrings.includes(t));
    if (hit) return i;
  }
  // default: first row
  return 0;
}

export function parsePortfolioFromXlsx(buffer: Buffer): { notes: NormalizedNote[]; droppedPiiColumns: string[] } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
  const headerIdx = detectHeaderRow(rows);
  const headersRaw = (rows[headerIdx] ?? []).map((h) => String(h ?? "").trim());
  const dataRows = rows.slice(headerIdx + 1);

  // PII column dropping
  const piiCols: boolean[] = headersRaw.map((h) => headerLooksLikePII(h));
  const droppedPiiColumns = headersRaw.filter((h, i) => piiCols[i]);

  // Convert rows to objects
  const objects: Record<string, any>[] = [];
  for (const r of dataRows) {
    if (!r || r.every((x) => x === null || x === undefined || String(x).trim() === "")) continue;
    const obj: Record<string, any> = {};
    headersRaw.forEach((h, i) => {
      if (!h) return;
      if (piiCols[i]) return;
      obj[h] = r[i];
    });

    // Extra safety: if any value looks like PII, drop that key
    for (const k of Object.keys(obj)) {
      if (valueLooksLikePII(obj[k])) delete obj[k];
    }

    objects.push(obj);
  }

  const notes: NormalizedNote[] = objects.map((o, idx) => {
    const returnTypeRaw = toStr(o["Return Type"]) ?? "Other";
    const returnType = (returnTypeRaw === "Income" || returnTypeRaw === "Growth") ? returnTypeRaw : "Other";

    const cusip = toStr(o["Cusip"]);
    const issuer = toStr(o["Issuer Abbr"]) ?? toStr(o["Issuer"]);

    const underliers = (() => {
      const list = toStr(o["List Of Underliers"]);
      if (list) return list.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      const syms: string[] = [];
      for (let i = 1; i <= 4; i++) {
        const s = toStr(o[`Underlier ${i} Symbol`]);
        if (s) syms.push(s.toUpperCase());
      }
      return syms;
    })();

    // Active underlier
    let activeI: number | null = null;
    for (let i = 1; i <= 4; i++) {
      const val = o[`Underlier ${i} Is Active`];
      if (val === true || val === 1 || String(val).toLowerCase() === "true" || String(val).toLowerCase() === "yes") {
        activeI = i;
        break;
      }
    }
    if (activeI === null) activeI = 1;

    const activeUnderlierSymbol = toStr(o[`Underlier ${activeI} Symbol`]) ?? (underliers[0] ?? null);
    const activeUnderlierSpot = toNum(o[`Underlier ${activeI} Current Price`]);
    const activeUnderlierPrincipalBarrier = toNum(o[`Underlier ${activeI} Protection Barrier Level`]);
    const activeUnderlierCouponBarrier = toNum(o[`Underlier ${activeI} Coupon Barrier Level`]);

    // Parse dates
    const issueDate = o["Issue Date"] instanceof Date ? o["Issue Date"] : null;
    const maturityDate = o["Maturity Date"] instanceof Date ? o["Maturity Date"] : null;

    // Barriers in percent terms (e.g. 0.7)
    const couponBarrierPct = toNum(o["Coupon Barrier"]) ?? toNum(o["Coupon Barrier Level Percent"]) ?? null;
    const principalBarrierPct = toNum(o["Protection Level Percent"]) ?? null;

    return {
      id: safeIdFromRow(idx, cusip),
      issuer,
      cusip,
      returnType,
      structureType: toStr(o["Structure Type"]),
      underliers,

      notionalUsd: toNum(o["Current Notional (USD)"]) ?? toNum(o["Notional (USD)"]) ?? null,
      m2m: toNum(o["Mark To Market Price"]) ?? null,
      intrinsic: toNum(o["Intrinsic Value"]) ?? null,

      couponPa: toNum(o["Coupon Rate Per Annum Percent"]) ?? toNum(o["Coupon Rate Percent"]) ?? null,
      timeToMaturityMonths: toNum(o["Time to Maturity (Months)"]) ?? null,
      issueDate,
      maturityDate,

      callObsFreq: toStr(o["Call Observation Freq"]) ?? toStr(o["Call Barrier Observation Freq"]) ?? null,
      numNoCallPeriods: toNum(o["Num No Call Periods"]),
      couponBarrierPct,
      principalBarrierPct,

      activeUnderlierSymbol,
      activeUnderlierSpot,
      activeUnderlierPrincipalBarrier,
      activeUnderlierCouponBarrier,
    };
  });

  return { notes, droppedPiiColumns };
}

export function computeNoCallMonths(note: NormalizedNote): number | null {
  if (note.numNoCallPeriods === null) return null;
  const m = parseFreqToMonths(note.callObsFreq);
  if (m === null) return null;
  return note.numNoCallPeriods * m;
}

export function computeOriginalTenorMonths(note: NormalizedNote): number | null {
  if (!note.issueDate || !note.maturityDate) return null;
  const days = (note.maturityDate.getTime() - note.issueDate.getTime()) / (1000 * 60 * 60 * 24);
  const months = days / 30.4375;
  return Math.round(months);
}

export function canonicalBasketKey(note: NormalizedNote): string {
  return canonicalUnderlierKey(note.underliers);
}
