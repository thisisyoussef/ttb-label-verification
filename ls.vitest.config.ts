import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vite.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['evals/**/*.eval.ts'],
      testTimeout: 30000,
      passWithNoTests: false
    }
  })
);
