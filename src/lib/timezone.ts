/**
 * Timezone utilities for consistent day boundary calculations.
 */

export function getTimezoneOffsetMs(timezone: string, date: Date = new Date()): number {
  const utcParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(date)

  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(date)

  const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parseInt(parts.find(p => p.type === type)?.value || '0')

  const utcMs = Date.UTC(
    getPart(utcParts, 'year'),
    getPart(utcParts, 'month') - 1,
    getPart(utcParts, 'day'),
    getPart(utcParts, 'hour'),
    getPart(utcParts, 'minute'),
    getPart(utcParts, 'second')
  )

  const tzMs = Date.UTC(
    getPart(tzParts, 'year'),
    getPart(tzParts, 'month') - 1,
    getPart(tzParts, 'day'),
    getPart(tzParts, 'hour'),
    getPart(tzParts, 'minute'),
    getPart(tzParts, 'second')
  )

  return utcMs - tzMs
}

export function getUserDateStr(timezone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export function getDayBoundariesUTC(dateStr: string, timezone: string): { startOfDay: Date; endOfDay: Date } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const refDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const tzOffsetMs = getTimezoneOffsetMs(timezone, refDate)

  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  startOfDay.setTime(startOfDay.getTime() + tzOffsetMs)

  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)

  return { startOfDay, endOfDay }
}

export function getUserHour(timezone: string, date: Date = new Date()): number {
  return parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false
  }).format(date))
}
