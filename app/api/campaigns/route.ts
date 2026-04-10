import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDemoSession } from "../_utils/requireDemoToken";

type CampaignRow = {
  campagne_id: string | number | null;
  sent_to_batibarr_date: string | null;
} & Record<string, unknown>;

type DbError = {
  code?: string;
  message?: string;
};

function isMissingRelationOrColumnError(error: unknown): boolean {
  const e = error as DbError | null;
  const code = e?.code ?? "";
  const message = (e?.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

function toIsoDate(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    const ts = Date.parse(value);
    if (!Number.isNaN(ts)) return new Date(ts).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const ts = new Date(ms).getTime();
    if (!Number.isNaN(ts)) return new Date(ts).toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

function formatCampaignLabel(id: string, dateRaw: string | null): string {
  if (!dateRaw) return `#${id} · date inconnue`;
  const dt = new Date(dateRaw);
  if (Number.isNaN(dt.getTime())) return `#${id} · date inconnue`;
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(dt);
  return `#${id} · ${formatted}`;
}

export async function GET(req: Request) {
  const denied = requireDemoSession(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const sourceRaw = url.searchParams.get("source");
  const schema = sourceRaw === "preprod" ? "preprod" : "data";

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .schema(schema)
      .from("batibarr_client_ia")
      .select("campagne_id, sent_to_batibarr_date")
      .not("campagne_id", "is", null);
    if (error) {
      if (isMissingRelationOrColumnError(error)) {
        return NextResponse.json({ items: [] });
      }
      throw error;
    }

    const rows = (data ?? []) as unknown as CampaignRow[];
    const latestDateByCampaign = new Map<string, string | null>();
    for (const row of rows) {
      if (row.campagne_id === null || row.campagne_id === undefined) continue;
      const id = String(row.campagne_id).trim();
      if (!id) continue;
      const candidate = toIsoDate(row.sent_to_batibarr_date);
      const current = latestDateByCampaign.get(id) ?? null;
      if (current === null) {
        latestDateByCampaign.set(id, candidate);
        continue;
      }
      if (candidate !== null && Date.parse(candidate) > Date.parse(current)) {
        latestDateByCampaign.set(id, candidate);
      }
    }

    const items = Array.from(latestDateByCampaign.entries())
      .map(([id, dateRaw]) => {
        const ts = dateRaw ? Date.parse(dateRaw) : Number.NEGATIVE_INFINITY;
        const numericId = Number.parseInt(id, 10);
        return {
          id,
          date: dateRaw,
          label: formatCampaignLabel(id, dateRaw),
          sortTs: Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts,
          sortId: Number.isNaN(numericId) ? Number.NEGATIVE_INFINITY : numericId,
        };
      })
      .sort((a, b) => {
        if (a.sortTs !== b.sortTs) return b.sortTs - a.sortTs;
        return b.sortId - a.sortId;
      });

    return NextResponse.json({
      items: items.map(({ id, date, label }) => ({ id, date, label })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

