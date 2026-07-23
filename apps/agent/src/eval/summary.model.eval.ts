import { evalite } from 'evalite'
import { createBlackboard } from '../agent/shared/blackboard'
import { type Budget, createPool } from '../agent/shared/budget'
import { runSummary } from '../agent/summary/agent'
import { referenceFindings } from '../fixtures/findings-good'
import { referencePrediction } from '../fixtures/prediction-good'
import { syntheticNews } from '../fixtures/synthetic-news'
import { COMPARED_MODELS } from '../llm/models'
import { SUMMARY_SCORERS } from './scorers'

const BUDGET: Budget = { softLimitUsd: 1, hardLimitUsd: 2 }

/** Fed fixed findings + prediction so the score reflects the summary step alone. */
evalite.each(COMPARED_MODELS.map((model) => ({ name: model, input: model })))(
  'summary',
  {
    data: [{ input: syntheticNews }],
    task: (briefInput, model) => {
      const board = createBlackboard(briefInput)
      board.findings = referenceFindings
      board.prediction = referencePrediction
      return runSummary({ model, board, pool: createPool(), budget: BUDGET })
    },
    scorers: SUMMARY_SCORERS,
    trialCount: 3,
  },
)
