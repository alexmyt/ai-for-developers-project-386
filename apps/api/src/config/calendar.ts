// Константы календаря из спецификации §2 (docs/spec/calendar.md).
// Пока нужны константы сид-типа и формата id типа встречи: сетка слотов
// и окно записи появятся вместе со слотами в следующих срезах.

/** Id сид-типа встречи. */
export const SEED_MEETING_TYPE_ID = 'intro'

/** Название сид-типа встречи. */
export const SEED_MEETING_TYPE_TITLE = 'Знакомство'

/** Длительность сид-типа встречи в минутах. */
export const SEED_MEETING_TYPE_DURATION_MINUTES = 30

/** Формат id типа встречи, который задаёт владелец. */
export const MEETING_TYPE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Максимальная длина id типа встречи. */
export const MEETING_TYPE_ID_MAX_LENGTH = 50
