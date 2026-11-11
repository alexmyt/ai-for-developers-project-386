import { Injectable } from '@nestjs/common'
import type { Booking } from './booking'

// Хранилище броней в памяти процесса (ADR-0003). Эндпоинта бронирования
// пока нет: брони добавляют тесты, доступность читает их для расчёта
// статусов слотов.
@Injectable()
export class BookingsService {
  private readonly items: Booking[] = []

  /** Все брони: пересечения считаются по всем типам встреч сразу (§5). */
  list(): Booking[] {
    return this.items
  }

  /** Добавить бронь; HTTP-эндпоинт и мьютекс появятся вместе с бронированием. */
  add(booking: Booking): void {
    this.items.push(booking)
  }
}
