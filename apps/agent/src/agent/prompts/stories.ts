import type { ResearchFindings } from '../../schema'

/** One numbered block per story, cited by document id. */
const storiesBlock = (findings: ResearchFindings): string =>
  findings.stories
    .map(
      (story, i) =>
        `[${i + 1}] ${story.title}\n${story.summary}\nWhy it matters: ${story.whyItMatters}\nSources: ${story.sourceIds.join(', ')}`,
    )
    .join('\n\n')

/**
 * The header both downstream agents open their user message with. Shared so the
 * prediction and summary models never see the same findings rendered two ways —
 * a drift no type or test would catch, only an eval score.
 */
export const briefContext = (findings: ResearchFindings): string =>
  `As of: ${findings.generatedAt}\nEdition: ${findings.edition}\n\nKey stories:\n\n${storiesBlock(findings)}`
