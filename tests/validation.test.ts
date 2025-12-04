import { describe, it, expect } from 'vitest';
import { normalizeTimestamp, isValidJsonKeyName } from '../utils/validation';

describe('normalizeTimestamp', () => {
  it('normalizes single point', () => {
    const r = normalizeTimestamp('1:02');
    console.log('normalize single', r);
    expect(r).toBe('01:02');
  });

  it('normalizes range', () => {
    const r = normalizeTimestamp('01:01-1:42');
    console.log('normalize range', r);
    expect(r).toBe('01:01-01:42');
  });

  it('rejects invalid', () => {
    const r = normalizeTimestamp('99:99');
    expect(r).toBeUndefined();
  });

  it('rejects end before start', () => {
    const r = normalizeTimestamp('02:00-01:00');
    expect(r).toBeUndefined();
  });
});

describe('isValidJsonKeyName', () => {
  it('accepts normal text', () => {
    expect(isValidJsonKeyName('Verse 1')).toBe(true);
  });
  it('rejects empty', () => {
    expect(isValidJsonKeyName('   ')).toBe(false);
  });
});
