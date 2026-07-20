import { type BriefInput, BriefSchema } from '../schema.js'
import {
  type CheckResult,
  numbersGrounded,
  predictionResolvable,
  sourceDiversity,
  sourceIdsResolve,
} from './checks.js'

export type EvalReport = {
  ok: boolean
  meanScore: number
  checks: CheckResult[]
  schemaErrors: string[]
}

/**
 * Schema validity gates everything: an unparseable candidate scores 0 rather
 * than a misleading partial average.
 */
export function evaluateBrief(
  candidate: unknown,
  input: BriefInput,
): EvalReport {
  const parsed = BriefSchema.safeParse(candidate)

  if (!parsed.success) {
    return {
      ok: false,
      meanScore: 0,
      checks: [],
      schemaErrors: parsed.error.issues.map(
        (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
      ),
    }
  }

  const brief = parsed.data
  const checks: CheckResult[] = [
    sourceIdsResolve(brief, input),
    numbersGrounded(brief, input),
    sourceDiversity(brief),
    predictionResolvable(brief),
  ]

  const meanCheckScore =
    checks.reduce((sum, c) => sum + c.score, 0) / (checks.length || 1)

  return {
    ok: checks.every((c) => c.passed),
    meanScore: meanCheckScore,
    checks,
    schemaErrors: [],
  }
}
