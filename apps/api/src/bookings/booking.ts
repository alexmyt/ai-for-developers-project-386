// Бронь из спецификации §8 (docs/spec/calendar.md): занятый интервал
// с данными гостя; единственный способ занять слот.
export interface Booking {
  /** Id брони, генерирует сервер (crypto.randomUUID). */
  id: string
  /** Id типа встречи, длительность которого задаёт размер интервала. */
  meetingTypeId: string
  /** Название типа встречи на момент брони. */
  meetingTypeTitle: string
  /** Полуоткрытый интервал [start, end): касание границами — не конфликт. */
  start: Date
  end: Date
  /** Имя гостя: 1–100 символов после trim. */
  guestName: string
  /** Email гостя: без пробелов, с «@» и точкой в домене. */
  guestEmail: string
  /** Момент создания брони — из Clock (ADR-0003). */
  createdAt: Date
}
