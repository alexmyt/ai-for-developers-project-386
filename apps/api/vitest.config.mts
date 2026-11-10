import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// esbuild не эмитит метаданные декораторов, поэтому Nest-тесты идут через swc.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
})
