import { defineConfig } from '@hey-api/openapi-ts'

// Пакет генерируется целиком: руками здесь ничего не правится (ADR-0002).
export default defineConfig({
  input: '../contract/openapi.json',
  output: {
    path: 'src',
    format: 'prettier',
  },
  plugins: ['@hey-api/typescript'],
})
