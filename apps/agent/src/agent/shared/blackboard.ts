import type {
  BriefInput,
  Prediction,
  ResearchFindings,
  SummaryDraft,
} from '../../schema'

/**
 * The typed hand-off store the specialists write to and read from. The
 * orchestrator model sequences the agents; this carries the actual payloads so
 * they never travel as model-serialized tool arguments.
 */
export type Blackboard = {
  readonly input: BriefInput
  findings?: ResearchFindings
  prediction?: Prediction
  summary?: SummaryDraft
}

export const createBlackboard = (input: BriefInput): Blackboard => ({ input })
