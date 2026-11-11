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
