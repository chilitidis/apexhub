/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Source-level smoke test — fast and stable: confirms the modal's source
// includes all 4 steps and the three required notes textareas. Avoids the
// fragility of a full RTL render for a 4-step animated wizard, while still
// catching regressions like a removed step or note field.
describe('AddTradeModal — step layout', () => {
  const src = readFileSync(
    resolve(__dirname, 'AddTradeModal.tsx'),
    'utf-8',
  );

  it('has all four steps', () => {
    expect(src).toContain('step === 1');
    expect(src).toContain('step === 2');
    expect(src).toContain('step === 3');
    expect(src).toContain('step === 4');
    expect(src).toMatch(/Step \{step\} of 4/);
  });

  it('step 4 renders three notes textareas', () => {
    expect(src).toContain('pre_checklist');
    expect(src).toContain('psychology');
    expect(src).toContain('lessons_learned');
    // Three <textarea> elements (one per note field)
    const matches = src.match(/<textarea/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('step 4 label is "Notes & Reflection"', () => {
    expect(src).toContain('Notes & Reflection');
  });
});
