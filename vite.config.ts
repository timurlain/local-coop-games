import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        spy: 'src/games/spy-vs-spy/index.html',
        diktator: 'src/games/diktator/index.html',
        'diktator-rooms': 'src/games/diktator/dev/rooms.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
