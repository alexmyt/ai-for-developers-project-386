import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { configureApp } from '../src/app.config'
import { AppModule } from '../src/app.module'
import { Clock } from '../src/clock/clock'
import { expectValidResponse } from './openapi-assertions'

// 12:15 по Москве 11 ноября: «сейчас» фиксировано подменой Clock (ADR-0003),
// поэтому границы окна записи — статичные строки, а не расчёт от даты запуска.
const FIXED_NOW = new Date('2026-11-11T09:15:00Z')

// Пример из спецификации §3: 2026-11-12T07:00:00Z — это 12 ноября, 10:00
// по Москве. Москва круглый год UTC+3, поэтому UTC-старты в тестах статичны.
// Формат ответа — ISO 8601 с Z без миллисекунд, как в примерах §8.
const NOV12_AT = (moscowHour: number, moscowMinute = 0): string =>
  new Date(Date.UTC(2026, 10, 12, moscowHour - 3, moscowMinute)).toISOString().replace('.000Z', 'Z')

/** Данные брони по умолчанию: свободный слот 10:00–10:30 по Москве 12 ноября. */
function bookingBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    meetingTypeId: 'intro',
    start: NOV12_AT(10),
    name: 'Анна',
    email: 'anna@example.com',
    ...overrides,
  }
}

/**
 * Приложение с подвижным «сейчас»: тест двигает время между бронированием
 * и чтением списка, чтобы проверить фильтрацию прошедших броней (§9).
 */
async function createAppWithMovableClock(
  now: Date,
): Promise<{ app: INestApplication; moveClockTo(next: Date): void }> {
  const state = { now }
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock)
    .useValue({ now: () => new Date(state.now) })
    .compile()
  const app = moduleRef.createNestApplication()
  configureApp(app)
  await app.init()
  return { app, moveClockTo: (next) => (state.now = next) }
}

async function createAppWithFixedClock(): Promise<INestApplication> {
  const { app } = await createAppWithMovableClock(FIXED_NOW)
  return app
}

