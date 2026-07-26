import { evalite } from 'evalite'

import { runBrief } from '../agent/orchestrator/agent'
import { syntheticNews } from '../fixtures/synthetic-news'
import { fixtureProvider } from '../sources/fixture'
import { acrossModels, E2E_BUDGET, reportingPerModel } from './models'
import { BRIEF_SCORERS } from './scorers'

const LAYER = 'orchestrator'

/** End to end: the orchestrator drives research → predict → summarize itself. */
evalite.each(acrossModels())(LAYER, {
  data: [{ input: syntheticNews }],
  task: reportingPerModel(LAYER, async (briefInput, model, sessionId) => {
    const { brief } = await runBrief(briefInput, {
      sources: fixtureProvider(briefInput.docs),
      model,
      budget: E2E_BUDGET,
      sessionId,
    })
    return brief
  }),
  scorers: BRIEF_SCORERS,
})
