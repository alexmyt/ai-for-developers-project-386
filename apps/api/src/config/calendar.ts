// Константы календаря из спецификации §2 (docs/spec/calendar.md).

/** Пояс владельца: UTC+3 круглый год, перехода на летнее время нет. */
export const TIME_ZONE = 'Europe/Moscow'

/** Час первого возможного старта слота. */
export const WORKDAY_START_HOUR = 9

/** Час, до которого встреча должна закончиться. */
export const WORKDAY_END_HOUR = 18

/** Шаг между соседними стартами в минутах. */
export const SLOT_STEP_MINUTES = 30

/** Окно записи: сегодня + 13 следующих дней, включая выходные. */
export const BOOKING_WINDOW_DAYS = 14

/** Id сид-типа встречи. */
export const SEED_MEETING_TYPE_ID = 'intro'

/** Название сид-типа встречи. */
export const SEED_MEETING_TYPE_TITLE = 'Знакомство'

/** Длительность сид-типа встречи в минутах. */
export const SEED_MEETING_TYPE_DURATION_MINUTES = 30
