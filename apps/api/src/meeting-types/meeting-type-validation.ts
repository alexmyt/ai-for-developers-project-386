import { MEETING_TYPE_ID_MAX_LENGTH, MEETING_TYPE_ID_PATTERN } from '../config/calendar'
import { requireJsonObject, requireStringField, validationError } from '../validation/validation'

/** Название на карточке для гостя: 1–100 символов после trim (спецификация §6). */
export const MEETING_TYPE_TITLE_MAX_LENGTH = 100

/** Описание для гостя: до 500 символов после trim (спецификация §6). */
export const MEETING_TYPE_DESCRIPTION_MAX_LENGTH = 500

/** Границы длительности в минутах: от 30 до 240, кратна 30 (спецификация §6). */
export const MEETING_TYPE_DURATION_MIN_MINUTES = 30
export const MEETING_TYPE_DURATION_MAX_MINUTES = 240
export const MEETING_TYPE_DURATION_STEP_MINUTES = 30

/** Нормализованные поля запроса на создание типа встречи. */
export interface CreateMeetingTypeInput {
  id: string
  title: string
  description: string | null
  durationMinutes: number
}

/**
 * Проверяет форму и поля запроса на создание типа (спецификация §6.1)
 * и нормализует их: title и description обрезаются, пустое описание
 * превращается в null. Нарушение — 400 validation_error.
 */
export function validateCreateMeetingTypeRequest(request: unknown): CreateMeetingTypeInput {
  const body = requireJsonObject(request)

  // id — внешний идентификатор, который задаёт владелец: 1–50 символов
  // по шаблону. Минимальная длина выводится из шаблона, поэтому отдельной
  // проверки на пустоту не нужно.
  const id = requireStringField(body, 'id')
  if (id.length > MEETING_TYPE_ID_MAX_LENGTH) {
    throw validationError(`Поле id должно быть не длиннее ${MEETING_TYPE_ID_MAX_LENGTH} символов`)
  }
  if (!MEETING_TYPE_ID_PATTERN.test(id)) {
    throw validationError(
      'Поле id должно состоять из строчных латинских букв, цифр и дефисов между ними',
    )
  }

  // title — 1–100 символов после trim.
  const title = requireStringField(body, 'title')
  const trimmedTitle = title.trim()
  if (trimmedTitle.length < 1 || trimmedTitle.length > MEETING_TYPE_TITLE_MAX_LENGTH) {
    throw validationError(
      `Поле title должно быть от 1 до ${MEETING_TYPE_TITLE_MAX_LENGTH} символов`,
    )
  }

  // description — до 500 символов после trim; не передано, null или пустое — null.
  let description: string | null = null
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      throw validationError('Поле description должно быть строкой или null')
    }
    const trimmedDescription = body.description.trim()
    if (trimmedDescription.length > MEETING_TYPE_DESCRIPTION_MAX_LENGTH) {
      throw validationError(
        `Поле description должно быть не длиннее ${MEETING_TYPE_DESCRIPTION_MAX_LENGTH} символов`,
      )
    }
    description = trimmedDescription === '' ? null : trimmedDescription
  }

  // durationMinutes — целое от 30 до 240, кратное 30: длительность задаёт
  // размер слота на сетке с шагом 30 минут.
  const durationMinutes = body.durationMinutes
  if (durationMinutes === undefined) {
    throw validationError('Поле durationMinutes обязательно')
  }
  if (
    typeof durationMinutes !== 'number' ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MEETING_TYPE_DURATION_MIN_MINUTES ||
    durationMinutes > MEETING_TYPE_DURATION_MAX_MINUTES ||
    durationMinutes % MEETING_TYPE_DURATION_STEP_MINUTES !== 0
  ) {
    throw validationError(
      `Поле durationMinutes должно быть целым числом от ${MEETING_TYPE_DURATION_MIN_MINUTES} до ${MEETING_TYPE_DURATION_MAX_MINUTES}, кратным ${MEETING_TYPE_DURATION_STEP_MINUTES}`,
    )
  }

  return { id, title: trimmedTitle, description, durationMinutes }
}
