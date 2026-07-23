import { describe, expect, it } from 'vitest'
import { MESSAGE_LIMIT, splitMessage } from './split'

const within = (chunks: string[], limit: number) =>
  chunks.every((chunk) => chunk.length <= limit)

describe('splitMessage', () => {
  it('leaves a message that fits as one chunk', () => {
    expect(splitMessage('a short brief')).toEqual(['a short brief'])
  })

  it('drops an empty message rather than sending a blank', () => {
    expect(splitMessage('   \n\n  ')).toEqual([])
  })

  it('keeps a message of exactly the limit whole', () => {
    const chunks = splitMessage('a'.repeat(MESSAGE_LIMIT))
    expect(chunks).toHaveLength(1)
  })

  it('splits one code unit over the limit', () => {
    const chunks = splitMessage('a'.repeat(MESSAGE_LIMIT + 1))
    expect(chunks).toHaveLength(2)
    expect(within(chunks, MESSAGE_LIMIT)).toBe(true)
  })

  it('prefers paragraph boundaries', () => {
    const paragraph = 'x'.repeat(30)
    expect(splitMessage([paragraph, paragraph].join('\n\n'), 40)).toEqual([
      paragraph,
      paragraph,
    ])
  })

  it('falls back to line, then word boundaries', () => {
    expect(splitMessage('alpha bravo\ncharlie delta', 13)).toEqual([
      'alpha bravo',
      'charlie delta',
    ])
    expect(splitMessage('alpha bravo charlie', 12)).toEqual([
      'alpha bravo',
      'charlie',
    ])
  })

  it('hard cuts a word longer than the limit', () => {
    const chunks = splitMessage('z'.repeat(25), 10)
    expect(chunks).toEqual(['z'.repeat(10), 'z'.repeat(10), 'z'.repeat(5)])
  })

  it('never halves a surrogate pair', () => {
    const chunks = splitMessage('🙂'.repeat(10), 5)
    expect(within(chunks, 5)).toBe(true)
    expect(chunks.join('')).toBe('🙂'.repeat(10))
    expect(chunks.join('')).not.toContain('�')
  })

  it('preserves the text across a realistic split', () => {
    const source = Array.from(
      { length: 60 },
      (_, index) => `Paragraph ${index}. ${'filler words here. '.repeat(12)}`,
    ).join('\n\n')

    const chunks = splitMessage(source)

    expect(chunks.length).toBeGreaterThan(1)
    expect(within(chunks, MESSAGE_LIMIT)).toBe(true)
    const words = (text: string) => text.replace(/\s+/g, ' ').trim()
    expect(words(chunks.join(' '))).toBe(words(source))
  })

  it('rejects a limit that cannot hold anything', () => {
    expect(() => splitMessage('anything', 0)).toThrow(RangeError)
  })
})
