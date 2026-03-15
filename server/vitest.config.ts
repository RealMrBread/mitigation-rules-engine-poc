import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  test: {
    globals: false,
    fileParallelism: false,
    env: {
      DATABASE_URL:
        'postgresql://managpan@localhost:5432/mitigation_rules_engine_test',
      JWT_SECRET: 'test-jwt-secret-do-not-use',
    },
  },
});
