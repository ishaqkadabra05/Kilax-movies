import { NextRequest, NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const playlist = id
    ? await ReelplexiService.getPlaylist(id)
    : await ReelplexiService.getPlaylists()

  if (id && !playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
  }

  return NextResponse.json(id ? { playlist } : { playlists: playlist })
}