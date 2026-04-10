"use client";

import type { EmailStats } from "@/app/types/email";

type Props = {
  stats: EmailStats | null;
  loading: boolean;
};

export function StatsPanel({ stats, loading }: Props) {
  return (
    <aside className="border-l border-zinc-200 bg-white p-4 overflow-auto">
      <div className="text-sm font-semibold text-zinc-900">Statistiques</div>
      <div className="mt-1 text-xs text-zinc-500">Filtrees par base et campagne</div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="text-xs uppercase tracking-wide text-zinc-600">Societes traitees</div>
        <div className="mt-1 text-2xl font-semibold text-zinc-900">
          {loading ? "..." : String(stats?.totalCompanies ?? 0)}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
        <div className="text-xs uppercase tracking-wide text-zinc-600">Par commercial</div>
        <div className="mt-2 space-y-2">
          {!loading && (!stats || stats.byRepresentative.length === 0) ? (
            <div className="text-sm text-zinc-500">Aucune donnee.</div>
          ) : null}
          {(stats?.byRepresentative ?? []).map((row) => (
            <div
              key={row.representativeId ?? "unassigned"}
              className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-2"
            >
              <div className="truncate text-sm text-zinc-700">{row.representativeName}</div>
              <div className="ml-3 text-sm font-semibold text-zinc-900">{row.companyCount}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

