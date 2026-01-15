"use client";

import { useState } from "react";
import type { NoteResult } from "./ResultsTable";
import { ResultsTable } from "./ResultsTable";

export function UploadPanel() {
  const [portfolio, setPortfolio] = useState<File | null>(null);
  const [pricing, setPricing] = useState<File | null>(null);
  const [frictionPoints, setFrictionPoints] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<NoteResult[] | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);

  async function analyze() {
    if (!portfolio) return;
    setLoading(true);
    setErr(null);

    try {
      const fd = new FormData();
      fd.append("portfolio", portfolio);
      if (pricing) fd.append("pricing", pricing);
      fd.append("frictionPoints", String(frictionPoints));

      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setResults(data.results);
      setAsOf(data.asOf ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="grid gap-4 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Portfolio export (xlsx/csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setPortfolio(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
          <p className="mt-2 text-xs text-slate-500">
            No PII required. Uploads are processed in-memory in the server function.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Market pricing snapshot (optional)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setPricing(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
          <p className="mt-2 text-xs text-slate-500">
            Used to estimate “what you could buy today” for matching templates.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Transaction friction (points)</label>
          <input
            type="number"
            min={0}
            step={0.25}
            value={frictionPoints}
            onChange={(e) => setFrictionPoints(Number(e.target.value))}
            className="mt-2 w-40 rounded-lg border px-3 py-2 text-sm"
          />
          <p className="mt-2 text-xs text-slate-500">
            1 point = 1% of notional haircut applied to the sale (proxy for bid/offer + costs).
          </p>
        </div>

        <div className="flex items-end justify-start">
          <button
            onClick={analyze}
            disabled={!portfolio || loading}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
          {err && <div className="ml-3 text-sm text-rose-700">{err}</div>}
        </div>
      </div>

      {results && <ResultsTable results={results} asOfLabel={asOf} />}
    </div>
  );
}
