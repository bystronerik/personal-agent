import { evalite } from 'evalite'

import { referenceBrief } from '../fixtures/brief-good'
import { hallucinatedBrief } from '../fixtures/brief-hallucinated'
import { referenceFindings } from '../fixtures/findings-good'
import { hallucinatedFindings } from '../fixtures/findings-hallucinated'
import { referencePrediction } from '../fixtures/prediction-good'
import { hallucinatedPrediction } from '../fixtures/prediction-hallucinated'
import { referenceSummary } from '../fixtures/summary-good'
import { hallucinatedSummary } from '../fixtures/summary-hallucinated'
import { syntheticNews } from '../fixtures/synthetic-news'
import {
  BRIEF_SCORERS,
  PREDICTION_SCORERS,
  RESEARCH_SCORERS,
  SUMMARY_SCORERS,
} from './scorers'

/**
 * Regression test for the scorers themselves — no model call, so it is free and
 * deterministic. If a hallucinated fixture ever converges on its reference's
 * score, that layer's scorers have stopped discriminating and every downstream
 * eval on it is meaningless. Guarded per layer so a break is localized.
 */

evalite.each([
  { name: 'reference', input: referenceFindings },
  { name: 'hallucinated', input: hallucinatedFindings },
])('research scorers', {
  data: [{ input: syntheticNews }],
  task: (_input, findings) => findings,
  scorers: RESEARCH_SCORERS,
})

evalite.each([
  { name: 'reference', input: referencePrediction },
  { name: 'hallucinated', input: hallucinatedPrediction },
])('prediction scorers', {
  data: [{ input: syntheticNews }],
  task: (_input, prediction) => prediction,
  scorers: PREDICTION_SCORERS,
})

evalite.each([
  { name: 'reference', input: referenceSummary },
  { name: 'hallucinated', input: hallucinatedSummary },
])('summary scorers', {
  data: [{ input: syntheticNews }],
  task: (_input, summary) => summary,
  scorers: SUMMARY_SCORERS,
})

evalite.each([
  { name: 'reference', input: referenceBrief },
  { name: 'hallucinated', input: hallucinatedBrief },
])('brief scorers', {
  data: [{ input: syntheticNews }],
  task: (_input, brief) => brief,
  scorers: BRIEF_SCORERS,
})
