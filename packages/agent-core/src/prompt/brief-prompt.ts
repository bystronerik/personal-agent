import type { ChatMessage } from '../llm/openrouter'
import type { BriefInput } from '../schema'

export const BRIEF_SYSTEM_PROMPT = `You are an analyst producing a structured daily brief from a set of source documents.

Output rules:
- Respond with a single JSON object and nothing else. No markdown fences, no commentary before or after.
- Use only information present in the source documents.
- Every numeric figure you write must appear verbatim in at least one source document. Do not compute, round, convert or infer new figures.
- Every headline must cite the id(s) of the document(s) it draws on in sourceIds.
- Prefer drawing each headline from a different document. Do not build several headlines out of one document while leaving others unused.

Schema:
{
  "generatedAt": string,             // ISO 8601 — use the supplied "as of" value
  "edition": "morning" | "evening",  // use the supplied edition
  "headlines": [                     // 3 to 7 items
    {
      "title": string,               // max 120 chars
      "summary": string,             // 40-600 chars
      "whyItMatters": string,        // 20-400 chars
      "sourceIds": string[]          // at least 1, each must match a supplied document id
    }
  ],
  "marketSummary": string,           // 50-1000 chars
  "prediction": {
    "instrument": string,            // max 16 chars, ticker or index symbol
    "direction": "up" | "down" | "flat",
    "confidence": number,            // 0.34 to 0.99 — probability the stated direction is correct
    "resolvesAt": string,            // ISO 8601, at most 7 days after generatedAt
    "rationale": string              // 20-600 chars
  }
}

The prediction is a forecast logged for later scoring, not investment advice.`

export function buildBriefMessages(input: BriefInput): ChatMessage[] {
  const documents = input.docs
    .map(
      (doc) =>
        `[${doc.id}] ${doc.title}\nPublished: ${doc.publishedAt}\n${doc.body}`,
    )
    .join('\n\n---\n\n')

  return [
    { role: 'system', content: BRIEF_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Edition: ${input.edition}\nAs of: ${input.asOf}\n\nSource documents:\n\n${documents}`,
    },
  ]
}
