import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import Ajv, { type ValidateFunction } from 'ajv'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { configureApp } from '../src/app.config'
import { AppModule } from '../src/app.module'
import type { MeetingType } from '../src/meeting-types/meeting-type'
import openapiJson from '../../../packages/contract/openapi.json'

// Схемы ответов берём из openapi.json — источника истины контракта (ADR-0002).
const openapi = openapiJson as unknown as OpenapiDocument

type Schema = Record<string, unknown>

interface OpenapiDocument {
  paths: Record<
    string,
    Record<string, { responses: Record<string, { content: Record<string, { schema: Schema }> }> }>
  >
  components: { schemas?: Record<string, Schema> }
}

// OpenAPI расширяет JSON Schema словом nullable, ajv его не понимает:
// переводим «type + nullable» в массив типов перед компиляцией.
function toJsonSchema(schema: Schema): Schema {
  const { nullable, ...rest } = schema
  if (nullable === true && typeof rest.type === 'string') {
    rest.type = [rest.type, 'null']
  }
  if (rest.items !== undefined) {
    rest.items = toJsonSchema(rest.items as Schema)
  }
  if (rest.properties !== undefined) {
    rest.properties = Object.fromEntries(
      Object.entries(rest.properties as Record<string, Schema>).map(([name, child]) => [
        name,
        toJsonSchema(child),
      ]),
    )
  }
  for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
    if (Array.isArray(rest[key])) {
      rest[key] = (rest[key] as Schema[]).map(toJsonSchema)
    }
  }
  return rest
}

const validators = new Map<string, ValidateFunction>()

// Валидатор для одного ответа компилируем из открытой спецификации:
// $ref'ы указывают на #/components/schemas, поэтому компоненты кладём в корень.
function responseValidator(method: 'get' | 'post', path: string, status: number): ValidateFunction {
  const key = `${method} ${path} ${status}`
  const cached = validators.get(key)
  if (cached) {
    return cached
  }
  const schema =
    openapi.paths[path]?.[method]?.responses[String(status)]?.content['application/json']?.schema
  if (!schema) {
    throw new Error(`В openapi.json нет схемы для ${method.toUpperCase()} ${path} → ${status}`)
  }
  const componentSchemas = openapi.components.schemas ?? {}
  const ajv = new Ajv({ strict: false, validateFormats: false })
  const validator = ajv.compile({
    ...toJsonSchema(schema),
    components: {
      schemas: Object.fromEntries(
        Object.entries(componentSchemas).map(([name, component]) => [
          name,
          toJsonSchema(component),
        ]),
      ),
    },
  })
  validators.set(key, validator)
  return validator
}

/** Валидирует тело ответа по схеме openapi.json; кидает ошибку со списком нарушений. */
function expectValidResponse(
  method: 'get' | 'post',
  path: string,
  status: number,
  body: unknown,
): void {
  const validator = responseValidator(method, path, status)
  if (!validator(body)) {
    throw new Error(`Ответ не соответствует openapi.json: ${JSON.stringify(validator.errors)}`)
  }
}

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

