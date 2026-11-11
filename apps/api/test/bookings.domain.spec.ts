// Чистая логика брони: окно записи, сетка и пересечения (спецификация §5,
// §8, docs/spec/calendar.md). Время передаётся снаружи, поэтому тесты
// детерминированы и не зависят от даты запуска.
import { describe, expect, it } from 'vitest'
import { isStartInWindow, isStartOnGrid, intervalsIntersect } from '../src/bookings/booking.domain'

// 12:15 по Москве 11 ноября — «сейчас» для всех проверок окна.
const FIXED_NOW = new Date('2026-11-11T09:15:00Z')

// Окно записи из спецификации §2: сегодня + 13 следующих дней,
// то есть с 11 по 24 ноября 2026 включительно.
describe('окно записи брони', () => {
  it('принимает старт на сетке завтрашнего дня', () => {
    // 10:00 по Москве 12 ноября — 07:00 UTC.
    expect(isStartInWindow({ start: new Date('2026-11-12T07:00:00Z'), now: FIXED_NOW })).toBe(true)
  })

  it('отклоняет старт, который уже наступил', () => {
    // 12:00 по Москве 11 ноября: раньше фиксированного «сейчас» (12:15).
    expect(isStartInWindow({ start: new Date('2026-11-11T09:00:00Z'), now: FIXED_NOW })).toBe(false)
  })

  it('отклоняет старт, начинающийся ровно сейчас (start <= now)', () => {
    expect(isStartInWindow({ start: new Date('2026-11-11T09:15:00Z'), now: FIXED_NOW })).toBe(false)
  })

  it('принимает последний слот 14-го дня окна: 17:30 по Москве 24 ноября', () => {
    expect(isStartInWindow({ start: new Date('2026-11-24T14:30:00Z'), now: FIXED_NOW })).toBe(true)
  })

  it('отклоняет старт 15-го дня: окно кончается 24 ноября', () => {
    // 09:00 по Москве 25 ноября — уже за границей окна.
    expect(isStartInWindow({ start: new Date('2026-11-25T06:00:00Z'), now: FIXED_NOW })).toBe(false)
  })

  it('границу окна проверяет по московской дате, а не по UTC', () => {
    // Полночь по Москве — 21:00 UTC предыдущего дня (спецификация §3):
    // 25 ноября по Москве начинается в 21:00 UTC 24-го.
    const lateEveningNow = new Date('2026-11-11T20:59:59Z')
    expect(isStartInWindow({ start: new Date('2026-11-24T20:59:59Z'), now: lateEveningNow })).toBe(
      true,
    )
    expect(isStartInWindow({ start: new Date('2026-11-24T21:00:00Z'), now: lateEveningNow })).toBe(
      false,
    )
  })
})

// Сетка слотов из спецификации §4: 09:00–18:00 по Москве, шаг 30 минут,
// встреча должна закончиться не позже 18:00.
describe('старт на сетке', () => {
  it('принимает выровненный старт внутри рабочего дня', () => {
    expect(isStartOnGrid({ start: new Date('2026-11-12T07:00:00Z'), durationMinutes: 30 })).toBe(
      true,
    )
  })

  it('принимает последний старт для 30 минут — 17:30', () => {
    expect(isStartOnGrid({ start: new Date('2026-11-12T14:30:00Z'), durationMinutes: 30 })).toBe(
      true,
    )
  })

  it('принимает последний старт для 60 минут — 17:00', () => {
    expect(isStartOnGrid({ start: new Date('2026-11-12T14:00:00Z'), durationMinutes: 60 })).toBe(
      true,
    )
  })

  it.each([
    { name: 'старт между шагами сетки (10:10)', start: '2026-11-12T07:10:00Z', duration: 30 },
    { name: 'старт раньше 09:00 по Москве (07:00)', start: '2026-11-12T04:00:00Z', duration: 30 },
    { name: 'старт ровно в 18:00 по Москве', start: '2026-11-12T15:00:00Z', duration: 30 },
    { name: 'секунды не нулевые (10:00:30)', start: '2026-11-12T07:00:30Z', duration: 30 },
    {
      name: 'встреча на 60 минут не влезает до 18:00 (17:30)',
      start: '2026-11-12T14:30:00Z',
      duration: 60,
    },
  ])('отклоняет случай: $name', ({ start, duration }) => {
    expect(isStartOnGrid({ start: new Date(start), durationMinutes: duration })).toBe(false)
  })
})

// Матрица пересечений из спецификации §5 и §13.1: полуоткрытые интервалы
// [start, end), касание границами конфликтом не считается.
describe('пересечение полуоткрытых интервалов', () => {
  /** Настенное время по Москве в UTC-инстант: 10:00 → 07:00Z. */
  function at(hour: number, minute: number): Date {
    return new Date(Date.UTC(2026, 10, 12, hour - 3, minute))
  }

  it('точное наложение — конфликт', () => {
    expect(
      intervalsIntersect(
        { start: at(10, 0), end: at(10, 30) },
        { start: at(10, 0), end: at(10, 30) },
      ),
    ).toBe(true)
  })

  it('частичное наложение — конфликт, даже у разных типов встреч', () => {
    // 10:00–11:00 и 10:30–11:00: пример из требований (спецификация §5).
    expect(
      intervalsIntersect(
        { start: at(10, 0), end: at(11, 0) },
        { start: at(10, 30), end: at(11, 0) },
      ),
    ).toBe(true)
  })

  it('вложение — конфликт', () => {
    expect(
      intervalsIntersect(
        { start: at(10, 0), end: at(11, 0) },
        { start: at(10, 10), end: at(10, 20) },
      ),
    ).toBe(true)
  })

  it('касание границами — не конфликт', () => {
    // 10:00–10:30 и 10:30–11:00 совместимы (пример спецификации §5).
    expect(
      intervalsIntersect(
        { start: at(10, 0), end: at(10, 30) },
        { start: at(10, 30), end: at(11, 0) },
      ),
    ).toBe(false)
  })

  it('касание в другую сторону — не конфликт', () => {
    expect(
      intervalsIntersect(
        { start: at(10, 30), end: at(11, 0) },
        { start: at(10, 0), end: at(10, 30) },
      ),
    ).toBe(false)
  })

  it('непересекающиеся интервалы — не конфликт', () => {
    expect(
      intervalsIntersect(
        { start: at(10, 0), end: at(10, 30) },
        { start: at(11, 0), end: at(11, 30) },
      ),
    ).toBe(false)
  })
})
