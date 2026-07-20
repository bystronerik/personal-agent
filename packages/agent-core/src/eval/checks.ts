import type { Brief, BriefInput } from '../schema.js'

export type CheckResult = {
  name: string
  /** 0..1, partial credit allowed. */
  score: number
  passed: boolean
  details: string[]
}

/** Matches "3", "1,200", "4.25" — digit tokens only, spelled-out numbers are ignored. */
const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?/g

const normalizeNumber = (raw: string): string => raw.replace(/,/g, '')

const numbersIn = (text: string): string[] =>
  (text.match(NUMBER_TOKEN) ?? []).map(normalizeNumber)

const proseOf = (brief: Brief): string[] => [
  brief.marketSummary,
  brief.prediction.rationale,
  ...brief.headlines.flatMap((s) => [s.title, s.summary, s.whyItMatters]),
]

/** Every cited source id must exist in the input. */
export function sourceIdsResolve(brief: Brief, input: BriefInput): CheckResult {
  const knownIds = new Set(input.docs.map((d) => d.id))
  const details: string[] = []
  let cited = 0
  let resolved = 0

  for (const [i, story] of brief.headlines.entries()) {
    for (const id of story.sourceIds) {
      cited += 1
      if (knownIds.has(id)) {
        resolved += 1
      } else {
        details.push(`headline[${i}] cites unknown source "${id}"`)
      }
    }
  }

  const score = cited === 0 ? 0 : resolved / cited
  return { name: 'sourceIdsResolve', score, passed: score === 1, details }
}

/**
 * Every number in the brief's prose must appear in the source text. Known
 * false positives: derived figures ("3rd month in a row") and rounded ones
 * ("about 4%" from "4.25%") — which is why this contributes a score instead
 * of gating.
 */
export function numbersGrounded(brief: Brief, input: BriefInput): CheckResult {
  const sourceNumbers = new Set(
    input.docs.flatMap((d) => [...numbersIn(d.title), ...numbersIn(d.body)]),
  )

  const details: string[] = []
  let total = 0
  let grounded = 0

  for (const text of proseOf(brief)) {
    for (const n of numbersIn(text)) {
      total += 1
      if (sourceNumbers.has(n)) {
        grounded += 1
      } else {
        details.push(`"${n}" does not appear in any source document`)
      }
    }
  }

  const score = total === 0 ? 1 : grounded / total
  return { name: 'numbersGrounded', score, passed: score === 1, details }
}

/** Flags briefs where most headlines lean on the same source document. */
export function sourceDiversity(brief: Brief): CheckResult {
  const distinct = new Set(brief.headlines.flatMap((s) => s.sourceIds))
  const score = Math.min(1, distinct.size / brief.headlines.length)
  const details =
    score < 1
      ? [
          `${brief.headlines.length} headlines drawn from only ${distinct.size} distinct source(s)`,
        ]
      : []
  return { name: 'sourceDiversity', score, passed: score === 1, details }
}

const MAX_HORIZON_DAYS = 7
const DAY_MS = 86_400_000

/** A prediction must resolve in the future and within a scoreable horizon. */
export function predictionResolvable(brief: Brief): CheckResult {
  const { prediction } = brief
  const generated = Date.parse(brief.generatedAt)
  const resolves = Date.parse(prediction.resolvesAt)
  const horizonDays = (resolves - generated) / DAY_MS

  const details: string[] = []
  const conditions = [
    {
      ok: resolves > generated,
      msg: `resolvesAt (${prediction.resolvesAt}) is not after generatedAt (${brief.generatedAt})`,
    },
    {
      ok: horizonDays <= MAX_HORIZON_DAYS,
      msg: `horizon of ${horizonDays.toFixed(1)} days exceeds the ${MAX_HORIZON_DAYS}-day maximum`,
    },
  ]

  let met = 0
  for (const c of conditions) {
    if (c.ok) met += 1
    else details.push(c.msg)
  }

  const score = met / conditions.length
  return { name: 'predictionResolvable', score, passed: score === 1, details }
}

export const ALL_CHECKS = [
  sourceIdsResolve,
  numbersGrounded,
  sourceDiversity,
  predictionResolvable,
] as const
