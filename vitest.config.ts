import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@renderer': resolve('src/renderer/src') }
  },
  test: {
    globals: true,
    // Main-process logic is plain Node. Renderer test files opt into a DOM with
    // a `@vitest-environment jsdom` docblock at the top of the file.
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true
  }
})
