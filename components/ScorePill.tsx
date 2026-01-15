export function ScorePill({ value }: { value: number | null }) {
  if (value === null || Number.isNaN(value)) return <span className="text-slate-400">—</span>;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    v >= 80 ? "bg-emerald-100 text-emerald-900" :
    v >= 60 ? "bg-sky-100 text-sky-900" :
    v >= 40 ? "bg-amber-100 text-amber-900" :
    "bg-rose-100 text-rose-900";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {v}
    </span>
  );
}
