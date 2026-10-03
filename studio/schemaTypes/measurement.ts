import { defineField, defineType } from 'sanity'

// One archive value with its asymmetric errors. Errors are stored as non-negative
// magnitudes; limitFlag is the archive's raw "Limit Flag" value, copied verbatim.
export const measurement = defineType({
  name: 'measurement',
  title: 'Measurement',
  type: 'object',
  fields: [
    defineField({ name: 'value', type: 'number', validation: (r) => r.required() }),
    defineField({ name: 'errPlus', type: 'number', validation: (r) => r.min(0) }),
    defineField({ name: 'errMinus', type: 'number', validation: (r) => r.min(0) }),
    defineField({
      name: 'limitFlag',
      type: 'number',
      description: 'Archive limit flag, verbatim. 0 = a measured value; non-zero = a limit, not a measurement.',
      validation: (r) => r.integer().min(-1).max(1),
    }),
  ],
})

// A composite-table value: the measurement plus where the archive says it came from.
export const compositeValue = defineType({
  name: 'compositeValue',
  title: 'Composite value',
  type: 'object',
  fields: [
    defineField({ name: 'measurement', type: 'measurement' }),
    defineField({ name: 'publication', type: 'reference', to: [{ type: 'publication' }] }),
    defineField({
      name: 'calculated',
      type: 'boolean',
      description: 'True when the archive reference column reads "Calculated Value".',
    }),
    defineField({ name: 'referenceText', type: 'string', description: 'Reference column text as given by the archive.' }),
  ],
})
