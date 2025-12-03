export type PathSegment = string | number;

export const isPlainObject = (val: any): val is Record<string, any> => {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
};

export const isString = (val: any): val is string => typeof val === 'string';
export const isArray = Array.isArray;

export const buildPathKey = (segments: PathSegment[]): string => {
  const parts: string[] = [];
  segments.forEach(seg => {
    if (typeof seg === 'number') {
      const prev = parts.pop() || '';
      parts.push(`${prev}[${seg}]`);
    } else {
      parts.push(parts.length ? `.${seg}` : seg);
    }
  });
  return parts.join('');
};

export const parsePathKey = (key: string): PathSegment[] => {
  const segments: PathSegment[] = [];
  // Split by dots, then expand [index]
  key.split('.').forEach(part => {
    const re = /(\w+)(\[[0-9]+\])*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(part)) !== null) {
      const name = m[1];
      if (name) segments.push(name);
      const bracketRe = /\[([0-9]+)\]/g;
      let bm: RegExpExecArray | null;
      const bracketStr = m[2] || '';
      while ((bm = bracketRe.exec(bracketStr)) !== null) {
        segments.push(Number(bm[1]));
      }
    }
  });
  return segments;
};

export const getByPath = (root: any, pathKey: string): any => {
  const segs = parsePathKey(pathKey);
  let cur = root;
  for (const s of segs) {
    if (typeof s === 'number') {
      if (!isArray(cur) || s < 0 || s >= cur.length) return undefined;
      cur = cur[s];
    } else {
      if (!isPlainObject(cur) || !(s in cur)) return undefined;
      cur = (cur as Record<string, any>)[s];
    }
  }
  return cur;
};

export const collectStringPaths = (root: any): string[] => {
  const result: string[] = [];
  const stack: { node: any; path: PathSegment[] }[] = [{ node: root, path: [] }];
  let iter = 0;
  const MAX_NODES = 1_000_000;
  while (stack.length) {
    const { node, path } = stack.pop()!;
    if (++iter > MAX_NODES) throw new Error('Traversal aborted: too many nodes');
    if (isString(node)) {
      result.push(buildPathKey(path));
    } else if (isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        stack.push({ node: node[i], path: path.concat(i) });
      }
    } else if (isPlainObject(node)) {
      const keys = Object.keys(node);
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i];
        stack.push({ node: node[k], path: path.concat(k) });
      }
    }
  }
  return result;
};

