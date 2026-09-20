import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Domain boundaries, enforced.
 *
 * The architecture (ADR-0011) is that each domain is a sealed vertical slice:
 * it owns its generation, its geometry, its DOM and its constants, and reaches
 * other domains only through `contracts/`. That only survives contact with
 * real work if a machine checks it, so these rules are the architecture — the
 * documentation is a description of them.
 *
 * Two separate restrictions are at work:
 *
 *   1. **Purity.** `sim/` and `world/gen/` may not touch three.js or the DOM,
 *      so the simulation and the generator stay testable in plain Node and
 *      portable off this rendering stack (ADR-0002).
 *   2. **Isolation.** No domain may import another domain. This is what lets
 *      separate people — or separate agents — work on the environment, the
 *      cockpit and the UI at once without their changes reaching each other.
 */

/** Every domain directory. Used to forbid all the ones you don't belong to. */
const DOMAINS = ['sim', 'world', 'render', 'cockpit', 'ui', 'input', 'fx', 'audio'];

const THREE_PATTERNS = ['three', 'three/*'];

const CONTRACT_HINT =
  'Domains must not import one another (ADR-0011). If you need something from ' +
  'another domain, add or use an interface in src/contracts/ and let app/ wire ' +
  'the implementation in. See docs/06-modules.md.';

const PURITY_HINT =
  'This code must stay pure (ADR-0002): no three.js, no DOM. It has to run in ' +
  'plain Node so the simulation and the generator can be tested without a GPU. ' +
  'Export data and let the view layer draw it.';

/** Forbids every domain except the ones listed. */
function otherDomains(own) {
  return DOMAINS.filter((d) => !own.includes(d)).map((d) => `**/${d}/**`);
}

function restrict(patterns, message) {
  return ['error', { patterns: [{ group: patterns, message }] }];
}

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

  // core/ is the foundation. It may depend on nothing but itself — if core
  // needed a contract, the thing in question is not core.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        [...THREE_PATTERNS, '**/contracts/**', ...DOMAINS.map((d) => `**/${d}/**`), '**/app/**'],
        'core/ is the bottom of the stack and depends on nothing above it.',
      ),
    },
  },

  // contracts/ describes the seams. It may name three.js types, but it must
  // never reach into a domain — that would make the seam a dependency.
  {
    files: ['src/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        [...DOMAINS.map((d) => `**/${d}/**`), '**/app/**'],
        'contracts/ describes the boundaries between domains and must not depend on any of them.',
      ),
    },
  },

  // The pure layers: the simulation and the world generator.
  {
    files: ['src/sim/**/*.ts', 'src/world/gen/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: THREE_PATTERNS, message: PURITY_HINT },
            {
              group: [
                '**/sim/**',
                '**/view/**',
                '**/render/**',
                '**/cockpit/**',
                '**/ui/**',
                '**/input/**',
                '**/fx/**',
                '**/audio/**',
              ],
              message: CONTRACT_HINT,
            },
            { group: ['**/app/**'], message: 'Only app/ wires modules together; nothing imports it.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: PURITY_HINT },
        { name: 'window', message: PURITY_HINT },
        { name: 'localStorage', message: PURITY_HINT },
        { name: 'performance', message: PURITY_HINT },
      ],
    },
  },

  // sim/ additionally may not reach into world/ — it reads the road through
  // the RoadQuery contract like everyone else.
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: THREE_PATTERNS, message: PURITY_HINT },
            { group: otherDomains(['sim']), message: CONTRACT_HINT },
            { group: ['**/app/**'], message: 'Only app/ wires modules together; nothing imports it.' },
          ],
        },
      ],
    },
  },

  // The view-owning domains. Each may use three.js and its own internals, and
  // nothing else's.
  ...['world', 'render', 'cockpit', 'ui', 'input', 'fx', 'audio'].map((domain) => ({
    files: [`src/${domain}/**/*.ts`],
    ignores: domain === 'world' ? ['src/world/gen/**/*.ts'] : [],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: otherDomains([domain]), message: CONTRACT_HINT },
            { group: ['**/app/**'], message: 'Only app/ wires modules together; nothing imports it.' },
          ],
        },
      ],
    },
  })),

  {
    files: ['tests/**/*.ts', 'tools/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-imports': 'off',
      'no-restricted-globals': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
