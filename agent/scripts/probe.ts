// Connectivity probe: lists tools on each Context endpoint and makes one tiny model call.
// Prints tool names and statuses only, never credentials.
import { createMCPClient } from '@ai-sdk/mcp'
import { generateText } from 'ai'
import { contextEndpoints, MODEL_ID, model } from '../config.ts'
import { PROVIDER_OPTIONS } from '../agent.ts'
import { loadEnv } from '../env.ts'

loadEnv()
for (const [mode, url] of Object.entries(contextEndpoints())) {
  try {
    const client = await createMCPClient({
      transport: { type: 'http', url, headers: { Authorization: `Bearer ${process.env.SANITY_ORGANIZATION_TOKEN}` } },
    })
    const { tools } = await client.listTools()
    console.log(`${mode}: ${url.replace(/organizations\/[^/]+/, 'organizations/<org>')} -> ${tools.map((t) => t.name).join(', ')}`)
    await client.close()
  } catch (e) {
    console.log(`${mode}: FAILED ${(e as Error).message.slice(0, 200)}`)
  }
}
const r = await generateText({ model: model(), prompt: 'Reply with the single word: ok', maxOutputTokens: 300, providerOptions: PROVIDER_OPTIONS })
console.log(`model ${MODEL_ID}: "${r.text.trim()}" (response model ${r.response.modelId})`)
