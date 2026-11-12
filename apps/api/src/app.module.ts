import { Module } from '@nestjs/common'
import { AvailabilityModule } from './availability/availability.module'
import { BookingsModule } from './bookings/bookings.module'
import { ClockModule } from './clock/clock.module'
import { HealthController } from './health/health.controller'
import { MeetingTypesModule } from './meeting-types/meeting-types.module'
import { createWebStaticModule } from './web-static'

// Статика SPA подключается последней: wildcard-фолбэк на index.html не должен
// перехватывать роуты /api (ADR-0002).
const webStaticModule = createWebStaticModule()

@Module({
  imports: [
    ClockModule,
    MeetingTypesModule,
    AvailabilityModule,
    BookingsModule,
    ...(webStaticModule ? [webStaticModule] : []),
  ],
  controllers: [HealthController],
})
export class AppModule {}
