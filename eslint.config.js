import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**'],
  },
  {
    ...js.configs.recommended,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      sourceType: 'module',
      ecmaVersion: 2022,
    },
  },
  {
    files: ['**/*.jsx'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  eslintConfigPrettier,
];
