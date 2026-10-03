import { defineField, defineType } from 'sanity'

const compositeFields = [
  ['radiusEarth', 'Radius [R_earth]'],
  ['massEarth', 'Best mass [M_earth]'],
  ['semiMajorAxisAu', 'Semi-major axis [AU]'],
  ['insolationEarth', 'Insolation [S_earth]'],
  ['eqTempK', 'Equilibrium temperature [K]'],
  ['stellarRadiusSun', 'Stellar radius [R_sun]'],
  ['stellarMassSun', 'Stellar mass [M_sun]'],
  ['stellarTeffK', 'Stellar effective temperature [K]'],
] as const

export const planet = defineType({
  name: 'planet',
  title: 'Planet',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'name' }, validation: (r) => r.required() }),
    defineField({ name: 'host', type: 'reference', to: [{ type: 'star' }], validation: (r) => r.required() }),
    defineField({
      name: 'parameterSets',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'parameterSet' }] }],
      validation: (r) => r.required().min(1),
    }),
    defineField({
      name: 'defaultParameterSet',
      type: 'reference',
      to: [{ type: 'parameterSet' }],
      description: 'The one set with defaultFlag = true.',
      validation: (r) =>
        r.required().custom(async (ref, ctx) => {
          if (!ref?._ref || !ctx.document) return true
          const id = ctx.document._id.replace(/^drafts\./, '')
          const defaults: string[] = await ctx
            .getClient({ apiVersion: '2026-10-03' })
            .fetch('*[_type == "parameterSet" && planet._ref == $id && defaultFlag == true]._id', { id })
          if (defaults.length !== 1) return `Expected exactly one default parameter set, found ${defaults.length}`
          return defaults[0] === ref._ref || 'defaultParameterSet must be the set with defaultFlag = true'
        }),
    }),
    defineField({
      name: 'compositeSnapshot',
      title: 'Composite (pscomppars) values',
      description: 'One row per planet, values mixed from several references by the archive. Counterfactual only.',
      type: 'object',
      fields: [
        ...compositeFields.map(([name, title]) => defineField({ name, title, type: 'compositeValue' })),
        defineField({ name: 'massKind', type: 'string', description: 'Archive pl_bmassprov for the composite best mass.' }),
        defineField({ name: 'snapshot', type: 'reference', to: [{ type: 'snapshot' }] }),
      ],
    }),
    defineField({
      name: 'selection',
      type: 'object',
      fields: [
        defineField({ name: 'rules', type: 'array', of: [{ type: 'string' }] }),
        defineField({ name: 'reasons', type: 'array', of: [{ type: 'string' }] }),
      ],
    }),
  ],
})
