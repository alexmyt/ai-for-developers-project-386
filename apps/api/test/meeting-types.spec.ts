import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configureApp } from '../src/app.config'
import { AppModule } from '../src/app.module'
import { expectValidResponse } from './openapi-assertions'

describe('GET /api/meeting-types', () => {
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

  it('отвечает 200 и списком с сид-типом «Знакомство», 30 минут', async () => {
    const response = await request(app.getHttpServer()).get('/api/meeting-types').expect(200)

    // Ожидаемые значения — из спецификации §6.2 (docs/spec/calendar.md).
    expect(response.body).toEqual({
      items: [
        {
          id: 'intro',
          title: 'Знакомство',
          description: null,
          durationMinutes: 30,
        },
      ],
    })
  })

  it('ответ соответствует схеме из openapi.json', async () => {
    const response = await request(app.getHttpServer()).get('/api/meeting-types').expect(200)

    expect(() => expectValidResponse('get', '/api/meeting-types', 200, response.body)).not.toThrow()
  })

  it('ответ валиден и для пустого списка типов', async () => {
    // Пустой список — тоже корректный ответ (спецификация §6.2).
    expect(() => expectValidResponse('get', '/api/meeting-types', 200, { items: [] })).not.toThrow()
  })
})
