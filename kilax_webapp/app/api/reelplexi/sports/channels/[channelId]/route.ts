import { NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'
import { requireStreamingPackageAccess } from '@/lib/require-standard-access'
import { FREE_LIVE_CHANNEL_IDS } from '@/lib/live-tv-access'

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const { channelId } = await params
    if (!FREE_LIVE_CHANNEL_IDS.has(channelId.toLowerCase())) {
      const access = await requireStreamingPackageAccess(request)
      if (!access.allowed) return access.response
    }
    const channel = await ReelplexiService.getSportsChannel(channelId)
    return NextResponse.json(channel, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Channel request failed' },
      { status: 502 },
    )
  }
}