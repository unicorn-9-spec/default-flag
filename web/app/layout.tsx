import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Default Flag',
  description: 'Derived exoplanet answers from one self-consistent parameter set per planet, next to what the archive composite table would give.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="site">
          <header className="site-header">
            <Link href="/" className="brand">Default Flag</Link>
            <nav aria-label="Main">
              <Link href="/">Ask</Link>
              <Link href="/eval">Evaluation</Link>
              <Link href="/how-it-works">How it works</Link>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="muted">
            <p>
              This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology,
              under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
