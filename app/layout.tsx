import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marine Layer | Note Analyzer",
  description: "Analyze structured note portfolios (attractiveness + swap lens).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-6xl px-4 py-8">
          <header className="mb-6">
            <div className="flex items-baseline justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">Note Analyzer</h1>
              <div className="text-sm text-slate-500">Internal prototype</div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Upload a portfolio export and an optional market pricing snapshot. This tool is for
              decision support only and does not constitute investment advice.
            </p>
          </header>
          {children}
          <footer className="mt-12 border-t pt-6 text-xs text-slate-500">
            <p>
              Disclosures: Scores are heuristic and depend on the data provided. Mark-to-market values may
              differ from executable levels. No PII is stored or required.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
