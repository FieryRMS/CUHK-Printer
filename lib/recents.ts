const STORAGE_KEY = "cuhk-printer-recents"

export interface RecentServer {
  url: string
  label: string
  count: number
  lastUsed: number
}

export function getRecents(): RecentServer[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as RecentServer[]) : []
  } catch {
    return []
  }
}

export function recordServerUsage(url: string, label: string): void {
  if (typeof window === "undefined") return
  try {
    const recents = getRecents()
    const existing = recents.find((r) => r.url === url)
    if (existing) {
      existing.count++
      existing.lastUsed = Date.now()
    } else {
      recents.push({ url, label, count: 1, lastUsed: Date.now() })
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recents))
  } catch {
    // ignore storage errors
  }
}
