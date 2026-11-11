import { HttpException, HttpStatus } from '@nestjs/common'

/** Имя гостя: 1–100 символов после trim (спецификация §8). */
export const GUEST_NAME_MAX_LENGTH = 100

/** Email гостя: до 254 символов (спецификация §8). */
export const GUEST_EMAIL_MAX_LENGTH = 254

/** Нормализованные поля запроса на бронирование. */
export interface CreateBookingInput {
  meetingTypeId: string
  start: Date
  name: string
  email: string
}

/** Ошибка валидации в едином конверте { code, message } (спецификация §10). */
function validationError(message: string): HttpException {
  return new HttpException({ code: 'validation_error', message }, HttpStatus.BAD_REQUEST)
}

// Формат utcDateTime из контракта: UTC-инстант в ISO 8601 с Z
// (спецификация §3). Дробные секунды допустимы.
const ISO_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/

/**
 * Разбирает ISO-инстант с проверкой компонентов: JS перекатывает
 * несуществующие даты (31 ноября превращается в 1 декабря), поэтому
 * «2026-11-31T07:00:00Z» не должен пройти как валидный момент.
 */
function parseIsoInstant(value: string): Date | null {
  const match = ISO_INSTANT_PATTERN.exec(value)
  if (!match) {
    return null
  }
  // Группы регулярки гарантируют шесть чисел; Number() терпит undefined.
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const monthIndex = month - 1
  // Число дней в месяце: день 0 следующего месяца — последний день текущего.
  const lastDayOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const componentsExist =
    day >= 1 && day <= lastDayOfMonth && hour <= 23 && minute <= 59 && second <= 59
  const instant = new Date(value)
  if (!componentsExist || Number.isNaN(instant.getTime())) {
    return null
  }
  return instant
}

// Email: до 254 символов, содержит @ и точку в домене, без пробелов (§8).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Проверяет форму и поля запроса на бронирование (спецификация §8) — первый
 * шаг порядка проверок, — и нормализует их: name обрезается. Нарушение —
 * 400 validation_error.
 */
export function validateCreateBookingRequest(request: unknown): CreateBookingInput {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    throw validationError('Тело запроса должно быть объектом JSON')
  }
  const body = request as Record<string, unknown>

  const meetingTypeId = body.meetingTypeId
  if (meetingTypeId === undefined) {
    throw validationError('Поле meetingTypeId обязательно')
  }
  if (typeof meetingTypeId !== 'string') {
    throw validationError('Поле meetingTypeId должно быть строкой')
  }

  const start = body.start
  if (start === undefined) {
    throw validationError('Поле start обязательно')
  }
  if (typeof start !== 'string') {
    throw validationError('Поле start должно быть строкой')
  }
  const startInstant = parseIsoInstant(start)
  if (!startInstant) {
    throw validationError('Поле start должно быть UTC-инстантом в формате ISO 8601 с Z')
  }

  const name = body.name
  if (name === undefined) {
    throw validationError('Поле name обязательно')
  }
  if (typeof name !== 'string') {
    throw validationError('Поле name должно быть строкой')
  }
  const trimmedName = name.trim()
  if (trimmedName.length < 1 || trimmedName.length > GUEST_NAME_MAX_LENGTH) {
    throw validationError(`Поле name должно быть от 1 до ${GUEST_NAME_MAX_LENGTH} символов`)
  }

  const email = body.email
  if (email === undefined) {
    throw validationError('Поле email обязательно')
  }
  if (typeof email !== 'string') {
    throw validationError('Поле email должно быть строкой')
  }
  if (email.length > GUEST_EMAIL_MAX_LENGTH) {
    throw validationError(`Поле email должно быть не длиннее ${GUEST_EMAIL_MAX_LENGTH} символов`)
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw validationError(
      'Поле email должно содержать «@» и точку в домене и не должно содержать пробелов',
    )
  }

  return { meetingTypeId, start: startInstant, name: trimmedName, email }
}
