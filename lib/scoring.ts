import { clamp } from "./utils";
import type { MarketSnapshot } from "./pricing";
import type { NormalizedNote } from "./portfolio";
import { canonicalBasketKey, computeNoCallMonths, computeOriginalTenorMonths } from "./portfolio";

export type SwapDetails = {
  // For income notes
  yourCoupon: number | null;
  marketCoupon: number | null;
  couponDiffBps: number | null;
  estimatedSellPrice: number | null;
  netBenefitPts: number | null;
  horizonMonths: number | null;

  // For growth notes
  m2m: number | null;
  intrinsic: number | null;
  m2mVsIntrinsicPct: number | null; // (m2m - intrinsic) / intrinsic * 100

  // Common
  principalCushionPct: number | null;
  frictionPoints: number;
};

export type ScoreResult = {
  swapRecommendation: "yes" | "no" | "na";
  swapReason: string;
  swapDetails: SwapDetails;

  // Keep these for display
  marketCouponPa: number | null;
  principalCushionPct: number | null;
  couponCushionPct: number | null;

  // For risk flagging
  isNearBarrier: boolean;
};

function cushionPct(spot: number | null, barrier: number | null): number | null {
  if (spot === null || barrier === null || spot === 0) return null;
  return ((spot - barrier) / spot) * 100;
}

/**
 * Flexible market matching for income notes.
 * Relaxed criteria: ±6 months tenor, ±5% barriers, any quarterly structure
 */
function findMarketCoupon(note: NormalizedNote, snap: MarketSnapshot | null): number | null {
  if (!snap) return null;
  if (note.returnType !== "Income") return null;

  const tenor = computeOriginalTenorMonths(note);
  const noCall = computeNoCallMonths(note);
  const callFreq = note.callObsFreq?.toLowerCase() ?? null;
  const cb = note.couponBarrierPct;
  const pb = note.principalBarrierPct;

  // Relaxed matching criteria
  const looksQuarterly = callFreq ? (callFreq.includes("quarter") || callFreq.includes("3m")) : false;
  const tenorOk = tenor !== null ? Math.abs(tenor - 36) <= 6 : false; // ±6 months (was ±3)
  const noCallOk = noCall !== null ? Math.abs(noCall - 3) <= 3 : true; // ±3 months or missing is ok
  const couponBarrierOk = cb !== null ? Math.abs(cb - 0.70) <= 0.05 : true; // ±5% (was ±3%)
  const principalBarrierOk = pb !== null ? Math.abs(pb - 0.70) <= 0.05 : true; // ±5% (was ±3%)

  // Need at least tenor and quarterly to match
  if (!(tenorOk && looksQuarterly)) return null;

  // Prefer if barrier constraints also match
  if (!(noCallOk && couponBarrierOk && principalBarrierOk)) return null;

  // First try exact basket match
  const key = canonicalBasketKey(note);
  const exactMatch = snap.basketCouponMap[key];
  if (typeof exactMatch === "number") return exactMatch;

  // Fallback: use average of available coupons if no exact match
  const coupons = Object.values(snap.basketCouponMap).filter((v): v is number => typeof v === "number");
  if (coupons.length > 0) {
    return coupons.reduce((a, b) => a + b, 0) / coupons.length;
  }

  return null;
}

/**
 * Main scoring function - returns swap recommendation with clear reasoning
 */
