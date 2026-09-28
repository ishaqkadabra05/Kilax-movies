import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * HLS Proxy endpoint for ReelPlex streaming
 * Handles .m3u8 manifest files and .ts video segments
 * 
 * GET /api/reelplexi/hls/[session]/[file]
 * 
 * This endpoint proxies HLS streaming requests to prevent CORS issues
 * and maintain streaming session continuity without player resets.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ session: string; file: string }> }
) {
  try {
    const { session, file } = await params
    
    if (!session || !file) {
      return NextResponse.json(
        { error: 'Missing session or file parameter' },
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
    const upstreamUrl = `${reelplexBaseUrl}/hls/${session}/${file}`
    
    // Add API key if available
    const apiKey = process.env.REELPLEXI_API_KEY
    const finalUrl = apiKey ? `${upstreamUrl}?key=${encodeURIComponent(apiKey)}` : upstreamUrl

    console.log(`[HLS Proxy] Fetching: ${finalUrl}`)

    // Forward the request to ReelPlex
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Kilax-Player/1.0',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        // Forward original request headers that might be needed
        ...(request.headers.get('range') ? { 'Range': request.headers.get('range')! } : {}),
      },
    })

    if (!response.ok) {
      console.error(`[HLS Proxy] Upstream error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: 'Upstream streaming service unavailable' },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentLength = response.headers.get('content-length')
    const acceptRanges = response.headers.get('accept-ranges')
    const contentRange = response.headers.get('content-range')

    // Get the response body
    const body = await response.arrayBuffer()

    // Create response with appropriate headers for streaming
    const proxyResponse = new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': file.endsWith('.m3u8') 
          ? 'no-cache, no-store, must-revalidate' // Don't cache manifests
          : 'public, max-age=3600', // Cache video segments for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        ...(acceptRanges ? { 'Accept-Ranges': acceptRanges } : {}),
        ...(contentRange ? { 'Content-Range': contentRange } : {}),
      },
    })

    return proxyResponse

  } catch (error) {
    console.error('[HLS Proxy] Error:', error)
    return NextResponse.json(
      { error: 'HLS proxy request failed' },
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