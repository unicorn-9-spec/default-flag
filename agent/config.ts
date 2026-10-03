// Runtime configuration shared by the agent, the web app and the evaluation.
import fs from 'node:fs'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

/** Pinned model: every evaluation arm uses this exact id (checked against models.list on 2026-10-03). */
export const MODEL_ID = 'gemini-3.8-flash'

export function loadEnv(): void {
  const file = new URL('../.env.local', import.meta.url)
  if (fs.existsSync(file)) process.loadEnvFile(file)
}

export function model() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return createGoogleGenerativeAI({ apiKey })(MODEL_ID)
}

/** Context MCP endpoints: one dataset (GROQ) mode, one Knowledge Base mode. */
export function contextEndpoints(): { data: string; kb: string } {
  const org = process.env.SANITY_ORG_ID
  if (!org) throw new Error('SANITY_ORG_ID is not set')
  const base = `https://api.sanity.io/v1/context/organizations/${org}/mcp`
  return {
    data: `${base}/${process.env.CONTEXT_DATA_ENDPOINT ?? 'defaultflag-data'}`,
    kb: `${base}/${process.env.CONTEXT_KB_ENDPOINT ?? 'defaultflag-kb'}`,
  }
}
