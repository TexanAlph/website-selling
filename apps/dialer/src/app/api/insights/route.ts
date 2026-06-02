import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerClient();

    const [{ data: insight }, { data: scraper }] = await Promise.all([
      supabase
        .from("daily_insights")
        .select("report_date, content, created_at")
        .order("report_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("scraper_runs")
        .select(
          "started_at, finished_at, status, leads_upserted, error_message",
        )
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      dailyInsight: insight ?? null,
      lastScraperRun: scraper ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load insights" },
      { status: 500 },
    );
  }
}
