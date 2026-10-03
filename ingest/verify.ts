// Step 1: check every raw snapshot file against its MANIFEST (size + SHA-256).
// The owner fetches sources; this pipeline never downloads anything.
import { DOCS_DIR, TABLES_DIR, verifyManifest } from './lib/archive.ts'

let failed = 0
for (const dir of [TABLES_DIR, DOCS_DIR]) {
  for (const r of verifyManifest(dir)) {
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${new URL(r.file, dir).pathname.split('/raw/')[1]}${r.reason ? ` (${r.reason})` : ''}`)
    if (!r.ok) failed++
  }
}
if (failed) {
  console.error(`${failed} snapshot file(s) do not match their manifest`)
  process.exit(1)
}
