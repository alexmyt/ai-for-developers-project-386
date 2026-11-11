import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { DynamicModule } from '@nestjs/common'
import { ServeStaticModule } from '@nestjs/serve-static'

// ADR-0002: в проде один процесс Nest отдаёт и API под /api, и собранную
// статику SPA. Корень статики — переменная WEB_STATIC_ROOT; без неё корнем
// считается dist/web рядом с main.js, как в Docker-образе.
export const WEB_STATIC_ROOT_ENV = 'WEB_STATIC_ROOT'

/**
 * Возвращает корень собранной статики или null, если собранного фронтенда
 * нет: в dev статикой занимается Vite, а unit-тесты не должны зависеть
 * от билда фронтенда.
 */
export function resolveWebStaticRoot(): string | null {
  const envRoot = process.env[WEB_STATIC_ROOT_ENV]?.trim()
  const rootPath = envRoot ? resolve(envRoot) : join(process.cwd(), 'dist', 'web')

  return existsSync(rootPath) ? rootPath : null
}

/**
 * Модуль отдачи SPA-статики: файлы — как есть, клиентские маршруты —
 * переписыванием на index.html. Роуты /api исключены из фолбэка, чтобы
 * неизвестные пути API оставались 404. Если статики нет, модуль
 * не регистрируется.
 */
export function createWebStaticModule(): DynamicModule | null {
  const rootPath = resolveWebStaticRoot()

  if (!rootPath) {
    return null
  }

  return ServeStaticModule.forRoot({
    rootPath,
    // path-to-regexp v8 (Express 5) не понимает «/api*»: нужно точное имя
    // для wildcard. Исключаем /api целиком, чтобы неизвестные пути API
    // оставались 404, а не отдавали index.html.
    exclude: ['/api', '/api/{*path}'],
  })
}
