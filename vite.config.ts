import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        spy: 'src/games/spy-vs-spy/index.html',
        diktator: 'src/games/diktator/index.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
