import { clamp } from "./utils";
import type { MarketSnapshot } from "./pricing";
import type { NormalizedNote } from "./portfolio";
import { canonicalBasketKey, computeNoCallMonths } from "./portfolio";

export type SwapDetails = {
  // For income notes
  yourCoupon: number | null;
  marketCoupon: number | null;
  couponDiffBps: number | null;
  estimatedSellPrice: number | null;
  netBenefitBps: number | null;
  paybackMonths: number | null;  // How long to recover exit cost from coupon gain
  breakevenM2M: number | null;   // M2M price at which swap breaks even

  // For growth notes
  m2m: number | null;
  intrinsic: number | null;
  embeddedGainPct: number | null; // (m2m - intrinsic) / intrinsic * 100
  currentCushion: number | null;
  newCushion: number; // Standard 70% barrier = ~43% cushion at par
  cushionGain: number | null;
  exitCostPct: number | null;
  marketParticipation: number | null; // From pricing file

  // Call info for display
  callFreq: string | null;       // "Monthly", "Quarterly", etc.
  noCallMonths: number | null;   // How many months until first call

  // Match info
  matchType: "exact" | "partial" | "average" | "none";
  isNonCallable: boolean;

  // Common
  frictionPoints: number;
};

export type ScoreResult = {
  swapScore: number; // 0-100 for sorting
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

type MarketMatch = {
  coupon: number;
  matchType: "exact" | "partial" | "average";
} | null;

/**
 * Flexible market matching for income notes.
 * Priority: 1) Exact underlier match, 2) Partial match (note underliers subset of market), 3) Average
 * Ignores tenor - focus on underliers and protection level
 */
function findMarketCoupon(note: NormalizedNote, snap: MarketSnapshot | null): MarketMatch {
  if (!snap) return null;
  if (note.returnType !== "Income") return null;
  if (!snap.basketCouponMap || Object.keys(snap.basketCouponMap).length === 0) return null;

  // 1. Try exact basket match (sorted canonical key)
  const key = canonicalBasketKey(note);
  const exactMatch = snap.basketCouponMap[key];
  if (typeof exactMatch === "number") {
    return { coupon: exactMatch, matchType: "exact" };
  }

  // 2. Try partial match - find basket that contains all note underliers
  const noteUnderliers = note.underliers.map(s => s.trim().toUpperCase()).sort();
  for (const [basketKey, coupon] of Object.entries(snap.basketCouponMap)) {
    if (typeof coupon !== "number") continue;
    const marketUnderliers = basketKey.split(",").map(s => s.trim().toUpperCase());

    // Check if all note underliers are in market basket
    const allPresent = noteUnderliers.every(u => marketUnderliers.includes(u));
    if (allPresent) {
      return { coupon, matchType: "partial" };
    }
  }

  // 3. Fallback: use average of all market coupons (indicative)
  const coupons = Object.values(snap.basketCouponMap).filter((v): v is number => typeof v === "number");
  if (coupons.length > 0) {
    const avg = coupons.reduce((a, b) => a + b, 0) / coupons.length;
    return { coupon: avg, matchType: "average" };
  }

  return null;
}

/**
 * Check if note appears to be non-callable
 */
function isNonCallable(note: NormalizedNote): boolean {
  const noCallMonths = computeNoCallMonths(note);
  // If no-call period is null or >= 24 months (2 years), treat as non-callable
  if (noCallMonths === null) return false; // Can't determine
  if (noCallMonths >= 24) return true;
  // Also check if call freq indicates non-callable
  const freq = note.callObsFreq?.toLowerCase() ?? "";
  if (freq.includes("non") || freq.includes("none") || freq === "") return true;
  return false;
}

/**
 * Main scoring function - returns swap score (0-100) with clear reasoning
 */
export function scoreNote(note: NormalizedNote, snap: MarketSnapshot | null, frictionPoints: number): ScoreResult {
  const principalCush = cushionPct(note.activeUnderlierSpot, note.activeUnderlierPrincipalBarrier);
  const couponCush = cushionPct(note.activeUnderlierSpot, note.activeUnderlierCouponBarrier);
  const isNearBarrier = principalCush !== null && principalCush < 10;
  const noteIsNonCallable = isNonCallable(note);

  // Initialize swap details
  const noCallMonths = computeNoCallMonths(note);
  const swapDetails: SwapDetails = {
    yourCoupon: note.couponPa,
    marketCoupon: null,
    couponDiffBps: null,
    estimatedSellPrice: null,
    netBenefitBps: null,
    paybackMonths: null,
    breakevenM2M: null,
    m2m: note.m2m,
    intrinsic: note.intrinsic,
    embeddedGainPct: null,
    currentCushion: principalCush,
    newCushion: 70, // Standard new note barrier
    cushionGain: null,
    exitCostPct: null,
    marketParticipation: snap?.basketParticipationMap ?
      Object.values(snap.basketParticipationMap)[0] ?? null : null,
    callFreq: note.callObsFreq,
    noCallMonths: noCallMonths,
    matchType: "none",
    isNonCallable: noteIsNonCallable,
    frictionPoints,
  };

  // Calculate embedded gain for growth notes
  if (note.m2m !== null && note.intrinsic !== null && note.intrinsic > 0) {
    swapDetails.embeddedGainPct = ((note.m2m - note.intrinsic) / note.intrinsic) * 100;
  }

  // Calculate cushion gain
  if (principalCush !== null) {
    swapDetails.cushionGain = swapDetails.newCushion - principalCush;
  }

  // Calculate exit cost
  if (note.m2m !== null) {
    swapDetails.exitCostPct = (1 - note.m2m) * 100 + frictionPoints;
  }

  let swapScore = 50; // Base score
  let swapRecommendation: "yes" | "no" | "na" = "na";
  let swapReason = "";

  // Handle Income notes
  if (note.returnType === "Income") {
    const match = findMarketCoupon(note, snap);

    if (match !== null && note.couponPa !== null) {
      swapDetails.marketCoupon = match.coupon;
      swapDetails.matchType = match.matchType;

      // Calculate the economics
      const couponDiffBps = Math.round((match.coupon - note.couponPa) * 10000);
      swapDetails.couponDiffBps = couponDiffBps;

      const exitCostBps = ((1 - (note.m2m ?? 1)) * 10000) + (frictionPoints * 100);
      const estimatedSellPrice = (note.m2m ?? 1) - (frictionPoints / 100);
      swapDetails.estimatedSellPrice = estimatedSellPrice;

      // Net benefit over 1 year horizon (default)
      const netBenefitBps = couponDiffBps - exitCostBps;
      swapDetails.netBenefitBps = netBenefitBps;

      // Calculate payback period (months to recover exit cost from coupon gain)
      // paybackMonths = (exitCostBps / couponDiffBps) * 12
      if (couponDiffBps > 0) {
        swapDetails.paybackMonths = Math.round((exitCostBps / couponDiffBps) * 12);
      } else {
        swapDetails.paybackMonths = null; // N/A if market coupon is lower
      }

      // Calculate breakeven M2M price (what price makes swap worthwhile over 1yr)
      // At breakeven: couponDiffBps = exitCostBps
      // couponDiffBps = ((1 - breakevenM2M) * 10000) + frictionBps
      // breakevenM2M = 1 - (couponDiffBps - frictionBps) / 10000
      if (couponDiffBps > 0) {
        const breakevenM2M = 1 - (couponDiffBps - (frictionPoints * 100)) / 10000;
        swapDetails.breakevenM2M = Math.max(0, Math.min(1.5, breakevenM2M)); // Clamp to reasonable range
      } else {
        swapDetails.breakevenM2M = null;
      }

      // Calculate swap score: 50 base + net benefit adjustment
      // Each 50bps net benefit = 1 point
      swapScore = clamp(50 + (netBenefitBps / 50), 0, 100);

      // Decision logic with payback info
      const currentM2M = ((note.m2m ?? 1) * 100).toFixed(1);
      const paybackText = swapDetails.paybackMonths !== null && swapDetails.paybackMonths < 999
        ? ` Payback: ${swapDetails.paybackMonths} months.`
        : "";
      const breakevenText = swapDetails.breakevenM2M !== null
        ? ` Swap if M2M ≥ ${(swapDetails.breakevenM2M * 100).toFixed(1)}.`
        : "";

      if (netBenefitBps > 50) { // > 50bps net benefit
        swapRecommendation = "yes";
        const matchLabel = match.matchType === "exact" ? "exact match" :
                          match.matchType === "partial" ? "similar basket" : "market average";
        swapReason = `Market (${matchLabel}) yields ${(match.coupon * 100).toFixed(1)}% vs your ${(note.couponPa * 100).toFixed(1)}%. ` +
          `Net: +${netBenefitBps} bps/yr.${paybackText}`;
      } else if (netBenefitBps < -100) { // losing more than 100bps
        swapRecommendation = "no";
        swapReason = `Your ${(note.couponPa * 100).toFixed(1)}% beats market ${(match.coupon * 100).toFixed(1)}%. HOLD at M2M ${currentM2M}.`;
      } else if (couponDiffBps > 0 && swapDetails.paybackMonths !== null) {
        // Marginal case - market pays more but exit cost high
        swapRecommendation = "no";
        swapReason = `+${couponDiffBps} bps coupon but ${swapDetails.paybackMonths}mo payback at M2M ${currentM2M}.${breakevenText}`;
      } else {
        swapRecommendation = "no";
        swapReason = `Marginal: Net ${netBenefitBps > 0 ? "+" : ""}${netBenefitBps} bps after costs.`;
      }

      // Add non-callable warning
      if (noteIsNonCallable) {
        swapReason += " ⚠️ Non-callable.";
      }
    } else {
      // No market data
      swapRecommendation = "na";
      swapDetails.matchType = "none";
      swapReason = "No comparable market data available for this underlier basket.";
    }
  }
  // Handle Growth notes
  else if (note.returnType === "Growth") {
    const cushion = principalCush;
    const embeddedGain = swapDetails.embeddedGainPct ?? 0;
    const exitCost = swapDetails.exitCostPct ?? 0;
    const cushionGain = swapDetails.cushionGain ?? 0;

    if (note.m2m !== null && cushion !== null) {
      // Growth note swap score based on:
      // 1. Protection reset value (locking in gains + refreshing barrier)
      // 2. Exit cost

      // Score calculation:
      // - Base 50
      // - +10 if locking in gains (M2M > intrinsic)
      // - +cushionGain/3 for protection reset value
      // - -exitCost for cost to exit

      swapScore = clamp(
        50 +
        (embeddedGain > 0 ? 10 : 0) +
        (cushionGain > 0 ? cushionGain / 3 : 0) -
        exitCost,
        0, 100
      );

      // Decision logic
      if (swapScore >= 60) {
        swapRecommendation = "yes";
        const gainText = embeddedGain > 0
          ? `You're up ${embeddedGain.toFixed(1)}% vs intrinsic - swapping locks in gains. `
          : "";
        const protectionText = cushionGain > 0
          ? `Resets protection from ${cushion.toFixed(0)}% to 70% (+${cushionGain.toFixed(0)}% cushion). `
          : "";
        const costText = `Exit cost: ${exitCost.toFixed(1)} pts.`;
        swapReason = gainText + protectionText + costText;
      } else if (exitCost > 10) {
        swapRecommendation = "no";
        swapReason = `Exit cost is high (${exitCost.toFixed(1)} pts). ` +
          `M2M at ${((note.m2m ?? 1) * 100).toFixed(1)} - wait for better exit opportunity.`;
      } else {
        swapRecommendation = "no";
        swapReason = `Current position is reasonable. Cushion at ${cushion.toFixed(0)}%, ` +
          `exit cost ${exitCost.toFixed(1)} pts. No strong case for swap.`;
      }
    } else {
      swapRecommendation = "na";
      swapReason = "Missing M2M or cushion data. Cannot evaluate swap.";
    }
  }
  // Other note types
  else {
    swapRecommendation = "na";
    swapReason = "Swap analysis not available for this note type.";
  }

  // Override with risk warning if near barrier
  if (isNearBarrier) {
    swapScore = Math.max(swapScore, 80); // Boost score for risk notes
    swapRecommendation = "yes";
    swapReason = `RISK: Cushion only ${principalCush!.toFixed(1)}% - underlier near barrier. ` + swapReason;
  }

  return {
    swapScore: Math.round(swapScore),
    swapRecommendation,
    swapReason,
    swapDetails,
    marketCouponPa: swapDetails.marketCoupon,
    principalCushionPct: principalCush,
    couponCushionPct: couponCush,
    isNearBarrier,
  };
}