describe('POST /api/bookings', () => {
  let app: INestApplication

  // Каждый тест создаёт своё приложение: брони меняют состояние в памяти,
  // и тесты не должны зависеть от порядка выполнения.
  beforeEach(async () => {
    app = await createAppWithFixedClock()
  })

  afterAll(async () => {
    await app.close()
  })

  it('отвечает 201 и созданной бронью с серверными id, end и createdAt', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody())
      .expect(201)

    const body = response.body as Record<string, unknown>
    // end вычисляет сервер из длительности типа: 10:00 + 30 минут (§8).
    expect(body).toEqual({
      id: expect.any(String),
      meetingTypeId: 'intro',
      meetingTypeTitle: 'Знакомство',
      start: NOV12_AT(10),
      end: NOV12_AT(10, 30),
      guestName: 'Анна',
      guestEmail: 'anna@example.com',
      // Формат момента из примера §8 — без миллисекунд.
      createdAt: '2026-11-11T09:15:00Z',
    })
    // id брони генерирует сервер (crypto.randomUUID, §8).
    expect(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id as string),
    ).toBe(true)
  })

  it('ответ соответствует схеме из openapi.json', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody())
      .expect(201)

    expect(() => expectValidResponse('post', '/api/bookings', 201, response.body)).not.toThrow()
  })

  it('end вычисляется из длительности типа встречи, а не из запроса', async () => {
    // Владелец создаёт 60-минутный тип (§6.1) и гость бронирует его слот.
    await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({ id: 'review', title: 'Обзор проекта', durationMinutes: 60 })
      .expect(201)

    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ meetingTypeId: 'review', start: NOV12_AT(10) }))
      .expect(201)

    // 10:00 + 60 минут: end — 11:00 по Москве (пример §5).
    expect((response.body as Record<string, unknown>).end).toBe(NOV12_AT(11))
  })

  it('забронированный слот сразу занят в доступности', async () => {
    await request(app.getHttpServer()).post('/api/bookings').send(bookingBody()).expect(201)

    const response = await request(app.getHttpServer())
      .get('/api/availability?meetingTypeId=intro')
      .expect(200)
    const day = (
      response.body as { days: { date: string; slots: { start: string; status: string }[] }[] }
    ).days.find((d) => d.date === '2026-11-12')
    const slot = day?.slots.find((s) => s.start === NOV12_AT(10))

    expect(slot?.status).toBe('taken')
  })

  it('касание границами разрешено: соседние слоты бронируются оба', async () => {
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: NOV12_AT(10) }))
      .expect(201)

    // 10:30–11:00 начинается ровно в момент окончания предыдущей брони (§5).
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: NOV12_AT(10, 30) }))
      .expect(201)

    expect(() => expectValidResponse('post', '/api/bookings', 201, response.body)).not.toThrow()
  })

  it('частичное наложение разных типов запрещено: 10:30–11:00 против брони 10:00–11:00', async () => {
    // Пример из требований (§5): 60-минутная бронь 10:00–11:00.
    await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({ id: 'review', title: 'Обзор проекта', durationMinutes: 60 })
      .expect(201)
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ meetingTypeId: 'review' }))
      .expect(201)

    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: NOV12_AT(10, 30) }))
      .expect(409)

    expect(response.body).toMatchObject({ code: 'slot_taken' })
    expect(() => expectValidResponse('post', '/api/bookings', 409, response.body)).not.toThrow()
  })

  it('запись сразу после окончания 60-минутной брони допустима: 11:00–11:30', async () => {
    await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({ id: 'review', title: 'Обзор проекта', durationMinutes: 60 })
      .expect(201)
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ meetingTypeId: 'review' }))
      .expect(201)

    await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: NOV12_AT(11) }))
      .expect(201)
  })

  it.each([
    {
      name: 'нет поля meetingTypeId',
      body: { start: NOV12_AT(10), name: 'Анна', email: 'anna@example.com' },
    },
    {
      name: 'meetingTypeId не строка',
      body: { meetingTypeId: 42, start: NOV12_AT(10), name: 'Анна', email: 'anna@example.com' },
    },
    {
      name: 'нет поля start',
      body: { meetingTypeId: 'intro', name: 'Анна', email: 'anna@example.com' },
    },
    {
      name: 'start не строка',
      body: { meetingTypeId: 'intro', start: 42, name: 'Анна', email: 'anna@example.com' },
    },
    {
      name: 'start не ISO-инстант',
      body: {
        meetingTypeId: 'intro',
        start: '2026-11-12 10:00:00',
        name: 'Анна',
        email: 'anna@example.com',
      },
    },
    {
      name: 'start без Z',
      body: {
        meetingTypeId: 'intro',
        start: '2026-11-12T07:00:00',
        name: 'Анна',
        email: 'anna@example.com',
      },
    },
    {
      name: 'start — не существующая дата',
      body: {
        meetingTypeId: 'intro',
        start: '2026-11-31T07:00:00Z',
        name: 'Анна',
        email: 'anna@example.com',
      },
    },
    {
      name: 'нет поля name',
      body: { meetingTypeId: 'intro', start: NOV12_AT(10), email: 'anna@example.com' },
    },
    {
      name: 'name пустой после trim',
      body: { meetingTypeId: 'intro', start: NOV12_AT(10), name: '   ', email: 'anna@example.com' },
    },
    {
      name: 'name длиннее 100 символов',
      body: {
        meetingTypeId: 'intro',
        start: NOV12_AT(10),
        name: 'А'.repeat(101),
        email: 'anna@example.com',
      },
    },
    {
      name: 'name не строка',
      body: { meetingTypeId: 'intro', start: NOV12_AT(10), name: 42, email: 'anna@example.com' },
    },
    { name: 'нет поля email', body: { meetingTypeId: 'intro', start: NOV12_AT(10), name: 'Анна' } },
    {
      name: 'email без @',
      body: {
        meetingTypeId: 'intro',
        start: NOV12_AT(10),
        name: 'Анна',
        email: 'anna.example.com',
      },
    },
    {
      name: 'email без точки в домене',
      body: { meetingTypeId: 'intro', start: NOV12_AT(10), name: 'Анна', email: 'anna@examplecom' },
    },
    {
      name: 'email с пробелом',
      body: {
        meetingTypeId: 'intro',
        start: NOV12_AT(10),
        name: 'Анна',
        email: 'anna example@example.com',
      },
    },
    {
      name: 'email длиннее 254 символов',
      body: {
        meetingTypeId: 'intro',
        start: NOV12_AT(10),
        name: 'Анна',
        email: `${'a'.repeat(250)}@example.com`,
      },
    },
  ])('отвечает 400 validation_error, когда $name', async ({ body }) => {
    const response = await request(app.getHttpServer()).post('/api/bookings').send(body).expect(400)

    // Конверт ошибки — { code, message } (спецификация §10).
    expect(response.body).toMatchObject({ code: 'validation_error' })
    expect(typeof response.body.message).toBe('string')
    expect(response.body.message.length).toBeGreaterThan(0)
    expect(() => expectValidResponse('post', '/api/bookings', 400, response.body)).not.toThrow()
  })

  it('отвечает 400 validation_error, когда тела запроса нет', async () => {
    const response = await request(app.getHttpServer()).post('/api/bookings').expect(400)

    expect(response.body).toMatchObject({ code: 'validation_error' })
    expect(() => expectValidResponse('post', '/api/bookings', 400, response.body)).not.toThrow()
  })

  it('отвечает 404 meeting_type_not_found для неизвестного типа', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ meetingTypeId: 'no-such-type' }))
      .expect(404)

    expect(response.body).toMatchObject({ code: 'meeting_type_not_found' })
    expect(typeof response.body.message).toBe('string')
    expect(() => expectValidResponse('post', '/api/bookings', 404, response.body)).not.toThrow()
  })

  it('отвечает 400 slot_out_of_window для старта в прошлом', async () => {
    // 12:00 по Москве 11 ноября: раньше фиксированного «сейчас» (12:15).
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: '2026-11-11T09:00:00Z' }))
      .expect(400)

    expect(response.body).toMatchObject({ code: 'slot_out_of_window' })
    expect(() => expectValidResponse('post', '/api/bookings', 400, response.body)).not.toThrow()
  })

  it('отвечает 400 slot_out_of_window для старта за пределами 14 дней', async () => {
    // 10:00 по Москве 26 ноября: окно кончается 24-м.
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: '2026-11-26T07:00:00Z' }))
      .expect(400)

    expect(response.body).toMatchObject({ code: 'slot_out_of_window' })
  })

  it('принимает последний слот 14-го дня: 17:30–18:00 по Москве 24 ноября', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: '2026-11-24T14:30:00Z' }))
      .expect(201)

    expect(() => expectValidResponse('post', '/api/bookings', 201, response.body)).not.toThrow()
  })

  it('отвечает 400 slot_out_of_grid для старта между шагами сетки', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: NOV12_AT(10, 10) }))
      .expect(400)

    expect(response.body).toMatchObject({ code: 'slot_out_of_grid' })
    expect(() => expectValidResponse('post', '/api/bookings', 400, response.body)).not.toThrow()
  })

  it('отвечает 400 slot_out_of_grid для старта раньше 09:00 по Москве', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: NOV12_AT(7) }))
      .expect(400)

    expect(response.body).toMatchObject({ code: 'slot_out_of_grid' })
  })

  it('отвечает 400 slot_out_of_grid, когда 60-минутная встреча не влезает до 18:00', async () => {
    await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({ id: 'review', title: 'Обзор проекта', durationMinutes: 60 })
      .expect(201)

    // Старт 17:30: встреча закончилась бы в 18:30 (§4).
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ meetingTypeId: 'review', start: NOV12_AT(17, 30) }))
      .expect(400)

    expect(response.body).toMatchObject({ code: 'slot_out_of_grid' })
  })

  it('отвечает 409 slot_taken при повторной брони того же слота', async () => {
    await request(app.getHttpServer()).post('/api/bookings').send(bookingBody()).expect(201)

    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody())
      .expect(409)

    // Сообщение объясняет, что время только что заняли, и предлагает другой слот (§8).
    expect(response.body).toMatchObject({ code: 'slot_taken' })
    expect(typeof response.body.message).toBe('string')
    expect(response.body.message.length).toBeGreaterThan(0)
    expect(() => expectValidResponse('post', '/api/bookings', 409, response.body)).not.toThrow()
  })

  // Порядок проверок из спецификации §8 — от него зависят коды ответов.
  describe('порядок проверок', () => {
    it('валидация полей раньше существования типа', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .send(bookingBody({ meetingTypeId: 'no-such-type', start: NOV12_AT(10), name: '   ' }))
        .expect(400)

      expect(response.body).toMatchObject({ code: 'validation_error' })
    })

    it('существование типа раньше окна записи', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .send(bookingBody({ meetingTypeId: 'no-such-type', start: '2026-11-11T09:00:00Z' }))
        .expect(404)

      expect(response.body).toMatchObject({ code: 'meeting_type_not_found' })
    })

    it('окно записи раньше сетки', async () => {
      // 07:10 по Москве 10 ноября: старт в прошлом И не на сетке —
      // побеждает проверка окна.
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .send(bookingBody({ start: '2026-11-10T04:10:00Z' }))
        .expect(400)

      expect(response.body).toMatchObject({ code: 'slot_out_of_window' })
    })

    it('сетка раньше пересечений', async () => {
      await request(app.getHttpServer()).post('/api/bookings').send(bookingBody()).expect(201)

      // 10:10 по Москве: не на сетке и пересекается с бронью 10:00–10:30 —
      // побеждает проверка сетки.
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .send(bookingBody({ start: NOV12_AT(10, 10) }))
        .expect(400)

      expect(response.body).toMatchObject({ code: 'slot_out_of_grid' })
    })
  })

  // Конкуренция из спецификации §13.2: Promise.all по одному слоту —
  // успешен ровно один запрос, остальные получают 409.
  it('при одновременных запросах на один слот успешен ровно один', async () => {
    const requests = Array.from({ length: 5 }, () =>
      request(app.getHttpServer()).post('/api/bookings').send(bookingBody()),
    )
    const responses = await Promise.all(requests)

    const statuses = responses.map((response) => response.status).sort()
    expect(statuses).toEqual([201, 409, 409, 409, 409])
    for (const response of responses) {
      if (response.status === 409) {
        expect(response.body).toMatchObject({ code: 'slot_taken' })
        expect(() => expectValidResponse('post', '/api/bookings', 409, response.body)).not.toThrow()
      }
    }
  })
})

