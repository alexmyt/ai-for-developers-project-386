import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configureApp } from '../src/app.config'
import { WEB_STATIC_ROOT_ENV } from '../src/web-static'

// ADR-0002: один процесс Nest отдаёт и API под /api, и собранную статику SPA.
// Корень статики задаётся переменной WEB_STATIC_ROOT: так тестируется отдача
// на любом пути, а в Docker-образе рядом с main.js лежит dist/web.
describe('отдача SPA-статики рядом с API', () => {
  let app: INestApplication
  let staticRoot: string

  beforeAll(async () => {
    staticRoot = mkdtempSync(join(tmpdir(), 'call-calendar-web-'))
    writeFileSync(
      join(staticRoot, 'index.html'),
      '<!doctype html><html lang="ru"><head><title>Календарь звонков</title></head><body>SPA</body></html>',
    )
    mkdirSync(join(staticRoot, 'assets'))
    writeFileSync(join(staticRoot, 'assets', 'app.js'), 'console.log("календарь")')

    // AppModule читает корень статики при создании модуля, поэтому импортируем
    // его уже после установки переменной. Приложение создаём через
    // NestFactory.create — тот же путь, что в main.ts: тестовый
    // createNestApplication выбирает загрузчик статики до появления
    // HTTP-адаптера и молча её отключает.
    process.env[WEB_STATIC_ROOT_ENV] = staticRoot
    const { AppModule } = await import('../src/app.module.js')
    app = await NestFactory.create(AppModule, { logger: false })
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    delete process.env[WEB_STATIC_ROOT_ENV]
    rmSync(staticRoot, { recursive: true, force: true })
  })

  it('клиентский маршрут /book получает index.html (SPA-переписывание)', async () => {
    const response = await request(app.getHttpServer()).get('/book?type=intro').expect(200)

    expect(response.headers['content-type']).toContain('text/html')
    expect(response.text).toContain('Календарь звонков')
  })

  it('вложенный клиентский маршрут /admin/bookings тоже получает index.html', async () => {
    const response = await request(app.getHttpServer()).get('/admin/bookings').expect(200)

    expect(response.headers['content-type']).toContain('text/html')
    expect(response.text).toContain('SPA')
  })

  it('файл статики отдаётся как есть', async () => {
    const response = await request(app.getHttpServer()).get('/assets/app.js').expect(200)

    expect(response.text).toBe('console.log("календарь")')
  })

  it('GET /api/health отвечает JSON, а не статикой', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200)

    expect(response.body).toEqual({ status: 'ok' })
  })

  it('неизвестный путь под /api не получает index.html', async () => {
    const response = await request(app.getHttpServer()).get('/api/unknown').expect(404)

    expect(response.text).not.toContain('SPA')
  })
})
