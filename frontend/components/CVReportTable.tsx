"use client";

export type CVFold = {
  fold: number;
  train_size: number;
  validation_size: number;
  mae: number;
  rmse: number;
  mape: number;
};

export type CVReport = {
  symbol: string;
  model_available: boolean;
  folds: CVFold[];
  summary: {
    mae?: number | null;
    rmse?: number | null;
    mape?: number | null;
  };
};

type CVReportTableProps = {
  report?: CVReport | null;
};

const formatMetric = (value?: number | null, suffix = "") =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(2)}${suffix}`
    : "—";

export default function CVReportTable({ report }: CVReportTableProps) {
  return (
    <div className="mt-4 rounded-[28px] border border-[var(--border)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--ink-muted)]">
            Cross-validation
          </div>
          <h3 className="mt-1 font-display text-xl text-[var(--ink)]">
            Model stability
          </h3>
        </div>
        {report?.model_available && (
          <div className="rounded-full border border-[var(--border)] bg-[var(--paper-strong)] px-3 py-1 text-xs text-[var(--ink-soft)]">
            {report.symbol} model ready
          </div>
        )}
      </div>

      {!report || report.folds.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          CV folds will appear here after the ticker model has been trained.
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--paper-strong)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                <tr>
                  <th className="px-3 py-2">Fold</th>
                  <th className="px-3 py-2">Train</th>
                  <th className="px-3 py-2">Validation</th>
                  <th className="px-3 py-2">MAE</th>
                  <th className="px-3 py-2">RMSE</th>
                  <th className="px-3 py-2">MAPE</th>
                </tr>
              </thead>
              <tbody>
                {report.folds.map((fold) => (
                  <tr key={`${report.symbol}-${fold.fold}`} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium text-[var(--ink)]">
                      {fold.fold}
                    </td>
                    <td className="px-3 py-2 text-[var(--ink-soft)]">
                      {fold.train_size}
                    </td>
                    <td className="px-3 py-2 text-[var(--ink-soft)]">
                      {fold.validation_size}
                    </td>
                    <td className="px-3 py-2 text-[var(--ink-soft)]">
                      {formatMetric(fold.mae)}
                    </td>
                    <td className="px-3 py-2 text-[var(--ink-soft)]">
                      {formatMetric(fold.rmse)}
                    </td>
                    <td className="px-3 py-2 text-[var(--ink-soft)]">
                      {formatMetric(fold.mape, "%")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper-strong)] px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                Avg MAE
              </div>
              <div className="mt-1 font-display text-xl text-[var(--ink)]">
                {formatMetric(report.summary.mae)}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper-strong)] px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                Avg RMSE
              </div>
              <div className="mt-1 font-display text-xl text-[var(--ink)]">
                {formatMetric(report.summary.rmse)}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper-strong)] px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                Avg MAPE
              </div>
              <div className="mt-1 font-display text-xl text-[var(--ink)]">
                {formatMetric(report.summary.mape, "%")}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
