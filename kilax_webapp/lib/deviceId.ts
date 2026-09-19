/**
 * lib/deviceId.ts
 *
 * Generates and persists a unique device ID for this browser.
 * Format: klm_dev_<16 hex chars>
 *
 * Persistence strategy (most → least durable):
 *   1. localStorage  — survives page refresh, lost on clear/incognito
 *   2. IndexedDB     — slightly more durable than localStorage
 *   3. sessionStorage — fallback, survives only the session
 *
 * The same ID is used across all three so whichever survives is picked up.
 */

const KEY       = 'kilax_device_id'
const DB_NAME   = 'kilax_db'
const DB_STORE  = 'meta'
const DB_KEY    = 'device_id'

// ── Generate ──────────────────────────────────────────────────────────────────
function generateDeviceId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `klm_dev_${hex}`
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
function idbGet(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(DB_STORE)
      }
      req.onsuccess = () => {
        const tx  = req.result.transaction(DB_STORE, 'readonly')
        const get = tx.objectStore(DB_STORE).get(DB_KEY)
        get.onsuccess = () => resolve(get.result ?? null)
        get.onerror   = () => resolve(null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function idbSet(id: string): void {
  try {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
    req.onsuccess = () => {
      const tx = req.result.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).put(id, DB_KEY)
    }
  } catch {
    // non-critical
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the persistent device ID for this browser, creating one if needed.
 * Async because it tries IndexedDB.
 */
export async function getDeviceId(): Promise<string> {
  // 1. localStorage
  try {
    const ls = localStorage.getItem(KEY)
    if (ls) return ls
  } catch { /* private browsing blocks localStorage */ }

  // 2. IndexedDB
  try {
    const idb = await idbGet()
    if (idb) {
      // Re-sync into localStorage
      try { localStorage.setItem(KEY, idb) } catch { /* ignore */ }
      return idb
    }
  } catch { /* ignore */ }

  // 3. sessionStorage
  try {
    const ss = sessionStorage.getItem(KEY)
    if (ss) return ss
  } catch { /* ignore */ }

  // Generate new ID and persist everywhere
  const id = generateDeviceId()
  try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
  try { sessionStorage.setItem(KEY, id) } catch { /* ignore */ }
  idbSet(id)

  return id
}

/**
 * Build a human-readable device label from the browser UA.
 * e.g. "Chrome on Android", "Safari on iOS", "Firefox on Windows"
 */
export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown'
  const ua = navigator.userAgent

  let browser = 'Browser'
  if      (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
  else if (ua.includes('Firefox'))                         browser = 'Firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome'))browser = 'Safari'
  else if (ua.includes('Edg'))                             browser = 'Edge'
  else if (ua.includes('OPR') || ua.includes('Opera'))    browser = 'Opera'

  let os = 'Unknown OS'
  if      (ua.includes('Android'))  os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Windows'))  os = 'Windows'
  else if (ua.includes('Mac'))      os = 'macOS'
  else if (ua.includes('Linux'))    os = 'Linux'

  return `${browser} on ${os}`
}
