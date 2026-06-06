import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'out/',
      'dist/',
      'coverage/',
      'node_modules/',
      '.Jules/',
      '.jules/',
      '_experiments/',
      'test-*.js'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      react
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': 'warn'
    }
  },
  {
    files: ['**/__tests__/**', '**/*.test.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
