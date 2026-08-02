import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/.svelte-kit/**', '**/node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: config.files ?? tsFiles,
  })),
  {
    files: tsFiles,
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.vitest },
    },
  },
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.js', 'apps/web/**/*.svelte'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
);
