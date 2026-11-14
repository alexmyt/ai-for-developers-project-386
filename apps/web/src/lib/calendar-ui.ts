// Общие константы интерфейса и форматтеры времени для страниц фронтенда.
// Бизнес-константы календаря принадлежат API (`apps/api/src/config/calendar.ts`)
// и приходят на экраны через API: фронтенд не дублирует правила. Здесь живёт
// только оформление: пояс для показа времени, подписи и пределы полей форм,
// повторяющие ограничения контракта. Полное решение — metadata-эндпоинт API,
// который отдавал бы их как данные; пока вне объёма проекта (спецификация §12).

/** Пояс владельца, в котором показывается любое время (спецификация §3). */
export const TIME_ZONE = 'Europe/Moscow'

// Подписи времени строятся вручную через locale-форматтеры: ru-RU даёт
// «10:00» и «11 ноября», разделитель интервала — тире. В конце подписи
// слота — метка « МСК»: гость видит, в каком поясе записывается (§3).

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})

const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'long',
})

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
})

/** Подпись слота «10:00–10:30 МСК» — время всегда московское (§3). */
export function slotLabel(startIso: string, endIso: string): string {
  return `${timeFormatter.format(new Date(startIso))}–${timeFormatter.format(new Date(endIso))} МСК`
}

/** Подпись дня календаря «ср, 11 ноября» по московской дате `YYYY-MM-DD`. */
export function dayLabel(date: string): string {
  return dayFormatter.format(new Date(`${date}T00:00:00Z`))
}

/** Подпись даты «11 ноября» по UTC-инстанту — для списка владельца (§9). */
export function dateLabel(isoInstant: string): string {
  return dateFormatter.format(new Date(isoInstant))
}

/** Пределы полей форм: повторяют ограничения контракта (§6, §8). */
export const INPUT_LIMITS = {
  /** id типа встречи: 1–50 символов (§6). */
  meetingTypeId: 50,
  /** Название типа и имя гостя: 1–100 символов после trim (§6, §8). */
  title: 100,
  guestName: 100,
  /** Описание типа: до 500 символов (§6). */
  description: 500,
  /** Email гостя: до 254 символов (§8). */
  guestEmail: 254,
} as const

// Длительность кратна шагу сетки: варианты от 30 до 240 минут (§6).
export const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180, 210, 240] as const
