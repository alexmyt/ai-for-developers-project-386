import { Module } from '@nestjs/common'
import { AvailabilityModule } from './availability/availability.module'
import { BookingsModule } from './bookings/bookings.module'
import { ClockModule } from './clock/clock.module'
import { HealthController } from './health/health.controller'
import { MeetingTypesModule } from './meeting-types/meeting-types.module'

@Module({
  imports: [ClockModule, MeetingTypesModule, AvailabilityModule, BookingsModule],
  controllers: [HealthController],
})
export class AppModule {}
