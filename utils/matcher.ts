import { collectStringPaths, getByPath, isPlainObject, isArray, buildPathKey } from './jsonPath';

export interface MatchDiagnostics {
  missingPaths: string[];
  extraPaths: string[];
  typeMismatches: { path: string; originalType: string; translationType: string }[];
}

export type TranslationMap = Record<string, string>;

export const buildTranslationMapFromJson = (translationJson: any): TranslationMap => {
  const map: TranslationMap = {};
  const stack: { node: any; path: (string|number)[] }[] = [{ node: translationJson, path: [] }];
  let iter = 0;
  const MAX_NODES = 1_000_000;
  while (stack.length) {
    const { node, path } = stack.pop()!;
    if (++iter > MAX_NODES) break;
    if (typeof node === 'string') {
      map[buildPathKey(path)] = node;
    } else if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push({ node: node[i], path: path.concat(i) });
    } else if (node && typeof node === 'object') {
      const keys = Object.keys(node);
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i];
        stack.push({ node: (node as any)[k], path: path.concat(k) });
      }
    }
  }
  return map;
};

export const diagnoseMatch = (originalJson: any, translationJson: any): MatchDiagnostics => {
  const origPaths = collectStringPaths(originalJson);
  const transPaths = collectStringPaths(translationJson);
  const origSet = new Set(origPaths);
  const transSet = new Set(transPaths);
  const missingPaths: string[] = [];
  const extraPaths: string[] = [];
  const typeMismatches: { path: string; originalType: string; translationType: string }[] = [];

  for (const p of origPaths) {
    if (!transSet.has(p)) missingPaths.push(p);
    else {
      const o = getByPath(originalJson, p);
      const t = getByPath(translationJson, p);
      const ot = Array.isArray(o) ? 'array' : typeof o;
      const tt = Array.isArray(t) ? 'array' : typeof t;
      if (ot !== tt) typeMismatches.push({ path: p, originalType: ot, translationType: tt });
    }
  }
  for (const p of transPaths) {
    if (!origSet.has(p)) extraPaths.push(p);
  }

  return { missingPaths, extraPaths, typeMismatches };
};

export interface TitleDuplicate {
  title: string;
  paths: string[];
}

export const findTitleDuplicates = (json: any): TitleDuplicate[] => {
  const dupIndex: Record<string, string[]> = {};
  const stack: { node: any; path: (string|number)[] }[] = [{ node: json, path: [] }];
  let iter = 0;
  const MAX_NODES = 1_000_000;
  while (stack.length) {
    const { node, path } = stack.pop()!;
    if (++iter > MAX_NODES) break;
    if (typeof node === 'string') {
      const title = String(node).trim();
      if (title) {
        const key = title.length > 64 ? title.slice(0, 64) : title;
        const pk = path.map(s => (typeof s === 'number' ? `[${s}]` : `.${s}`)).join('').replace(/^\./, '');
        dupIndex[key] = dupIndex[key] || [];
        dupIndex[key].push(pk);
      }
    } else if (isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push({ node: node[i], path: path.concat(i) });
    } else if (isPlainObject(node)) {
      for (const k of Object.keys(node)) stack.push({ node: node[k], path: path.concat(k) });
    }
  }
  const res: TitleDuplicate[] = [];
  for (const [title, paths] of Object.entries(dupIndex)) {
    if (paths.length > 1) res.push({ title, paths });
  }
  return res;
};
