import { defineField, defineType } from 'sanity'

const sourceField = defineField({
  name: 'source',
  type: 'object',
  validation: (r) => r.required(),
  fields: [
    defineField({ name: 'citation', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'url', type: 'url', validation: (r) => r.required() }),
    defineField({ name: 'location', type: 'string', description: 'Table, equation or page in the source.' }),
    defineField({ name: 'retrievedAt', type: 'date', validation: (r) => r.required() }),
    defineField({ name: 'note', type: 'string', description: 'Caveats, e.g. a modelling assumption or a pending check.' }),
  ],
})

export const constant = defineType({
  name: 'constant',
  title: 'Constant',
  type: 'document',
  fields: [
    defineField({ name: 'key', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'value', type: 'number', validation: (r) => r.required() }),
    defineField({ name: 'unit', type: 'string', validation: (r) => r.required() }),
    sourceField,
  ],
})

export const threshold = defineType({
  name: 'threshold',
  title: 'Threshold',
  type: 'document',
  fields: [
    defineField({ name: 'key', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'value', type: 'number', validation: (r) => r.required() }),
    defineField({ name: 'unit', type: 'string', validation: (r) => r.required() }),
    sourceField,
  ],
})

// Kopparapu et al. (2014) Eq. (4): S_eff = S_eff_sun + a T + b T^2 + c T^3 + d T^4, T = Teff - 5780 K.
export const hzLimit = defineType({
  name: 'hzLimit',
  title: 'Habitable-zone limit',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'edge', type: 'string', options: { list: ['inner', 'outer'] }, validation: (r) => r.required() }),
    defineField({ name: 'seffSun', type: 'number', validation: (r) => r.required() }),
    defineField({ name: 'a', type: 'number', validation: (r) => r.required() }),
    defineField({ name: 'b', type: 'number', validation: (r) => r.required() }),
    defineField({ name: 'c', type: 'number', validation: (r) => r.required() }),
    defineField({ name: 'd', type: 'number', validation: (r) => r.required() }),
    defineField({ name: 'teffMinK', type: 'number' }),
    defineField({ name: 'teffMaxK', type: 'number' }),
    sourceField,
  ],
})

type InputItem = { set?: { _ref?: string } }

export const derivedAnswer = defineType({
  name: 'derivedAnswer',
  title: 'Derived answer',
  type: 'document',
  fields: [
    defineField({ name: 'question', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'parameterSet', type: 'reference', to: [{ type: 'parameterSet' }], validation: (r) => r.required() }),
    defineField({ name: 'quantity', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'inputs',
      type: 'array',
      validation: (r) =>
        r.custom((inputs, ctx) => {
          const own = (ctx.document?.parameterSet as { _ref?: string } | undefined)?._ref
          const mixed = ((inputs ?? []) as InputItem[]).filter((i) => i.set?._ref !== own)
          return mixed.length === 0 || "Every input must come from this answer's parameter set"
        }),
      of: [
        {
          type: 'object',
          fields: [
            defineField({ name: 'field', type: 'string', validation: (r) => r.required() }),
            defineField({ name: 'value', type: 'number', validation: (r) => r.required() }),
            defineField({ name: 'set', type: 'reference', to: [{ type: 'parameterSet' }], validation: (r) => r.required() }),
          ],
        },
      ],
    }),
    defineField({
      name: 'result',
      type: 'object',
      fields: [
        defineField({ name: 'median', type: 'number' }),
        defineField({ name: 'p16', type: 'number' }),
        defineField({ name: 'p84', type: 'number' }),
      ],
    }),
    defineField({ name: 'codeVersion', type: 'string' }),
  ],
})
