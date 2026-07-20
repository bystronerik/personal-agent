import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { syntheticNews } from '../fixtures/synthetic-news'
import { DEFAULT_MODEL } from '../llm/models'
import { chatCompletion } from '../llm/openrouter'
import { buildBriefMessages } from '../prompt/brief-prompt'
import { parseBriefFromResponse } from '../prompt/parse-brief'
import { readEnv } from '../utils/env'

const moduleDir = dirname(fileURLToPath(import.meta.url))
const artifactsDir = join(moduleDir, '..', '..', '.artifacts')

const model = readEnv('OPENROUTER_MODEL') ?? DEFAULT_MODEL

console.log(`Generating brief with ${model}...`)

const result = await chatCompletion({
  model,
  messages: buildBriefMessages(syntheticNews),
  temperature: 0,
})

mkdirSync(artifactsDir, { recursive: true })
const artifactPath = join(
  artifactsDir,
  `${new Date().toISOString().replace(/[:.]/g, '-')}.txt`,
)
writeFileSync(artifactPath, result.content, 'utf8')
console.log(`Raw output saved to ${artifactPath}`)

const { wasFenced } = parseBriefFromResponse(result.content)
if (wasFenced) {
  console.log(
    'note: output was wrapped in a markdown fence despite instructions',
  )
}

if (result.promptTokens !== undefined) {
  const cost =
    result.costUsd === undefined ? '' : `  —  $${result.costUsd.toFixed(5)}`
  console.log(
    `tokens: ${result.promptTokens} in / ${result.completionTokens} out${cost}`,
  )
}
