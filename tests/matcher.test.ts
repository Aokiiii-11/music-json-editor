import { describe, it, expect } from 'vitest';
import { buildTranslationMapFromJson, diagnoseMatch } from '../utils/matcher';

describe('matcher diagnostics', () => {
  const original = {
    global_dimension: { description: 'Song', fact_keywords: { Genre: 'Rock' } },
    section_dimension: [
      { description: 'Intro', lyrics: 'la la', keywords: { BPM: '120' } },
      { description: 'Verse', lyrics: 'hello', highlights: { Hook: 'Yes', 'High-Quality Timbre/Vocal Texture': 'Great' } },
    ],
  };

  const translation = {
    global_dimension: { description: '歌曲', fact_keywords: { Genre: '摇滚' } },
    section_dimension: [
      { description: '前奏', lyrics: '啦啦', keywords: { BPM: '120' } },
      { description: '主歌', lyrics: '你好', highlights: { Hook: '是', 'High-Quality Timbre/Vocal Texture': '高品质音色/人声质感' } },
    ],
  };

  it('builds map and reports no missing paths when aligned', () => {
    const map = buildTranslationMapFromJson(translation);
    expect(map['global_dimension.description']).toBe('歌曲');
    expect(map['section_dimension[1].lyrics']).toBe('你好');
    expect(map['section_dimension[1].highlights.High-Quality Timbre/Vocal Texture']).toBe('高品质音色/人声质感');
    const diag = diagnoseMatch(original, translation);
    // eslint-disable-next-line no-console
    console.log('diag.extraPaths', diag.extraPaths);
    expect(diag.missingPaths.length).toBe(0);
    expect(diag.extraPaths.length).toBe(0);
    expect(diag.typeMismatches.length).toBe(0);
  });

  it('detects missing and extra paths', () => {
    const t2 = { global_dimension: { description: '歌曲' } };
    const diag = diagnoseMatch(original, t2);
    expect(diag.missingPaths.length).toBeGreaterThan(0);
    const diag2 = diagnoseMatch({ global_dimension: { description: 'Song' } }, translation);
    expect(diag2.extraPaths.length).toBeGreaterThan(0);
  });
});
