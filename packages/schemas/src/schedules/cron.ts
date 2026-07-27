import { z } from 'zod'

/**
 * A deliberately narrower grammar than croner's: five fields, `* , - /`, and
 * numeric or named values. No seconds or year field, no `L`, `W`, `#`, `+`, `?`
 * and no `@daily` nicknames.
 *
 * The contract that matters is one-directional — **everything this accepts,
 * croner parses**. `apps/server` re-checks with croner itself before writing, so
 * a pattern that gets past both is one the worker can fire; a pattern this
 * rejects is one the portal never offered to build.
 */
const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const

const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

type CronField = {
  label: string
  min: number
  max: number
  /** croner rejects a step larger than its field's own ceiling, which is not `max` everywhere. */
  maxStep: number
  names?: readonly string[]
}

const FIELDS: readonly CronField[] = [
  { label: 'minute', min: 0, max: 59, maxStep: 60 },
  { label: 'hour', min: 0, max: 23, maxStep: 24 },
  { label: 'day-of-month', min: 1, max: 31, maxStep: 31 },
  { label: 'month', min: 1, max: 12, maxStep: 12, names: MONTH_NAMES },
  { label: 'day-of-week', min: 0, max: 7, maxStep: 7, names: WEEKDAY_NAMES },
]

const NUMERIC = /^\d{1,4}$/

const allowedValues = (field: CronField): string =>
  field.names
    ? `${field.min}-${field.max} or ${field.names[0]}-${field.names.at(-1)}`
    : `${field.min}-${field.max}`

const namedValue = (token: string, field: CronField): number | null => {
  const index = field.names?.indexOf(token.toUpperCase()) ?? -1
  return index < 0 ? null : field.min + index
}

const boundValue = (token: string, field: CronField): number | null => {
  const named = namedValue(token, field)
  if (named !== null) return named
  if (!NUMERIC.test(token)) return null

  const value = Number(token)
  return value >= field.min && value <= field.max ? value : null
}

/**
 * croner reads a named Sunday closing a range as 7 rather than 0, which is what
 * makes `MON-SUN` a whole week instead of an inverted range.
 */
const rangeEndOf = (token: string, field: CronField): number | null => {
  const value = boundValue(token, field)
  return value === 0 && namedValue(token, field) === 0 && field.max === 7
    ? field.max
    : value
}

const stepProblem = (
  part: string,
  step: string,
  base: string,
  field: CronField,
): string | null => {
  if (!NUMERIC.test(step)) {
    return `${field.label} field: "${step}" is not a step`
  }
  const size = Number(step)
  if (size < 1) {
    return `${field.label} field: a step must be at least 1`
  }
  if (size > field.maxStep) {
    return `${field.label} field: a step may not be greater than ${field.maxStep}`
  }
  if (base !== '*' && !base.includes('-')) {
    return `${field.label} field: "${part}" steps from a single value — write "*/${step}" or a range`
  }
  return null
}

const partProblem = (part: string, field: CronField): string | null => {
  const [base, step, ...extraSteps] = part.split('/')
  if (base === undefined || base.length === 0) {
    return `${field.label} field: "${part}" is missing a value`
  }
  if (extraSteps.length > 0) {
    return `${field.label} field: "${part}" has more than one step`
  }
  if (step !== undefined) {
    const problem = stepProblem(part, step, base, field)
    if (problem) return problem
  }
  if (base === '*') return null

  const [start, end, ...extraBounds] = base.split('-')
  if (extraBounds.length > 0) {
    return `${field.label} field: "${base}" has more than one range`
  }

  const from = start === undefined ? null : boundValue(start, field)
  if (from === null) {
    return `${field.label} field: "${start ?? ''}" is not ${allowedValues(field)}`
  }
  if (end === undefined) return null

  const to = rangeEndOf(end, field)
  if (to === null) {
    return `${field.label} field: "${end}" is not ${allowedValues(field)}`
  }
  return to < from
    ? `${field.label} field: range "${base}" ends before it starts`
    : null
}

const fieldProblem = (raw: string, field: CronField): string | null => {
  for (const part of raw.split(',')) {
    const problem = partProblem(part, field)
    if (problem) return problem
  }
  return null
}

const cronProblem = (pattern: string): string | null => {
  const fields = pattern.split(/\s+/).filter((field) => field.length > 0)
  if (fields.length !== FIELDS.length) {
    return `must be 5 fields — minute hour day-of-month month day-of-week — not ${fields.length}`
  }

  for (const [index, field] of FIELDS.entries()) {
    const problem = fieldProblem(fields[index] ?? '', field)
    if (problem) return problem
  }
  return null
}

export const CronExpressionSchema = z
  .string()
  .trim()
  .check((ctx) => {
    const problem = cronProblem(ctx.value)
    if (problem !== null) {
      ctx.issues.push({ code: 'custom', message: problem, input: ctx.value })
    }
  })
