import { evalite } from 'evalite'

import { runBrief } from '../agent/orchestrator/agent'
import { syntheticNews } from '../fixtures/synthetic-news'
import { acrossModels, E2E_BUDGET } from './models'
import { BRIEF_SCORERS } from './scorers'

/** End to end: the orchestrator drives research → predict → summarize itself. */
evalite.each(acrossModels())('orchestrator', {
  data: [{ input: syntheticNews }],
  task: async (briefInput, model) => {
    const { brief } = await runBrief(briefInput, { model, budget: E2E_BUDGET })
    return brief
  },
  scorers: BRIEF_SCORERS,
})
