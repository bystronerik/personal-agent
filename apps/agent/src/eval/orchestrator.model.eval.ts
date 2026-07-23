import { evalite } from 'evalite'

import { runBrief } from '../agent/orchestrator/agent'
import type { Budget } from '../agent/shared/budget'
import { syntheticNews } from '../fixtures/synthetic-news'
import { COMPARED_MODELS } from '../llm/models'
import { BRIEF_SCORERS } from './scorers'

/** Generous enough to let the loop finish the whole pipeline once. */
const BUDGET: Budget = { softLimitUsd: 1.5, hardLimitUsd: 3 }

/** End to end: the orchestrator drives research → predict → summarize itself. */
evalite.each(COMPARED_MODELS.map((model) => ({ name: model, input: model })))(
  'orchestrator',
  {
    data: [{ input: syntheticNews }],
    task: async (briefInput, model) => {
      const { brief } = await runBrief(briefInput, { model, budget: BUDGET })
      return brief
    },
    scorers: BRIEF_SCORERS,
  },
)