describe('POST /api/meeting-types', () => {
  let app: INestApplication

  // Каждый тест создаёт своё приложение: тесты меняют состояние и не зависят
  // от порядка выполнения.
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('отвечает 201 и созданным типом', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({
        id: 'review',
        title: 'Обзор проекта',
        description: 'Разбираем вашу задачу и план на встречу',
        durationMinutes: 60,
      })
      .expect(201)

    // Ожидаемые значения — из примера создания типа (спецификация §6.1).
    expect(response.body).toEqual({
      id: 'review',
      title: 'Обзор проекта',
      description: 'Разбираем вашу задачу и план на встречу',
      durationMinutes: 60,
    })
    expect(() =>
      expectValidResponse('post', '/api/meeting-types', 201, response.body),
    ).not.toThrow()
  })

  it('созданный тип сразу виден в общем списке после сид-типа', async () => {
    await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({ id: 'consult', title: 'Консультация', durationMinutes: 30 })
      .expect(201)

    const response = await request(app.getHttpServer()).get('/api/meeting-types').expect(200)

    // Порядок — по времени создания, сид-тип первый (спецификация §6.2).
    expect(response.body.items.map((type: MeetingType) => type.id)).toEqual(['intro', 'consult'])
  })

  it('нормализует поля: обрезает пробелы, пустое описание превращает в null', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({
        id: 'review',
        title: '  Обзор проекта  ',
        description: '   ',
        durationMinutes: 30,
      })
      .expect(201)

    // Описание после trim пустое — в ответе null (спецификация §6).
    expect(response.body).toEqual({
      id: 'review',
      title: 'Обзор проекта',
      description: null,
      durationMinutes: 30,
    })
  })

  it('отвечает 201 на гранично допустимые значения полей', async () => {
    // У каждого случая свой id: типы накапливаются в общем хранилище теста.
    const cases = [
      // id ровно 50 символов.
      { id: 'a'.repeat(50), title: 'Обзор проекта', durationMinutes: 30 },
      // title ровно 100 символов после trim.
      { id: 'title-edge', title: `  ${'О'.repeat(100)}  `, durationMinutes: 30 },
      // description ровно 500 символов.
      {
        id: 'description-edge',
        title: 'Обзор проекта',
        description: 'Д'.repeat(500),
        durationMinutes: 30,
      },
      // durationMinutes на верхней границе.
      { id: 'duration-edge', title: 'Обзор проекта', durationMinutes: 240 },
    ]

    for (const [index, body] of cases.entries()) {
      const response = await request(app.getHttpServer()).post('/api/meeting-types').send(body)

      expect(response.status, `граничное значение №${index} должно быть допустимым`).toBe(201)
    }
  })

  it.each([
    {
      name: 'id отсутствует',
      body: { title: 'Обзор проекта', durationMinutes: 30 },
    },
    {
      name: 'id не строка',
      body: { id: 42, title: 'Обзор проекта', durationMinutes: 30 },
    },
    {
      name: 'id длиннее 50 символов',
      body: { id: 'a'.repeat(51), title: 'Обзор проекта', durationMinutes: 30 },
    },
    {
      name: 'id с заглавными буквами',
      body: { id: 'Intro', title: 'Обзор проекта', durationMinutes: 30 },
    },
    {
      name: 'id с дефисом в конце',
      body: { id: 'intro-', title: 'Обзор проекта', durationMinutes: 30 },
    },
    {
      name: 'title отсутствует',
      body: { id: 'review', durationMinutes: 30 },
    },
    {
      name: 'title пустой после trim',
      body: { id: 'review', title: '   ', durationMinutes: 30 },
    },
    {
      name: 'title длиннее 100 символов после trim',
      body: { id: 'review', title: 'О'.repeat(101), durationMinutes: 30 },
    },
    {
      name: 'title не строка',
      body: { id: 'review', title: 42, durationMinutes: 30 },
    },
    {
      name: 'description длиннее 500 символов',
      body: {
        id: 'review',
        title: 'Обзор проекта',
        description: 'Д'.repeat(501),
        durationMinutes: 30,
      },
    },
    {
      name: 'description не строка',
      body: { id: 'review', title: 'Обзор проекта', description: 42, durationMinutes: 30 },
    },
    {
      name: 'durationMinutes отсутствует',
      body: { id: 'review', title: 'Обзор проекта' },
    },
    {
      name: 'durationMinutes меньше 30',
      body: { id: 'review', title: 'Обзор проекта', durationMinutes: 10 },
    },
    {
      name: 'durationMinutes больше 240',
      body: { id: 'review', title: 'Обзор проекта', durationMinutes: 270 },
    },
    {
      name: 'durationMinutes не кратна 30',
      body: { id: 'review', title: 'Обзор проекта', durationMinutes: 45 },
    },
    {
      name: 'durationMinutes не целое',
      body: { id: 'review', title: 'Обзор проекта', durationMinutes: 30.5 },
    },
    {
      name: 'durationMinutes не число',
      body: { id: 'review', title: 'Обзор проекта', durationMinutes: '30' },
    },
  ])('отвечает 400 validation_error, когда $name', async ({ body }) => {
    const response = await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send(body)
      .expect(400)

    // Конверт ошибки — { code, message } (спецификация §10).
    expect(response.body).toMatchObject({ code: 'validation_error' })
    expect(typeof response.body.message).toBe('string')
    expect(response.body.message.length).toBeGreaterThan(0)
    expect(() =>
      expectValidResponse('post', '/api/meeting-types', 400, response.body),
    ).not.toThrow()
  })

  it('отвечает 400 validation_error, когда тела запроса нет', async () => {
    const response = await request(app.getHttpServer()).post('/api/meeting-types').expect(400)

    expect(response.body).toMatchObject({ code: 'validation_error' })
    expect(() =>
      expectValidResponse('post', '/api/meeting-types', 400, response.body),
    ).not.toThrow()
  })

  it('отвечает 400 validation_error, когда тело — массив', async () => {
    // Массив доходит до контроллера и должен попасть в проверку формы:
    // телом запроса может быть только объект.
    const response = await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send([1, 2, 3])
      .expect(400)

    expect(response.body).toMatchObject({ code: 'validation_error' })
  })

  it('проверяет поля до уникальности: дубль id с невалидной длительностью отвечает 400', async () => {
    // Порядок проверок из §6.1: форма и поля → уникальность id.
    const response = await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({ id: 'intro', title: 'Другое знакомство', durationMinutes: 45 })
      .expect(400)

    expect(response.body).toMatchObject({ code: 'validation_error' })
  })

  it('отвечает 409 meeting_type_exists при дубликате id', async () => {
    const create = () =>
      request(app.getHttpServer())
        .post('/api/meeting-types')
        .send({ id: 'review', title: 'Обзор проекта', durationMinutes: 60 })

    await create().expect(201)
    const response = await create().expect(409)

    expect(response.body).toMatchObject({ code: 'meeting_type_exists' })
    expect(typeof response.body.message).toBe('string')
    expect(response.body.message.length).toBeGreaterThan(0)
    expect(() =>
      expectValidResponse('post', '/api/meeting-types', 409, response.body),
    ).not.toThrow()
  })

  it('отвечает 409 meeting_type_exists при создании типа с id сид-типа', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/meeting-types')
      .send({ id: 'intro', title: 'Другое знакомство', durationMinutes: 30 })
      .expect(409)

    expect(response.body).toMatchObject({ code: 'meeting_type_exists' })
  })
})
