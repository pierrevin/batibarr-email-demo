"use client";

import type { EmailStats } from "@/app/types/email";

type Props = {
  stats: EmailStats | null;
  loading: boolean;
  selectedRepresentativeId: string | null;
  onSelectRepresentative: (id: string | null) => void;
};

export function StatsPanel({
  stats,
  loading,
  selectedRepresentativeId,
  onSelectRepresentative,
}: Props) {
  return (
    <aside className="border-l border-zinc-200 bg-white p-3 overflow-auto">
      <div className="text-sm font-semibold text-zinc-900">Statistiques</div>
      <div className="mt-1 text-[11px] text-zinc-500">Filtrees par base et campagne</div>

      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
        <div className="text-[11px] uppercase tracking-wide text-zinc-600">Societes traitees</div>
        <div className="mt-1 text-xl font-semibold text-zinc-900">
          {loading ? "..." : String(stats?.totalCompanies ?? 0)}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-2.5">
        <div className="text-[11px] uppercase tracking-wide text-zinc-600">Filtre commercial</div>
        <button
          type="button"
          onClick={() => onSelectRepresentative(null)}
          className={[
            "mt-2 w-full rounded-lg border px-2 py-1.5 text-left text-xs",
            selectedRepresentativeId === null
              ? "border-zinc-300 bg-zinc-100 text-zinc-900"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
          ].join(" ")}
        >
          Tous les commerciaux
        </button>
        <div className="mt-2 space-y-1.5">
          {!loading && (!stats || stats.byRepresentative.length === 0) ? (
            <div className="text-xs text-zinc-500">Aucune donnee.</div>
          ) : null}
          {(stats?.byRepresentative ?? []).map((row) => (
            <button
              type="button"
              key={row.representativeId ?? "unassigned"}
              onClick={() => onSelectRepresentative(row.representativeId)}
              className={[
                "w-full flex items-center justify-between rounded-lg border px-2 py-1.5 text-left",
                selectedRepresentativeId === row.representativeId
                  ? "border-zinc-300 bg-zinc-100"
                  : "border-zinc-100 bg-zinc-50 hover:bg-zinc-100",
              ].join(" ")}
            >
              <div className="truncate text-xs text-zinc-700">{row.representativeName}</div>
              <div className="ml-2 text-xs font-semibold text-zinc-900">{row.companyCount}</div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

