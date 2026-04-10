import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDemoSession } from "../_utils/requireDemoToken";

type CampaignRow = {
  id: string | number | null;
} & Record<string, unknown>;

function pickDateValue(row: Record<string, unknown>): string | null {
  const keys = [
    "date_generation",
    "created_at",
    "campaign_date",
    "date",
    "generated_at",
    "sent_to_batibarr_date",
    "start_date",
  ];

  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value))) {
      return value;
    }
  }
  return null;
}

function formatCampaignLabel(id: string, dateRaw: string | null): string {
  if (!dateRaw) return `Campagne #${id}`;
  const dt = new Date(dateRaw);
  if (Number.isNaN(dt.getTime())) return `Campagne #${id}`;
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
  return `${formatted} · #${id}`;
}

export async function GET(req: Request) {
  const denied = requireDemoSession(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const sourceRaw = url.searchParams.get("source");
  const schema = sourceRaw === "preprod" ? "preprod" : "data";

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.schema(schema).from("batibarr_campaigns").select("*");
    if (error) throw error;

    const rows = (data ?? []) as unknown as CampaignRow[];
    const items = rows
      .map((row) => {
        if (row.id === null || row.id === undefined) return null;
        const id = String(row.id);
        const dateRaw = pickDateValue(row);
        const ts = dateRaw ? Date.parse(dateRaw) : Number.NEGATIVE_INFINITY;
        return {
          id,
          date: dateRaw,
          label: formatCampaignLabel(id, dateRaw),
          sortTs: Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts,
        };
      })
      .filter((x): x is { id: string; date: string | null; label: string; sortTs: number } => x !== null)
      .sort((a, b) => b.sortTs - a.sortTs);

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

