import { NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'
import { requireStandardAccess } from '@/lib/require-standard-access'

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const access = await requireStandardAccess(request)
  if (!access.allowed) return access.response

  try {
    const { channelId } = await params
    const channel = await ReelplexiService.getSportsChannel(channelId)
    return NextResponse.json(channel, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Channel request failed' },
      { status: 502 },
    )
  }
}