// Snapshot access for the NASA Exoplanet Archive tables. Everything here is pure and
// deterministic: same raw files in, same objects out.
import crypto from 'node:crypto'
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'
import { decodeHTML } from 'entities'

export const RAW_DIR = new URL('../data/raw/', import.meta.url)
export const TABLES_DIR = new URL('nea-tables/', RAW_DIR)
export const DOCS_DIR = new URL('nea-docs/', RAW_DIR)

export type Cell = string | number | null
export type Row = Record<string, Cell>

export interface ManifestEntry {
  file: string
  sizeBytes: number
  sha256: string
  sourceUrl: string
  retrievedAtUtc: string
  rows: number | null
  table: string | null
}

export function sha256(buf: Buffer | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

// MANIFEST.tsv is written by the owner; columns are looked up by header name so the
// table and doc manifests (which differ in extra columns) share one reader.
export function readManifest(dir: URL): ManifestEntry[] {
  const lines = fs.readFileSync(new URL('MANIFEST.tsv', dir), 'utf8').trim().split(/\r?\n/)
  const header = lines[0]!.split('\t')
  const col = (cells: string[], name: string) => {
    const i = header.indexOf(name)
    return i === -1 ? undefined : cells[i]
  }
  return lines.slice(1).map((line) => {
    const c = line.split('\t')
    const rows = col(c, 'rows')
    return {
      file: col(c, 'file')!,
      sizeBytes: Number(col(c, 'size_bytes')),
      sha256: col(c, 'sha256')!,
      sourceUrl: col(c, 'source_url')!,
      retrievedAtUtc: col(c, 'retrieved_at_utc')!,
      rows: rows === undefined ? null : Number(rows),
      table: col(c, 'table') ?? null,
    }
  })
}

export function verifyManifest(dir: URL): { file: string; ok: boolean; reason?: string }[] {
  return readManifest(dir).map((m) => {
    const path = new URL(m.file, dir)
    if (!fs.existsSync(path)) return { file: m.file, ok: false, reason: 'missing' }
    const buf = fs.readFileSync(path)
    if (buf.length !== m.sizeBytes) return { file: m.file, ok: false, reason: `size ${buf.length} != ${m.sizeBytes}` }
    const hash = sha256(buf)
    if (hash !== m.sha256) return { file: m.file, ok: false, reason: `sha256 ${hash} != ${m.sha256}` }
    return { file: m.file, ok: true }
  })
}

const TEXT_COLUMNS = new Set([
  'pl_name', 'hostname', 'pl_letter', 'soltype', 'pl_refname', 'st_refname',
  'pl_pubdate', 'releasedate', 'rowupdate', 'pl_bmassprov',
])

export function loadTable(file: string): Row[] {
  const rows: Row[] = parse(fs.readFileSync(new URL(file, TABLES_DIR)), {
    columns: true,
    cast: (value, ctx) => {
      if (ctx.header) return value
      if (value === '') return null
      const name = String(ctx.column)
      if (TEXT_COLUMNS.has(name) || name.endsWith('_reflink')) return value
      const n = Number(value)
      if (!Number.isFinite(n)) throw new Error(`non-numeric ${name}=${value}`)
      return n
    },
  })
  return rows
}

export function text(row: Row, key: string): string | null {
  const v = row[key]
  return typeof v === 'string' ? v : null
}

export function num(row: Row, key: string): number | null {
  const v = row[key]
  return typeof v === 'number' ? v : null
}

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface ParsedRef {
  raw: string
  calculated: boolean
  refstr: string | null
  url: string | null
  text: string
  bibcode: string | null
  year: number | null
}

// Archive references are HTML anchors, e.g.
// <a refstr=FARIA_ET_AL__2022 href=https://ui.adsabs.harvard.edu/abs/2022A&A...658A.115F/abstract target=ref>Faria et al. 2022</a>
// Composite reflinks can instead be the literal "Calculated Value".
export function parseRef(raw: string): ParsedRef {
  const trimmed = raw.trim()
  if (trimmed === 'Calculated Value') {
    return { raw, calculated: true, refstr: null, url: null, text: trimmed, bibcode: null, year: null }
  }
  const refstr = /refstr=([^\s>]+)/.exec(trimmed)?.[1] ?? null
  const url = /href=([^\s>]+)/.exec(trimmed)?.[1] ?? null
  const inner = /<a\b[^>]*>([\s\S]*?)<\/a>/.exec(trimmed)?.[1] ?? trimmed.replace(/<[^>]+>/g, '')
  const bibcode = url ? (/\/abs\/([^/]+)/.exec(url)?.[1] ?? null) : null
  const yearMatch = bibcode ? /^(\d{4})/.exec(bibcode) : /(\d{4})\s*$/.exec(inner)
  return {
    raw,
    calculated: false,
    refstr,
    url,
    text: decodeHTML(inner).replace(/\s+/g, ' ').trim(),
    bibcode: bibcode ? decodeURIComponent(bibcode) : null,
    year: yearMatch ? Number(yearMatch[1]) : null,
  }
}

// Publication ids come from the citation text ("Faria et al. 2022" -> faria-et-al-2022).
// When two different papers share a citation text, every one of them gets the bibcode
// appended, so ids never depend on which planets happen to be selected.
export function buildRefSlugger(allRefs: Iterable<ParsedRef>): (ref: ParsedRef) => string {
  const keysByText = new Map<string, Set<string>>()
  for (const ref of allRefs) {
    if (ref.calculated) continue
    const base = slugify(ref.text)
    const set = keysByText.get(base) ?? new Set<string>()
    set.add(ref.bibcode ?? ref.url ?? ref.raw)
    keysByText.set(base, set)
  }
  return (ref) => {
    const base = slugify(ref.text)
    return (keysByText.get(base)?.size ?? 0) > 1 ? `${base}-${slugify(ref.bibcode ?? ref.url ?? ref.raw)}` : base
  }
}

export interface Measurement {
  value: number
  errPlus?: number
  errMinus?: number
  limitFlag?: number
}

// Archive err2 columns are negative; we store both errors as non-negative magnitudes.
// limitFlag is copied verbatim: the archive labels it "Limit Flag" without defining
// the sign convention in the snapshotted docs, so we do not interpret it here.
export function measurement(row: Row, base: string): Measurement | null {
  const value = num(row, base)
  if (value === null) return null
  const m: Measurement = { value }
  const plus = num(row, `${base}err1`)
  const minus = num(row, `${base}err2`)
  const lim = num(row, `${base}lim`)
  if (plus !== null) m.errPlus = Math.abs(plus)
  if (minus !== null) m.errMinus = Math.abs(minus)
  if (lim !== null) m.limitFlag = lim
  return m
}

export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = out.get(k)
    if (list) list.push(item)
    else out.set(k, [item])
  }
  return out
}

export const PS_FILE = 'nea-ps.csv'
export const COMPOSITE_FILE = 'nea-pscomppars.csv'
