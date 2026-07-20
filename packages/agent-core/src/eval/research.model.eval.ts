import { evalite } from 'evalite'

import { runResearch } from '../agent/research/agent'
import { createBlackboard } from '../agent/shared/blackboard'
import { type Budget, createPool } from '../agent/shared/budget'
import { syntheticNews } from '../fixtures/synthetic-news'
import { COMPARED_MODELS } from '../llm/models'
import { RESEARCH_SCORERS } from './scorers'

/** Generous — the eval measures research quality, not budget behaviour. */
const BUDGET: Budget = { softLimitUsd: 1, hardLimitUsd: 2 }

evalite.each(COMPARED_MODELS.map((model) => ({ name: model, input: model })))(
  'research',
  {
    data: [{ input: syntheticNews }],
    task: (briefInput, model) =>
      runResearch({
        model,
        board: createBlackboard(briefInput),
        pool: createPool(),
        budget: BUDGET,
      }),
    scorers: RESEARCH_SCORERS,
  },
)
