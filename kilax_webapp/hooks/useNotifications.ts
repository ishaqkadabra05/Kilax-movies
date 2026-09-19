import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/lib/types/media'

export function useNotifications(isLoggedIn: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true

    const load = async (attempt = 0) => {
      if (!alive) return

      if (!isLoggedIn) {
        setNotifications([])
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return

        const response = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        })

        if (!alive) return

        if (response.ok) {
          const payload = await response.json()
          setNotifications(
            Array.isArray(payload.notifications) ? payload.notifications : []
          )
        }
        // Non-ok responses (401, 500 etc.) are silently ignored — notifications
        // are non-critical and should never break the page

      } catch (err) {
        // fetch throws TypeError when the server isn't reachable yet (dev cold
        // start, network blip, etc.).  Retry up to 3 times with backoff so the
        // notifications still load once the server is ready, but never throw.
        if (!alive) return
        const maxRetries = 3
        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt) // 1 s, 2 s, 4 s
          console.warn(
            `[useNotifications] fetch failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay / 1000}s…`,
            err instanceof Error ? err.message : err
          )
          retryRef.current = setTimeout(() => load(attempt + 1), delay)
        } else {
          console.warn('[useNotifications] Could not load notifications after retries — skipping.')
        }
      }
    }

    void load()

    return () => {
      alive = false
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [isLoggedIn])

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(current =>
      current.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    )

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          Authorization:  `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId: id }),
      })
    } catch {
      // PATCH failure is non-critical — the optimistic update stays
    }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(current =>
      current.map(n => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
    )

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          Authorization:  `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId: 'all' }),
      })
    } catch {
      // non-critical
    }
  }, [])

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read_at).length,
    markRead,
    markAllRead,
  }
}
