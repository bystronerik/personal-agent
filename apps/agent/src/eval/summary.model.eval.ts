import { evalite } from 'evalite'

import { runSummary } from '../agent/summary/agent'
import { referenceFindings } from '../fixtures/findings-good'
import { referencePrediction } from '../fixtures/prediction-good'
import { syntheticNews } from '../fixtures/synthetic-news'
import { acrossModels, layerContext } from './models'
import { SUMMARY_SCORERS } from './scorers'

/** Fed fixed findings + prediction so the score reflects the summary step alone. */
evalite.each(acrossModels())('summary', {
  data: [{ input: syntheticNews }],
  task: (briefInput, model) => {
    const ctx = layerContext(briefInput, model)
    ctx.board.findings = referenceFindings
    ctx.board.prediction = referencePrediction
    return runSummary(ctx)
  },
  scorers: SUMMARY_SCORERS,
  trialCount: 3,
})
