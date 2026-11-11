import "@typespec/http";

using TypeSpec.Http;

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

/** 400: неверная форма запроса или поля (спецификация §10). */
@error
model ValidationError {
  @statusCode statusCode: 400;

  /** Машинночитаемый код ошибки. */
  code: "validation_error";

  /** Сообщение для человека; тестами не проверяется (спецификация §8). */
  message: string;
}

/** 404: тип встречи с таким id не существует (спецификация §10). */
@error
model MeetingTypeNotFoundError {
  @statusCode statusCode: 404;

  /** Машинночитаемый код ошибки. */
  code: "meeting_type_not_found";

  /** Сообщение для человека; тестами не проверяется (спецификация §8). */
  message: string;
}

/**
 * Сетка на окно записи одним ответом: 14 дней с сегодняшнего по Москве,
 * чтобы фронтенд не делал 14 запросов (спецификация §7).
 */
@route("/api/availability")
@get
op getAvailability(@query meetingTypeId: string):
  | Availability
  | ValidationError
  | MeetingTypeNotFoundError;
