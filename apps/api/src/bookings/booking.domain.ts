// Чистая логика брони: окно записи, сетка и пересечения (спецификация §4,
// §5, §8, docs/spec/calendar.md). Текущее время передаётся снаружи через
// Clock (ADR-0003), поэтому функции детерминированы.
import { BOOKING_WINDOW_DAYS } from '../config/calendar'
import { addDays, moscowDateString } from '../availability/moscow-time'
import { buildDayGrid } from '../availability/slot-grid'

/** Интервал-кандидат: проверяемая бронь или существующая бронь (§5). */
export interface Interval {
  /** Полуоткрытый интервал [start, end): касание границами — не конфликт. */
  start: Date
  end: Date
}

/**
 * Пересечение полуоткрытых интервалов: a.start < b.end && b.start < a.end.
 * Касание границами конфликтом не считается, частичное наложение любых
 * типов встреч запрещено (спецификация §5).
 */
export function intervalsIntersect(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
}

/**
 * Старт внутри окна записи (спецификация §8): start > now, а московская дата
 * старта — не дальше 13-го дня от сегодняшней. Границы окна проверяются
 * по московской дате, а не по UTC (спецификация §3).
 */
export function isStartInWindow(input: { start: Date; now: Date }): boolean {
  const lastWindowDay = addDays(moscowDateString(input.now), BOOKING_WINDOW_DAYS - 1)
  return (
    input.start.getTime() > input.now.getTime() && moscowDateString(input.start) <= lastWindowDay
  )
}

/**
 * Старт на сетке дня (спецификация §4): 09:00–18:00 по Москве с шагом
 * 30 минут, и встреча успевает закончиться до 18:00. Проверка повторно
 * использует построение сетки дня: старт валиден, если он совпадает
 * с одним из стартов сетки.
 */
export function isStartOnGrid(input: { start: Date; durationMinutes: number }): boolean {
  const date = moscowDateString(input.start)
  return buildDayGrid(date, input.durationMinutes).some(
    (slot) => slot.start.getTime() === input.start.getTime(),
  )
}
