import { Module } from '@nestjs/common'
import { BookingsModule } from '../bookings/bookings.module'
import { MeetingTypesModule } from '../meeting-types/meeting-types.module'
import { AvailabilityController } from './availability.controller'
import { AvailabilityService } from './availability.service'

@Module({
  imports: [BookingsModule, MeetingTypesModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
