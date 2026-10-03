import { defineField, defineType } from 'sanity'

export const star = defineType({
  name: 'star',
  title: 'Star',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'name' }, validation: (r) => r.required() }),
  ],
})

// Stellar parameters exactly as published alongside one archive row.
export const stellarSolution = defineType({
  name: 'stellarSolution',
  title: 'Stellar solution',
  type: 'document',
  fields: [
    defineField({ name: 'star', type: 'reference', to: [{ type: 'star' }], validation: (r) => r.required() }),
    defineField({ name: 'publication', type: 'reference', to: [{ type: 'publication' }], validation: (r) => r.required() }),
    defineField({ name: 'radiusSun', title: 'Radius [R_sun]', type: 'measurement' }),
    defineField({ name: 'massSun', title: 'Mass [M_sun]', type: 'measurement' }),
    defineField({ name: 'teffK', title: 'Effective temperature [K]', type: 'measurement' }),
    defineField({ name: 'snapshot', type: 'reference', to: [{ type: 'snapshot' }], validation: (r) => r.required() }),
  ],
  preview: { select: { title: 'star.name', subtitle: 'publication.citation' } },
})
