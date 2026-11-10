import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configureApp } from '../src/app.config'
import { AppModule } from '../src/app.module'

describe('GET /api/health', () => {
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

  it('отвечает 200 и статусом ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200)

    expect(response.body).toEqual({ status: 'ok' })
  })
})
