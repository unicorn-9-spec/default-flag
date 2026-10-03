import { defineField, defineType } from 'sanity'

// One raw file under ingest/data/raw/, as recorded in its MANIFEST.tsv.
export const snapshot = defineType({
  name: 'snapshot',
  title: 'Snapshot',
  type: 'document',
  fields: [
    defineField({ name: 'file', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'table', type: 'string' }),
    defineField({ name: 'sha256', type: 'string', validation: (r) => r.required().regex(/^[0-9a-f]{64}$/) }),
    defineField({ name: 'sizeBytes', type: 'number' }),
    defineField({ name: 'rows', type: 'number' }),
    defineField({ name: 'sourceUrl', type: 'url', validation: (r) => r.required() }),
    defineField({ name: 'retrievedAt', type: 'datetime', validation: (r) => r.required() }),
  ],
  preview: { select: { title: 'file', subtitle: 'retrievedAt' } },
})
