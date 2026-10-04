import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.SANITY_PROJECT_ID ?? '',
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  server: { port: 3334 },
  // Hosted Studio: Sanity Context dataset mode checks for a deployed Studio application.
  studioHost: 'default-flag',
  deployment: { appId: 'g00c7ixv4uq1kzgq1yhoo2f1' },
})
