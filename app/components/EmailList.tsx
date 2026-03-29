"use client";

import { useMemo, useState } from "react";
import type { EmailListItem as EmailListItemType } from "@/app/types/email";
import { EmailListItem } from "./EmailListItem";

export type InboxFilter = "all" | "unread" | "read";

type Props = {
  items: EmailListItemType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  readIds: Set<string>;
  listLoading: boolean;
  listError: string | null;
  offset: number;
  activeRule: string;
  onMarkAllRead: () => void;
  onResetRead: () => void;
};

export function EmailList({
  items,
  selectedId,
  onSelect,
  readIds,
  listLoading,
  listError,
  offset,
  activeRule,
  onMarkAllRead,
  onResetRead,
}: Props) {
  const [filter, setFilter] = useState<InboxFilter>("all");

  const { readCount, unreadCount, visibleItems } = useMemo(() => {
    const read = items.filter((i) => readIds.has(i.id)).length;
    const unread = items.length - read;
    let visible = items;
    if (filter === "unread") visible = items.filter((i) => !readIds.has(i.id));
    if (filter === "read") visible = items.filter((i) => readIds.has(i.id));
    return { readCount: read, unreadCount: unread, visibleItems: visible };
  }, [items, readIds, filter]);

  const progressPct = items.length > 0 ? Math.round((readCount / items.length) * 100) : 0;

  return (
    <section className="w-[420px] border-r border-zinc-200 bg-white flex flex-col shrink-0">
      <div className="border-b border-zinc-200 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-zinc-900">
            {listLoading ? "Chargement…" : `${unreadCount} non lu${unreadCount !== 1 ? "s" : ""} / ${items.length} email(s)`}
          </div>
          <div className="text-xs text-zinc-500 whitespace-nowrap">
            offset {offset} · {activeRule}
          </div>
        </div>

        {items.length > 0 && !listLoading ? (
          <div className="space-y-1">
            <div
              className="h-2 w-full rounded-full bg-zinc-200 overflow-hidden"
              role="progressbar"
              aria-valuenow={readCount}
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-label="Progression de lecture"
            >
              <div
                className="h-full bg-zinc-700 transition-[width] duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-xs text-zinc-500">{readCount} relu{readCount !== 1 ? "s" : ""}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs font-medium">
            {(
              [
                { key: "all" as const, label: "Tous" },
                { key: "unread" as const, label: "Non lus" },
                { key: "read" as const, label: "Lus" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={[
                  "rounded-md px-2.5 py-1 transition-colors",
                  filter === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={listLoading || items.length === 0}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
          >
            Tout marquer lu
          </button>
          <button
            type="button"
            onClick={onResetRead}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            title="Effacer les états lus (navigateur)"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {listError ? <div className="px-4 py-3 text-sm text-red-600">{listError}</div> : null}

      <div className="overflow-auto flex-1">
        {items.length === 0 && !listLoading ? (
          <div className="px-4 py-6 text-sm text-zinc-600">Aucun email à afficher.</div>
        ) : null}

        {visibleItems.length === 0 && items.length > 0 && !listLoading ? (
          <div className="px-4 py-6 text-sm text-zinc-600">Aucun email dans ce filtre.</div>
        ) : null}

        <div className="divide-y divide-zinc-100">
          {visibleItems.map((item) => (
            <EmailListItem
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              isRead={readIds.has(item.id)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
