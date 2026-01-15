"use client";

import { useMemo, useState } from "react";
import { ScorePill } from "./ScorePill";

export type NoteResult = {
  id: string;
  issuer: string | null;
  cusip: string | null;
  returnType: "Income" | "Growth" | "Other";
  structureType: string | null;
  underliers: string[];
  notionalUsd: number | null;

  m2m: number | null; // as decimal (1.02 = 102)
  couponPa: number | null; // decimal (0.10 = 10%)
  marketCouponPa: number | null;

  principalCushionPct: number | null;
  couponCushionPct: number | null;

  attractivenessScore: number | null;
  swapScore: number | null;

  action: string;
  why: string;
};

function fmtPct(x: number | null, digits = 1) {
  if (x === null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}
function fmtPctAlready(x: number | null, digits = 1) {
  if (x === null || Number.isNaN(x)) return "—";
  return `${x.toFixed(digits)}%`;
}
function fmtUsd(x: number | null) {
  if (x === null || Number.isNaN(x)) return "—";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtM2M(x: number | null) {
  if (x === null || Number.isNaN(x)) return "—";
  return (x * 100).toFixed(2);
}

export function ResultsTable({ results, asOfLabel }: { results: NoteResult[]; asOfLabel: string | null }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return results;
    return results.filter((r) => {
      const hay = [
        r.issuer ?? "",
        r.cusip ?? "",
        r.returnType,
        r.structureType ?? "",
        r.underliers.join(","),
        r.action,
      ].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }, [q, results]);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {asOfLabel ? (
            <span>As-of: <span className="font-medium text-slate-800">{asOfLabel}</span></span>
          ) : (
            <span>As-of: <span className="font-medium text-slate-800">Unknown</span></span>
          )}
          <span className="ml-3 text-slate-400">|</span>
          <span className="ml-3">{filtered.length} notes</span>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search issuer, CUSIP, underlier, action..."
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm sm:w-96"
        />
      </div>

      <div className="mt-4 overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-[1200px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-3">Issuer</th>
              <th className="px-3 py-3">CUSIP</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Underliers</th>
              <th className="px-3 py-3">Notional</th>
              <th className="px-3 py-3">M2M</th>
              <th className="px-3 py-3">Coupon</th>
              <th className="px-3 py-3">Market Coupon</th>
              <th className="px-3 py-3">Principal Cushion</th>
              <th className="px-3 py-3">Attractiveness</th>
              <th className="px-3 py-3">Swap</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                <td className="px-3 py-3 whitespace-nowrap">{r.issuer ?? "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">{r.cusip ?? "—"}</td>
                <td className="px-3 py-3">{r.returnType}</td>
                <td className="px-3 py-3">{r.underliers.length ? r.underliers.join(", ") : "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{fmtUsd(r.notionalUsd)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{fmtM2M(r.m2m)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{fmtPct(r.couponPa)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{fmtPct(r.marketCouponPa)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{fmtPctAlready(r.principalCushionPct)}</td>
                <td className="px-3 py-3"><ScorePill value={r.attractivenessScore} /></td>
                <td className="px-3 py-3"><ScorePill value={r.swapScore} /></td>
                <td className="px-3 py-3">
                  <div className="font-medium">{r.action}</div>
                  <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">{r.why}</div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={12}>
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-medium">Scoring notes (quick)</summary>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-medium">Attractiveness</span>: favor notes whose terms look better than the
            current market (when a match exists), and with more distance to the principal barrier.
          </p>
          <p>
            <span className="font-medium">Swap</span>: favor notes where current market terms are materially
            better, the note is near par (lower unwind pain), and cushion is reasonable. A default transaction
            friction of 1 point is applied.
          </p>
        </div>
      </details>
    </div>
  );
}
