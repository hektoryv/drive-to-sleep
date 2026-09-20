import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

describe('enforced domain boundaries', () => {
  it('keeps pure world generation out of sibling domains', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const [result] = await eslint.lintText(
      [
        "import '../../audio/tuning.js';",
        "import '../../sim/tuning.js';",
        "import '../view/materials.js';",
        'export const probe = 1;',
      ].join('\n'),
      { filePath: 'src/world/gen/architecture-probe.ts' },
    );

    const boundaryErrors = result?.messages.filter(
      (message) => message.ruleId === 'no-restricted-imports',
    );
    expect(boundaryErrors).toHaveLength(3);
  });
});
