import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * The load-bearing rule here is the layering restriction (ADR-0002):
 * sim/ and world/ must stay pure — no three.js, no DOM-facing modules — so the
 * whole simulation stays testable in plain Node and portable off this stack.
 */
const PURE_LAYER_RESTRICTIONS = {
  patterns: [
    {
      group: ['three', 'three/*', '**/render/*', '**/cockpit/*', '**/ui/*', '**/fx/*'],
      message:
        'sim/ and world/ must stay pure (ADR-0002). No three.js and no render/cockpit/ui/fx imports. ' +
        'If the renderer needs something from here, export data and let render/ read it.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'shots', 'android'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['src/sim/**/*.ts', 'src/world/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', PURE_LAYER_RESTRICTIONS] },
  },
  {
    files: ['tests/**/*.ts', 'tools/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
