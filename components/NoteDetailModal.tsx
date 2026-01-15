"use client";

import type { NoteResult } from "./ResultsTable";

function fmtPct(x: number | null, digits = 1) {
  if (x === null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

function fmtBps(x: number | null) {
  if (x === null || Number.isNaN(x)) return "—";
  const bps = Math.round(x * 10000);
  return `${bps > 0 ? "+" : ""}${bps} bps`;
}

function fmtPts(x: number | null, digits = 2) {
  if (x === null || Number.isNaN(x)) return "—";
  const pts = x * 100;
  return `${pts > 0 ? "+" : ""}${pts.toFixed(digits)} pts`;
}

function fmtScore(x: number | null) {
  if (x === null || Number.isNaN(x)) return "—";
  return Math.round(x).toString();
}

function ScoreBar({ value, label, color }: { value: number | null; label: string; color: string }) {
  const v = value !== null ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 text-xs text-slate-600">{label}</span>
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="w-8 text-xs text-right font-mono">{fmtScore(value)}</span>
    </div>
  );
}

export function NoteDetailModal({ note, onClose }: { note: NoteResult; onClose: () => void }) {
  const b = note.breakdown;
  const hasMatch = b.hasMarketMatch;

  const attractivenessInterpretation = note.attractivenessScore !== null
    ? note.attractivenessScore >= 75
      ? { text: "This note has excellent terms compared to current market. Hold it.", color: "text-emerald-700", bg: "bg-emerald-50" }
      : note.attractivenessScore >= 50
        ? { text: "Terms are slightly better than or similar to current market.", color: "text-sky-700", bg: "bg-sky-50" }
        : { text: "Current market may offer better terms than this note.", color: "text-amber-700", bg: "bg-amber-50" }
    : null;

  const swapInterpretation = note.swapScore !== null
    ? note.swapScore >= 80
      ? { text: "Strong signal to consider swapping. Current market terms are materially better.", color: "text-amber-700", bg: "bg-amber-50", action: "Consider selling and reinvesting" }
      : note.swapScore >= 50
        ? { text: "Marginal case. Swapping may or may not be beneficial.", color: "text-slate-700", bg: "bg-slate-50", action: "No strong action needed" }
        : { text: "No benefit from swapping. Your current terms are good.", color: "text-emerald-700", bg: "bg-emerald-50", action: "Hold position" }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{note.issuer ?? "Unknown Issuer"}</h2>
            <p className="text-sm text-slate-500">
              {note.cusip ?? "No CUSIP"} · {note.underliers.join(", ") || "No underliers"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Action Summary */}
          <div className={`rounded-xl p-4 ${
            note.action === "Risk watch" ? "bg-rose-50 border border-rose-200" :
            note.action === "Consider swap" ? "bg-amber-50 border border-amber-200" :
            note.action === "Keep (attractive)" ? "bg-emerald-50 border border-emerald-200" :
            "bg-slate-50 border border-slate-200"
          }`}>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-semibold ${
                note.action === "Risk watch" ? "text-rose-800" :
                note.action === "Consider swap" ? "text-amber-800" :
                note.action === "Keep (attractive)" ? "text-emerald-800" :
                "text-slate-800"
              }`}>
                {note.action}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{note.why}</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Your Coupon</div>
              <div className="mt-1 text-lg font-semibold">{fmtPct(note.couponPa)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Market Coupon</div>
              <div className="mt-1 text-lg font-semibold">
                {hasMatch ? fmtPct(note.marketCouponPa) : <span className="text-slate-400">No match</span>}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide">M2M Price</div>
              <div className="mt-1 text-lg font-semibold">{note.m2m !== null ? (note.m2m * 100).toFixed(2) : "—"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Principal Cushion</div>
              <div className="mt-1 text-lg font-semibold">{note.principalCushionPct?.toFixed(1) ?? "—"}%</div>
            </div>
          </div>

          {/* Attractiveness Score Breakdown */}
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Attractiveness Score</h3>
              <span className={`text-2xl font-bold ${
                (note.attractivenessScore ?? 0) >= 75 ? "text-emerald-600" :
                (note.attractivenessScore ?? 0) >= 50 ? "text-sky-600" :
                "text-amber-600"
              }`}>
                {fmtScore(note.attractivenessScore)}
              </span>
            </div>

            {attractivenessInterpretation && (
              <p className={`mt-2 text-sm ${attractivenessInterpretation.color} ${attractivenessInterpretation.bg} rounded-lg p-2`}>
                {attractivenessInterpretation.text}
              </p>
            )}

            <div className="mt-4 space-y-2">
              {hasMatch ? (
                <>
                  <div className="text-xs text-slate-500 mb-2">
                    Formula: 70% Coupon Edge + 30% Principal Cushion
                  </div>
                  <ScoreBar value={b.couponEdgeScore} label="Coupon Edge (70%)" color="bg-emerald-500" />
                  <div className="pl-[8.5rem] text-xs text-slate-500">
                    Your coupon is {fmtBps(b.couponEdge)} vs. market
                  </div>
                  <ScoreBar value={b.principalCushionScore} label="Cushion (30%)" color="bg-sky-500" />
                </>
              ) : (
                <>
                  <div className="text-xs text-slate-500 mb-2">
                    No direct market match found. Using proxy: 60% Richness + 40% Cushion
                  </div>
                  <ScoreBar value={b.richnessScore} label="Richness (60%)" color="bg-purple-500" />
                  <div className="pl-[8.5rem] text-xs text-slate-500">
                    Based on M2M vs. intrinsic value
                  </div>
                  <ScoreBar value={b.principalCushionScore} label="Cushion (40%)" color="bg-sky-500" />
                </>
              )}
            </div>
          </div>

          {/* Swap Score Breakdown */}
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Swap Score</h3>
              <span className={`text-2xl font-bold ${
                (note.swapScore ?? 0) >= 80 ? "text-amber-600" :
                (note.swapScore ?? 0) >= 50 ? "text-slate-600" :
                "text-emerald-600"
              }`}>
                {fmtScore(note.swapScore)}
              </span>
            </div>

            {swapInterpretation && (
              <div className={`mt-2 ${swapInterpretation.bg} rounded-lg p-2`}>
                <p className={`text-sm ${swapInterpretation.color}`}>
                  {swapInterpretation.text}
                </p>
                <p className={`mt-1 text-xs font-medium ${swapInterpretation.color}`}>
                  Recommended: {swapInterpretation.action}
                </p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {hasMatch ? (
                <>
                  <div className="text-xs text-slate-500 mb-2">
                    Formula: 65% Net Benefit + 20% M2M + 15% Cushion
                  </div>
                  <ScoreBar value={b.netBenefitScore} label="Net Benefit (65%)" color="bg-amber-500" />
                  <div className="pl-[8.5rem] text-xs text-slate-500 space-y-0.5">
                    <div>Annual benefit: {fmtBps(b.annualBenefit)} (market - your coupon)</div>
                    <div>Unwind cost: {fmtPts(b.unwindCost)}</div>
                    <div>Horizon: {b.horizonMonths ?? "—"} months</div>
                    <div>Net benefit: {fmtPts(b.netBenefitPts)}</div>
                  </div>
                  <ScoreBar value={b.m2mScore} label="M2M (20%)" color="bg-sky-500" />
                  <div className="pl-[8.5rem] text-xs text-slate-500">
                    Closer to par = easier to unwind
                  </div>
                  <ScoreBar value={b.principalCushionScore} label="Cushion (15%)" color="bg-slate-400" />
                </>
              ) : (
                <>
                  <div className="text-xs text-slate-500 mb-2">
                    No direct market match. Using proxy: 50% (inverse) Richness + 30% M2M + 20% Cushion
                  </div>
                  <ScoreBar value={b.richnessScore !== null ? 100 - b.richnessScore : null} label="Inv. Richness (50%)" color="bg-amber-500" />
                  <div className="pl-[8.5rem] text-xs text-slate-500">
                    Lower richness = more reason to swap
                  </div>
                  <ScoreBar value={b.m2mScore} label="M2M (30%)" color="bg-sky-500" />
                  <ScoreBar value={b.principalCushionScore} label="Cushion (20%)" color="bg-slate-400" />
                </>
              )}
            </div>
          </div>

          {/* Friction Info */}
          <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            <strong>Transaction friction applied:</strong> {b.frictionPointsUsed.toFixed(1)} points
            <span className="block mt-1">
              This represents the estimated cost to sell the note (bid/offer spread + execution costs).
              1 point = 1% of notional.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
