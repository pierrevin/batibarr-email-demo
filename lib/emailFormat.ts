import type { Company } from "@/app/types/email";

export function formatDate(dateStr: string | null) {
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

export function companyLine(c: Company) {
  if (!c) return "—";
  const parts = [c.name, c.entity].filter((x) => (x ?? "").trim().length > 0);
  if (parts.length === 0) return "—";
  return parts.join(" · ");
}

export function isLikelyHtml(content: string | null) {
  if (!content) return false;
  return /<\/?[a-z][\s\S]*>/i.test(content) || /<!doctype html>/i.test(content);
}
