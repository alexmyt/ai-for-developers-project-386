import { Module } from '@nestjs/common'
import { MeetingTypesModule } from '../meeting-types/meeting-types.module'
import { BookingsController } from './bookings.controller'
import { BookingsService } from './bookings.service'

@Module({
  imports: [MeetingTypesModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
