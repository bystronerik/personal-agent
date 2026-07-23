/** Telegram rejects a `text` longer than this many UTF-16 code units. */
export const MESSAGE_LIMIT = 4096

/** Break points, widest structure first. `''` is the last-resort hard cut. */
const SEPARATORS = ['\n\n', '\n', ' ', '']

/**
 * Iterating a string yields whole code points, so a surrogate pair is never
 * halved. Grapheme clusters (ZWJ sequences, skin tones) still can be — this
 * path only runs for an unbroken run longer than the whole limit.
 */
function hardCut(text: string, limit: number): string[] {
  const chunks: string[] = []
  let current = ''
  for (const character of text) {
    if (current !== '' && current.length + character.length > limit) {
      chunks.push(current)
      current = ''
    }
    current += character
  }
  if (current !== '') {
    chunks.push(current)
  }
  return chunks
}

/**
 * Packs greedily at `SEPARATORS[level]`, descending to a finer separator only
 * for a part that does not fit on its own. The last piece of a descent stays
 * open so the next part can still join it.
 */
function pack(text: string, limit: number, level: number): string[] {
  if (text.length <= limit) {
    return [text]
  }

  const separator = SEPARATORS[level]
  if (separator === undefined || separator === '') {
    return hardCut(text, limit)
  }

  const chunks: string[] = []
  let current = ''
  for (const part of text.split(separator)) {
    const candidate = current === '' ? part : current + separator + part
    if (candidate.length <= limit) {
      current = candidate
      continue
    }

    if (current !== '') {
      chunks.push(current)
    }
    const pieces = pack(part, limit, level + 1)
    chunks.push(...pieces.slice(0, -1))
    current = pieces.at(-1) ?? ''
  }

  if (current !== '') {
    chunks.push(current)
  }
  return chunks
}

/**
 * Splits `text` into sendable chunks, preferring paragraph, then line, then
 * word boundaries. Assumes plain text: a chunk boundary inside an HTML or
 * MarkdownV2 entity would leave the tag unclosed and Telegram would reject it.
 */
export function splitMessage(text: string, limit = MESSAGE_LIMIT): string[] {
  if (limit < 1) {
    throw new RangeError(`splitMessage needs a positive limit, got ${limit}`)
  }

  return pack(text.trim(), limit, 0)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk !== '')
}
