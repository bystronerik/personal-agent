import { describe, expect, it } from 'vitest'

import { researchInstructions } from './prompt'

describe('researchInstructions', () => {
  it('lists the schedule topics as standing interests', () => {
    const prompt = researchInstructions([
      'central bank policy',
      'semiconductors',
    ])

    expect(prompt).toContain('- central bank policy')
    expect(prompt).toContain('- semiconductors')
  })

  /**
   * Topics steer the search; they are not the search. Handing them over as a
   * fixed query list would be the hardcoded pipeline the project exists not to
   * have.
   */
  it('tells the model to write its own queries from them', () => {
    const prompt = researchInstructions(['energy prices'])

    expect(prompt).toMatch(/not as search strings/)
    expect(prompt).toMatch(/write your own queries/)
  })

  /**
   * A schedule with no topics gets a general brief. Not the interests prompt
   * with an empty list in it — "the reader follows: (nothing)" reads as a corpus
   * with nothing worth reporting, and the model obliges.
   */
  it('asks for a general brief when there are no topics', () => {
    const prompt = researchInstructions([])

    expect(prompt).toMatch(/has not named any interests/)
    expect(prompt).toMatch(/Search broadly/)
    expect(prompt).not.toMatch(/The reader follows/)
  })

  it('keeps the citation and verbatim-figure rules in both shapes', () => {
    for (const prompt of [
      researchInstructions([]),
      researchInstructions(['x']),
    ]) {
      expect(prompt).toMatch(
        /Never record a story from a document you have not fetched/,
      )
      expect(prompt).toMatch(/must appear verbatim in a fetched document/)
    }
  })
})
