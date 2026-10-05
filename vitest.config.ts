import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Fuso do processo propositalmente diferente de São Paulo:
    // as regras de data não podem depender do fuso do aparelho.
    env: { TZ: 'Asia/Tokyo' },
  },
})
