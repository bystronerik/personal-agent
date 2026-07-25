import { evalite } from 'evalite'

import { runPrediction } from '../agent/prediction/agent'
import { referenceFindings } from '../fixtures/findings-good'
import { syntheticNews } from '../fixtures/synthetic-news'
import { acrossModels, layerContext, reportingPerModel } from './models'
import { PREDICTION_SCORERS } from './scorers'

const LAYER = 'prediction'

/** Fed a fixed findings fixture so the score reflects the prediction step alone. */
evalite.each(acrossModels())(LAYER, {
  data: [{ input: syntheticNews }],
  task: reportingPerModel(LAYER, (briefInput, model, sessionId) => {
    const ctx = layerContext(briefInput, model, sessionId)
    ctx.board.findings = referenceFindings
    return runPrediction(ctx)
  }),
  scorers: PREDICTION_SCORERS,
  /** JSON failures here are intermittent; a single trial proves nothing. */
  trialCount: 3,
})
