import type { Brief, Story } from '../../schema'

const EDITION_LABEL = {
  morning: 'Morning brief',
  evening: 'Evening brief',
} as const

const stamp = (iso: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso))

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A date-only value names a calendar day, not an instant: `Date.parse` puts it
 * at UTC midnight, so projecting it into a western zone would print the day
 * before the one the model committed to.
 */
const day = (iso: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: DATE_ONLY.test(iso) ? 'UTC' : timeZone,
  }).format(new Date(iso))

/**
 * The source ids ride along because this rendering is the only one a human
 * reads: without them a headline the model invented is indistinguishable from
 * one it fetched.
 */
const headline = (story: Story, index: number): string =>
  [
    `${index + 1}. ${story.title}`,
    story.summary,
    `Why it matters: ${story.whyItMatters}`,
    `Sources: ${story.sourceIds.join(', ')}`,
  ].join('\n')

/**
 * Plain text, deliberately. `splitMessage` packs at paragraph boundaries with no
 * notion of markup, so a chunk boundary inside an entity would leave a tag
 * unclosed and Telegram would reject that chunk — which is also why delivery
 * sets no `parse_mode`.
 *
 * The prediction carries its disclaimer in the delivered text: it is a logged
 * experiment to be scored later, and never advice.
 */
export function formatBrief(brief: Brief, timeZone: string): string {
  const { prediction } = brief

  return [
    `${EDITION_LABEL[brief.edition]} · ${stamp(brief.generatedAt, timeZone)}`,
    brief.headlines.map(headline).join('\n\n'),
    `Market summary\n${brief.marketSummary}`,
    [
      'Prediction — a logged experiment, not financial advice',
      `${prediction.instrument} ${prediction.direction} · confidence ${prediction.confidence} · resolves ${day(prediction.resolvesAt, timeZone)}`,
      prediction.rationale,
    ].join('\n'),
  ].join('\n\n')
}
