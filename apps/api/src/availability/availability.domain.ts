// Чистая логика доступности: окно записи, скрытие прошедших стартов и статусы
// по пересечению с бронями (спецификация §4, §5, §7, docs/spec/calendar.md).
// Время приходит снаружи через Clock (ADR-0003), поэтому функции детерминированы.
import { BOOKING_WINDOW_DAYS } from '../config/calendar'
import { intervalsIntersect } from '../bookings/booking.domain'
import type { Availability, AvailabilityDay, AvailabilitySlot } from './availability'
import { addDays, isoInstant, moscowDateString } from './moscow-time'
import { buildDayGrid } from './slot-grid'

/** Интервал занятости: бронь любого типа встречи (спецификация §5). */
export interface BookingInterval {
  meetingTypeId: string
  /** Полуоткрытый интервал [start, end). */
  start: Date
  end: Date
}

/**
 * Окно записи целиком: ровно 14 дней с сегодняшнего по Москве, слоты сетки
 * дня без прошедших стартов, статус по пересечению с любыми бронями.
 */
export function buildAvailability(input: {
  /** Текущий момент — в продакшене из Clock, в тестах фиксированный. */
  now: Date
  meetingTypeId: string
  durationMinutes: number
  bookings: BookingInterval[]
}): Availability {
  const { now, meetingTypeId, durationMinutes, bookings } = input
  const today = moscowDateString(now)
  const days: AvailabilityDay[] = []
  for (let dayOffset = 0; dayOffset < BOOKING_WINDOW_DAYS; dayOffset += 1) {
    const date = addDays(today, dayOffset)
    const slots: AvailabilitySlot[] = buildDayGrid(date, durationMinutes)
      // Старт, который уже наступил (start <= now), не возвращается вообще (§4).
      .filter((slot) => slot.start.getTime() > now.getTime())
      .map((slot) => ({
        start: isoInstant(slot.start),
        end: isoInstant(slot.end),
        status: bookings.some((booking) => intervalsIntersect(slot, booking)) ? 'taken' : 'free',
      }))
    days.push({ date, slots })
  }
  return { meetingTypeId, days }
}
