import { defineConfig } from '@playwright/test'
import process from 'node:process'

// Браузерный смоук первого среза (спецификация §13.4): поднимаем собранный
// API и фронтенд на свободных портах, сеть не мокается.
//
// Запуск из корня репозитория: `pnpm e2e` (сначала собирает пакеты).
// В первый раз нужно поставить браузер: `pnpm --filter @repo/e2e exec playwright install chromium`.
const API_PORT = 3101
const WEB_PORT = 4301

export default defineConfig({
  testDir: './tests',
  // Тесты работают с одним собранным API, состояние которого живёт в
  // памяти (ADR-0003): брони из одного сценария видны другим. Чтобы файлы
  // не гоняли параллельно один и тот же слот, всё выполняется по порядку.
  workers: 1,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
  },
  webServer: [
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
