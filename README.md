# Note Analyzer (Attractiveness + Swap)

This is a deployable Next.js app that:
- uploads a structured-note portfolio export (xlsx/csv)
- optionally uploads a “market pricing snapshot” (xlsx)
- computes:
  - **Attractiveness Score (0–100)**: how strong the existing terms look (vs market when a match exists)
  - **Swap Score (0–100)**: whether it’s worth switching out (vs market when a match exists)
  - **Mark-to-market**, **principal cushion**, **coupon cushion**
- surfaces simple actions: **Keep (attractive)**, **Consider swap**, **Risk watch**, **Monitor**

## What you can and cannot do with this prototype
✅ You can run it locally, push to GitHub, and deploy on Vercel.  
✅ You can swap in newer pricing snapshots as you get them.  
✅ No client PII is required or persisted (basic header/value dropping is implemented).  

⚠️ Scores are heuristic. M2M levels may differ from executable levels.  
⚠️ This is decision support only, not investment advice.

---

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel
1. Create a GitHub repo and push this folder.
2. In Vercel: “New Project” → import repo → deploy.
3. No special environment variables required for this version.

---

## Market snapshot matching (v1)
The included market snapshot parser supports the format in **Pricing Analysis 01-12-2026.xlsx**:
- Sheet: "Broad Based Historical Pricing"
- Assumes one template: 36m tenor, 3m no-call, quarterly call/coupon, 70% coupon barrier / 70% EKI.
- It matches only portfolio notes that approximately fit that template and have the same 3-underlier basket.

Notes that don’t match fall back to a proxy score using m2m vs intrinsic and cushion.

---

## Roadmap you asked for (next)
- Add a toggle to model short-term vs long-term cap gains impact (tax-aware swap score).
- Support multiple market templates (income + growth) and more flexible nearest-neighbor matching.
- Add issuer constraints, strategy “guardrails”, and export.

---

## Files
- `app/api/analyze/route.ts` server function that parses uploads and returns scored JSON
- `lib/portfolio.ts` portfolio parsing + normalization
- `lib/pricing.ts` market snapshot parsing (current format)
- `lib/scoring.ts` attractiveness + swap scoring logic
- `components/*` minimal UI (upload + table)

