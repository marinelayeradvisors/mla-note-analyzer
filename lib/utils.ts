export function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

export function toNum(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    const s = x.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toStr(x: unknown): string | null {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  return s ? s : null;
}

export function parseFreqToMonths(freq: string | null): number | null {
  if (!freq) return null;
  const f = freq.toLowerCase();
  if (f.includes("monthly")) return 1;
  if (f.includes("quarter")) return 3;
  if (f.includes("semi")) return 6;
  if (f.includes("annual")) return 12;
  return null;
}

export function canonicalUnderlierKey(symbols: string[]): string {
  const cleaned = symbols
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .map((s) => s.replaceAll(" ", ""))
    .sort();
  return cleaned.join(",");
}

export function safeIdFromRow(i: number, cusip: string | null) {
  return `${i}-${cusip ?? "NA"}`;
}

export function sigmoid01(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export function fmtDateIso(d: Date) {
  return d.toISOString().slice(0, 10);
}
