import { Module } from '@nestjs/common'
import { HealthController } from './health/health.controller'
import { MeetingTypesModule } from './meeting-types/meeting-types.module'

@Module({
  imports: [MeetingTypesModule],
  controllers: [HealthController],
})
export class AppModule {}
