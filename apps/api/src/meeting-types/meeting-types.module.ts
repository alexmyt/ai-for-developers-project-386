import { Module } from '@nestjs/common'
import { MeetingTypesController } from './meeting-types.controller'
import { MeetingTypesService } from './meeting-types.service'

@Module({
  controllers: [MeetingTypesController],
  providers: [MeetingTypesService],
})
export class MeetingTypesModule {}
