import { evalite } from 'evalite'

import { runPrediction } from '../agent/prediction/agent'
import { createBlackboard } from '../agent/shared/blackboard'
import { type Budget, createPool } from '../agent/shared/budget'
import { referenceFindings } from '../fixtures/findings-good'
import { syntheticNews } from '../fixtures/synthetic-news'
import { COMPARED_MODELS } from '../llm/models'
import { PREDICTION_SCORERS } from './scorers'

const BUDGET: Budget = { softLimitUsd: 1, hardLimitUsd: 2 }

/** Fed a fixed findings fixture so the score reflects the prediction step alone. */
evalite.each(COMPARED_MODELS.map((model) => ({ name: model, input: model })))(
  'prediction',
  {
    data: [{ input: syntheticNews }],
    task: (briefInput, model) => {
      const board = createBlackboard(briefInput)
      board.findings = referenceFindings
      return runPrediction({ model, board, pool: createPool(), budget: BUDGET })
    },
    scorers: PREDICTION_SCORERS,
    /** JSON failures here are intermittent; a single trial proves nothing. */
    trialCount: 3,
  },
)
