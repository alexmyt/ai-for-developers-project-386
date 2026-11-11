import { defineConfig } from '@playwright/test'

// Браузерные сценарии билета #26 против одного контейнера (ADR-0002):
// собранный образ отдаёт и API под /api, и SPA-статику на порту 3000.
// Playwright сам запускает контейнер, ждёт /api/health и гоняет все
// сценарии по порядку — сеть не мокается.
//
// Запуск из корня репозитория: `pnpm e2e:container` (сначала соберёт образ).
const CONTAINER_PORT = 3000
const CONTAINER_NAME = 'call-calendar-e2e'
const IMAGE_TAG = 'call-calendar:latest'

export default defineConfig({
  testDir: './tests',
  // Тесты работают с одним сервером, состояние которого живёт в памяти
  // (ADR-0003): брони из одного сценария видны другим. Чтобы файлы не гоняли
  // параллельно один и тот же слот, всё выполняется по порядку.
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
    baseURL: `http://localhost:${CONTAINER_PORT}`,
  },
  webServer: [
    {
      // Контейнер каждый раз новый и предсказуемый: reuseExistingServer
      // отключён, потому что состояние в памяти (ADR-0003) и брони прошлых
      // прогонов исказили бы сценарии. Перед запуском снимаем контейнер
      // прошлого прогона, если тот остался висеть: Playwright убивает
      // клиент docker run, а не сам контейнер.
      command: `docker rm --force ${CONTAINER_NAME} >/dev/null 2>&1; docker run --rm --name ${CONTAINER_NAME} -p ${CONTAINER_PORT}:3000 ${IMAGE_TAG}`,
      url: `http://localhost:${CONTAINER_PORT}/api/health`,
      reuseExistingServer: false,
    },
  ],
  globalTeardown: './global-teardown.ts',
})
