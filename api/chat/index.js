import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { persistSession: false } });
}

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const DEFAULT_CODE = process.env.THERAPIST_DEFAULT_CODE || "8W79AL2B";

const SYSTEM_PROMPT_USER = `
你是 Huggy，一位高共情的AI陪伴师。你的核心使命：让来访者感到“被听见、不孤单”。
沟通原则：
1) 无条件积极关注：接纳、无评判；禁止说教/诊断/医疗建议。
2) 准确共情：先情绪验证（validating），再用简短复述/反映（reflect/paraphrase）。
3) 真诚透明：可适度使用“我…”句式（如“我听到你说…我能感到…”）。
4) 以用户为中心：少谈自己，围绕用户当下体验与需要。
5) 此时此地：回应此刻情绪；若出现自伤/他伤等风险，温和提示尽快寻求线下专业支持与求助热线。
对话风格：
- 2–4 句一轮，语气温柔自然，尽量简洁，可少量表情🙂；
- 多用开放式问题（什么/如何/哪一刻），避免“你应该…”；
- 仅在用户明确提出预约时交由业务流程处理，否则坚持情感陪伴。
输出：自然中文短段落；非必要不列清单。
`;

function isBookingIntent(text = "") {
  const t = String(text).toLowerCase();
  const zhBook = /(预约|约个?|安排|改约|改期|再约|可预约|可用|可用时间|空档|空闲|空余|空位|时段|看.*时段|时间安排|排期)/;
  const zhTime = /(时间(段|点)?|今天|明天|后天|这周|下周|周[一二三四五六日天]|上午|下午|晚上|\d{1,2}点|\d{1,2}:\d{2}|(\d{1,3})\s*小时|(\d{1,3})h)/;
  const enBook = /\b(book|booking|schedule|reschedule|slot|availability|available)\b/;
  const enTime = /\b(today|tomorrow|tonight|this week|next week|morning|afternoon|evening|am|pm|\d{1,2}(:\d{2})?\s?(am|pm)?|\d{1,3}\s?hours?)\b/;
  const strong = /(预约|booking|安排时间|排期)/.test(t);
  const normal = (zhBook.test(t) && zhTime.test(t)) || (enBook.test(t) && enTime.test(t));
  return strong || normal;
}

function normTokens(raw) {
  const t = String(raw || '').toLowerCase()
  return Array.from(new Set(t.split(/[^a-z\u4e00-\u9fa5]+/).filter(Boolean)))
}

const HARD_ALIASES = {
  "hanqi": "8W79AL2C",
  "hanqi lyu": "8W79AL2C",
  "hanqi.lyu": "8W79AL2C",
  "寒琦": "8W79AL2C",
  "吕寒琦": "8W79AL2C"
};

async function resolveTherapistFromText(text) {
  const supabase = getSupabase();
  const raw = String(text || "").toLowerCase().trim();
  if (!raw) return null;

  const terms = normTokens(raw);
  for (const k of [...terms, raw]) {
    const hit = HARD_ALIASES[k];
    if (hit) {
      const { data } = await supabase
        .from("therapists")
        .select("code,name,aliases,active")
        .eq("code", hit)
        .eq("active", true)
        .limit(1);
      if (data?.length) return data[0];
    }
  }

  const aliasCandidates = [...terms, raw];
  for (const term of aliasCandidates) {
    const { data: byAlias } = await supabase
      .from("therapists")
      .select("code,name,aliases,active")
      .contains("aliases", [term])
      .eq("active", true)
      .limit(1);
    if (byAlias?.length) return byAlias[0];
  }

  for (const t of terms) {
    const { data } = await supabase
      .from("therapists")
      .select("code,name,aliases,active")
      .ilike("name", `%${t}%`)
      .eq("active", true)
      .limit(1);
    if (data?.length) return data[0];
  }
  return null;
}

