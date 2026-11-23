import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // Match tsconfig's "@/*" → "src/*" so tests can import app modules.
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'node',
  },
})
