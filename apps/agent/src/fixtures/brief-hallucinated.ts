import { type Brief, BriefSchema } from '../schema'

/**
 * Deliberately defective brief — valid per schema, but trips every check in
 * `grading/checks.ts`. Exists to prove the scorers discriminate; each defect is
 * annotated with the check it fails. Figures contradict [syntheticNews](./synthetic-news.ts)
 * rather than merely omitting it, so `numbersGrounded` has something to catch.
 */
export const hallucinatedBrief = BriefSchema.parse({
  // echoesInput: both fields contradict the supplied input (asOf 06:00, morning).
  generatedAt: '2026-07-19T22:00:00Z',
  edition: 'evening',
  headlines: [
    {
      // numbersGrounded: the source holds at 4.25%; a 50bp cut to 3.75% is invented.
      title: 'Valdora cuts rates by 50 basis points in surprise move',
      summary:
        'The Central Bank of Valdora cut its policy rate by 50 basis points to 3.75 percent, a decision no forecaster in the survey of 47 economists had anticipated. The bank also raised its growth forecast to 2.8 percent for the year ahead.',
      whyItMatters:
        'An unforecast cut of this size would mark the sharpest policy pivot since the last easing cycle.',
      sourceIds: ['doc-01'],
    },
    {
      // numbersGrounded: source reports 890 million and a 7.5% fall, not 1,200 and a rally.
      title: 'Semiconductor revenues surge past expectations',
      summary:
        'Northwind Semiconductor posted revenue of 1,200 million credits, beating consensus by a wide margin, and guided full-year revenue up by 15 percent. Shares rallied 5.5 percent in extended trading on the strength of data-center orders.',
      whyItMatters:
        'A beat of this magnitude would reset expectations for the entire chip sector heading into the second half.',
      sourceIds: ['doc-01', 'doc-99'], // sourceIdsResolve: doc-99 is not in the input.
    },
    {
      // numbersGrounded: source reports rates up 64% and delays up 9 days, not flat.
      title: 'Freight costs stable as shipping lanes normalise',
      summary:
        'Container rates held broadly flat this month as carriers resumed normal transit schedules, with average delays falling back to 2 days. Analysts expect no measurable pass-through to consumer goods inflation over the coming quarter.',
      whyItMatters:
        'Stable freight removes one of the more persistent upside risks to the goods component of inflation.',
      sourceIds: ['doc-01'],
    },
    // sourceDiversity: 3 headlines drawn from 2 distinct ids, one of them unresolvable.
  ],
  // numbersGrounded: crude settled at 71, gas storage at 11% above seasonal.
  marketSummary:
    'Equities closed broadly higher, led by a 5.5 percent advance in semiconductors and supported by crude falling to 62 credits a barrel. Natural gas storage was reported at 19 percent above the seasonal average, easing the near-term energy cost outlook considerably.',
  prediction: {
    instrument: 'VLD100',
    direction: 'up',
    confidence: 0.91,
    // predictionResolvable: a 400+ day horizon blows the 7-day scoreable maximum.
    resolvesAt: '2027-09-01T20:00:00Z',
    rationale:
      'Rate cuts and a semiconductor earnings beat together argue for a sustained advance over the period ahead, with limited downside risk from the energy complex.',
  },
} satisfies Brief)
