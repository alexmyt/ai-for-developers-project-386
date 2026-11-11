import { Injectable, NotFoundException } from '@nestjs/common'
import { MeetingTypesService } from '../meeting-types/meeting-types.service'
import { BookingsService } from '../bookings/bookings.service'
import { Clock } from '../clock/clock'
import { buildAvailability } from './availability.domain'
import type { Availability } from './availability'

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly clock: Clock,
    private readonly meetingTypesService: MeetingTypesService,
    private readonly bookingsService: BookingsService,
  ) {}

  /** Доступность типа встречи на всё окно записи (спецификация §7). */
  get(meetingTypeId: string): Availability {
    const meetingType = this.meetingTypesService.get(meetingTypeId)
    if (!meetingType) {
      throw new NotFoundException({
        code: 'meeting_type_not_found',
        message: `Тип встречи «${meetingTypeId}» не найден`,
      })
    }
    return buildAvailability({
      now: this.clock.now(),
      meetingTypeId: meetingType.id,
      durationMinutes: meetingType.durationMinutes,
      bookings: this.bookingsService.list(),
    })
  }
}
