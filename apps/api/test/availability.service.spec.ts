import type { INestApplication } from '@nestjs/common'
import { NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configureApp } from '../src/app.config'
import { AppModule } from '../src/app.module'
import { AvailabilityService } from '../src/availability/availability.service'
import { BookingsService } from '../src/bookings/bookings.service'
import { Clock } from '../src/clock/clock'

// 12:15 по Москве 11 ноября: «сегодня» фиксировано подменой Clock (ADR-0003),
// поэтому тесты не зависят от даты запуска.
const FIXED_NOW = new Date('2026-11-11T09:15:00Z')

describe('AvailabilityService с подменённым Clock', () => {
  let app: INestApplication
  let availabilityService: AvailabilityService
  let bookingsService: BookingsService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({ now: () => FIXED_NOW })
      .compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
    availabilityService = app.get(AvailabilityService)
    bookingsService = app.get(BookingsService)
  })

  afterAll(async () => {
    await app.close()
  })

  it('считает окно от «сегодня» по Москве, а не от даты запуска', () => {
    const result = availabilityService.get('intro')

    expect(result.days).toHaveLength(14)
    expect(result.days[0].date).toBe('2026-11-11')
    expect(result.days[13].date).toBe('2026-11-24')
  })

  it('бронь из хранилища делает пересекающиеся слоты занятыми', () => {
    // Бронь 10:00–11:00 по Москве 12 ноября: заняты слоты 10:00 и 10:30.
    bookingsService.add({
      id: 'b-1',
      meetingTypeId: 'intro',
      start: new Date('2026-11-12T07:00:00Z'),
      end: new Date('2026-11-12T08:00:00Z'),
    })

    const result = availabilityService.get('intro')
    const day = result.days.find((d) => d.date === '2026-11-12')
    const takenStarts = day.slots.filter((s) => s.status === 'taken').map((s) => s.start)

    expect(takenStarts).toEqual(['2026-11-12T07:00:00Z', '2026-11-12T07:30:00Z'])
  })

  it('бросает NotFoundException с конвертом ошибки для неизвестного типа', () => {
    let thrown: unknown
    try {
      availabilityService.get('no-such-type')
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(NotFoundException)
    expect((thrown as NotFoundException).getResponse()).toMatchObject({
      code: 'meeting_type_not_found',
    })
  })
})
