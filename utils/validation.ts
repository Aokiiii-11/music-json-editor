export const isValidJsonKeyName = (key: string): boolean => {
  if (typeof key !== 'string') return false;
  const s = key.trim();
  if (!s) return false;
  if(/[\u0000-\u001f]/.test(s)) return false;
  return true;
};

export const normalizeTimestamp = (ts: string): string | undefined => {
  const raw = String(ts || '').trim();
  if (!raw) return undefined;
  const s = raw.replace(/[—–]/g, '-');
  const parse = (p: string): { ok: boolean; m?: number; s?: number } => {
    const m = p.match(/^([0-9]{1,3}):([0-5][0-9])$/);
    if (!m) return { ok: false };
    return { ok: true, m: parseInt(m[1], 10), s: parseInt(m[2], 10) };
  };
  const fmt = (m: number, sec: number): string => `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (s.includes('-')) {
    const [a, b] = s.split('-').map(x => x.trim());
    const pa = parse(a);
    const pb = parse(b);
    if (!pa.ok || !pb.ok) return undefined;
    const start = pa.m! * 60 + pa.s!;
    const end = pb.m! * 60 + pb.s!;
    if (end < start) return undefined;
    return `${fmt(pa.m!, pa.s!)}-${fmt(pb.m!, pb.s!)}`;
  }
  const p1 = parse(s);
  if (!p1.ok) return undefined;
  return fmt(p1.m!, p1.s!);
};
