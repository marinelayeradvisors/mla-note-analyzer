import { clamp, sigmoid01 } from "./utils";
import type { MarketSnapshot } from "./pricing";
import type { NormalizedNote } from "./portfolio";
import { canonicalBasketKey, computeNoCallMonths, computeOriginalTenorMonths } from "./portfolio";

export type ScoreResult = {
  attractivenessScore: number | null; // 0-100
  swapScore: number | null; // 0-100
  marketCouponPa: number | null; // decimal
  principalCushionPct: number | null; // percent of current, already *100
  couponCushionPct: number | null;
  action: string;
  why: string;
};

function cushionPct(spot: number | null, barrier: number | null): number | null {
  if (spot === null || barrier === null || spot === 0) return null;
  return ((spot - barrier) / spot) * 100;
}

function cushionScore0to100(cushPct: number | null): number | null {
  if (cushPct === null) return null;
  // Clamp between -5% and +60% of spot
  const x = clamp(cushPct, -5, 60);
  return ((x - (-5)) / (60 - (-5))) * 100;
}

function m2mScore0to100(m2m: number | null): number | null {
  if (m2m === null) return null;
  // prefer near par for swap flexibility
  const x = clamp(m2m, 0.90, 1.03);
  return ((x - 0.90) / (1.03 - 0.90)) * 100;
}

function couponEdgeScore0to100(edge: number): number {
  // edge = (noteCoupon - marketCoupon) / marketCoupon
  // centered at 50 when edge=0, steepness tuned
  const s = sigmoid01(edge * 10);
  return s * 100;
}

function netBenefitScore0to100(netBenefitPts: number): number {
  // netBenefitPts measured in "price points" (e.g. 0.01 = 1 point).
  // map roughly: -2pts => 0, 0 => 35, +4pts => 100
  const x = clamp(netBenefitPts, -0.02, 0.04);
  return ((x - (-0.02)) / (0.04 - (-0.02))) * 100;
}

function matchMarketCoupon(note: NormalizedNote, snap: MarketSnapshot | null): number | null {
  if (!snap) return null;
  if (note.returnType !== "Income") return null;

  // Match the specific template implied by the provided snapshot:
  // 36m tenor, 3m no-call, quarterly call/coupon, 70% coupon barrier / 70% principal barrier.
  const tenor = computeOriginalTenorMonths(note);
  const noCall = computeNoCallMonths(note);
  const callFreq = note.callObsFreq?.toLowerCase() ?? null;

  const cb = note.couponBarrierPct;
  const pb = note.principalBarrierPct;

  const looksQuarterly = callFreq ? callFreq.includes("quarter") : false;
  const tenorOk = tenor !== null ? Math.abs(tenor - 36) <= 3 : false;
  const noCallOk = noCall !== null ? Math.abs(noCall - 3) <= 1.5 : false;
  const couponBarrierOk = cb !== null ? Math.abs(cb - 0.70) <= 0.03 : false;
  const principalBarrierOk = pb !== null ? Math.abs(pb - 0.70) <= 0.03 : false;

  if (!(tenorOk && noCallOk && looksQuarterly && couponBarrierOk && principalBarrierOk)) return null;

  const key = canonicalBasketKey(note);
  const v = snap.basketCouponMap[key];
  return typeof v === "number" ? v : null;
}

export function scoreNote(note: NormalizedNote, snap: MarketSnapshot | null, frictionPoints: number): ScoreResult {
  const principalCush = cushionPct(note.activeUnderlierSpot, note.activeUnderlierPrincipalBarrier);
  const couponCush = cushionPct(note.activeUnderlierSpot, note.activeUnderlierCouponBarrier);
  const pcScore = cushionScore0to100(principalCush);
  const m2mScore = m2mScore0to100(note.m2m);

  const marketCouponPa = matchMarketCoupon(note, snap);

  // Default (fallback) attractiveness: proxy using m2m vs intrinsic
  const termRichness = (note.m2m !== null && note.intrinsic !== null && note.m2m > 0 && note.intrinsic > 0)
    ? Math.log(note.m2m / note.intrinsic)
    : 0;

  let attractivenessScore: number | null = null;
  let swapScore: number | null = null;

  if (marketCouponPa !== null && note.couponPa !== null) {
    // Attractiveness favors above-market coupons + cushion.
    const edge = (note.couponPa - marketCouponPa) / marketCouponPa;
    const edgeScore = couponEdgeScore0to100(edge);
    attractivenessScore = 0.70 * edgeScore + 0.30 * (pcScore ?? 50);

    // Swap favors below-market coupons, near par, and positive net benefit after friction.
    const remainingMonths = note.timeToMaturityMonths ?? 12;
    const horizonMonths = Math.max(3, Math.min(12, remainingMonths)); // default 1y horizon, min 3m
    const effectiveSell = (note.m2m ?? 1) - (frictionPoints / 100);
    const unwindCost = 1 - effectiveSell; // in price points
    const annualBenefit = marketCouponPa - note.couponPa; // decimal
    const netBenefitPts = annualBenefit * (horizonMonths / 12) - unwindCost;

    const netScore = netBenefitScore0to100(netBenefitPts);
    swapScore = 0.65 * netScore + 0.20 * (m2mScore ?? 50) + 0.15 * (pcScore ?? 50);
  } else {
    // Fallback heuristic scores if no market match (works for growth notes too):
    // Use termRichness sign and cushion.
    const richnessScore = clamp(50 + termRichness * 60, 0, 100);
    attractivenessScore = 0.60 * richnessScore + 0.40 * (pcScore ?? 50);

    const upgradeScore = 0.50 * (100 - richnessScore) + 0.30 * (m2mScore ?? 50) + 0.20 * (pcScore ?? 50);
    swapScore = upgradeScore;
  }

  // Action logic (lightweight)
  const nearBarrier = principalCush !== null && principalCush < 10;
  const veryAttractive = attractivenessScore !== null && attractivenessScore >= 75;
  const strongSwap = swapScore !== null && swapScore >= 80;

  let action = "Monitor";
  let why = "No strong signal.";

  if (nearBarrier) {
    action = "Risk watch";
    why = `Principal cushion is low (${principalCush!.toFixed(1)}%).`;
  } else if (strongSwap) {
    action = "Consider swap";
    why = marketCouponPa !== null && note.couponPa !== null
      ? `Current market looks better vs existing terms after ~${frictionPoints.toFixed(1)}pt friction (heuristic).`
      : "Swap score high vs peers (heuristic).";
  } else if (veryAttractive) {
    action = "Keep (attractive)";
    why = marketCouponPa !== null && note.couponPa !== null
      ? "Existing terms look strong vs current market for a comparable template."
      : "Existing terms look strong vs peers (proxy).";
  }

  return {
    attractivenessScore,
    swapScore,
    marketCouponPa,
    principalCushionPct: principalCush,
    couponCushionPct: couponCush,
    action,
    why,
  };
}
