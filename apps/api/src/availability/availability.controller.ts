import { BadRequestException, Controller, Get, Query } from '@nestjs/common'
import { AvailabilityService } from './availability.service'
import type { Availability } from './availability'

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  /** Сетка на окно записи одним ответом (спецификация §7). */
  @Get()
  getAvailability(@Query('meetingTypeId') meetingTypeId: string | undefined): Availability {
    if (!meetingTypeId) {
      // Отсутствующий параметр — ошибка формы запроса (спецификация §7).
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Укажите параметр запроса meetingTypeId',
      })
    }
    return this.availabilityService.get(meetingTypeId)
  }
}
