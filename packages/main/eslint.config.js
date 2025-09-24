const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');
const path = require('node:path');

module.exports = tseslint.config(
  {
    name: 'main/ignores',
    ignores: ['dist/**', '.webpack/**', 'eslint.config.*'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    name: 'main/typescript-node',
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: path.resolve(__dirname),
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false },
      ],
    },
  },
  {
    name: 'main/unsafe-boundaries',
    files: [
      'src/app/controllers/**/*.ts',
      'src/app/bidirectional-sync/**/*.ts',
      'src/app/services/mp3-tag.service.ts',
      'src/app/services/tag-transformer.service.ts',
      'src/app/source-file-state/**/*.ts',
      'src/app/sync/**/*.ts',
      'src/app/logger/**/*.ts',
      'src/app/config/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
);
