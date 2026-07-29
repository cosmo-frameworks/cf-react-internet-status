import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'example/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // This config file itself is not in any tsconfig `include`.
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ...react.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
  },
  // Required with `jsx: "react-jsx"` — turns off the "React must be in scope" rules.
  react.configs.flat['jsx-runtime'],
  reactHooks.configs['recommended-latest'],
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Fights the `typeof navigator`/`typeof window` SSR guards, which are
      // genuinely necessary even though the DOM lib types claim otherwise.
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  // This file is still linted for syntax, but type-aware rules are pointless
  // here: eslint-plugin-react ships no types, so every plugin spread below
  // reads as `error`-typed and trips no-unsafe-assignment.
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Must stay last: disables every rule that conflicts with Prettier.
  prettier
);
