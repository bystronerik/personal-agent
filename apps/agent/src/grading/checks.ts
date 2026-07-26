import type { FixtureBriefInput } from '../fixtures/input'
import {
  type Brief,
  type BriefInput,
  type Edition,
  MAX_HORIZON_DAYS,
  type Prediction,
  type ResearchFindings,
  type Story,
  type SummaryDraft,
} from '../schema'

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

/** One value per number, with any scale word applied — what the prose asserts. */
export function claimedValuesIn(text: string): NumericClaim[] {
  return [...matchNumbers(text)].map(({ raw, base, scale }) => ({
    raw,
    value: round(base * scale),
  }))
}

/**
 * Both the scaled and unscaled reading of each number, so "310 thousand" in a
 * source backs prose written as either "310,000" or "310 thousand". Keeping the
 * source side permissive and the prose side strict means a wrong scale
 * ("310 million") is still caught.
 */
export function sourceValuesIn(text: string): number[] {
  const values: number[] = []
  for (const { base, scale } of matchNumbers(text)) {
    values.push(round(base * scale))
    if (scale !== 1) values.push(round(base))
  }
  return values
}

const storyProse = (stories: Story[]): string[] =>
  stories.flatMap((s) => [s.title, s.summary, s.whyItMatters])

// --- primitives: each operates on the minimal data it needs, so one
// implementation powers both a per-layer check and the end-to-end check. ---

/** Every cited source id must exist in the input. */
function sourceIdsResolve(
  stories: Story[],
  input: FixtureBriefInput,
): CheckResult {
  const knownIds = new Set(input.docs.map((d) => d.id))
  const details: string[] = []
  let cited = 0
  let resolved = 0

  for (const [i, story] of stories.entries()) {
    for (const id of story.sourceIds) {
      cited += 1
      if (knownIds.has(id)) {
        resolved += 1
      } else {
        details.push(`story[${i}] cites unknown source "${id}"`)
      }
    }
  }

  const score = cited === 0 ? 0 : resolved / cited
  return { name: 'sourceIdsResolve', score, details }
}

/**
 * Every number in the prose must trace to a value in the source text. Compares
 * numeric values rather than digit strings, so "310,000" matches a source that
 * wrote "310 thousand". Known false positives remain for derived figures
 * ("3rd month in a row") and rounded ones ("about 4%" from "4.25%"), which is
 * why this contributes a score instead of gating.
 */
function numbersGrounded(
  prose: string[],
  input: FixtureBriefInput,
): CheckResult {
  const sourceValues = new Set(
    input.docs.flatMap((d) => [
      ...sourceValuesIn(d.title),
      ...sourceValuesIn(d.body),
    ]),
  )

  const details: string[] = []
  let total = 0
  let grounded = 0

  for (const text of prose) {
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

/** Flags a set of stories where most lean on the same source document. */
function sourceDiversity(stories: Story[]): CheckResult {
  const distinct = new Set(stories.flatMap((s) => s.sourceIds))
  const score =
    stories.length === 0 ? 0 : Math.min(1, distinct.size / stories.length)
  const details =
    score < 1
      ? [
          `${stories.length} stories drawn from only ${distinct.size} distinct source(s)`,
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

const DAY_MS = 86_400_000

/** A prediction must resolve in the future and within a scoreable horizon. */
function predictionResolvable(
  prediction: Prediction,
  generatedAt: string,
): CheckResult {
  const generated = Date.parse(generatedAt)
  const resolves = Date.parse(prediction.resolvesAt)
  const horizonDays = (resolves - generated) / DAY_MS

  return scoreConditions('predictionResolvable', [
    {
      ok: resolves > generated,
      msg: `resolvesAt (${prediction.resolvesAt}) is not after generatedAt (${generatedAt})`,
    },
    {
      ok: horizonDays <= MAX_HORIZON_DAYS,
      msg: `horizon of ${horizonDays.toFixed(1)} days exceeds the ${MAX_HORIZON_DAYS}-day maximum`,
    },
  ])
}

/**
 * The pipeline supplies both fields and echoes them back. Timestamps are compared
 * as instants so a reformatted but equivalent `generatedAt` still counts.
 */
function echoesInput(
  generatedAt: string,
  edition: Edition,
  input: BriefInput,
): CheckResult {
  return scoreConditions('echoesInput', [
    {
      ok: Date.parse(generatedAt) === Date.parse(input.asOf),
      msg: `generatedAt (${generatedAt}) does not match the supplied asOf (${input.asOf})`,
    },
    {
      ok: edition === input.edition,
      msg: `edition "${edition}" does not match the supplied "${input.edition}"`,
    },
  ])
}

export type Check<T> = (artifact: T, input: FixtureBriefInput) => CheckResult

/** Tags a check closure with the stable name it reports, so scorers can label it. */
type NamedCheck<T> = Check<T> & { checkName: string }
const named = <T>(checkName: string, check: Check<T>): NamedCheck<T> =>
  Object.assign(check, { checkName })

export type { NamedCheck }

/** Research findings: grounded, well-sourced, diverse stories that echo the input. */
export const RESEARCH_CHECKS: NamedCheck<ResearchFindings>[] = [
  named('sourceIdsResolve', (f, i) => sourceIdsResolve(f.stories, i)),
  named('numbersGrounded', (f, i) => numbersGrounded(storyProse(f.stories), i)),
  named('sourceDiversity', (f) => sourceDiversity(f.stories)),
  named('echoesInput', (f, i) => echoesInput(f.generatedAt, f.edition, i)),
]

/** A prediction: resolvable in a scoreable window, with a grounded rationale. */
export const PREDICTION_CHECKS: NamedCheck<Prediction>[] = [
  named('predictionResolvable', (p, i) => predictionResolvable(p, i.asOf)),
  named('numbersGrounded', (p, i) => numbersGrounded([p.rationale], i)),
]

/** The brief body: grounded prose over well-sourced, diverse headlines. */
export const SUMMARY_CHECKS: NamedCheck<SummaryDraft>[] = [
  named('sourceIdsResolve', (s, i) => sourceIdsResolve(s.headlines, i)),
  named('numbersGrounded', (s, i) =>
    numbersGrounded([s.marketSummary, ...storyProse(s.headlines)], i),
  ),
  named('sourceDiversity', (s) => sourceDiversity(s.headlines)),
]

/** The assembled brief, end to end — every content check on the final artifact. */
export const BRIEF_CHECKS: NamedCheck<Brief>[] = [
  named('sourceIdsResolve', (b, i) => sourceIdsResolve(b.headlines, i)),
  named('numbersGrounded', (b, i) =>
    numbersGrounded(
      [b.marketSummary, b.prediction.rationale, ...storyProse(b.headlines)],
      i,
    ),
  ),
  named('sourceDiversity', (b) => sourceDiversity(b.headlines)),
  named('predictionResolvable', (b) =>
    predictionResolvable(b.prediction, b.generatedAt),
  ),
  named('echoesInput', (b, i) => echoesInput(b.generatedAt, b.edition, i)),
]
