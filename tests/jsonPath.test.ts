import { describe, it, expect } from 'vitest';
import { collectStringPaths, getByPath, buildPathKey, parsePathKey } from '../utils/jsonPath';

describe('jsonPath utilities', () => {
  it('builds and parses path keys with indices', () => {
    const key = buildPathKey(['section_dimension', 2, 'lyrics']);
    expect(key).toBe('section_dimension[2].lyrics');
    expect(parsePathKey(key)).toEqual(['section_dimension', 2, 'lyrics']);
  });

  it('collects string paths and preserves special symbols', () => {
    const data = {
      global_dimension: { description: 'Rock | 摇滚丨风格｜测试' },
      section_dimension: [
        { lyrics: 'A | B', description: 'X｜Y' },
        { lyrics: 'C丨D', description: 'E|F' },
      ],
    };
    const paths = collectStringPaths(data);
    expect(paths).toContain('global_dimension.description');
    expect(paths).toContain('section_dimension[0].lyrics');
    expect(paths).toContain('section_dimension[1].description');
    // getByPath returns raw strings without any split
    expect(getByPath(data, 'section_dimension[1].lyrics')).toBe('C丨D');
  });
});

