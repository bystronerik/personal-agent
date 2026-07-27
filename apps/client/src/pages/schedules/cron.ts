const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/** A known Sunday, so a cron day-of-week number maps onto a locale weekday name. */
const REFERENCE_SUNDAY = Date.UTC(2024, 0, 7)

export function describeCron(
  cron: string,
  locale: string,
  everyDayLabel: string,
): { time: string; days: string } {
  const [minute, hour, , , weekday] = cron.split(' ')
  const time = `${(hour ?? '').padStart(2, '0')}:${(minute ?? '').padStart(2, '0')}`

  return { time, days: describeWeekdays(weekday ?? '*', locale, everyDayLabel) }
}

function describeWeekdays(
  field: string,
  locale: string,
  everyDayLabel: string,
): string {
  const days = expandDayField(field)
  if (!days) return field
  if (days.length === ALL_DAYS.length) return everyDayLabel

  const name = weekdayNamer(locale)
  const first = days.at(0)
  const last = days.at(-1)
  if (first === undefined || last === undefined) return field

  const contiguous = days.every((day, index) => day === first + index)

  return contiguous && days.length > 2
    ? `${name(first)}–${name(last)}`
    : days.map(name).join(', ')
}

function expandDayField(field: string): number[] | null {
  if (field === '*') return ALL_DAYS

  const days: number[] = []
  for (const part of field.split(',')) {
    const bounds = part.split('-').map(Number)
    const from = bounds.at(0)
    const to = bounds.at(1)
    if (from === undefined || Number.isNaN(from)) return null
    if (bounds.length === 1) {
      days.push(from)
      continue
    }
    if (to === undefined || Number.isNaN(to) || to < from) return null
    for (let day = from; day <= to; day += 1) days.push(day)
  }

  return [...new Set(days)].sort((a, b) => a - b)
}

function weekdayNamer(locale: string) {
  const format = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'UTC',
  })

  return (day: number) =>
    format.format(new Date(REFERENCE_SUNDAY + day * 24 * 60 * 60 * 1000))
}
