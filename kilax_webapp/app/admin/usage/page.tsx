'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Metrics = {
  active_users_24h: number
  active_users_30d: number
  movie_streams: number
  series_streams: number
  movie_viewers: number
  series_viewers: number
  total_views: number
  total_viewers: number
}

type ContentMetric = {
  content_type: string
  content_id: string
  content_title: string | null
  view_count: number
  unique_viewers: number
}

type DailyMetric = {
  usage_date: string
  view_count: number
  unique_viewers: number
}

type ReelplexiContentMetric = {
  id: string | number
  title: string
  view_count: number
}

type UsageUser = {
  user_id: string
  last_active_at: string
  stream_starts: number
  completed_streams: number
  incomplete_streams: number
  movies_watched: number
  series_watched: number
  movie_streams: number
  series_streams: number
  watch_seconds: number
  profile: { email?: string | null; full_name?: string | null } | null
}

export default function AdminUsagePage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [users, setUsers] = useState<UsageUser[]>([])
  const [content, setContent] = useState<ContentMetric[]>([])
  const [daily, setDaily] = useState<DailyMetric[]>([])
  const [reelplexi, setReelplexi] = useState<{ top_movies: ReelplexiContentMetric[]; top_series: ReelplexiContentMetric[] } | null>(null)
  const [status, setStatus] = useState('Loading usage data...')

  async function loadUsage() {
    setStatus('Loading usage data...')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in with an administrator account first.')
      const response = await fetch('/api/admin/usage', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load usage data')
      setMetrics(result.metrics)
      setUsers(result.users || [])
      setContent(result.content || [])
      setDaily(result.daily || [])
      setReelplexi(result.reelplexi || null)
      setStatus('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load usage data')
    }
  }

  useEffect(() => { void loadUsage() }, [])

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Kilax admin</p>
          <h1 style={styles.heading}>Viewing activity</h1>
          <p style={styles.muted}>Streams recorded from the last activity event for each user.</p>
        </div>
        <button type="button" onClick={() => void loadUsage()} style={styles.button}>Refresh</button>
      </header>

      {status && <p role="status" style={styles.status}>{status}</p>}

      {metrics && <section style={styles.cards} aria-label="Usage metrics">
        <Metric label="Active users, 24h" value={metrics.active_users_24h} />
        <Metric label="Active users, 30d" value={metrics.active_users_30d} />
        <Metric label="Movie streams" value={metrics.movie_streams} detail={`${metrics.movie_viewers} users`} />
        <Metric label="Series streams" value={metrics.series_streams} detail={`${metrics.series_viewers} users`} />
        <Metric label="Total viewers" value={metrics.total_viewers} detail="unique users" />
        <Metric label="Total views" value={metrics.total_views} detail="stream starts" />
      </section>}

      <section style={styles.panel}>
        <h2 style={styles.subheading}>Most viewed content</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr>{['Content', 'Type', 'Views', 'Unique viewers'].map((heading) => <th key={heading} style={styles.th}>{heading}</th>)}</tr></thead>
            <tbody>
              {content.map((item) => <tr key={`${item.content_type}:${item.content_id}`}>
                <td style={styles.td}><strong>{item.content_title || item.content_id}</strong><small style={styles.small}>{item.content_id}</small></td>
                <td style={styles.td}>{item.content_type}</td>
                <td style={styles.td}>{item.view_count.toLocaleString()}</td>
                <td style={styles.td}>{item.unique_viewers.toLocaleString()}</td>
              </tr>)}
              {!content.length && !status && <tr><td colSpan={4} style={styles.empty}>No streaming history has been recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.subheading}>Daily viewing trend</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr>{['Date', 'Views', 'Unique viewers'].map((heading) => <th key={heading} style={styles.th}>{heading}</th>)}</tr></thead>
            <tbody>{daily.map((item) => <tr key={item.usage_date}>
              <td style={styles.td}>{item.usage_date}</td>
              <td style={styles.td}>{item.view_count.toLocaleString()}</td>
              <td style={styles.td}>{item.unique_viewers.toLocaleString()}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      {reelplexi && <section style={styles.panel}>
        <h2 style={styles.subheading}>Reelplexi content views</h2>
        <p style={styles.muted}>View counts reported by Reelplexi for the last 30 days.</p>
        <div style={styles.analyticsColumns}>
          <AnalyticsList heading="Top movies" items={reelplexi.top_movies} />
          <AnalyticsList heading="Top series" items={reelplexi.top_series} />
        </div>
      </section>}

      <section style={styles.panel}>
        <h2 style={styles.subheading}>Users and watched content</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr>{['User', 'Last active', 'Movies watched', 'Series watched', 'Movie streams', 'Series streams', 'Watch time'].map((heading) => <th key={heading} style={styles.th}>{heading}</th>)}</tr></thead>
            <tbody>
              {users.map((user) => <tr key={user.user_id}>
                <td style={styles.td}><strong>{user.profile?.full_name || user.profile?.email || 'Unknown user'}</strong><small style={styles.small}>{user.profile?.email || user.user_id}</small></td>
                <td style={styles.td}>{formatDate(user.last_active_at)}</td>
                <td style={styles.td}>{user.movies_watched}</td>
                <td style={styles.td}>{user.series_watched}</td>
                <td style={styles.td}>{user.movie_streams}</td>
                <td style={styles.td}>{user.series_streams}</td>
                <td style={styles.td}>{formatDuration(user.watch_seconds)}</td>
              </tr>)}
              {!users.length && !status && <tr><td colSpan={7} style={styles.empty}>No viewing activity has been recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return <div style={styles.card}><span style={styles.muted}>{label}</span><strong style={styles.value}>{value.toLocaleString()}</strong>{detail && <small style={styles.small}>{detail}</small>}</div>
}

function AnalyticsList({ heading, items }: { heading: string; items: ReelplexiContentMetric[] }) {
  return <div><h3 style={styles.listHeading}>{heading}</h3><ol style={styles.list}>
    {items.map((item) => <li key={item.id} style={styles.listItem}><span>{item.title}</span><strong>{item.view_count.toLocaleString()}</strong></li>)}
    {!items.length && <li style={styles.small}>No Reelplexi analytics available.</li>}
  </ol></div>
}

function formatDate(value: string) { return new Date(value).toLocaleString() }
function formatDuration(seconds: number) { return `${Math.floor(seconds / 60)}m ${seconds % 60}s` }

const styles = {
  main: { minHeight: '100vh', background: '#0d1117', color: '#f8fafc', padding: '42px 24px', fontFamily: "'DM Sans', sans-serif" },
  header: { maxWidth: 1280, margin: '0 auto 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20 },
  eyebrow: { color: '#60a5fa', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' as const, margin: 0 },
  heading: { margin: '8px 0', fontSize: 32 },
  subheading: { margin: 0, fontSize: 20 },
  muted: { color: '#94a3b8', fontSize: 14 },
  status: { maxWidth: 1280, margin: '0 auto 18px', color: '#fbbf24' },
  button: { background: '#2563eb', color: 'white', border: 0, borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' },
  cards: { maxWidth: 1280, margin: '0 auto 28px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 },
  card: { background: '#161b22', border: '1px solid #263244', borderRadius: 8, padding: 18, display: 'grid', gap: 8 },
  value: { fontSize: 30 },
  small: { display: 'block', color: '#64748b', fontSize: 12, marginTop: 4 },
  panel: { maxWidth: 1280, margin: '0 auto', background: '#111820', border: '1px solid #263244', borderRadius: 8, padding: 20 },
  analyticsColumns: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, marginTop: 18 },
  listHeading: { fontSize: 15, margin: '0 0 8px' },
  list: { margin: 0, paddingLeft: 22 },
  listItem: { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid #1e293b', fontSize: 14 },
  tableWrap: { overflowX: 'auto' as const, marginTop: 16 },
  table: { width: '100%', borderCollapse: 'collapse' as const, minWidth: 820 },
  th: { color: '#94a3b8', fontSize: 12, textAlign: 'left' as const, padding: '12px 10px', borderBottom: '1px solid #263244', whiteSpace: 'nowrap' as const },
  td: { padding: '14px 10px', borderBottom: '1px solid #1e293b', fontSize: 14, verticalAlign: 'top' as const },
  empty: { color: '#94a3b8', textAlign: 'center' as const, padding: 32 },
}