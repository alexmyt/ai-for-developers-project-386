import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import Ajv, { type ValidateFunction } from 'ajv'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configureApp } from '../src/app.config'
import { AppModule } from '../src/app.module'
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
