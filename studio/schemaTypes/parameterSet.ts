import { defineField, defineType } from 'sanity'

// One row of the archive's Planetary Systems (ps) table: a single self-consistent
// set of planet parameters from one publication.
export const parameterSet = defineType({
  name: 'parameterSet',
  title: 'Parameter set',
  type: 'document',
  fields: [
    defineField({ name: 'planet', type: 'reference', to: [{ type: 'planet' }], validation: (r) => r.required() }),
    defineField({ name: 'publication', type: 'reference', to: [{ type: 'publication' }], validation: (r) => r.required() }),
    defineField({ name: 'defaultFlag', type: 'boolean', description: 'Archive default_flag = 1.', validation: (r) => r.required() }),
    defineField({ name: 'radiusEarth', title: 'Radius [R_earth]', type: 'measurement' }),
    defineField({ name: 'massEarth', title: 'Best mass [M_earth]', type: 'measurement' }),
    defineField({
      name: 'massKind',
      type: 'string',
      description: 'Archive pl_bmassprov, verbatim. The archive describes M*sin(i) as a lower limit of the planet mass.',
      options: { list: ['Mass', 'Msini', 'Msin(i)/sin(i)'] },
    }),
    defineField({ name: 'semiMajorAxisAu', title: 'Semi-major axis [AU]', type: 'measurement' }),
    defineField({
      name: 'archiveInsolationEarth',
      title: 'Archive insolation [S_earth]',
      type: 'measurement',
      description: 'As reported by the archive; used to test our formulas, never shown as our answer.',
    }),
    defineField({
      name: 'archiveEqTempK',
      title: 'Archive equilibrium temperature [K]',
      type: 'measurement',
      description: 'As reported by the archive; used to test our formulas.',
    }),
    defineField({
      name: 'stellarSolution',
      type: 'reference',
      to: [{ type: 'stellarSolution' }],
      description: "The stellar solution published with this row, never another row's.",
    }),
    defineField({ name: 'solutionType', type: 'string', description: 'Archive soltype.' }),
    defineField({ name: 'controversial', type: 'boolean', description: 'Archive pl_controv_flag = 1.' }),
    defineField({ name: 'publishedMonth', type: 'string', description: 'Archive pl_pubdate.' }),
    defineField({ name: 'snapshot', type: 'reference', to: [{ type: 'snapshot' }], validation: (r) => r.required() }),
    defineField({
      name: 'archiveRowSha256',
      type: 'string',
      description: 'SHA-256 of the source CSV row, for tracing back to the snapshot.',
    }),
  ],
  preview: {
    select: { planet: 'planet.name', citation: 'publication.citation', isDefault: 'defaultFlag' },
    prepare: ({ planet, citation, isDefault }) => ({
      title: `${planet ?? '?'} — ${citation ?? '?'}`,
      subtitle: isDefault ? 'default' : undefined,
    }),
  },
})
