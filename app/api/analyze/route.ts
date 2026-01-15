import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parsePortfolioFromXlsx } from "@/lib/portfolio";
import { parseMarketSnapshotFromXlsx } from "@/lib/pricing";
import { scoreNote } from "@/lib/scoring";

export const runtime = "nodejs";

const FormSchema = z.object({
  frictionPoints: z.coerce.number().min(0).max(10).default(1),
});

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const portfolio = fd.get("portfolio");
    const pricing = fd.get("pricing");

    const frictionPoints = FormSchema.parse({
      frictionPoints: fd.get("frictionPoints") ?? 1,
    }).frictionPoints;

    if (!(portfolio instanceof File)) {
      return NextResponse.json({ error: "Missing portfolio file." }, { status: 400 });
    }

    const portfolioBuf = Buffer.from(await portfolio.arrayBuffer());
    const { notes, droppedPiiColumns } = parsePortfolioFromXlsx(portfolioBuf);

    let snap = null;
    if (pricing instanceof File) {
      const pricingBuf = Buffer.from(await pricing.arrayBuffer());
      snap = parseMarketSnapshotFromXlsx(pricingBuf);
    }

    const results = notes.map((n) => {
      const scored = scoreNote(n, snap, frictionPoints);
      return {
        id: n.id,
        issuer: n.issuer,
        cusip: n.cusip,
        returnType: n.returnType,
        structureType: n.structureType,
        underliers: n.underliers,
        notionalUsd: n.notionalUsd,

        m2m: n.m2m,
        couponPa: n.couponPa,
        intrinsic: n.intrinsic,
        marketCouponPa: scored.marketCouponPa,

        principalCushionPct: scored.principalCushionPct,
        couponCushionPct: scored.couponCushionPct,

        // New simplified swap fields
        swapRecommendation: scored.swapRecommendation,
        swapReason: scored.swapReason,
        swapDetails: scored.swapDetails,
        isNearBarrier: scored.isNearBarrier,
      };
    });

    // Sort: REVIEW (yes) first, then HOLD (no), then N/A, with risk warnings at top
    results.sort((a, b) => {
      // Risk warnings first
      if (a.isNearBarrier && !b.isNearBarrier) return -1;
      if (!a.isNearBarrier && b.isNearBarrier) return 1;

      // Then by swap recommendation: yes > no > na
      const recRank: Record<string, number> = { yes: 0, no: 1, na: 2 };
      const ra = recRank[a.swapRecommendation] ?? 9;
      const rb = recRank[b.swapRecommendation] ?? 9;
      if (ra !== rb) return ra - rb;

      // Within same recommendation, sort by net benefit (for income) or cushion (for growth)
      const benefitA = a.swapDetails.netBenefitPts ?? 0;
      const benefitB = b.swapDetails.netBenefitPts ?? 0;
      return benefitB - benefitA;
    });

    const asOf = snap?.asOf ?? null;

    return NextResponse.json({
      asOf,
      droppedPiiColumns,
      marketStructureLabel: snap?.structureLabel ?? null,
      results,
    });
  } catch (e: any) {
    return new NextResponse(
      JSON.stringify({ error: e?.message ?? "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
