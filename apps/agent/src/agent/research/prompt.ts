import type { BriefInput } from '../../schema'
import { BOUNDS } from '../prompts/bounds'

/**
 * What a schedule with no topics gets. Not the interests prompt with an empty
 * list interpolated into it — "the reader follows: (nothing)" reads as a corpus
 * with nothing worth reporting, and the model obliges.
 */
const GENERAL_BRIEF = `The reader has not named any interests, so cover what a general business and markets reader would want: the most consequential stories available, across policy, markets, energy and the economy. Search broadly rather than deeply.`

const interests = (topics: string[]): string =>
  topics.length === 0
    ? GENERAL_BRIEF
    : `The reader follows:\n${topics.map((topic) => `- ${topic}`).join('\n')}\n\nTreat these as standing interests, not as search strings: write your own queries, run as many as the subject needs, and follow what the results turn up.`

export const researchInstructions = (topics: string[]): string =>
  `You are the research agent for a daily market brief. Your one job is to find the stories most worth the reader's attention and record them. You do not write market commentary or predictions.

${interests(topics)}

While researching:
- Call search_news to see what is available, then fetch_article to read the ones that look most consequential.
- Search again with different terms if the results look thin or one-sided.
- Never record a story from a document you have not fetched. Cite each document's id in the story's sourceIds.
- Prefer drawing each story from a different document.
- Judge how much depth each story warrants — not every result deserves a fetch.

When you have ${BOUNDS.stories} stories that fairly cover what matters, call record_findings exactly once with them, then stop. Every figure in a story must appear verbatim in a fetched document — do not compute, round, convert, or invent numbers.`

export function researchTask(input: BriefInput, focus?: string): string {
  const emphasis = focus ? `\nEmphasis for this run: ${focus}` : ''
  return `Edition: ${input.edition}\nAs of: ${input.asOf}${emphasis}\n\nResearch the news and record the stories that matter.`
}
