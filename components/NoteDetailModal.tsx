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
  return `${x >= 0 ? "+" : ""}${x.toFixed(1)} pts`;
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
                value={d.currentCushion !== null ? `${d.currentCushion.toFixed(1)}%` : "—"}
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
                    label="Embedded Gain"
                    value={d.embeddedGainPct !== null ? `${d.embeddedGainPct >= 0 ? "+" : ""}${d.embeddedGainPct.toFixed(1)}%` : "—"}
                    hint="M2M vs intrinsic - gains you'd lock in by swapping"
                  />
                </>
              )}
            </div>
          </div>

          {/* Swap Math - Only for Income with market data */}
          {isIncome && hasMarketData && (
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold mb-3">Swap Economics</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-start">
                  <span className="text-slate-600">
                    Market match
                    <span className="block text-xs text-slate-400">
                      {d.matchType === "exact" ? "Exact basket match" :
                       d.matchType === "partial" ? "Similar basket (underliers match)" :
                       d.matchType === "average" ? "Market average (indicative)" : "No match"}
                    </span>
                  </span>
                  <span className={`font-medium ${d.matchType === "exact" ? "text-emerald-600" : "text-amber-600"}`}>
                    {d.matchType === "exact" ? "✓" : d.matchType === "partial" ? "~" : "?"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Your coupon</span>
                  <span className="font-medium">{fmtPct(d.yourCoupon)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Market coupon</span>
                  <span className="font-medium">{fmtPct(d.marketCoupon)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Coupon difference</span>
                  <span className={`font-medium ${(d.couponDiffBps ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {fmtBps(d.couponDiffBps)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Est. sell price (incl. {d.frictionPoints}pt friction)</span>
                  <span className="font-medium">~{fmtPrice(d.estimatedSellPrice)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Net benefit (annual)</span>
                  <span className={`font-bold ${(d.netBenefitBps ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {fmtBps(d.netBenefitBps)}
                  </span>
                </div>
              </div>
              {d.isNonCallable && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                  ⚠️ Your note is non-callable. A replacement note would typically be autocallable.
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Net benefit = coupon improvement − exit cost (M2M discount + {d.frictionPoints}pt friction)
              </p>
            </div>
          )}

          {/* Swap Analysis - For Growth notes */}
          {isGrowth && d.m2m !== null && (
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold mb-3">Swap Economics</h3>
              <div className="space-y-3 text-sm">
                {/* Comparison Table */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div></div>
                  <div className="font-medium text-slate-500 text-xs">Your Note</div>
                  <div className="font-medium text-slate-500 text-xs">New Note</div>

                  <div className="text-left text-slate-600">Cushion</div>
                  <div className="font-medium">{d.currentCushion !== null ? `${d.currentCushion.toFixed(0)}%` : "—"}</div>
                  <div className="font-medium text-emerald-600">~{d.newCushion}%</div>

                  {d.embeddedGainPct !== null && (
                    <>
                      <div className="text-left text-slate-600">Embedded Gain</div>
                      <div className={`font-medium ${d.embeddedGainPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {d.embeddedGainPct >= 0 ? "+" : ""}{d.embeddedGainPct.toFixed(1)}%
                      </div>
                      <div className="font-medium text-slate-400">—</div>
                    </>
                  )}
                </div>

                {/* Protection Reset Value */}
                {d.cushionGain !== null && d.cushionGain > 0 && (
                  <div className="bg-emerald-50 p-3 rounded text-emerald-800 text-sm">
                    <strong>Protection reset value:</strong> Swapping resets your barrier from {d.currentCushion?.toFixed(0)}% to {d.newCushion}%
                    <span className="block text-xs mt-1">
                      This means the market can drop an additional {d.cushionGain.toFixed(0)}% before you lose principal.
                    </span>
                  </div>
                )}

                {/* Embedded Gain Lock-in */}
                {d.embeddedGainPct !== null && d.embeddedGainPct > 5 && (
                  <div className="bg-amber-50 p-3 rounded text-amber-800 text-sm">
                    <strong>Lock in gains:</strong> You're up {d.embeddedGainPct.toFixed(1)}% vs intrinsic. Swapping locks these in.
                  </div>
                )}

                {/* Exit Cost */}
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-slate-600">Exit cost</span>
                  <span className={`font-medium ${(d.exitCostPct ?? 0) > 5 ? "text-rose-600" : "text-slate-600"}`}>
                    {fmtPts(d.exitCostPct)}
                  </span>
                </div>

                {d.isNonCallable && (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                    ⚠️ Your note is non-callable. A replacement note would typically be autocallable.
                  </p>
                )}
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