async function fetchSlotsWithNames(code, limit = 8, windowHours = 72) {
  const supabase = getSupabase();
  const nowISO = new Date().toISOString();
  const endISO = new Date(Date.now() + windowHours * 3600 * 1000).toISOString();

  if (code) {
    const { data: ts } = await supabase
      .from("therapist_availability")
      .select("id, therapist_code, start_utc, end_utc, status")
      .eq("therapist_code", code)
      .or("status.eq.open,status.eq.available,status.is.null")
      .gt("start_utc", nowISO)
      .lt("start_utc", endISO)
      .order("start_utc", { ascending: true })
      .limit(limit);

    if (Array.isArray(ts) && ts.length) {
      const { data: ther } = await supabase
        .from("therapists")
        .select("code,name")
        .eq("code", code)
        .limit(1);
      const name = ther?.[0]?.name || "Therapist";

      try {
        await supabase.from("ai_logs").insert({
          scope: "chat",
          ok: true,
          model: "none",
          payload: JSON.stringify({ phase: "slots_from_therapist_availability", requestedCode: code, windowHours }),
          output: JSON.stringify({ count: ts.length })
        });
      } catch {}

      return ts.map(s => ({
        availabilityId: s.id,
        therapistCode: code,
        therapistName: name,
        startUTC: s.start_utc,
        endUTC: s.end_utc
      }));
    } else {
      try {
        await supabase.from("ai_logs").insert({
          scope: "chat",
          ok: true,
          model: "none",
          payload: JSON.stringify({ phase: "no_slots_in_therapist_availability", requestedCode: code, windowHours }),
          output: JSON.stringify({ count: Array.isArray(ts) ? ts.length : 0 })
        });
      } catch {}
    }
  }

  let profileId = null;
  let trow = null;
  if (code) {
    const r1 = await supabase
      .from("therapists")
      .select("user_id, code, name")
      .eq("code", code)
      .maybeSingle();
    trow = r1?.data || null;

    if (trow?.user_id) {
      const r2 = await supabase
        .from("user_profiles")
        .select("id, user_id")
        .eq("user_id", trow.user_id)
        .maybeSingle();
      profileId = r2?.data?.id || null;
    }
  }

  let q = supabase
    .from("availability")
    .select("id, therapist_id, start_time, end_time, is_booked")
    .gt("start_time", nowISO)
    .lt("start_time", endISO)
    .or("is_booked.is.null,is_booked.eq.false")
    .order("start_time", { ascending: true })
    .limit(limit);

  if (profileId) q = q.eq("therapist_id", profileId);

  const { data: slots } = await q;
  if (!slots?.length) return [];

  const profileIds = [...new Set(slots.map(s => s.therapist_id))];
  const { data: profs } = await supabase
    .from("user_profiles")
    .select("id, user_id")
    .in("id", profileIds);

  const userIds = [...new Set((profs || []).map(p => p.user_id))];
  const { data: ther } = await supabase
    .from("therapists")
    .select("user_id, code, name")
    .in("user_id", userIds);

  const byProfileId = {};
  (profs || []).forEach(p => {
    const t = (ther || []).find(th => th.user_id === p.user_id);
    if (t) byProfileId[p.id] = { code: t.code, name: t.name };
  });

  try {
    await supabase.from("ai_logs").insert({
      scope: "chat",
      ok: true,
      model: "none",
      payload: JSON.stringify({ phase: "slots_from_availability", requestedCode: code || null, windowHours }),
      output: JSON.stringify({ count: (slots || []).length })
    });
  } catch {}

  return (slots || []).map(s => {
    const info = byProfileId[s.therapist_id] || {};
    return {
      availabilityId: s.id,
      therapistCode: info.code || code || DEFAULT_CODE,
      therapistName: info.name || "Therapist",
      startUTC: s.start_time,
      endUTC: s.end_time
    };
  });
}

function compat(text, toolResults) {
  return {
    success: true,
    content: text,
    toolResults,
    reply: { role: "assistant", content: text },
    blocks: toolResults,
    response: text
  };
}

