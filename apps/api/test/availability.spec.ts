import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configureApp } from '../src/app.config'
import { AppModule } from '../src/app.module'
import { expectValidResponse } from './openapi-assertions'

// «Сегодня» и настенное время по Москве считаются в тесте независимо
// от реализации — через Intl (спецификация §2, §3).
const moscowDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const moscowParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Moscow',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function todayMoscow(): string {
  return moscowDate.format(new Date())
}

/** Настенное время по Москве для ISO-строки: «ЧЧ:ММ:СС». */
function moscowTimeOf(iso: string): string {
  const parts = moscowParts.formatToParts(new Date(iso))
  const values = new Map<string, string>()
  for (const part of parts) {
    if (part.type !== 'literal') {
      values.set(part.type, part.value)
    }
  }
  return `${values.get('hour')}:${values.get('minute')}:${values.get('second')}`
}

/** Ожидаемое окно: сегодня + 13 следующих дней по Москве. */
function expectedWindowDates(): string[] {
  const [year, month, day] = todayMoscow().split('-').map(Number)
  return Array.from({ length: 14 }, (_, offset) =>
    new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10),
  )
}

interface AvailabilityResponse {
  meetingTypeId: string
  days: { date: string; slots: { start: string; end: string; status: string }[] }[]
}

describe('GET /api/availability', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('отвечает 200 и ровно 14 днями, начиная с сегодняшнего по Москве', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/availability?meetingTypeId=intro')
      .expect(200)

    expect(response.body.meetingTypeId).toBe('intro')
    expect(response.body.days.map((day: { date: string }) => day.date)).toEqual(
      expectedWindowDates(),
    )
  })

  it('ответ соответствует схеме из openapi.json', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/availability?meetingTypeId=intro')
      .expect(200)

    expect(() => expectValidResponse('get', '/api/availability', 200, response.body)).not.toThrow()
  })

  it('слоты сид-типа выровнены по сетке 09:00–18:00 с шагом 30 минут', async () => {
    // Сид-тип «Знакомство» длится 30 минут (спецификация §2).
    const response = await request(app.getHttpServer())
      .get('/api/availability?meetingTypeId=intro')
      .expect(200)
    const body = response.body as AvailabilityResponse

    const starts: string[] = []
    for (const day of body.days) {
      for (const slot of day.slots) {
        const start = moscowTimeOf(slot.start)
        const end = moscowTimeOf(slot.end)
        // Рабочие часы: старт не раньше 09:00, конец не позже 18:00 (§4).
        expect(start >= '09:00:00' && start < '18:00:00').toBe(true)
        expect(end <= '18:00:00').toBe(true)
        // Сетка: минуты кратны 30, секунды нулевые.
        expect(Number(start.slice(3, 5)) % 30).toBe(0)
        expect(start.endsWith(':00:00') || start.endsWith(':30:00')).toBe(true)
        // Длительность слота — из типа встречи.
        expect(new Date(slot.end).getTime() - new Date(slot.start).getTime()).toBe(30 * 60_000)
        // Прошедшие старты не возвращаются (§4).
        expect(new Date(slot.start).getTime()).toBeGreaterThan(Date.now())
        starts.push(slot.start)
      }
    }

    // Все старты уникальны, а их шаг — ровно 30 минут.
    expect(new Set(starts).size).toBe(starts.length)
  })

  it('неизвестный тип отвечает 404 meeting_type_not_found', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/availability?meetingTypeId=no-such-type')
      .expect(404)

    expect(() => expectValidResponse('get', '/api/availability', 404, response.body)).not.toThrow()
    expect(response.body.code).toBe('meeting_type_not_found')
    expect(typeof response.body.message).toBe('string')
  })

  it('без параметра meetingTypeId отвечает 400 validation_error', async () => {
    const response = await request(app.getHttpServer()).get('/api/availability').expect(400)

    expect(() => expectValidResponse('get', '/api/availability', 400, response.body)).not.toThrow()
    expect(response.body.code).toBe('validation_error')
  })
})
