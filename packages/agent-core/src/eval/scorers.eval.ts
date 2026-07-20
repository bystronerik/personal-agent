import { evalite } from 'evalite'

import { referenceBrief } from '../fixtures/brief-good'
import { hallucinatedBrief } from '../fixtures/brief-hallucinated'
import { syntheticNews } from '../fixtures/synthetic-news'
import { BRIEF_SCORERS } from './scorers'

/**
 * Regression test for the scorers themselves — no model call, so it is free and
 * deterministic. If the hallucinated brief ever converges on the reference
 * brief's score, the scorers have stopped discriminating and every downstream
 * eval is meaningless.
 */
evalite.each([
  { name: 'reference', input: referenceBrief },
  { name: 'hallucinated', input: hallucinatedBrief },
])('scorers', {
  data: [{ input: syntheticNews }],
  task: (_briefInput, brief) => ({ brief, wasFenced: false }),
  scorers: BRIEF_SCORERS,
})
