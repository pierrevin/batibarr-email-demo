"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Company = {
  id: string;
  name: string | null;
  entity: string | null;
  address: string | null;
  town: string | null;
  state: string | null;
  country_code: string | null;
  email: string | null;
  phone: string | null;
} | null;

type EmailListItem = {
  id: string;
  date_generation: string | null;
  id_tiers: string | null;
  email_brouillon_sujet: string | null;
  company: Company;
};

type EmailDetail = {
  id: string;
  date_generation: string | null;
  email_brouillon_sujet: string | null;
  email_brouillon_corps: string | null;
  email_brouillon_points_cles: string[];
  descriptif: string | null;
  marches: string | null;
  concurrents: string | null;
  actualites: string | null;
  salons: string | null;
  company: Company;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.valueOf())) return dateStr;
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isLikelyHtml(content: string | null) {
  if (!content) return false;
  // Détection simple: balises HTML courantes ou doctype.
  return /<\/?[a-z][\s\S]*>/i.test(content) || /<!doctype html>/i.test(content);
}

async function fetchJson<T>(url: string) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // ignore parsing errors
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [campaignId, setCampaignId] = useState<string>("");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [items, setItems] = useState<EmailListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailDetail | null>(null);

  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [activeRule, setActiveRule] = useState<"first" | "last" | "keep">("first");
  const [bodyViewMode, setBodyViewMode] = useState<"auto" | "html" | "text">("auto");

  useEffect(() => {
    const run = async () => {
      setAuthLoading(true);
      try {
        await fetchJson<{ authenticated: boolean }>("/api/auth/session");
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };
    run();
  }, []);

  const loadList = useCallback(
    async (newOffset: number, strategy: "first" | "last" | "keep") => {
      if (!isAuthenticated) return;
      setListError(null);
      setListLoading(true);
      setActiveRule(strategy);

      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(newOffset));
      if (campaignId.trim()) params.set("campagne_id", campaignId.trim());

      try {
        const data = await fetchJson<{ items: EmailListItem[]; hasMore: boolean }>(
          `/api/emails?${params.toString()}`,
        );

        setItems(data.items);
        setHasMore(data.hasMore);
        setOffset(newOffset);

        if (data.items.length === 0) {
          setSelectedId(null);
          setDetail(null);
          return;
        }

        const keepSelected =
          strategy === "keep" && selectedId && data.items.some((x) => x.id === selectedId);

        if (keepSelected) {
          // no-op, selectedId already set
        } else if (strategy === "last") {
          setSelectedId(data.items[data.items.length - 1].id);
        } else {
          setSelectedId(data.items[0].id);
        }
      } catch (e) {
        setListError(e instanceof Error ? e.message : String(e));
        setItems([]);
        setSelectedId(null);
        setDetail(null);
        setHasMore(false);
      } finally {
        setListLoading(false);
      }
    },
    [isAuthenticated, campaignId, limit, selectedId],
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    // chargement initial
    if (items.length === 0) loadList(0, "first");
  }, [isAuthenticated, items.length, loadList]);

  useEffect(() => {
    if (!isAuthenticated || !selectedId) return;
    setDetailLoading(true);
    setListError(null);

    const run = async () => {
      try {
        const d = await fetchJson<EmailDetail>(`/api/emails/${encodeURIComponent(selectedId)}`);
        setDetail(d);
      } catch (e) {
        setListError(e instanceof Error ? e.message : String(e));
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };
    run();
  }, [isAuthenticated, selectedId]);

  async function login() {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailInput, password: passwordInput }),
      });
      if (!res.ok) {
        let message = `Erreur ${res.status}`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      setIsAuthenticated(true);
    } catch (e) {
      setIsAuthenticated(false);
      setAuthError(e instanceof Error ? e.message : "Identifiants invalides");
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setIsAuthenticated(false);
    setPasswordInput("");
    setItems([]);
    setSelectedId(null);
    setDetail(null);
  }

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return items.findIndex((x) => x.id === selectedId);
  }, [items, selectedId]);

  const atFirst = selectedIndex <= 0;
  const atLast = selectedIndex >= items.length - 1;
  const rawBody = detail?.email_brouillon_corps ?? "";
  const bodyHasHtml = isLikelyHtml(rawBody);
  const shouldRenderHtml = bodyViewMode === "html" || (bodyViewMode === "auto" && bodyHasHtml);

  async function applyCampaign() {
    await loadList(0, "first");
  }

  async function goPrev() {
    if (listLoading) return;
    const idx = selectedIndex;
    if (idx > 0) {
      setSelectedId(items[idx - 1].id);
      return;
    }
    if (offset <= 0) return;
    const newOffset = Math.max(0, offset - limit);
    await loadList(newOffset, "last");
  }

  async function goNext() {
    if (listLoading) return;
    const idx = selectedIndex;
    if (idx >= 0 && idx < items.length - 1) {
      setSelectedId(items[idx + 1].id);
      return;
    }
    if (!hasMore) return;
    await loadList(offset + limit, "first");
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <div className="text-sm text-zinc-600">Chargement…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-zinc-900">Connexion démo</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Entrez votre email et mot de passe de démonstration.
          </p>

          <div className="mt-5">
            <label className="text-sm font-medium text-zinc-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="demo@batibarr.fr"
              type="email"
              autoComplete="off"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-zinc-700" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="off"
            />
            {authError ? <p className="mt-2 text-sm text-red-600">{authError}</p> : null}
          </div>

          <button
            onClick={login}
            disabled={!emailInput.trim() || !passwordInput.trim() || authLoading}
            className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  const companyLine = (c: Company) => {
    if (!c) return "—";
    const parts = [c.name, c.entity].filter((x) => (x ?? "").trim().length > 0);
    if (parts.length === 0) return "—";
    return parts.join(" · ");
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm text-zinc-600">Batibarr</div>
            <div className="text-lg font-semibold leading-tight">Emails IA (démo)</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-700" htmlFor="campagneId">
                Campagne ID
              </label>
              <input
                id="campagneId"
                className="w-36 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                placeholder="ex: 123"
                inputMode="numeric"
              />
            </div>
            <button
              onClick={applyCampaign}
              disabled={listLoading}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
            >
              Charger
            </button>
            <button
              onClick={logout}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <main className="flex h-[calc(100vh-56px)]">
        <section className="w-[420px] border-r border-zinc-200 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
            <div className="text-sm font-medium text-zinc-900">
              {listLoading ? "Chargement…" : `${items.length} email(s)`}
            </div>
            <div className="text-xs text-zinc-500">
              offset {offset} · {activeRule}
            </div>
          </div>

          {listError ? <div className="px-4 py-3 text-sm text-red-600">{listError}</div> : null}

          <div className="overflow-auto">
            {items.length === 0 && !listLoading ? (
              <div className="px-4 py-6 text-sm text-zinc-600">Aucun email à afficher.</div>
            ) : null}

            <div className="divide-y divide-zinc-100">
              {items.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={[
                      "w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors",
                      isSelected ? "bg-zinc-100" : "bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-900 truncate">
                          {companyLine(item.company)}
                        </div>
                        <div className="mt-1 text-sm text-zinc-700 truncate">
                          {item.email_brouillon_sujet || "Sans sujet"}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500 whitespace-nowrap">{formatDate(item.date_generation)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="flex-1 bg-zinc-50 overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-zinc-600">Navigation</div>
                <div className="text-base font-semibold">{detail?.company?.name ?? "Détail email"}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  disabled={listLoading || (offset <= 0 && atFirst)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  onClick={goNext}
                  disabled={listLoading || items.length === 0 || (atLast && !hasMore)}
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
                  <div className="flex items-center gap-2">
                    <button
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
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-zinc-900">Corps</div>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 outline-none"
                        value={bodyViewMode}
                        onChange={(e) => setBodyViewMode(e.target.value as "auto" | "html" | "text")}
                        title="Mode d'affichage du corps"
                      >
                        <option value="auto">Auto</option>
                        <option value="html">HTML visuel</option>
                        <option value="text">Texte brut</option>
                      </select>
                      <button
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
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="text-sm font-semibold text-zinc-900">Contexte société (IA)</div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {[
                      { label: "Descriptif", value: detail?.descriptif },
                      { label: "Marchés", value: detail?.marches },
                      { label: "Concurrents", value: detail?.concurrents },
                      { label: "Actualités", value: detail?.actualites },
                      { label: "Salons", value: detail?.salons },
                    ].map((item) => (
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
                        <div key={`${i}-${p.slice(0, 12)}`} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
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
      </main>
    </div>
  );
}
