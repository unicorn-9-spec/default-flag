import Link from 'next/link'
import { listPlanets } from '@default-flag/agent'

export const revalidate = 3600

export default async function Planets() {
  const planets = await listPlanets()
  return (
    <>
      <h1>Planets in the snapshot</h1>
      <ul>
        {planets.map((p) => (
          <li key={p.slug}>
            <Link href={`/planet/${p.slug}`}>{p.name}</Link> <span className="muted">· {p.host} · {p.sets} parameter sets</span>
          </li>
        ))}
      </ul>
    </>
  )
}
