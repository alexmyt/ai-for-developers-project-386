import { Injectable } from '@nestjs/common'

/**
 * Единственный доступ к текущему времени (ADR-0003): прямой вызов
 * Date.now() в сервисах запрещён — тесты подменяют Clock фиксированным
 * моментом и не зависят от даты запуска.
 */
@Injectable()
export class Clock {
  /** Текущий момент как UTC-инстант. */
  now(): Date {
    return new Date()
  }
}
