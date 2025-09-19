const allow = (origin: string, whitelist: string[]) =>
  whitelist.some(w => origin?.toLowerCase().startsWith(w.toLowerCase()));

export function cors(req: Request, resInit: ResponseInit = {}) {
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allow(origin, origins) ? origin : origins[0] || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...(resInit.headers as Record<string, string> | undefined),
  };
  return (body: any, init: ResponseInit = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      ...resInit, ...init, headers: { ...headers, ...(init.headers || {}) },
    });
}

export function preflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
  });
}
