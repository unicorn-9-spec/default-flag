import 'server-only'
import { sanity } from '@default-flag/agent'
import type { SnapshotInfo } from './types'

export async function snapshots(): Promise<SnapshotInfo[]> {
  return sanity().fetch(`*[_type == "snapshot"] | order(file asc){file, table, sha256, rows, retrievedAt}`)
}

// In-memory sliding-window limiter. Per server instance; enough to stop casual abuse
// of the public demo without needing a login.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 6
const hits = new Map<string, number[]>()

export function rateLimited(key: string): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent)
    return true
  }
  recent.push(now)
  hits.set(key, recent)
  return false
}
