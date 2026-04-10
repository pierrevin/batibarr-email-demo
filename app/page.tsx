"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmailDetail } from "@/app/components/EmailDetail";
import { EmailList } from "@/app/components/EmailList";
import { ExportButton } from "@/app/components/ExportButton";
import { useReadEmails } from "@/app/hooks/useReadEmails";
import type {
  CampaignOption,
  EmailDetail as EmailDetailType,
  EmailListItem,
  EmailStats,
} from "@/app/types/email";
import { fetchJson } from "@/lib/fetchJson";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [campaignId, setCampaignId] = useState<string>("");
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [source, setSource] = useState<"prod" | "preprod">("prod");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [items, setItems] = useState<EmailListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailDetailType | null>(null);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [selectedRepresentativeId, setSelectedRepresentativeId] = useState<string | null>(null);

  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [activeRule, setActiveRule] = useState<"first" | "last" | "keep">("first");
  const [bodyViewMode, setBodyViewMode] = useState<"auto" | "html" | "text">("auto");

  const { readIds, markAsRead, markAllAsRead, resetRead } = useReadEmails();

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
    async (
      newOffset: number,
      strategy: "first" | "last" | "keep",
      preservedSelectedId: string | null = null,
    ) => {
      if (!isAuthenticated) return;
      setListError(null);
      setListLoading(true);
      setActiveRule(strategy);

      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(newOffset));
      params.set("source", source);
      if (campaignId.trim()) params.set("campagne_id", campaignId.trim());

      try {
        const data = await fetchJson<{ items: EmailListItem[]; hasMore: boolean; stats: EmailStats }>(
          `/api/emails?${params.toString()}`,
        );

        setItems(data.items);
        setHasMore(data.hasMore);
        setStats(data.stats ?? { totalCompanies: 0, byRepresentative: [] });
        setOffset(newOffset);

        if (data.items.length === 0) {
          setSelectedId(null);
          setDetail(null);
          return;
        }

        const keepSelected =
          strategy === "keep" &&
          preservedSelectedId &&
          data.items.some((x) => x.id === preservedSelectedId);

        if (keepSelected) {
          // selectedId déjà valide
        } else if (strategy === "last") {
          setSelectedId(data.items[data.items.length - 1].id);
        } else {
          setSelectedId(data.items[0].id);
        }
      } catch (e) {
        setListError(e instanceof Error ? e.message : String(e));
        setItems([]);
        setStats({ totalCompanies: 0, byRepresentative: [] });
        setSelectedId(null);
        setDetail(null);
        setHasMore(false);
      } finally {
        setListLoading(false);
      }
    },
    [isAuthenticated, campaignId, source, limit],
  );

  useEffect(() => {
    const run = async () => {
      if (!isAuthenticated) return;
      setCampaignsLoading(true);
      setCampaignsError(null);
      try {
        const params = new URLSearchParams();
        params.set("source", source);
        const data = await fetchJson<{ items: CampaignOption[] }>(`/api/campaigns?${params.toString()}`);
        const nextCampaigns = data.items ?? [];
        setCampaigns(nextCampaigns);
        // Par defaut: selectionner la campagne la plus recente.
        if (nextCampaigns.length > 0) {
          setCampaignId(nextCampaigns[0].id);
        } else {
          setCampaignId("");
        }
      } catch (e) {
        setCampaigns([]);
        setCampaignsError(e instanceof Error ? e.message : String(e));
        setCampaignId("");
      } finally {
        setCampaignsLoading(false);
      }
    };
    run();
  }, [isAuthenticated, source]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadList(0, "first");
  }, [isAuthenticated, source, campaignId, loadList]);

  useEffect(() => {
    if (!isAuthenticated || !selectedId) return;
    markAsRead(selectedId);
  }, [isAuthenticated, selectedId, markAsRead]);

  useEffect(() => {
    if (!isAuthenticated || !selectedId) return;
    setDetailLoading(true);
    setListError(null);

    const run = async () => {
      try {
        const params = new URLSearchParams();
        params.set("source", source);
        const d = await fetchJson<EmailDetailType>(
          `/api/emails/${encodeURIComponent(selectedId)}?${params.toString()}`,
        );
        setDetail(d);
      } catch (e) {
        setListError(e instanceof Error ? e.message : String(e));
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };
    run();
  }, [isAuthenticated, selectedId, source]);

  const filteredItems = useMemo(() => {
    if (selectedRepresentativeId === null) return items;
    return items.filter((item) => {
      const repId = item.representative_id ?? item.company?.representative?.id ?? null;
      return repId === selectedRepresentativeId;
    });
  }, [items, selectedRepresentativeId]);

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filteredItems.findIndex((x) => x.id === selectedId);
  }, [filteredItems, selectedId]);

  const atFirst = selectedIndex <= 0;
  const atLast = selectedIndex >= items.length - 1;

  const readCountInList = useMemo(
    () => filteredItems.filter((i) => readIds.has(i.id)).length,
    [filteredItems, readIds],
  );

  const goPrev = useCallback(async () => {
    if (listLoading) return;
    const idx = filteredItems.findIndex((x) => x.id === selectedId);
    if (idx > 0) {
      setSelectedId(filteredItems[idx - 1].id);
      return;
    }
    if (offset <= 0) return;
    const newOffset = Math.max(0, offset - limit);
    await loadList(newOffset, "last", selectedId);
  }, [listLoading, filteredItems, selectedId, offset, limit, loadList]);

  const goNext = useCallback(async () => {
    if (listLoading) return;
    const idx = filteredItems.findIndex((x) => x.id === selectedId);
    if (idx >= 0 && idx < filteredItems.length - 1) {
      setSelectedId(filteredItems[idx + 1].id);
      return;
    }
    if (!hasMore) return;
    await loadList(offset + limit, "first", selectedId);
  }, [listLoading, filteredItems, selectedId, hasMore, offset, limit, loadList]);

  useEffect(() => {
    if (!selectedId) return;
    if (!filteredItems.some((x) => x.id === selectedId)) {
      setSelectedId(filteredItems.length > 0 ? filteredItems[0].id : null);
    }
  }, [filteredItems, selectedId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (t instanceof HTMLSelectElement) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        void goPrev();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        void goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthenticated, goPrev, goNext]);

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
    setStats(null);
    setSelectedId(null);
    setDetail(null);
    setSelectedRepresentativeId(null);
  }

  function applySource(newSource: "prod" | "preprod") {
    setSource(newSource);
    setCampaignId("");
    setItems([]);
    setStats(null);
    setSelectedId(null);
    setDetail(null);
    setOffset(0);
    setHasMore(true);
  }

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead(items.map((i) => i.id));
  }, [items, markAllAsRead]);

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
            type="button"
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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="sticky top-0 z-10 shrink-0 bg-white border-b border-zinc-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm text-zinc-600">Batibarr</div>
              <div className="text-lg font-semibold leading-tight">Boite de reception IA</div>
              {!listLoading && items.length > 0 ? (
                <div className="mt-1 text-xs text-zinc-500">
                  {filteredItems.length} email{filteredItems.length !== 1 ? "s" : ""} · {readCountInList} lu
                  {readCountInList !== 1 ? "s" : ""}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-700" htmlFor="source">
                  Base
                </label>
                <select
                  id="source"
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400"
                  value={source}
                  onChange={(e) => void applySource(e.target.value as "prod" | "preprod")}
                  disabled={listLoading}
                >
                  <option value="prod">Prod</option>
                  <option value="preprod">Preprod</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-700" htmlFor="campagneId">
                  Campagne
                </label>
                <select
                  id="campagneId"
                  className="w-60 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  disabled={listLoading || campaignsLoading}
                >
                  <option value="">Toutes les campagnes</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700">
                Societes: <span className="font-semibold text-zinc-900">{stats?.totalCompanies ?? 0}</span>
              </div>

              <ExportButton
                items={items}
                readIds={readIds}
                campaignId={campaignId}
                disabled={listLoading}
              />
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                Se deconnecter
              </button>
            </div>
          </div>

          <div className="mt-2 flex justify-end">
            <div className="w-fit max-w-[820px] rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
              <div className="text-[11px] text-zinc-600">Commercial</div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedRepresentativeId(null)}
                className={[
                  "rounded border px-1.5 py-0.5 text-[11px]",
                  selectedRepresentativeId === null
                    ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100",
                ].join(" ")}
              >
                Tous
              </button>
              {(stats?.byRepresentative ?? []).slice(0, 6).map((row) => (
                <button
                  type="button"
                  key={row.representativeId ?? "unassigned"}
                  onClick={() => setSelectedRepresentativeId(row.representativeId)}
                  className={[
                    "rounded border px-1.5 py-0.5 text-[11px] max-w-[180px] truncate",
                    selectedRepresentativeId === row.representativeId
                      ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                  title={`${row.representativeName} (${row.companyCount})`}
                >
                  {row.representativeName} ({row.companyCount})
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
        {campaignsError ? (
          <div className="px-4 pb-2 text-xs text-red-600">Erreur campagnes: {campaignsError}</div>
        ) : null}
      </header>

      <main className="grid flex-1 min-h-0 grid-cols-[220px_minmax(0,1fr)]">
        <EmailList
          items={filteredItems}
          selectedId={selectedId}
          onSelect={setSelectedId}
          readIds={readIds}
          listLoading={listLoading}
          listError={listError}
          offset={offset}
          activeRule={activeRule}
          onMarkAllRead={handleMarkAllRead}
          onResetRead={resetRead}
        />

        <EmailDetail
          detail={detail}
          selectedId={selectedId}
          detailLoading={detailLoading}
          bodyViewMode={bodyViewMode}
          onBodyViewModeChange={setBodyViewMode}
          onPrev={goPrev}
          onNext={goNext}
          prevDisabled={offset <= 0 && atFirst}
          nextDisabled={filteredItems.length === 0 || (atLast && !hasMore)}
          listLoading={listLoading}
        />
      </main>
    </div>
  );
}
