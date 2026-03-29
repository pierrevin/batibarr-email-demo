"use client";

import type { EmailListItem as EmailListItemType } from "@/app/types/email";
import { companyLine, formatDate } from "@/lib/emailFormat";

type Props = {
  item: EmailListItemType;
  isSelected: boolean;
  isRead: boolean;
  onSelect: (id: string) => void;
};

export function EmailListItem({ item, isSelected, isRead, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={[
        "w-full text-left px-4 py-3 transition-colors flex gap-2 items-start",
        isSelected ? "bg-zinc-100 ring-inset ring-1 ring-zinc-200" : "bg-white hover:bg-zinc-50",
        isRead ? "opacity-55" : "opacity-100",
      ].join(" ")}
    >
      <span
        className={[
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          isRead ? "bg-zinc-300" : "bg-blue-600",
        ].join(" ")}
        aria-hidden
      />
      <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-900 truncate">{companyLine(item.company)}</div>
          <div className="mt-1 text-sm text-zinc-700 truncate">
            {item.email_brouillon_sujet || "Sans sujet"}
          </div>
        </div>
        <div className="text-xs text-zinc-500 whitespace-nowrap">{formatDate(item.date_generation)}</div>
      </div>
    </button>
  );
}
