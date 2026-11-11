import { describe, expect, it } from 'vitest'
import { moscowDateString, moscowInstantAt } from '../src/availability/moscow-time'
import { buildDayGrid } from '../src/availability/slot-grid'
import { buildAvailability } from '../src/availability/availability.domain'
import type { BookingInterval } from '../src/availability/availability.domain'

// Часовой пояс из спецификации §2: Europe/Moscow, UTC+3 круглый год
// (docs/spec/calendar.md). Пример из §3: 2026-11-12T07:00:00Z — это
// 12 ноября, 10:00 по Москве.
describe('московское время', () => {
  it('переводит момент в дату YYYY-MM-DD по Москве', () => {
    expect(moscowDateString(new Date('2026-11-12T07:00:00Z'))).toBe('2026-11-12')
  })

  it('начало московского дня — это 21:00 UTC предыдущего дня', () => {
    expect(moscowDateString(new Date('2026-11-11T20:59:59Z'))).toBe('2026-11-11')
    expect(moscowDateString(new Date('2026-11-11T21:00:00Z'))).toBe('2026-11-12')
  })

  it('переводит настенное время по Москве в UTC-инстант', () => {
    // 09:00 по Москве — это 06:00 UTC, 18:00 — 15:00 UTC.
    expect(moscowInstantAt('2026-11-12', 9, 0).toISOString()).toBe('2026-11-12T06:00:00.000Z')
    expect(moscowInstantAt('2026-11-12', 18, 0).toISOString()).toBe('2026-11-12T15:00:00.000Z')
  })
})

// Сетка слотов из спецификации §4: старты от 09:00 с шагом 30 минут,
// встреча должна закончиться не позже 18:00.
describe('сетка слотов', () => {
  it('для 30 минут даёт 18 стартов: с 09:00 до 17:30', () => {
    const slots = buildDayGrid('2026-11-12', 30)

    expect(slots).toHaveLength(18)
    expect(slots[0].start.toISOString()).toBe('2026-11-12T06:00:00.000Z') // 09:00 по Москве
    const last = slots[slots.length - 1]
    expect(last.start.toISOString()).toBe('2026-11-12T14:30:00.000Z') // 17:30 по Москве
    expect(last.end.toISOString()).toBe('2026-11-12T15:00:00.000Z') // 18:00 по Москве
  })

  it('соседние старты разнесены на 30 минут', () => {
    const slots = buildDayGrid('2026-11-12', 30)

    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i].start.getTime() - slots[i - 1].start.getTime()).toBe(30 * 60_000)
      // Длительность слота равна длительности типа встречи.
      expect(slots[i].end.getTime() - slots[i].start.getTime()).toBe(30 * 60_000)
    }
  })

  it('для 60 минут последний старт — 17:00, чтобы успеть до 18:00', () => {
    const slots = buildDayGrid('2026-11-12', 60)

    expect(slots).toHaveLength(17)
    const last = slots[slots.length - 1]
    expect(last.start.toISOString()).toBe('2026-11-12T14:00:00.000Z') // 17:00 по Москве
    expect(last.end.toISOString()).toBe('2026-11-12T15:00:00.000Z') // 18:00 по Москве
  })

  it('встреча, не влезающая до 18:00, не даёт ни одного слота', () => {
    // 600 минут не помещаются в окно 09:00–18:00 даже со старта в 09:00.
    expect(buildDayGrid('2026-11-12', 600)).toEqual([])
  })
})

// Момент «до» окна: 15:00 по Москве 10 ноября — все слоты 12–24 ноября будущие.
const NOW_ALL_FUTURE = new Date('2026-11-10T12:00:00Z')

function booking(meetingTypeId: string, startIso: string, endIso: string): BookingInterval {
  return { meetingTypeId, start: new Date(startIso), end: new Date(endIso) }
}

// Окно записи из спецификации §7: ровно 14 дней, начиная с сегодняшнего по Москве.
describe('окно записи', () => {
  it('содержит ровно 14 дней: сегодня и 13 следующих', () => {
    // 12:15 по Москве 11 ноября: первый день — 11-е, четырнадцатый — 24-е.
    const result = buildAvailability({
      now: new Date('2026-11-11T09:15:00Z'),
      meetingTypeId: 'intro',
      durationMinutes: 30,
      bookings: [],
    })

    expect(result.days).toHaveLength(14)
    expect(result.days[0].date).toBe('2026-11-11')
    expect(result.days[13].date).toBe('2026-11-24')
  })

  it('смену московского дня определяет дата по Москве, а не UTC', () => {
    // Полночь по Москве — это 21:00 UTC предыдущего дня (спецификация §3).
    const before = buildAvailability({
      now: new Date('2026-11-11T20:59:59Z'),
      meetingTypeId: 'intro',
      durationMinutes: 30,
      bookings: [],
    })
    const after = buildAvailability({
      now: new Date('2026-11-11T21:00:00Z'),
      meetingTypeId: 'intro',
      durationMinutes: 30,
      bookings: [],
    })

    expect(before.days[0].date).toBe('2026-11-11')
    expect(after.days[0].date).toBe('2026-11-12')
  })

  it('пустой день всё равно присутствует в ответе', () => {
    // 19:00 по Москве: все старты сегодняшнего дня уже прошли, но день в ответе есть.
    const result = buildAvailability({
      now: new Date('2026-11-11T16:00:00Z'),
      meetingTypeId: 'intro',
      durationMinutes: 30,
      bookings: [],
    })

    expect(result.days[0]).toEqual({ date: '2026-11-11', slots: [] })
  })
})

