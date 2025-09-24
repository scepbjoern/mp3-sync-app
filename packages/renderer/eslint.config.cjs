const js = require('@eslint/js');
const globals = require('globals');
const react = require('eslint-plugin-react');
const tseslint = require('typescript-eslint');
const path = require('node:path');

module.exports = tseslint.config(
  {
    name: 'renderer/ignores',
    ignores: ['dist/**', 'eslint.config.*', 'postcss.config.js']
  },
  {
    name: 'renderer/config-file',
    files: ['eslint.config.{js,cjs,mjs}'],
    rules: {
      '@typescript-eslint/await-thenable': 'off'
    }
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    name: 'renderer/react-settings',
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    name: 'renderer/unsafe-boundaries',
    files: [
      'src/components/ErrorBoundary.tsx',
      'src/pages/**/*.tsx',
      'src/store/**/*.ts',
      'src/global.d.ts'
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
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false }
      ],
      'no-console': 'off'
    }
  },
  {
    name: 'renderer/typescript-react',
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: path.resolve(__dirname)
      },
      globals: {
        ...globals.browser,
        ...globals.es2022
      }
    },
    plugins: {
      react
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off'
    }
  }
);
