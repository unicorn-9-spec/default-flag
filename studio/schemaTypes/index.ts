import type { SchemaTypeDefinition } from 'sanity'
import { compositeValue, measurement } from './measurement'
import { parameterSet } from './parameterSet'
import { planet } from './planet'
import { publication } from './publication'
import { constant, derivedAnswer, hzLimit, threshold } from './reference'
import { snapshot } from './snapshot'
import { star, stellarSolution } from './star'

export const schemaTypes: SchemaTypeDefinition[] = [
  measurement,
  compositeValue,
  planet,
  star,
  parameterSet,
  stellarSolution,
  publication,
  snapshot,
  constant,
  threshold,
  hzLimit,
  derivedAnswer,
]
