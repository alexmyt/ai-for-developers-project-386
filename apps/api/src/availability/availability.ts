// Доступность типа встречи из спецификации §7 (docs/spec/calendar.md):
// окно записи отдаётся одним ответом, чтобы фронтенд не делал 14 запросов.
export interface AvailabilitySlot {
  /** UTC-инстант старта слота в ISO 8601 с Z. */
  start: string
  /** UTC-инстант окончания слота в ISO 8601 с Z. */
  end: string
  /** free — пересечений с бронями нет, taken — есть пересечение (спецификация §5). */
  status: 'free' | 'taken'
}

export interface AvailabilityDay {
  /** Дата по Москве в формате YYYY-MM-DD. */
  date: string
  /** Слоты рабочего дня; прошедшие старты скрыты, пустой день — норма. */
  slots: AvailabilitySlot[]
}

export interface Availability {
  meetingTypeId: string
  /** Ровно 14 дней, начиная с сегодняшнего по Москве. */
  days: AvailabilityDay[]
}
