"use client";

import { useMemo, useState } from "react";
import { ScorePill } from "./ScorePill";
import { NoteDetailModal } from "./NoteDetailModal";

export type ScoreBreakdown = {
  // Attractiveness components
  couponEdge: number | null;
  couponEdgeScore: number | null;
  principalCushionScore: number | null;
  richnessScore: number | null;

  // Swap components
  netBenefitPts: number | null;
  netBenefitScore: number | null;
  m2mScore: number | null;
  annualBenefit: number | null;
  unwindCost: number | null;
  horizonMonths: number | null;

  // Context
  hasMarketMatch: boolean;
  frictionPointsUsed: number;
};

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
  breakdown: ScoreBreakdown;
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
  const [selectedNote, setSelectedNote] = useState<NoteResult | null>(null);

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
              <th className="px-3 py-3" title="High = HOLD. Your note has better terms than current market.">
                <span className="border-b border-dashed border-slate-400 cursor-help">Attractiveness</span>
              </th>
              <th className="px-3 py-3" title="High = CONSIDER SELLING. Current market offers better terms.">
                <span className="border-b border-dashed border-slate-400 cursor-help">Swap</span>
              </th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b last:border-b-0 hover:bg-slate-50/50 cursor-pointer"
                onClick={() => setSelectedNote(r)}
              >
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

      {/* Score Explanation - Always visible */}
      <div className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Understanding the Scores</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <h4 className="font-semibold text-emerald-900">Attractiveness Score</h4>
            <p className="mt-1 text-emerald-800">
              <strong>High score = HOLD</strong> — Your note has better terms than what&apos;s available in the market today.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-emerald-700">
              <li>• Compares your coupon rate vs. current market rate</li>
              <li>• Considers distance to principal barrier (cushion)</li>
              <li>• Example: You locked in 15% when market now pays 10% = very attractive</li>
            </ul>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <h4 className="font-semibold text-amber-900">Swap Score</h4>
            <p className="mt-1 text-amber-800">
              <strong>High score = CONSIDER SELLING</strong> — The market now offers better terms than your note.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-700">
              <li>• Calculates if you&apos;d benefit from switching to a new note</li>
              <li>• Accounts for transaction costs (friction)</li>
              <li>• Example: Your note pays 8% but market now pays 12% = high swap score</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          <strong>Tip:</strong> Click any row to see a detailed breakdown of how the scores were calculated for that specific note.
        </p>
      </div>

      {selectedNote && (
        <NoteDetailModal note={selectedNote} onClose={() => setSelectedNote(null)} />
      )}
    </div>
  );
}
