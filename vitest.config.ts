import { defineConfig } from 'vitest/config'

// Один раннер на монорепо (ADR-0001): новый пакет с тестами добавляется сюда.
export default defineConfig({
  test: {
    projects: ['apps/api', 'apps/web'],
  },
})
