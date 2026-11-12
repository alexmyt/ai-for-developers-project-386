// Общие помощники валидации запросов: единый конверт ошибок и каскад
// «обязательно → строка» для каждого поля (спецификация §8, §10).
// Порядок проверок фиксирует спецификация, поэтому помощники не меняют
// ни порядок, ни дословные тексты сообщений.

import { HttpException, HttpStatus } from '@nestjs/common'

/** Ошибка валидации в едином конверте { code, message } (спецификация §10). */
export function validationError(message: string): HttpException {
  return new HttpException({ code: 'validation_error', message }, HttpStatus.BAD_REQUEST)
}

/** Тело запроса — объект JSON: массивы и скаляры не проходят (§6.1, §8). */
export function requireJsonObject(request: unknown): Record<string, unknown> {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    throw validationError('Тело запроса должно быть объектом JSON')
  }
  return request as Record<string, unknown>
}

/**
 * Обязательное строковое поле: сначала «обязательно», затем «строка»
 * (порядок проверок спецификации §8). Значение возвращается без изменений —
 * нормализация (trim, разбор формата) остаётся в вызывающей валидации.
 */
export function requireStringField(body: Record<string, unknown>, field: string): string {
  const value = body[field]
  if (value === undefined) {
    throw validationError(`Поле ${field} обязательно`)
  }
  if (typeof value !== 'string') {
    throw validationError(`Поле ${field} должно быть строкой`)
  }
  return value
}
