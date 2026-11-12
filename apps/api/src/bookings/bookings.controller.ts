import { Body, Controller, Get, Post } from '@nestjs/common'
import type { BookingJson } from './booking-json'
import { BookingsService } from './bookings.service'

// Список владельца из спецификации §9: брони всех типов одним массивом.
interface BookingsListJson {
  items: BookingJson[]
}

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * Предстоящие брони владельца (§9): фильтр по старту и сортировка —
   * на сервере, чтобы все клиенты видели одинаковый список.
   */
  @Get()
  listUpcoming(): BookingsListJson {
    return { items: this.bookingsService.listUpcoming() }
  }

  /** Создание брони гостем: проверки в фиксированном порядке (§8). */
  @Post()
  create(@Body() body: unknown): Promise<BookingJson> {
    return this.bookingsService.create(body)
  }
}
