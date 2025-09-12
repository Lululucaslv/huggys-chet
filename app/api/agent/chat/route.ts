import { cors, preflight } from '../../../../../lib/cors';

export function OPTIONS(){ return preflight(); }

export async function POST(req: Request) {
  const reply = cors(req);
  try {
    const body = await req.json();
    const mode = body?.mode === 'therapist' ? 'therapist' : 'user';
    const base = process.env.DIFY_API_BASE as string;
    const key  = process.env.DIFY_API_KEY as string;

    const workflowId = mode === 'therapist'
      ? (process.env.DIFY_THERAPIST_WORKFLOW_ID as string)
      : (process.env.DIFY_USER_WORKFLOW_ID as string);

    const r = await fetch(`${base}/workflows/${workflowId}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    return reply(JSON.stringify(data), { status: r.status, headers: { 'Content-Type': 'application/json' }});
  } catch (e: any) {
    return reply(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
}
