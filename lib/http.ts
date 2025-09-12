export async function json<T>(req: Request): Promise<T> {
  try { return await req.json() as T; }
  catch { throw new Error('Invalid JSON body'); }
}
export const ok = (body: any) => ({ status: 200, body });
export const bad = (msg: string, code = 400) => ({ status: code, body: { error: msg } });
export const err = (e: any) => ({ status: 500, body: { error: String(e?.message || e) } });
export const needAuth = () => bad('Unauthorized', 401);

export function bearer(req: Request) {
  return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
}
