import { Controller, Get } from '@nestjs/common'
import { MeetingTypesService } from './meeting-types.service'
import type { MeetingType } from './meeting-type'

@Controller('meeting-types')
export class MeetingTypesController {
  constructor(private readonly meetingTypesService: MeetingTypesService) {}

  /** Список типов встреч: общий для гостевой страницы и админки (§6.2). */
  @Get()
  list(): { items: MeetingType[] } {
    return { items: this.meetingTypesService.list() }
  }
}
