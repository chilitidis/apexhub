/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('ImportExcelModal + Home topbar — guards & wiring', () => {
  const modalSrc = readFileSync(
    resolve(__dirname, 'ImportExcelModal.tsx'),
    'utf-8',
  );
  const homeSrc = readFileSync(
    resolve(__dirname, '../pages/Home.tsx'),
    'utf-8',
  );

  it('ImportExcelModal blocks silent overwrite with a 2-step confirm', () => {
    expect(modalSrc).toContain('confirmingOverwrite');
    expect(modalSrc).toContain('ΑΝΤΙΚΑΤΑΣΤΑΣΗ');
    expect(modalSrc).toContain('ΕΠΙΒΕΒΑΙΩΣΗ ΑΝΤΙΚΑΤΑΣΤΑΣΗΣ');
    expect(modalSrc).toContain('isDuplicate');
  });

  it('Home topbar renders both NEW MONTH and IMPORT buttons', () => {
    expect(homeSrc).toContain('NEW MONTH');
    expect(homeSrc).toContain('IMPORT');
    expect(homeSrc).toContain('setShowNewMonth(true)');
    expect(homeSrc).toContain('setShowImportExcel(true)');
  });

  it('Home mounts ImportExcelModal with proper props', () => {
    expect(homeSrc).toContain('<ImportExcelModal');
    expect(homeSrc).toContain('existingMonthKeys');
    expect(homeSrc).toContain('onImport');
  });
});
