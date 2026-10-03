import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{agent,ingest,eval}/**/*.test.ts'],
  },
})
