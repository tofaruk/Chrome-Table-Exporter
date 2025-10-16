
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      enabled: true,
      all: true,
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
      include: ['src/**/*.ts']
    }
  }
});
