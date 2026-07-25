import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runBrief } from '../agent/orchestrator/agent'
import { briefSessionId } from '../agent/shared/session'
import { syntheticNews } from '../fixtures/synthetic-news'
import { BRIEF_CHECKS } from '../grading/checks'
import { resolveModel } from '../llm/models'
import { runScript } from './run-script'

await runScript(async () => {
  const model = resolveModel()
  const sessionId = briefSessionId(syntheticNews)

  console.log(
    `Running the brief orchestrator with ${model} (${syntheticNews.docs.length} documents available)`,
  )
  console.log(`Session: ${sessionId}\n`)

  const { brief, board, costUsd } = await runBrief(syntheticNews, {
    model,
    sessionId,
    onTurnEnd: (turn, cost, total) =>
      console.log(
        `  turn ${turn}  $${cost.toFixed(4)}  (running total $${total.toFixed(4)})`,
      ),
  })

  const ran = [
    board.findings && 'research',
    board.prediction && 'predict',
    board.summary && 'summarize',
  ]
    .filter(Boolean)
    .join(' → ')
  console.log(`\nPipeline: ${ran}`)
  console.log(
    `${brief.headlines.length} headlines — ${brief.prediction.instrument} ${brief.prediction.direction} @ ${brief.prediction.confidence}`,
  )
  console.log(`Cost: $${costUsd.toFixed(4)}`)

  const moduleDir = dirname(fileURLToPath(import.meta.url))
  const artifactsDir = join(moduleDir, '..', '..', '.artifacts')
  mkdirSync(artifactsDir, { recursive: true })
  const briefPath = join(
    artifactsDir,
    `brief-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  writeFileSync(briefPath, JSON.stringify(brief, null, 2), 'utf8')
  console.log(`Brief saved to ${briefPath}`)

  console.log('\nScores:')
  for (const check of BRIEF_CHECKS) {
    const result = check(brief, syntheticNews)
    console.log(`  ${result.score.toFixed(2)}  ${result.name}`)
    for (const detail of result.details) {
      console.log(`        ${detail}`)
    }
  }
})
