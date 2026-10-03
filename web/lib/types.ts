// Shapes shared between the API route and the client components.
import type { AgentRun } from '@default-flag/agent'

export interface SnapshotInfo {
  file: string
  table: string
  sha256: string
  rows: number
  retrievedAt: string
}

export type AskResponse =
  | { ok: true; run: AgentRun; snapshots: SnapshotInfo[]; cached?: { computedAt: string } }
  | { ok: false; error: { component: 'Sanity Context' | 'Sanity dataset' | 'Gemini model' | 'Rate limit' | 'Request'; message: string } }