// Прошедшие старты из спецификации §4: start <= now в ответ не попадает.
describe('прошедшие старты', () => {
  it('скрывает старты, чей момент уже наступил', () => {
    // 12:15 по Москве 11 ноября: первый будущий старт — 12:30 (09:30 UTC).
    const result = buildAvailability({
      now: new Date('2026-11-11T09:15:00Z'),
      meetingTypeId: 'intro',
      durationMinutes: 30,
      bookings: [],
    })

    expect(result.days[0].slots[0].start).toBe('2026-11-11T09:30:00Z')
    // Старты 12:30–17:30 — это 11 слотов.
    expect(result.days[0].slots).toHaveLength(11)
  })

  it('скрывает слот, начинающийся ровно сейчас', () => {
    // Ровно 12:30 по Москве: старт 12:30 уже наступил, будущее начинается в 13:00.
    const result = buildAvailability({
      now: new Date('2026-11-11T09:30:00Z'),
      meetingTypeId: 'intro',
      durationMinutes: 30,
      bookings: [],
    })

    expect(result.days[0].slots[0].start).toBe('2026-11-11T10:00:00Z')
  })
})

// Матрица пересечений из спецификации §5 и §13.1: полуоткрытые интервалы
// [start, end), касание границами конфликтом не считается.
describe('статусы слотов по пересечению с бронями', () => {
  const DAY = '2026-11-12'
  const slotStart = (moscowHour: number, moscowMinute = 0): string =>
    moscowInstantAt(DAY, moscowHour, moscowMinute).toISOString().replace('.000Z', 'Z')

  function availabilityWith(bookings: BookingInterval[]) {
    return buildAvailability({
      now: NOW_ALL_FUTURE,
      meetingTypeId: 'intro',
      durationMinutes: 30,
      bookings,
    })
  }

  function statusOn(
    day: { date: string; slots: { start: string; status: string }[] },
    startIso: string,
  ): string {
    const slot = day.slots.find((slot) => slot.start === startIso)
    expect(slot, `слот ${startIso} должен быть в ответе`).toBeDefined()
    return (slot as { start: string; status: string }).status
  }

  const dayOf = (result: {
    days: { date: string; slots: { start: string; status: string }[] }[]
  }) =>
    result.days.find((day) => day.date === DAY) as {
      date: string
      slots: { start: string; status: string }
    }

  it('без броней все слоты свободны', () => {
    const day = dayOf(availabilityWith([]))

    expect(statusOn(day, slotStart(10))).toBe('free')
    expect(statusOn(day, slotStart(11))).toBe('free')
  })

  it('бронь ровно на слот делает слот занятым', () => {
    // Бронь 10:00–10:30 по Москве — тот же интервал, что и слот.
    const day = dayOf(availabilityWith([booking('intro', slotStart(10), slotStart(10, 30))]))

    expect(statusOn(day, slotStart(10))).toBe('taken')
    expect(statusOn(day, slotStart(10, 30))).toBe('free')
  })

  it('частичное наложение делает слот занятым', () => {
    // Бронь 10:00–11:00: слоты 10:00 и 10:30 заняты, 11:00 свободен (пример §5).
    const day = dayOf(availabilityWith([booking('intro', slotStart(10), slotStart(11))]))

    expect(statusOn(day, slotStart(10))).toBe('taken')
    expect(statusOn(day, slotStart(10, 30))).toBe('taken')
    expect(statusOn(day, slotStart(11))).toBe('free')
  })

  it('бронь внутри слота делает слот занятым', () => {
    // Бронь 10:10–10:20 целиком внутри слота 10:00–10:30.
    const inside = booking(
      'intro',
      moscowInstantAt(DAY, 10, 10).toISOString(),
      moscowInstantAt(DAY, 10, 20).toISOString(),
    )
    const day = dayOf(availabilityWith([inside]))

    expect(statusOn(day, slotStart(10))).toBe('taken')
  })

  it('касание границами конфликтом не считается', () => {
    // Бронь 10:00–10:30: слот 10:30–11:00 начинается ровно в момент её окончания.
    const day = dayOf(availabilityWith([booking('intro', slotStart(10), slotStart(10, 30))]))

    expect(statusOn(day, slotStart(10, 30))).toBe('free')

    // И наоборот: бронь 10:30–11:00 кончается ровно в начале слота 11:00–11:30.
    const dayAfter = dayOf(availabilityWith([booking('intro', slotStart(10, 30), slotStart(11))]))
    expect(statusOn(dayAfter, slotStart(11))).toBe('free')
  })

  it('бронь другого типа встречи тоже занимает слот', () => {
    // Пересечение запрещено для любых типов встреч (спецификация §5).
    const day = dayOf(availabilityWith([booking('project-review', slotStart(10), slotStart(11))]))

    expect(statusOn(day, slotStart(10, 30))).toBe('taken')
  })

  it('бронь другого дня не влияет на слоты этого дня', () => {
    // Бронь 13 ноября 10:00–10:30, проверяем слоты 12 ноября.
    const otherDay = booking(
      'intro',
      moscowInstantAt('2026-11-13', 10, 0).toISOString(),
      moscowInstantAt('2026-11-13', 10, 30).toISOString(),
    )
    const day = dayOf(availabilityWith([otherDay]))

    expect(statusOn(day, slotStart(10))).toBe('free')
  })
})
