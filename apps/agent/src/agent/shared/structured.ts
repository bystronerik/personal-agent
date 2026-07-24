import { chatCompletion } from '../../llm/openrouter'

export type {
  ChatMessage,
  StructuredRequest,
  StructuredResult,
} from '../../llm/openrouter'

/**
 * One schema-constrained model call with no tools — the transform the
 * prediction and summary agents run. This seam is the reason no agent imports
 * the transport directly.
 */
export const structuredComplete = chatCompletion
