"use client";

import { useMemo, useState } from "react";
import { NoteDetailModal } from "./NoteDetailModal";

export type SwapDetails = {
  yourCoupon: number | null;
  marketCoupon: number | null;
  couponDiffBps: number | null;
  estimatedSellPrice: number | null;
  netBenefitPts: number | null;
  horizonMonths: number | null;
  m2m: number | null;
  intrinsic: number | null;
  m2mVsIntrinsicPct: number | null;
  principalCushionPct: number | null;
  frictionPoints: number;
};

export type NoteResult = {
  id: string;
  issuer: string | null;
  cusip: string | null;
  returnType: "Income" | "Growth" | "Other";
  structureType: string | null;
  underliers: string[];
  notionalUsd: number | null;

  m2m: number | null;
  couponPa: number | null;
  intrinsic: number | null;
  marketCouponPa: number | null;

  principalCushionPct: number | null;
  couponCushionPct: number | null;

  swapRecommendation: "yes" | "no" | "na";
  swapReason: string;
  swapDetails: SwapDetails;
  isNearBarrier: boolean;
};

function SwapBadge({ recommendation, isNearBarrier }: { recommendation: "yes" | "no" | "na"; isNearBarrier: boolean }) {
  if (isNearBarrier) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-rose-100 text-rose-800">
        RISK
      </span>
    );
  }

  if (recommendation === "yes") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800">
        REVIEW
      </span>
    );
  }

  if (recommendation === "no") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800">
        HOLD
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600">
      N/A
    </span>
  );
}

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

type SortField = "recommendation" | "cushion" | "coupon" | "m2m" | null;
type SortDir = "asc" | "desc";

export function ResultsTable({ results, asOfLabel }: { results: NoteResult[]; asOfLabel: string | null }) {
  const [q, setQ] = useState("");
  const [selectedNote, setSelectedNote] = useState<NoteResult | null>(null);
  const [sortField, setSortField] = useState<SortField>("recommendation");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let data = results;

    if (query) {
      data = results.filter((r) => {
        const hay = [
          r.issuer ?? "",
          r.cusip ?? "",
          r.returnType,
          r.structureType ?? "",
          r.underliers.join(","),
          r.swapRecommendation,
        ].join(" ").toLowerCase();
        return hay.includes(query);
      });
    }

    // Sort
    if (sortField) {
      data = [...data].sort((a, b) => {
        let cmp = 0;

        if (sortField === "recommendation") {
          // Risk first, then Review, then Hold, then N/A
          const rank = (r: NoteResult) => {
            if (r.isNearBarrier) return 0;
            if (r.swapRecommendation === "yes") return 1;
            if (r.swapRecommendation === "no") return 2;
            return 3;
          };
          cmp = rank(a) - rank(b);
        } else if (sortField === "cushion") {
          cmp = (a.principalCushionPct ?? 999) - (b.principalCushionPct ?? 999);
        } else if (sortField === "coupon") {
          cmp = (a.couponPa ?? 0) - (b.couponPa ?? 0);
        } else if (sortField === "m2m") {
          cmp = (a.m2m ?? 0) - (b.m2m ?? 0);
        }

        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return data;
  }, [q, results, sortField, sortDir]);

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-3 py-3 cursor-pointer hover:bg-slate-50 select-none"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-slate-400">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );

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
          placeholder="Search issuer, CUSIP, underlier..."
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm sm:w-96"
        />
      </div>

      <div className="mt-4 overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-3">Issuer</th>
              <th className="px-3 py-3">CUSIP</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Underliers</th>
              <th className="px-3 py-3">Notional</th>
              <SortHeader field="m2m">M2M</SortHeader>
              <SortHeader field="coupon">Coupon</SortHeader>
              <th className="px-3 py-3">Market Coupon</th>
              <SortHeader field="cushion">Cushion</SortHeader>
              <SortHeader field="recommendation">
                <span className="border-b border-dashed border-slate-400" title="REVIEW = consider swapping, HOLD = keep position, N/A = no data">
                  Swap
                </span>
              </SortHeader>
              <th className="px-3 py-3 max-w-xs">Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className={`border-b last:border-b-0 hover:bg-slate-50/50 cursor-pointer ${
                  r.isNearBarrier ? "bg-rose-50/30" : ""
                }`}
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
                <td className="px-3 py-3">
                  <SwapBadge recommendation={r.swapRecommendation} isNearBarrier={r.isNearBarrier} />
                </td>
                <td className="px-3 py-3 max-w-xs">
                  <div className="text-xs text-slate-600 line-clamp-2">{r.swapReason}</div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={11}>
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Swap Analysis Guide */}
      <div className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Swap Analysis Guide</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-800">RISK</span>
            <span className="text-xs text-slate-600">Underlier near barrier. Review immediately.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800">REVIEW</span>
            <span className="text-xs text-slate-600">Swapping may be beneficial. Click for details.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800">HOLD</span>
            <span className="text-xs text-slate-600">Current position looks good. No action needed.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">N/A</span>
            <span className="text-xs text-slate-600">No market data available for comparison.</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Click any row to see detailed swap analysis with the actual math.
        </p>
      </div>

      {selectedNote && (
        <NoteDetailModal note={selectedNote} onClose={() => setSelectedNote(null)} />
      )}
    </div>
  );
}
