import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * HLS Session proxy endpoint for ReelPlex streaming
 * Handles session-level HLS requests (typically for master playlists)
 * 
 * GET /api/reelplexi/hls/[session]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ session: string }> }
) {
  try {
    const { session } = await params
    
    if (!session) {
      return NextResponse.json(
        { error: 'Missing session parameter' },
        { status: 400 }
      )
    }

    // Validate authentication for streaming
    const authorization = request.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    
    const { data: { user } } = await client.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Build the upstream URL
    const reelplexBaseUrl = process.env.REELPLEXI_BASE_URL || 'https://api.reelplexi.com'
    const upstreamUrl = `${reelplexBaseUrl}/hls/${session}`
    
    // Add API key and any query parameters
    const apiKey = process.env.REELPLEXI_API_KEY
    const searchParams = new URLSearchParams(request.nextUrl.searchParams)
    if (apiKey) {
      searchParams.set('key', apiKey)
    }
    
    const finalUrl = `${upstreamUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    console.log(`[HLS Session Proxy] Fetching: ${finalUrl}`)

    // Forward the request to ReelPlex
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Kilax-Player/1.0',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    })

    if (!response.ok) {
      console.error(`[HLS Session Proxy] Upstream error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: 'Upstream streaming service unavailable' },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl'
    const body = await response.text()

    // Process the manifest to update URLs to use our proxy
    let processedBody = body
    if (contentType.includes('mpegurl') || contentType.includes('m3u8')) {
      // Replace relative URLs in the manifest with our proxy URLs
      processedBody = body.replace(
        /^([^#\n\r]+\.(?:m3u8|ts))$/gm,
        (match, filename) => {
          // Convert relative URLs to use our proxy
          return `/api/reelplexi/hls/${session}/${filename}`
        }
      )
    }

    return new NextResponse(processedBody, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
      },
    })

  } catch (error) {
    console.error('[HLS Session Proxy] Error:', error)
    return NextResponse.json(
      { error: 'HLS session proxy request failed' },
      { status: 502 }
    )
  }
}

/**
 * Handle preflight OPTIONS requests for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}