"use client";

import type { EmailDetail as EmailDetailType } from "@/app/types/email";
import { isLikelyHtml } from "@/lib/emailFormat";

type BodyViewMode = "auto" | "html" | "text";

type Props = {
  detail: EmailDetailType | null;
  selectedId: string | null;
  detailLoading: boolean;
  bodyViewMode: BodyViewMode;
  onBodyViewModeChange: (mode: BodyViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  listLoading: boolean;
};

export function EmailDetail({
  detail,
  selectedId,
  detailLoading,
  bodyViewMode,
  onBodyViewModeChange,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  listLoading,
}: Props) {
  const rawBody = detail?.email_brouillon_corps ?? "";
  const bodyHasHtml = isLikelyHtml(rawBody);
  const shouldRenderHtml = bodyViewMode === "html" || (bodyViewMode === "auto" && bodyHasHtml);

  return (
    <section className="flex-1 bg-zinc-50 overflow-auto min-w-0">
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-600">Navigation</div>
            <div className="text-base font-semibold">{detail?.company?.name ?? "Détail email"}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={listLoading || prevDisabled}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={listLoading || nextDisabled}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900">Sujet</div>
                <div className="mt-1 text-sm text-zinc-700 break-words">
                  {detail?.email_brouillon_sujet || "—"}
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
                disabled={!detail?.email_brouillon_sujet}
                onClick={async () => {
                  if (!detail?.email_brouillon_sujet) return;
                  await navigator.clipboard.writeText(detail.email_brouillon_sujet);
                }}
              >
                Copier
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-900">Corps</div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 outline-none"
                    value={bodyViewMode}
                    onChange={(e) => onBodyViewModeChange(e.target.value as BodyViewMode)}
                    title="Mode d'affichage du corps"
                    aria-label="Mode d'affichage du corps"
                  >
                    <option value="auto">Auto</option>
                    <option value="html">HTML visuel</option>
                    <option value="text">Texte brut</option>
                  </select>
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
                    disabled={!detail?.email_brouillon_corps}
                    onClick={async () => {
                      if (!detail?.email_brouillon_corps) return;
                      await navigator.clipboard.writeText(detail.email_brouillon_corps);
                    }}
                  >
                    Copier
                  </button>
                </div>
              </div>

              {shouldRenderHtml ? (
                <div
                  className={[
                    "mt-2 rounded-lg border border-zinc-100 bg-white overflow-hidden",
                    detailLoading ? "opacity-70" : "opacity-100",
                  ].join(" ")}
                  aria-busy={detailLoading}
                >
                  <iframe
                    title="Aperçu HTML email"
                    sandbox=""
                    srcDoc={rawBody}
                    className="h-[480px] w-full bg-white"
                  />
                </div>
              ) : (
                <div
                  className={[
                    "mt-2 text-sm text-zinc-800 whitespace-pre-wrap break-words rounded-lg border border-zinc-100 p-3 bg-zinc-50",
                    detailLoading ? "opacity-70" : "opacity-100",
                  ].join(" ")}
                  aria-busy={detailLoading}
                >
                  {detail?.email_brouillon_corps || (selectedId ? "—" : "Sélectionnez un email")}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Société ciblée</div>
              <div className="mt-2 text-sm text-zinc-700">
                <div className="font-medium text-zinc-900">{detail?.company?.name ?? "—"}</div>
                <div className="mt-1">{detail?.company?.entity ?? ""}</div>
                <div className="mt-3 text-sm text-zinc-600 whitespace-pre-wrap">
                  {[detail?.company?.address, detail?.company?.town, detail?.company?.state, detail?.company?.country_code]
                    .filter((x) => (x ?? "").trim().length > 0)
                    .join(", ") || ""}
                </div>
                <div className="mt-3 text-sm text-zinc-600">
                  {detail?.company?.email ? `Email: ${detail.company.email}` : ""}
                  {detail?.company?.phone ? ` · Téléphone: ${detail.company.phone}` : ""}
                </div>
                <div className="mt-3 text-sm text-zinc-600">
                  <span className="font-medium text-zinc-700">Commercial:</span>{" "}
                  {detail?.company?.representative?.name ?? "—"}
                  {detail?.company?.representative?.email
                    ? ` · ${detail.company.representative.email}`
                    : ""}
                  {detail?.company?.representative?.phone
                    ? ` · ${detail.company.representative.phone}`
                    : ""}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Contexte société (IA)</div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {(
                  [
                    { label: "Descriptif", value: detail?.descriptif },
                    { label: "Marchés", value: detail?.marches },
                    { label: "Concurrents", value: detail?.concurrents },
                    { label: "Actualités", value: detail?.actualites },
                    { label: "Salons", value: detail?.salons },
                  ] as const
                ).map((item) => (
                  <div key={item.label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{item.label}</div>
                    <div className="mt-1 text-sm text-zinc-800 whitespace-pre-wrap break-words">
                      {item.value && item.value.trim().length > 0 ? item.value : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Points clés / argumentaire</div>
              <div className="mt-3 flex flex-col gap-2">
                {detail?.email_brouillon_points_cles?.length ? (
                  detail.email_brouillon_points_cles.map((p, i) => (
                    <div
                      key={`${i}-${p.slice(0, 12)}`}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                    >
                      {p}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600">—</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
