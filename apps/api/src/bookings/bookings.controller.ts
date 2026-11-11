import { Body, Controller, Post } from '@nestjs/common'
import type { BookingJson } from './booking-json'
import { BookingsService } from './bookings.service'

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /** Создание брони гостем: проверки в фиксированном порядке (§8). */
  @Post()
  create(@Body() body: unknown): Promise<BookingJson> {
    return this.bookingsService.create(body)
  }
}
