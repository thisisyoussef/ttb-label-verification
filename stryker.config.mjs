export default {
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['progress', 'clear-text'],
  tempDirName: '.stryker-tmp',
  mutate: [
    'src/server/**/*.ts',
    'src/shared/**/*.ts',
    '!src/**/*.test.ts',
    '!src/client/**',
    '!src/server/index.ts',
  ],
  vitest: {
    related: false,
  },
};
