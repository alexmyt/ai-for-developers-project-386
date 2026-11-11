import { defineConfig } from '@hey-api/openapi-ts'

// Пакет генерируется целиком: руками здесь ничего не правится (ADR-0002).
export default defineConfig({
  input: '../contract/openapi.json',
  output: {
    path: 'src',
    postProcess: ['prettier'],
  },
  plugins: ['@hey-api/typescript', '@hey-api/client-fetch', '@hey-api/sdk'],
  // Пути контракта уже начинаются с /api, а сервера в openapi.json нет:
  // клиент ходит на относительный /api того же домена (без CORS, ADR-0001).
})
