import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { files: ['server/src/**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.node } },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
