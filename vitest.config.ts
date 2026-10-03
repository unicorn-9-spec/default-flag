import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{agent,ingest,eval}/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
