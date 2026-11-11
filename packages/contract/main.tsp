import "@typespec/http";
import "@typespec/json-schema";

using TypeSpec.Http;
using TypeSpec.JsonSchema;

/**
 * Контракт сервиса «Календарь звонков».
 * Источник истины: сервер пишется по этому описанию (ADR-0002).
 */
@service(#{ title: "Календарь звонков" })
namespace CallCalendar;

/** Проверка живости сервиса: используется Docker HEALTHCHECK и smoke-тестами. */
@route("/api/health")
@get
op health(): {
  status: "ok";
};

/**
 * Тип встречи — шаблон, заданный владельцем: размер слота и подпись
 * на гостевой странице (спецификация §6, docs/spec/calendar.md).
 */
model MeetingType {
  /** Внешний идентификатор: задаёт владелец, уникален и не меняется. */
  id: string;

  /** Название на карточке для гостя. */
  title: string;

  /** Описание для гостя; если не задано или пустое — null. */
  description: string | null;

  /** Длительность в минутах: от 30 до 240, кратна 30. */
  durationMinutes: int32;
}

/** Список типов встреч в порядке создания, сид-тип идёт первым (спецификация §6.2). */
@route("/api/meeting-types")
@get
op listMeetingTypes(): {
  items: MeetingType[];
};

/**
 * Создание типа встречи: id задаёт владелец, сервер его не генерирует
 * (спецификация §6.1). Проверки идут в порядке: форма и поля → уникальность id.
 */
@route("/api/meeting-types")
@post
op createMeetingType(
  @body body: CreateMeetingTypeRequest,
):
  | CreatedMeetingTypeResponse
  | ValidationErrorResponse
  | MeetingTypeExistsResponse;

/** Данные для создания типа встречи: все поля задаёт владелец (спецификация §6.1). */
model CreateMeetingTypeRequest {
  /** Внешний идентификатор: 1–50 символов, латиница в нижнем регистре и дефисы. */
  @minLength(1)
  @maxLength(50)
  @pattern("^[a-z0-9]+(?:-[a-z0-9]+)*$")
  id: string;

  /** Название на карточке для гостя: 1–100 символов. */
  @minLength(1)
  @maxLength(100)
  title: string;

  /** Описание для гостя: до 500 символов; если не передано или пустое — null. */
  @maxLength(500)
  description?: string | null;

  /** Длительность в минутах: от 30 до 240, кратна 30. */
  @minValue(30)
  @maxValue(240)
  @multipleOf(30)
  durationMinutes: int32;
}

/** Успешное создание: 201 с созданным типом (спецификация §6.1). */
model CreatedMeetingTypeResponse {
  @statusCode _: 201;
  ...MeetingType;
}

/** Слот в сетке дня: интервал-кандидат со статусом, ещё не бронь (спецификация §4). */
model AvailabilitySlot {
  /** UTC-инстант старта слота в ISO 8601 с Z. */
  start: utcDateTime;

  /** UTC-инстант окончания слота в ISO 8601 с Z. */
  end: utcDateTime;

  /** `free` — пересечений с бронями нет, `taken` — есть пересечение (спецификация §5). */
  status: "free" | "taken";
}

/** Календарный день по Москве со слотами рабочего дня. */
model AvailabilityDay {
  /** Дата по Москве в формате YYYY-MM-DD. */
  @pattern("^\\d{4}-\\d{2}-\\d{2}$")
  date: string;

  /** Слоты дня; прошедшие старты скрыты, пустой день — нормальное состояние. */
  slots: AvailabilitySlot[];
}

/** Доступность типа встречи на всё окно записи одним ответом (спецификация §7). */
model Availability {
  meetingTypeId: string;

  /** Ровно 14 дней, начиная с сегодняшнего по Москве. */
  days: AvailabilityDay[];
}

/**
 * Сетка на окно записи одним ответом: 14 дней с сегодняшнего по Москве,
 * чтобы фронтенд не делал 14 запросов (спецификация §7).
 */
@route("/api/availability")
@get
op getAvailability(@query meetingTypeId: string):
  | Availability
  | ValidationErrorResponse
  | MeetingTypeNotFoundResponse;

/** Бронь: занятый интервал с данными гостя (спецификация §8, docs/spec/calendar.md). */
model Booking {
  /** Id брони; генерирует сервер, гость и владелец его не задают. */
  id: string;

  /** Id типа встречи, длительность которого задаёт размер интервала. */
  meetingTypeId: string;

  /** Название типа встречи на момент брони. */
  meetingTypeTitle: string;

  /** UTC-инстант старта в ISO 8601 с Z. */
  start: utcDateTime;

  /** UTC-инстант окончания: start плюс длительность типа встречи. */
  end: utcDateTime;

  /** Имя гостя: 1–100 символов после trim. */
  guestName: string;

  /** Email гостя: без пробелов, с символом «@» и точкой в домене. */
  guestEmail: string;

  /** Момент создания брони в ISO 8601 с Z. */
  createdAt: utcDateTime;
}

/**
 * Данные бронирования (спецификация §8): end не принимается — длительность
 * берётся из типа встречи, поэтому клиент не может подделать интервал.
 */
model CreateBookingRequest {
  /** Идентификатор существующего типа встречи, например intro. */
  meetingTypeId: string;

  /** UTC-инстант старта в ISO 8601 с Z: старт из сетки внутри окна записи. */
  start: utcDateTime;

  /** Имя гостя: 1–100 символов после trim. */
  @minLength(1)
  @maxLength(100)
  name: string;

  /** Email гостя: до 254 символов, содержит «@» и точку в домене, без пробелов. */
  @maxLength(254)
  @pattern("^[^@\\s]+@[^@\\s]+\\.[^\\s@]+$")
  email: string;
}

/** Успешное бронирование: 201 с созданной бронью (спецификация §8). */
model CreatedBookingResponse {
  @statusCode _: 201;
  ...Booking;
}

/** Старт уже наступил или за пределами 14 дней: 400 (спецификация §8). */
model SlotOutOfWindowResponse {
  @statusCode _: 400;
  code: "slot_out_of_window";

  /** Человекочитаемое сообщение; тестами не проверяется (спецификация §8). */
  message: string;
}

/** Старт не на сетке или встреча не успевает до 18:00: 400 (спецификация §8). */
model SlotOutOfGridResponse {
  @statusCode _: 400;
  code: "slot_out_of_grid";

  /** Человекочитаемое сообщение; тестами не проверяется (спецификация §8). */
  message: string;
}

/** Слот пересекается с существующей бронью: 409 (спецификация §5, §8). */
model SlotTakenResponse {
  @statusCode _: 409;
  code: "slot_taken";

  /** Объясняет, что время только что заняли, и предлагает выбрать другой слот. */
  message: string;
}

/**
 * Бронирование свободного слота гостем (спецификация §8). Проверки идут
 * в фиксированном порядке: форма и поля → тип встречи → окно записи →
 * сетка → пересечения внутри мьютекса по дате.
 */
@route("/api/bookings")
@post
op createBooking(@body body: CreateBookingRequest):
  | CreatedBookingResponse
  | ValidationErrorResponse
  | MeetingTypeNotFoundResponse
  | SlotOutOfWindowResponse
  | SlotOutOfGridResponse
  | SlotTakenResponse;

/** Ошибка валидации: неверная форма запроса или поля (спецификация §10). */
model ValidationErrorResponse {
  @statusCode _: 400;
  code: "validation_error";

  /** Человекочитаемое описание того, что не так с запросом. */
  message: string;
}

/** Тип встречи с таким id не существует: 404 (спецификация §10). */
model MeetingTypeNotFoundResponse {
  @statusCode _: 404;
  code: "meeting_type_not_found";

  /** Человекочитаемое сообщение; тестами не проверяется (спецификация §8). */
  message: string;
}

/** Конфликт: тип встречи с таким id уже создан (спецификация §10). */
model MeetingTypeExistsResponse {
  @statusCode _: 409;
  code: "meeting_type_exists";

  /** Человекочитаемое описание конфликта. */
  message: string;
}
