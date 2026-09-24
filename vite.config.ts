import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
