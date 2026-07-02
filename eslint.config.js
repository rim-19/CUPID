import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

/* Lints JS/JSX. TypeScript modules are type-checked by `tsc` (npm run typecheck)
   rather than linted here, to avoid pulling in a second parser. */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
      },
    },
    plugins: { react: reactPlugin, 'react-hooks': hooksPlugin },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-cond-assign': ['error', 'except-parens'],
    },
  },
];
