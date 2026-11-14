import { defineConfig } from '@playwright/test'
import process from 'node:process'

// Браузерный смоук первого среза (спецификация §13.4): поднимаем собранный
// API и фронтенд на свободных портах, сеть не мокается.
//
// Запуск из корня репозитория: `pnpm e2e` (сначала собирает пакеты).
// В первый раз нужно поставить браузер: `pnpm --filter @repo/e2e exec playwright install chromium`.
//
// `E2E_BASE_URL` переносит прогон на развёрнутый инстанс вместо локальных
// серверов: `E2E_BASE_URL=https://… pnpm e2e` (прод на Render — ADR-0004).
// Free-инстанс засыпает без трафика, первый запрос будит его до минуты,
// поэтому навигациям даётся увеличенный таймаут.
const REMOTE_BASE_URL = process.env.E2E_BASE_URL
const API_PORT = 3101
const WEB_PORT = 4301

export default defineConfig({
  testDir: './tests',
  // Тесты работают с одним собранным API, состояние которого живёт в
  // памяти (ADR-0003): брони из одного сценария видны другим. Чтобы файлы
  // не гоняли параллельно один и тот же слот, всё выполняется по порядку.
  workers: 1,
  // Частичные сценарии живут на сид-типе «Знакомство» и не ждут лишних
  // типов на главной странице. Полный сценарий (full-scenario.spec.ts)
  // создаёт свой тип встречи и меняет общее состояние сервера, поэтому
  // выполняется после них через зависимость проектов.
  projects: [
    { name: 'flows', testIgnore: /full-scenario\.spec\.ts/ },
    { name: 'full', testMatch: /full-scenario\.spec\.ts/, dependencies: ['flows'] },
  ],
  use: {
    baseURL: REMOTE_BASE_URL ?? `http://localhost:${WEB_PORT}`,
    ...(REMOTE_BASE_URL && { navigationTimeout: 120_000 }),
  },
  // На развёрнутом инстансе серверы уже подняты — локальные не запускаем.
  webServer: REMOTE_BASE_URL
    ? []
    : [
        {
          command: 'pnpm --filter @repo/api start',
          url: `http://localhost:${API_PORT}/api/health`,
          reuseExistingServer: !process.env.CI,
          env: { ...process.env, PORT: String(API_PORT) },
        },
        {
          command: `pnpm --filter @repo/web exec vite preview --port ${WEB_PORT} --strictPort`,
          url: `http://localhost:${WEB_PORT}`,
          reuseExistingServer: !process.env.CI,
          // Превью-сервер проксирует /api на собранный API (см. vite.config.ts).
          env: { ...process.env, API_ORIGIN: `http://localhost:${API_PORT}` },
        },
      ],
})
