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
