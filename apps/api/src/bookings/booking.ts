// Бронь из спецификации §8 (docs/spec/calendar.md): занятый интервал
// с данными гостя; единственный способ занять слот.
export interface Booking {
  /** Id брони, генерирует сервер (crypto.randomUUID). */
  id: string
  /** Id типа встречи, длительность которого задаёт размер интервала. */
  meetingTypeId: string
  /** Полуоткрытый интервал [start, end): касание границами — не конфликт. */
  start: Date
  end: Date
}
