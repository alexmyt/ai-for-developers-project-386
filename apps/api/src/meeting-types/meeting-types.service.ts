import { Injectable } from '@nestjs/common'
import {
  SEED_MEETING_TYPE_DURATION_MINUTES,
  SEED_MEETING_TYPE_ID,
  SEED_MEETING_TYPE_TITLE,
} from '../config/calendar'
import type { MeetingType } from './meeting-type'

// Хранилище в памяти процесса (ADR-0003): Map сохраняет порядок создания,
// поэтому сид-тип, вставленный при старте, идёт в списке первым.
@Injectable()
export class MeetingTypesService {
  private readonly items = new Map<string, MeetingType>()

  constructor() {
    // Сид-тип «Знакомство» создаётся тем же способом, что и типы владельца,
    // и виден в общем списке (спецификация §6).
    this.items.set(SEED_MEETING_TYPE_ID, {
      id: SEED_MEETING_TYPE_ID,
      title: SEED_MEETING_TYPE_TITLE,
      description: null,
      durationMinutes: SEED_MEETING_TYPE_DURATION_MINUTES,
    })
  }

  /** Все типы встреч в порядке создания: сначала созданные раньше. */
  list(): MeetingType[] {
    return [...this.items.values()]
  }
}
