"use client";

import type { EmailListItem } from "@/app/types/email";
import { companyLine } from "@/lib/emailFormat";

type Props = {
  items: EmailListItem[];
  readIds: Set<string>;
  campaignId: string;
  disabled?: boolean;
};

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ExportButton({ items, readIds, campaignId, disabled }: Props) {
  function exportCsv() {
    const headers = ["id", "campagne_id", "société", "sujet", "date_génération", "lu"];
    const rows = items.map((item) => {
      const société = companyLine(item.company);
      const sujet = item.email_brouillon_sujet ?? "";
      const date = item.date_generation ?? "";
      const lu = readIds.has(item.id) ? "oui" : "non";
      return [
        escapeCsvField(item.id),
        escapeCsvField(campaignId.trim() || ""),
        escapeCsvField(société),
        escapeCsvField(sujet),
        escapeCsvField(date),
        escapeCsvField(lu),
      ].join(",");
    });
    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `batibarr-emails-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      disabled={disabled || items.length === 0}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
    >
      Exporter CSV
    </button>
  );
}
