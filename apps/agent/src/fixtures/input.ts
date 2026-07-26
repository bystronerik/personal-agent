import { z } from 'zod'

import { BriefInputSchema, SourceDocSchema } from '../schema'

/**
 * A `BriefInput` plus the corpus it is scored against. Only a fixture run can
 * carry documents inline — a live run's are in Postgres and are chosen by the
 * model through `search_news` — so this type, not `BriefInput`, is what
 * `grading/checks.ts` and the evals take. A live input then cannot reach a check
 * that would silently read its every figure as ungrounded.
 */
export const FixtureBriefInputSchema = BriefInputSchema.extend({
  docs: z.array(SourceDocSchema).min(1),
})

export type FixtureBriefInput = z.infer<typeof FixtureBriefInputSchema>