export function scoreNote(note: NormalizedNote, snap: MarketSnapshot | null, frictionPoints: number): ScoreResult {
  const principalCush = cushionPct(note.activeUnderlierSpot, note.activeUnderlierPrincipalBarrier);
  const couponCush = cushionPct(note.activeUnderlierSpot, note.activeUnderlierCouponBarrier);
  const isNearBarrier = principalCush !== null && principalCush < 10;

  // Initialize swap details
  const swapDetails: SwapDetails = {
    yourCoupon: note.couponPa,
    marketCoupon: null,
    couponDiffBps: null,
    estimatedSellPrice: null,
    netBenefitPts: null,
    horizonMonths: null,
    m2m: note.m2m,
    intrinsic: note.intrinsic,
    m2mVsIntrinsicPct: null,
    principalCushionPct: principalCush,
    frictionPoints,
  };

  // Calculate M2M vs Intrinsic spread (useful for both income and growth)
  if (note.m2m !== null && note.intrinsic !== null && note.intrinsic > 0) {
    swapDetails.m2mVsIntrinsicPct = ((note.m2m - note.intrinsic) / note.intrinsic) * 100;
  }

  let swapRecommendation: "yes" | "no" | "na" = "na";
  let swapReason = "";

  // Handle Income notes
  if (note.returnType === "Income") {
    const marketCoupon = findMarketCoupon(note, snap);
    swapDetails.marketCoupon = marketCoupon;

    if (marketCoupon !== null && note.couponPa !== null) {
      // Calculate the economics
      const couponDiffBps = Math.round((marketCoupon - note.couponPa) * 10000);
      swapDetails.couponDiffBps = couponDiffBps;

      const remainingMonths = note.timeToMaturityMonths ?? 12;
      const horizonMonths = Math.max(3, Math.min(12, remainingMonths));
      swapDetails.horizonMonths = horizonMonths;

      const estimatedSellPrice = (note.m2m ?? 1) - (frictionPoints / 100);
      swapDetails.estimatedSellPrice = estimatedSellPrice;

      const unwindCost = 1 - estimatedSellPrice; // cost in price points
      const annualBenefitPts = (marketCoupon - note.couponPa); // as decimal
      const netBenefitPts = annualBenefitPts * (horizonMonths / 12) - unwindCost;
      swapDetails.netBenefitPts = netBenefitPts;

      // Decision logic for income notes
      if (netBenefitPts > 0.005) { // > 0.5 points net benefit
        swapRecommendation = "yes";
        const netBenefitDisplay = (netBenefitPts * 100).toFixed(1);
        swapReason = `Market pays ${couponDiffBps > 0 ? "+" : ""}${couponDiffBps} bps more annually. ` +
          `After selling at ~${(estimatedSellPrice * 100).toFixed(1)} and buying new at 100, ` +
          `net benefit is ~${netBenefitDisplay} points over ${horizonMonths} months.`;
      } else if (netBenefitPts < -0.01) { // losing more than 1 point
        swapRecommendation = "no";
        const yourCouponPct = (note.couponPa * 100).toFixed(1);
        const marketCouponPct = (marketCoupon * 100).toFixed(1);
        swapReason = `Your coupon (${yourCouponPct}%) is competitive with market (${marketCouponPct}%). ` +
          `Swapping would cost ~${Math.abs(netBenefitPts * 100).toFixed(1)} points after friction. Hold.`;
      } else {
        swapRecommendation = "no";
        swapReason = `Marginal economics. Your coupon is close to market rates. ` +
          `No clear benefit to swapping after transaction costs.`;
      }
    } else {
      // No market data for income note
      swapRecommendation = "na";
      swapReason = "No comparable market data available. Cannot evaluate swap economics for this structure.";
    }
  }
  // Handle Growth notes
  else if (note.returnType === "Growth") {
    const m2mVsIntrinsic = swapDetails.m2mVsIntrinsicPct;
    const cushion = principalCush;

    if (m2mVsIntrinsic !== null && cushion !== null) {
      const cushionEroded = cushion < 25;

      if (m2mVsIntrinsic >= -2 && cushionEroded) {
        // M2M is close to or above intrinsic, and protection is getting thin
        swapRecommendation = "yes";
        const m2mDisplay = note.m2m !== null ? (note.m2m * 100).toFixed(1) : "—";
        const intrinsicDisplay = note.intrinsic !== null ? (note.intrinsic * 100).toFixed(1) : "—";
        swapReason = `M2M (${m2mDisplay}) is ${m2mVsIntrinsic >= 0 ? "above" : "close to"} intrinsic (${intrinsicDisplay}). ` +
          `Cushion is only ${cushion.toFixed(1)}%. ` +
          `Swapping would reset your protection and give fresh upside participation.`;
      } else if (m2mVsIntrinsic < -5) {
        // Selling would crystallize a significant loss
        swapRecommendation = "no";
        swapReason = `M2M is ${Math.abs(m2mVsIntrinsic).toFixed(1)}% below intrinsic. ` +
          `Selling now crystallizes a loss. Hold unless you need to exit for other reasons.`;
      } else {
        // M2M reasonable but cushion is healthy
        swapRecommendation = "no";
        swapReason = `Cushion is healthy at ${cushion.toFixed(1)}%. ` +
          `No urgent reason to swap. M2M is ${m2mVsIntrinsic >= 0 ? "above" : `${Math.abs(m2mVsIntrinsic).toFixed(1)}% below`} intrinsic.`;
      }
    } else {
      // Missing data for growth note evaluation
      swapRecommendation = "na";
      swapReason = "Missing M2M or intrinsic value data. Cannot evaluate swap economics.";
    }
  }
  // Other note types
  else {
    swapRecommendation = "na";
    swapReason = "Swap analysis not available for this note type.";
  }

  // Override with risk warning if near barrier
  if (isNearBarrier) {
    swapReason = `WARNING: Principal cushion is only ${principalCush!.toFixed(1)}%. ` +
      `Underlier is close to barrier. ${swapReason}`;
  }

  return {
    swapRecommendation,
    swapReason,
    swapDetails,
    marketCouponPa: swapDetails.marketCoupon,
    principalCushionPct: principalCush,
    couponCushionPct: couponCush,
    isNearBarrier,
  };
}
