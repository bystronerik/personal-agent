import type { Prediction } from '../schema'
import { referenceBrief } from './brief-good'

/** The reference brief's prediction, resolvable and grounded. */
export const referencePrediction: Prediction = referenceBrief.prediction
