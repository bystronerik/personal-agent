import type { Brief, BriefInput } from '../schema'

export type CheckResult = {
  name: string
  /** 0..1, partial credit allowed. */
  score: number
  details: string[]
}

const SCALE_WORDS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mn: 1e6,
  million: 1e6,
  bn: 1e9,
  billion: 1e9,
  tn: 1e12,
  trillion: 1e12,
}

/** Matches "3", "1,200", "4.25", "890 million" — spelled-out numbers are ignored. */
const NUMBER_TOKEN =
  /(\d[\d,]*(?:\.\d+)?)\s*(k|m|mn|bn|tn|thousand|million|billion|trillion)?\b/gi

type NumericClaim = { raw: string; value: number }

/** Guards against float drift from scale multiplication (0.3 * 1e6 and friends). */
const round = (value: number): number => Math.round(value * 1e6) / 1e6

function* matchNumbers(
  text: string,
): Generator<{ raw: string; base: number; scale: number }> {
  for (const match of text.matchAll(NUMBER_TOKEN)) {
    const [raw, digits, scaleWord] = match
    if (!digits) continue
    const base = Number.parseFloat(digits.replace(/,/g, ''))
    if (Number.isNaN(base)) continue
    const scale = scaleWord ? (SCALE_WORDS[scaleWord.toLowerCase()] ?? 1) : 1
    yield { raw: raw.trim(), base, scale }
  }
}

/** One value per number, with any scale word applied — what the brief asserts. */
function claimedValuesIn(text: string): NumericClaim[] {
  return [...matchNumbers(text)].map(({ raw, base, scale }) => ({
    raw,
    value: round(base * scale),
  }))
}

/**
 * Both the scaled and unscaled reading of each number, so "310 thousand" in a
 * source backs a brief written as either "310,000" or "310 thousand". Keeping
 * the source side permissive and the brief side strict means a wrong scale
 * ("310 million") is still caught.
 */
function sourceValuesIn(text: string): number[] {
  const values: number[] = []
  for (const { base, scale } of matchNumbers(text)) {
    values.push(round(base * scale))
    if (scale !== 1) values.push(round(base))
  }
  return values
}

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
  return { name: 'sourceIdsResolve', score, details }
}

/**
 * Every number in the brief's prose must trace to a value in the source text.
 * Compares numeric values rather than digit strings, so "310,000" matches a
 * source that wrote "310 thousand". Known false positives remain for derived
 * figures ("3rd month in a row") and rounded ones ("about 4%" from "4.25%"),
 * which is why this contributes a score instead of gating.
 */
export function numbersGrounded(brief: Brief, input: BriefInput): CheckResult {
  const sourceValues = new Set(
    input.docs.flatMap((d) => [
      ...sourceValuesIn(d.title),
      ...sourceValuesIn(d.body),
    ]),
  )

  const details: string[] = []
  let total = 0
  let grounded = 0

  for (const text of proseOf(brief)) {
    for (const claim of claimedValuesIn(text)) {
      total += 1
      if (sourceValues.has(claim.value)) {
        grounded += 1
      } else {
        details.push(`"${claim.raw}" does not appear in any source document`)
      }
    }
  }

  const score = total === 0 ? 1 : grounded / total
  return { name: 'numbersGrounded', score, details }
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
  return { name: 'sourceDiversity', score, details }
}

type Condition = { ok: boolean; msg: string }

/** Awards partial credit per satisfied condition, collecting the rest as details. */
function scoreConditions(name: string, conditions: Condition[]): CheckResult {
  const failed = conditions.filter((c) => !c.ok)
  return {
    name,
    score: (conditions.length - failed.length) / conditions.length,
    details: failed.map((c) => c.msg),
  }
}

const MAX_HORIZON_DAYS = 7
const DAY_MS = 86_400_000

/** A prediction must resolve in the future and within a scoreable horizon. */
export function predictionResolvable(brief: Brief): CheckResult {
  const { prediction } = brief
  const generated = Date.parse(brief.generatedAt)
  const resolves = Date.parse(prediction.resolvesAt)
  const horizonDays = (resolves - generated) / DAY_MS

  return scoreConditions('predictionResolvable', [
    {
      ok: resolves > generated,
      msg: `resolvesAt (${prediction.resolvesAt}) is not after generatedAt (${brief.generatedAt})`,
    },
    {
      ok: horizonDays <= MAX_HORIZON_DAYS,
      msg: `horizon of ${horizonDays.toFixed(1)} days exceeds the ${MAX_HORIZON_DAYS}-day maximum`,
    },
  ])
}

/**
 * The prompt supplies both fields and instructs the model to echo them back.
 * Timestamps are compared as instants so a reformatted but equivalent
 * `generatedAt` still counts.
 */
export function echoesInput(brief: Brief, input: BriefInput): CheckResult {
  return scoreConditions('echoesInput', [
    {
      ok: Date.parse(brief.generatedAt) === Date.parse(input.asOf),
      msg: `generatedAt (${brief.generatedAt}) does not match the supplied asOf (${input.asOf})`,
    },
    {
      ok: brief.edition === input.edition,
      msg: `edition "${brief.edition}" does not match the supplied "${input.edition}"`,
    },
  ])
}
