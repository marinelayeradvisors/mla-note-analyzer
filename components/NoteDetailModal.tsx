"use client";

import type { NoteResult } from "./ResultsTable";

function fmtPct(x: number | null, digits = 1) {
  if (x === null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

function fmtPrice(x: number | null) {
  if (x === null || Number.isNaN(x)) return "—";
  return (x * 100).toFixed(2);
}

function fmtBps(x: number | null) {
  if (x === null) return "—";
  return `${x > 0 ? "+" : ""}${x} bps`;
}

function fmtPts(x: number | null) {
  if (x === null || Number.isNaN(x)) return "—";
  const pts = x * 100;
  return `${pts >= 0 ? "+" : ""}${pts.toFixed(2)} pts`;
}

function InfoRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
      <div>
        <span className="text-slate-600">{label}</span>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function NoteDetailModal({ note, onClose }: { note: NoteResult; onClose: () => void }) {
  const d = note.swapDetails;
  const isIncome = note.returnType === "Income";
  const isGrowth = note.returnType === "Growth";
  const hasMarketData = d.marketCoupon !== null;

  // Determine badge color and text
  const getBadgeStyle = () => {
    if (note.isNearBarrier) return { bg: "bg-rose-100", text: "text-rose-800", label: "RISK" };
    if (note.swapRecommendation === "yes") return { bg: "bg-amber-100", text: "text-amber-800", label: "REVIEW" };
    if (note.swapRecommendation === "no") return { bg: "bg-emerald-100", text: "text-emerald-800", label: "HOLD" };
    return { bg: "bg-slate-100", text: "text-slate-600", label: "N/A" };
  };

  const badge = getBadgeStyle();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{note.issuer ?? "Unknown Issuer"}</h2>
              <p className="text-sm text-slate-500">
                {note.cusip ?? "No CUSIP"} · {note.returnType} · {note.underliers.join(", ") || "No underliers"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Recommendation Banner */}
          <div className={`rounded-xl p-4 ${badge.bg}`}>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold ${badge.text}`}>{badge.label}</span>
              <span className={`text-sm ${badge.text}`}>
                {note.isNearBarrier ? "Risk Warning" :
                 note.swapRecommendation === "yes" ? "Consider Swapping" :
                 note.swapRecommendation === "no" ? "Hold Position" : "Cannot Evaluate"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{note.swapReason}</p>
          </div>

          {/* Key Metrics */}
          <div className="rounded-xl border p-4">
            <h3 className="font-semibold mb-3">Key Metrics</h3>
            <div className="space-y-0">
              <InfoRow
                label="M2M Price"
                value={fmtPrice(d.m2m)}
                hint="Current market price (100 = par)"
              />
              <InfoRow
                label="Cushion"
                value={d.principalCushionPct !== null ? `${d.principalCushionPct.toFixed(1)}%` : "—"}
                hint="How far underlier can fall before hitting barrier"
              />
              {isIncome && (
                <>
                  <InfoRow
                    label="Your Coupon"
                    value={fmtPct(d.yourCoupon)}
                  />
                  <InfoRow
                    label="Market Coupon"
                    value={hasMarketData ? fmtPct(d.marketCoupon) : "No data"}
                    hint="What a similar new note would pay today"
                  />
                </>
              )}
              {isGrowth && (
                <>
                  <InfoRow
                    label="Intrinsic Value"
                    value={fmtPrice(d.intrinsic)}
                    hint="Theoretical value based on underlier performance"
                  />
                  <InfoRow
                    label="M2M vs Intrinsic"
                    value={d.m2mVsIntrinsicPct !== null ? `${d.m2mVsIntrinsicPct >= 0 ? "+" : ""}${d.m2mVsIntrinsicPct.toFixed(1)}%` : "—"}
                    hint="Positive = selling above theoretical value"
                  />
                </>
              )}
            </div>
          </div>

          {/* Swap Math - Only for Income with market data */}
          {isIncome && hasMarketData && (
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold mb-3">The Math</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Coupon difference</span>
                  <span className={`font-medium ${(d.couponDiffBps ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {fmtBps(d.couponDiffBps)}
                    <span className="text-slate-400 font-normal ml-1">
                      ({(d.couponDiffBps ?? 0) > 0 ? "market pays more" : "your coupon is better"})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Estimated sell price</span>
                  <span className="font-medium">~{fmtPrice(d.estimatedSellPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Buy new note at</span>
                  <span className="font-medium">100.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Horizon</span>
                  <span className="font-medium">{d.horizonMonths ?? "—"} months</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Net benefit</span>
                  <span className={`font-bold ${(d.netBenefitPts ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {fmtPts(d.netBenefitPts)}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Net benefit = (coupon improvement × horizon) − (selling cost + friction of {d.frictionPoints}pt)
              </p>
            </div>
          )}

          {/* Swap Analysis - For Growth notes */}
          {isGrowth && d.m2mVsIntrinsicPct !== null && (
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold mb-3">Growth Note Analysis</h3>
              <div className="space-y-3 text-sm">
                <p className="text-slate-600">
                  {d.m2mVsIntrinsicPct >= 0 ? (
                    <>M2M is <span className="font-medium text-emerald-600">above</span> intrinsic value.
                    You could sell without crystallizing a loss.</>
                  ) : d.m2mVsIntrinsicPct >= -5 ? (
                    <>M2M is <span className="font-medium text-amber-600">slightly below</span> intrinsic value ({d.m2mVsIntrinsicPct.toFixed(1)}%).
                    Small loss if you sell now.</>
                  ) : (
                    <>M2M is <span className="font-medium text-rose-600">significantly below</span> intrinsic value ({d.m2mVsIntrinsicPct.toFixed(1)}%).
                    Selling would crystallize a meaningful loss.</>
                  )}
                </p>
                {d.principalCushionPct !== null && d.principalCushionPct < 25 && (
                  <p className="text-amber-700 bg-amber-50 p-2 rounded">
                    Cushion is only {d.principalCushionPct.toFixed(1)}%. Swapping would reset your protection barrier.
                  </p>
                )}
                <div className="bg-slate-50 p-3 rounded text-slate-600">
                  <strong>If you swap:</strong>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Reset protection barrier to ~70%</li>
                    <li>• Get fresh upside participation</li>
                    <li>• Cost: ~{d.frictionPoints}pt friction + any M2M discount</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* No Data Message */}
          {note.swapRecommendation === "na" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-700 mb-2">Cannot Evaluate Swap</h3>
              <p className="text-sm text-slate-600">
                {isIncome ? (
                  "No comparable market data available for this note structure. " +
                  "We need pricing for similar tenor, barrier, and frequency notes to calculate swap economics."
                ) : isGrowth ? (
                  "Missing M2M or intrinsic value data needed to evaluate swap economics."
                ) : (
                  "Swap analysis is not available for this note type."
                )}
              </p>
            </div>
          )}

          {/* Glossary */}
          <details className="rounded-xl border p-4">
            <summary className="font-semibold cursor-pointer">Term Glossary</summary>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p><strong>M2M (Mark-to-Market):</strong> Current market price of your note. 100 = par value.</p>
              <p><strong>Cushion:</strong> How far the underlying can fall before hitting your protection barrier. Higher = safer.</p>
              <p><strong>Intrinsic Value:</strong> Theoretical value based on current underlier prices vs. strike. For growth notes, this is what the note "should" be worth.</p>
              <p><strong>Coupon:</strong> Annual yield paid by the note (for income notes).</p>
              <p><strong>Friction:</strong> Transaction cost estimate for selling (bid/offer spread + execution costs). 1pt = 1% of notional.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