export default async function handler(req, res) {
  withCors(res)
  if (req.method === "OPTIONS") {
    res.status(200).end()
    return
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const {
    userMessage,
    userId,
    therapistCode,
    browserTz = "UTC",
    lang = "zh-CN",
    actor = "user",
    targetUserId = null
  } = req.body || {};

  const supabase = getSupabase();
  const t0 = Date.now()

  if (!userMessage || !userId) {
    const msg = lang.startsWith("zh")
      ? "可以先跟我说说最近在意的事，或告诉我一个时间范围（例如“明天下午”），我来帮你查看可预约时间。"
      : "Tell me what's on your mind, or share a time window (e.g., 'tomorrow afternoon') and I can check availability.";
    return res.status(200).json(compat(msg, []));
  }
  try {
    const base = String(process.env.DIFY_API_BASE || 'https://api.dify.ai/v1').replace(/\/+$/, '')
    const modeParam = (req.query && (req.query.mode || req.query.m)) || req.body?.mode || actor
    const role = String(modeParam || 'user').toLowerCase() === 'therapist' ? 'therapist' : 'user'
    const scope = role === 'therapist' ? 'agent_chat_therapist' : 'agent_chat_user'
    const apiKey = role === 'therapist' ? process.env.DIFY_THERAPIST_API_KEY : process.env.DIFY_USER_API_KEY
    const url = `${base}/workflows/run`
    if (base && apiKey) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          inputs: {
            user_message: userMessage,
            query: userMessage,
            user_id: userId || 'anonymous',
            therapist_code: therapistCode || DEFAULT_CODE,
            browser_tz: browserTz || 'UTC'
          },
          response_mode: 'blocking',
          user: userId || 'anonymous'
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout))

      const dj = await r.json().catch(() => ({}))
      const outputs = dj?.data?.outputs
      const outputsKeys = Array.isArray(outputs) ? outputs.map(o => o?.name || o?.key).filter(Boolean) : (outputs && typeof outputs === 'object' ? Object.keys(outputs) : [])
      const hasOutputText = typeof dj?.data?.output_text === 'string'
      const outputTextLen = hasOutputText ? dj.data.output_text.length : 0
      const difyStatus = dj?.status || dj?.data?.status

      function pickFromOutputs(outs) {
        if (Array.isArray(outs)) {
          const byReply = outs.find(x => x?.key === 'reply' || x?.name === 'reply')
          if (byReply && byReply.value) return byReply.value
          const byAnswer = outs.find(x => x?.key === 'answer' || x?.name === 'answer')
          if (byAnswer && byAnswer.value) return byAnswer.value
          const any = outs.find(x => x && x.value)
          if (any) return any.value
        } else if (outs && typeof outs === 'object') {
          if (outs.reply) return outs.reply
          if (outs.answer) return outs.answer
        }
        return null
      }

      let out = pickFromOutputs(outputs) || null
      if (!out && hasOutputText) out = dj.data.output_text
      if (!out) out = (dj?.result && (dj.result.reply || dj.result.text)) || null
      if (!out) out = dj?.message || dj?.text || null

      if (typeof out === 'string') { try { const parsed = JSON.parse(out); out = parsed } catch {} }

      if (out && typeof out === 'object' && out.type === 'TIME_CONFIRM') {
        const options = Array.isArray(out.options) ? out.options : []
        const text = lang.startsWith('zh')
          ? (out.message || `已为您找到 ${options.length} 个可预约时间，请选择：`)
          : (out.message || `I found ${options.length} available time slots. Please pick one:`)

        try {
          await supabase.from('ai_logs').insert({
            scope, ok: true, model: 'dify-workflow',
            payload: JSON.stringify({ userMessage, userId, therapistCode, browserTz, role, url, status: r.status, keyHint: (apiKey||'').slice(-6), outputsKeys, hasOutputText, outputTextLen, difyStatus }).slice(0, 4000),
            output: JSON.stringify({ type: 'TIME_CONFIRM', count: options.length, raw: dj }).slice(0, 4000),
            ms: Date.now() - t0
          })
        } catch {}

        return res.status(200).json(compat(text, [{ type: 'TIME_CONFIRM', options }]))
      } else {
        let text = ''
        if (typeof out === 'string') text = out
        else if (out && typeof out === 'object' && (out.message || out.text)) text = out.message || out.text
        else if (hasOutputText) text = dj.data.output_text
        if (!text) text = lang.startsWith('zh') ? '我在，愿意听你说说。' : 'I’m here and listening.'

        try {
          await supabase.from('ai_logs').insert({
            scope, ok: true, model: 'dify-workflow',
            payload: JSON.stringify({ userMessage, userId, therapistCode, browserTz, role, url, status: r.status, keyHint: (apiKey||'').slice(-6), outputsKeys, hasOutputText, outputTextLen, difyStatus }).slice(0, 4000),
            output: JSON.stringify({ text: String(text || ''), raw: dj }).slice(0, 4000),
            ms: Date.now() - t0
          })
        } catch {}

        return res.status(200).json(compat(text, []))
      }
    }
  } catch (e) {
    try {
      await supabase.from('ai_logs').insert({
        scope: (String(actor||'user').toLowerCase()==='therapist' ? 'agent_chat_therapist' : 'agent_chat_user'),
        ok: false,
        model: 'dify-workflow',
        payload: JSON.stringify({
          role: (String(actor||'user').toLowerCase()==='therapist' ? 'therapist' : 'user'),
          url: (String(process.env.DIFY_API_BASE || 'https://api.dify.ai/v1').replace(/\/+$/, '')) + '/workflows/run',
          keyHint: (((String(actor||'user').toLowerCase()==='therapist' ? process.env.DIFY_THERAPIST_API_KEY : process.env.DIFY_USER_API_KEY)) || '').slice(-6)
        }).slice(0,4000),
        error: String(e && e.message ? e.message : e),
        ms: Date.now() - t0
      })
    } catch {}
  }


  try {
    const greetings = /(你好|您好|hello|hi|嗨|在吗|hey)/i;
    const wantBooking = isBookingIntent(userMessage) && !greetings.test(userMessage);

    if (wantBooking) {
      let resolved = null;
      try { resolved = await resolveTherapistFromText(userMessage); } catch {}
      const code = therapistCode || resolved?.code || DEFAULT_CODE;

      let options = [];
      if (code) {
        options = await fetchSlotsWithNames(code, 8, 72);
        if (!options.length) options = await fetchSlotsWithNames(code, 8, 96);
        if (!options.length) options = await fetchSlotsWithNames(code, 8, 168);
      } else {
        options = await fetchSlotsWithNames(null, 8, 72);
      }
      const opts = options;

      if (opts.length) {
        const text = lang.startsWith("zh")
          ? `已为您找到 ${opts.length} 个可预约时间，请选择：`
          : `I found ${opts.length} available time slots. Please pick one:`;
        const createEnabled = actor === "user" || !!targetUserId;

        try {
          await supabase.from("ai_logs").insert({
            scope: "chat",
            ok: true,
            model: "none",
            payload: JSON.stringify({ wantBooking: true, resolvedCode: code, source: "api/chat", optionsForCode: options.length }),
            output: JSON.stringify({ options: opts.length })
          });
        } catch {}

        return res.status(200).json(
          compat(text, [{ type: "TIME_CONFIRM", options: opts.map(o => ({ ...o, targetUserId })), createEnabled, targetUserId }])
        );
      }

      const noSlot = lang.startsWith("zh")
        ? "当前时段暂无可约。可以换个时间范围（如“这周末下午”），我再帮你查。"
        : "No open slots in that window. Try another time range and I’ll check again.";
      return res.status(200).json(compat(noSlot, []));
    }

    const payload = { message: userMessage, context: { browserTz, lang } };
    try {
      const resp = await openai.chat.completions.create(
        {
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT_USER },
            { role: "user", content: JSON.stringify(payload) }
          ],
          max_tokens: 600
        },
        { timeout: 12000 }
      );
      const text = resp.choices?.[0]?.message?.content ?? "";
      return res.status(200).json(compat(text || "我在这，愿意听你说说。", []));
    } catch {
      const fallback = lang.startsWith("zh")
        ? "我在这，先陪你说说发生了什么吧。如果你愿意，我们也可以在合适的时候安排一次专业咨询。"
        : "I’m here with you. Tell me what’s going on.";
      return res.status(200).json(compat(fallback, []));
    }
  } catch {
    return res.status(200).json(compat("抱歉，系统有点忙。请稍后再试。", []));
  }
}
