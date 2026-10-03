import fs from 'node:fs'
import path from 'node:path'
import { Ask } from './components/Ask'
import type { CachedAnswer } from './components/Ask'

function loadCached(): Record<string, CachedAnswer> {
  const file = path.join(process.cwd(), 'data', 'cached.json')
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
}

export default function Home() {
  return (
    <>
      <p className="pitch">
        Ask for a planet&rsquo;s density, insolation, equilibrium temperature or habitable-zone status. Every answer is computed from{' '}
        <strong>one</strong> published parameter set, and you can see what mixing values from several papers (the archive&rsquo;s composite table) would have said instead.
      </p>
      <Ask cached={loadCached()} />
    </>
  )
}