// Список владельца из спецификации §9: предстоящие брони всех типов
// в одном списке, без пагинации.
describe('GET /api/bookings', () => {
  let app: INestApplication
  let moveClockTo: (next: Date) => void

  // Каждый тест создаёт своё приложение: брони меняют состояние в памяти,
  // и тесты не должны зависеть от порядка выполнения.
  beforeEach(async () => {
    const created = await createAppWithMovableClock(FIXED_NOW)
    app = created.app
    moveClockTo = created.moveClockTo
  })

  afterAll(async () => {
    await app.close()
  })

  it('отвечает 200 и пустым списком, когда броней ещё нет', async () => {
    const response = await request(app.getHttpServer()).get('/api/bookings').expect(200)

    expect(response.body).toEqual({ items: [] })
    expect(() => expectValidResponse('get', '/api/bookings', 200, response.body)).not.toThrow()
  })

  it('показывает созданную бронь со всеми полями из спецификации §9', async () => {
    await request(app.getHttpServer()).post('/api/bookings').send(bookingBody()).expect(201)

    const response = await request(app.getHttpServer()).get('/api/bookings').expect(200)

    expect((response.body as { items: unknown[] }).items).toEqual([
      {
        id: expect.any(String),
        meetingTypeId: 'intro',
        meetingTypeTitle: 'Знакомство',
        start: NOV12_AT(10),
        end: NOV12_AT(10, 30),
        guestName: 'Анна',
        guestEmail: 'anna@example.com',
        createdAt: '2026-11-11T09:15:00Z',
      },
    ])
    expect(() => expectValidResponse('get', '/api/bookings', 200, response.body)).not.toThrow()
  })

  it('скрывает бронь, когда её старт уже прошёл', async () => {
    await request(app.getHttpServer()).post('/api/bookings').send(bookingBody()).expect(201)

    // 12:00 по Москве 12 ноября: старт брони (10:00) позади (§9).
    moveClockTo(new Date('2026-11-12T09:00:00Z'))

    const response = await request(app.getHttpServer()).get('/api/bookings').expect(200)

    expect((response.body as { items: unknown[] }).items).toEqual([])
  })

  it('оставляет бронь, старт которой совпадает с текущим моментом', async () => {
    await request(app.getHttpServer()).post('/api/bookings').send(bookingBody()).expect(201)

    // «Не раньше текущего момента» (§9): старт равен «сейчас» — бронь ещё видна.
    moveClockTo(new Date(NOV12_AT(10)))

    const response = await request(app.getHttpServer()).get('/api/bookings').expect(200)

    expect((response.body as { items: unknown[] }).items).toHaveLength(1)
  })

  it('сортирует брони по start по возрастанию и показывает все типы вместе', async () => {
    // Второй тип встречи: брони разных типов попадают в один список (§9).
    await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({ id: 'review', title: 'Обзор проекта', durationMinutes: 60 })
      .expect(201)

    // Создаём в порядке: 12-е 11:00, 13-е 09:00, 12-е 10:00 — сортировка на сервере.
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send(bookingBody({ start: NOV12_AT(11), name: 'Борис', email: 'boris@example.com' }))
      .expect(201)
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send({
        meetingTypeId: 'review',
        start: new Date(Date.UTC(2026, 10, 13, 6)).toISOString().replace('.000Z', 'Z'),
        name: 'Вера',
        email: 'vera@example.com',
      })
      .expect(201)
    await request(app.getHttpServer()).post('/api/bookings').send(bookingBody()).expect(201)

    const response = await request(app.getHttpServer()).get('/api/bookings').expect(200)

    const items = (response.body as { items: { start: string; guestName: string }[] }).items
    expect(items.map((item) => [item.start, item.guestName])).toEqual([
      [NOV12_AT(10), 'Анна'],
      [NOV12_AT(11), 'Борис'],
      [new Date(Date.UTC(2026, 10, 13, 6)).toISOString().replace('.000Z', 'Z'), 'Вера'],
    ])
    expect(() => expectValidResponse('get', '/api/bookings', 200, response.body)).not.toThrow()
  })
})
