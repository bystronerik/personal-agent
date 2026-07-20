import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BriefInputSchema } from '../schema.js'
import { type EvalReport, evaluateBrief } from './scorer.js'

const moduleDir = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(moduleDir, '..', 'fixtures')

const loadJson = (name: string): unknown =>
  JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'))

const input = BriefInputSchema.parse(loadJson('synthetic-news.json'))

const cases = [
  { name: 'brief-good', candidate: loadJson('brief-good.json') },
  {
    name: 'brief-hallucinated',
    candidate: loadJson('brief-hallucinated.json'),
  },
]

function render(name: string, report: EvalReport): void {
  const verdict = report.ok ? 'PASS' : 'FAIL'
  console.log(`\n${verdict}  ${name}  —  score ${report.meanScore.toFixed(2)}`)

  for (const err of report.schemaErrors) {
    console.log(`   schema  ${err}`)
  }

  for (const check of report.checks) {
    const mark = check.passed ? '✓' : '✗'
    console.log(`   ${mark} ${check.name.padEnd(22)} ${check.score.toFixed(2)}`)
    for (const detail of check.details) {
      console.log(`       ${detail}`)
    }
  }
}

let failures = 0
for (const { name, candidate } of cases) {
  const report = evaluateBrief(candidate, input)
  render(name, report)
  if (name === 'brief-good' && !report.ok) failures += 1
}

console.log()

if (failures > 0) {
  console.error('Reference brief failed its own checks. Fix the harness.')
  process.exit(1)
}
