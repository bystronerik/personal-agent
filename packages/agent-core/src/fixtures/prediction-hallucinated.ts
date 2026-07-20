import type { Prediction } from '../schema'
import { hallucinatedBrief } from './brief-hallucinated'

/** The defective prediction — its 400+ day horizon trips predictionResolvable. */
export const hallucinatedPrediction: Prediction = hallucinatedBrief.prediction
