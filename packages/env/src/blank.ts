/**
 * `.env` files routinely carry empty placeholders (`API_PORT=`), which an
 * optional field would otherwise accept as a valid empty string. Treating a
 * blank as absent lets it reach a field's `.default()` as `undefined`. This is
 * the single home for that rule — every loader and single-var reader routes
 * through it.
 */
export function blankAsAbsent<T>(value: T): T | undefined {
  if (typeof value !== 'string') {
    return value
  }
  const trimmed = value.trim()
  return trimmed === '' ? undefined : (trimmed as T)
}
