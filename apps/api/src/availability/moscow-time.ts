// Перевод между UTC-инстантами и настенным временем по Москве.
// Пояс владельца — Europe/Moscow из спецификации §2 (docs/spec/calendar.md):
// UTC+3 круглый года, но смещение считаем по IANA-имени, а не константой.
import { TIME_ZONE } from '../config/calendar'

/** Настенное время в часовом поясе владельца. */
interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

// en-CA даёт ровно формат YYYY-MM-DD.
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// h23 — чтобы полночь была «00», а не «24».
const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function wallClockOf(instant: Date): WallClock {
  const parts = partsFormatter.formatToParts(instant)
  const values = new Map<string, number>()
  for (const part of parts) {
    if (part.type !== 'literal') {
      values.set(part.type, Number(part.value))
    }
  }
  return {
    year: values.get('year') as number,
    month: values.get('month') as number,
    day: values.get('day') as number,
    hour: values.get('hour') as number,
    minute: values.get('minute') as number,
    second: values.get('second') as number,
  }
}

/** Смещение пояса в минутах: сколько прибавить к настенному времени, чтобы получить UTC. */
function zoneOffsetMinutes(instant: Date): number {
  const wall = wallClockOf(instant)
  const wallAsUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  )
  return (wallAsUtc - instant.getTime()) / 60_000
}

/** Дата момента по Москве в формате YYYY-MM-DD (спецификация §7). */
export function moscowDateString(instant: Date): string {
  return dateFormatter.format(instant)
}

/** ISO 8601 с Z без миллисекунд: все моменты сервиса выровнены по минутам. */
export function isoInstant(instant: Date): string {
  return instant.toISOString().replace('.000Z', 'Z')
}

/** Части календарной даты YYYY-MM-DD; для другой строки кидает ошибку. */
function parseDate(date: string): { year: number; month: number; day: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Ожидается дата YYYY-MM-DD, получено: ${date}`)
  }
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  }
}

/** UTC-инстант настенного времени по Москве: date «YYYY-MM-DD», часы и минуты. */
export function moscowInstantAt(date: string, hour: number, minute: number): Date {
  const { year, month, day } = parseDate(date)
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  // Две итерации сходятся для обычных переходов на летнее время; у Москвы
  // смещение постоянное, поэтому достаточно и одной.
  let instant = wallAsUtc
  for (let pass = 0; pass < 2; pass += 1) {
    instant = wallAsUtc - zoneOffsetMinutes(new Date(instant)) * 60_000
  }
  return new Date(instant)
}

/** Следующая или предыдущая календарная дата для строки YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDate(date)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}
