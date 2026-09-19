import { NextRequest, NextResponse } from "next/server"
import ReelplexiService from "@/lib/reelplexi-service"
export async function GET(req: NextRequest) {
  try {
    const page = Number(req.nextUrl.searchParams.get("page") || "1")
    const perPage = Number(req.nextUrl.searchParams.get("perPage") || "30")
    const items = await ReelplexiService.getTrendingAll(page, perPage)
    return NextResponse.json({ data: items, pagination: { page, perPage, hasMore: items.length === perPage } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trending request failed" }, { status: 502 })
  }
}
