import { defineField, defineType } from 'sanity'

export const publication = defineType({
  name: 'publication',
  title: 'Publication',
  type: 'document',
  fields: [
    defineField({ name: 'citation', type: 'string', description: 'Citation text as displayed by the archive.', validation: (r) => r.required() }),
    defineField({ name: 'refname', type: 'text', rows: 2, description: 'Reference string exactly as given by the archive.', validation: (r) => r.required() }),
    defineField({ name: 'refstr', type: 'string' }),
    defineField({ name: 'bibcode', type: 'string' }),
    defineField({ name: 'year', type: 'number' }),
    defineField({ name: 'adsUrl', type: 'url' }),
  ],
  preview: { select: { title: 'citation', subtitle: 'bibcode' } },
})
