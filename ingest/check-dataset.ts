// CI validation, written in GROQ against the public dataset (no token needed).
// Every check must return zero violations.
import { createClient } from '@sanity/client'

const projectId = process.env.SANITY_PROJECT_ID
if (!projectId) throw new Error('SANITY_PROJECT_ID is not set')
const client = createClient({ projectId, dataset: process.env.SANITY_DATASET ?? 'production', apiVersion: '2026-10-03', useCdn: false })

const checks: Record<string, string> = {
  'planets without exactly one default parameter set':
    `*[_type == "planet" && count(*[_type == "parameterSet" && planet._ref == ^._id && defaultFlag == true]) != 1].name`,
  'planets whose defaultParameterSet is not their default set':
    `*[_type == "planet" && !(defaultParameterSet->defaultFlag == true && defaultParameterSet->planet._ref == _id)].name`,
  'derived answers with an input from another parameter set':
    `*[_type == "derivedAnswer" && count(inputs[set._ref != ^.parameterSet._ref]) > 0]._id`,
  'parameter sets missing a publication or snapshot':
    `*[_type == "parameterSet" && (!defined(publication->_id) || !defined(snapshot->_id))]._id`,
  'negative uncertainties':
    `*[_type in ["parameterSet", "stellarSolution"] && (
      radiusEarth.errMinus < 0 || radiusEarth.errPlus < 0 || massEarth.errMinus < 0 || massEarth.errPlus < 0 ||
      semiMajorAxisAu.errMinus < 0 || semiMajorAxisAu.errPlus < 0 || radiusSun.errMinus < 0 || radiusSun.errPlus < 0 ||
      teffK.errMinus < 0 || teffK.errPlus < 0)]._id`,
  'reference values without a source URL':
    `*[_type in ["constant", "threshold", "hzLimit"] && !defined(source.url)]._id`,
  'document ids containing a dot (not publicly readable)':
    `*[_id match "*.*" && !(_id in path("drafts.**"))]._id`,
}

let failed = 0
for (const [name, query] of Object.entries(checks)) {
  const violations: string[] = await client.fetch(query)
  console.log(`${violations.length === 0 ? 'ok  ' : 'FAIL'} ${name}: ${violations.length}${violations.length ? ` (${violations.slice(0, 5).join(', ')})` : ''}`)
  if (violations.length) failed++
}
const counts = await client.fetch<Record<string, number>>(
  `{"planets": count(*[_type == "planet"]), "parameterSets": count(*[_type == "parameterSet"]), "derivedAnswers": count(*[_type == "derivedAnswer"])}`,
)
console.log(`dataset: ${JSON.stringify(counts)}`)
if (failed) process.exit(1)
