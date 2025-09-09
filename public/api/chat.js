// public/api/chat.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DEFAULT_CODE = process.env.THERAPIST_DEFAULT_CODE || "8W79AL2B";

/* ===== 用户端·共情聊天 System Prompt（内嵌文本） ===== */
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

/* ===== 收紧的预约意图 ===== */
function isBookingIntent(text = "") {
  const t = String(text || "").toLowerCase();
  const zhBook = /(预约|约个?|安排|改约|改期|再约|可预约|可用时间|可用|空档|空闲|空余|空位|时段|看.*时段|找|时间安排|排期)/;
  const zhTime = /(时间(段|点)?|今天|明天|后天|这周|本周|下周|周[一二三四五六日天]|上午|下午|晚上|\d{1,2}点|\d{1,2}:\d{2})/;
  const enBook = /\b(book|booking|schedule|reschedule|slot|availability|available|find)\b/;
  const enTime = /\b(today|tomorrow|tonight|this week|next week|morning|afternoon|evening|am|pm|\d{1,2}(:\d{2})?\s?(am|pm)?)\b/;
  const strong = /(预约|booking)/.test(t);
  const mentionFindTherapist = /找\s*([a-z\u4e00-\u9fa5\. ]+)/i.test(t);
  const normal = (zhBook.test(t) && zhTime.test(t)) || (enBook.test(t) && enTime.test(t));
  return strong || normal || mentionFindTherapist;
}

/* ===== 动态解析：根据文本匹配咨询师（therapists 表） ===== */
async function resolveTherapistFromText(text) {
  const raw = String(text || "").toLowerCase().trim();
  if (!raw) return null;

  const normTokens = Array.from(
    new Set(String(raw).toLowerCase().split(/[^a-z\u4e00-\u9fa5]+/).filter(Boolean))
  );

  const HARD_ALIASES = [
    { keys: ["hanqi.lyu"], code: "8W79AL2C" },
    { keys: ["hanqi lyu"], code: "8W79AL2C" },
    { keys: ["hanqi"], code: "8W79AL2C" },
    { keys: ["寒琦"], code: "8W79AL2C" },
    { keys: ["吕寒琦"], code: "8W79AL2C" }
  ];
  for (const item of HARD_ALIASES) {
    if (item.keys.some(k => raw.includes(k))) {
      const { data } = await supabase.from("therapists").select("code,name,active").eq("code", item.code).eq("active", true).limit(1);
      if (data?.length) return data[0];
      return { code: item.code, name: "Hanqi Lyu", active: true };
    }
  }

  const aliasCandidates = [raw, ...normTokens];
  for (const a of aliasCandidates) {
    const { data } = await supabase
      .from("therapists")
      .select("code,name,aliases,active")
      .contains("aliases", [a])
      .eq("active", true)
      .limit(1);
    if (data?.length) return data[0];
  }

  for (const t of normTokens) {
    const { data } = await supabase
      .from("therapists")
      .select("code,name,aliases,active")
      .ilike("name", `%${t}%`)
      .eq("active", true)
      .limit(1);
    if (data?.length) return data[0];
  }

  if (normTokens.includes("hanqi") && normTokens.includes("lyu")) {
    const { data } = await supabase
      .from("therapists")
      .select("code,name,aliases,active")
      .ilike("name", `%hanqi%`)
      .eq("active", true);
    const hit = (data || []).find(t => String(t.name || "").toLowerCase().includes("lyu"));
    if (hit) return hit;
  }

  return null;
}

/* ===== 查询未来72h可用时段，并附带咨询师姓名 ===== */
async function fetchSlotsWithNames(code, limit = 8, windowHours = 72) {
  const nowISO = new Date().toISOString();
  const untilISO = new Date(Date.now() + windowHours * 3600 * 1000).toISOString();

  let q = supabase
    .from("therapist_availability")
    .select("id, therapist_code, start_utc, end_utc")
    .eq("status", "open")
    .gt("start_utc", nowISO)
    .lt("start_utc", untilISO)
    .order("start_utc", { ascending: true })
    .limit(limit);

  if (code) q = q.eq("therapist_code", code);

  const { data: slots1 } = await q;

  let slots = Array.isArray(slots1) ? slots1 : [];

  if (!slots.length) {
    try {
      if (code) {
        const { data: t } = await supabase
          .from("therapists")
          .select("user_id, code, name")
          .eq("code", code)
          .maybeSingle();

        let therapistId = null;
        if (t?.user_id) {
          const { data: prof } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("user_id", String(t.user_id))
            .maybeSingle();
          therapistId = prof?.id || null;
        }

        if (therapistId) {
          const { data: slots2 } = await supabase
            .from("availability")
            .select("id, therapist_id, start_time, end_time, is_booked")
            .eq("therapist_id", therapistId)
            .eq("is_booked", false)
            .gt("start_time", nowISO)
            .lt("start_time", untilISO)
            .order("start_time", { ascending: true })
            .limit(limit);
          try {
            await supabase.from("ai_logs").insert({
              scope: "chat",
              ok: true,
              model: "none",
              payload: JSON.stringify({
                phase: "fallback_availability_by_code",
                requestedCode: code,
                therapistId,
                windowHours
              }),
              output: JSON.stringify({ count: (slots2 || []).length })
            });
          } catch {}


          slots = (slots2 || []).map(s => ({
            id: s.id,
            therapist_code: code,
            start_utc: s.start_time,
            end_utc: s.end_time
          }));
        }
      } else {
        const { data: slots2 } = await supabase
          .from("availability")
          .select("id, therapist_id, start_time, end_time, is_booked")
          .eq("is_booked", false)
          .gt("start_time", nowISO)
          .lt("start_time", untilISO)
          .order("start_time", { ascending: true })
          .limit(limit);

        const therapistIds = [...new Set((slots2 || []).map(s => s.therapist_id))];
        let codeByTid = {};
        if (therapistIds.length) {
          const { data: profs } = await supabase
            .from("user_profiles")
            .select("id, user_id")
            .in("id", therapistIds);
          const userIds = [...new Set((profs || []).map(p => p.user_id))];
          if (userIds.length) {
            const { data: ths } = await supabase
              .from("therapists")
              .select("user_id, code")
              .in("user_id", userIds);
            (profs || []).forEach(p => {
              const th = (ths || []).find(tt => String(tt.user_id) === String(p.user_id));
              if (th) codeByTid[p.id] = th.code;
            });
          }
        }

        slots = (slots2 || []).map(s => ({
          id: s.id,
          therapist_code: codeByTid[s.therapist_id] || DEFAULT_CODE,
          start_utc: s.start_time,
          end_utc: s.end_time
        }));

        try {
          await supabase.from("ai_logs").insert({
            scope: "chat",
            ok: true,
            model: "none",
            payload: JSON.stringify({
              phase: "fallback_availability_any",
              windowHours
            }),
            output: JSON.stringify({ count: (slots2 || []).length })
          });
        } catch {}
      }
    } catch {}
  }

  if (!slots.length) return [];

  const codes = [...new Set(slots.map(s => s.therapist_code))];
  const { data: ther } = await supabase
    .from("therapists")

    .select("code,name")
    .in("code", codes);

  const nameMap = {};
  ther?.forEach(t => (nameMap[t.code] = t.name));

  try {
    await supabase.from("ai_logs").insert({
      scope: "chat",
      ok: true,
      model: "none",
      payload: JSON.stringify({
        phase: "slots_result",
        requestedCode: code || null,
        windowHours,
        slotsCount: slots.length
      })
    });
  } catch {}

  return (slots || []).map(s => ({
    availabilityId: s.id,
    therapistCode: s.therapist_code,
    therapistName: nameMap[s.therapist_code] || "Therapist",
    startUTC: s.start_utc,
    endUTC: s.end_utc
  }));
}

async function logAILine(scope, entry = {}) {
  try {
    await supabase.from("ai_logs").insert({
      scope,
      ok: entry.ok ?? false,
      model: entry.model ?? "none",
      prompt_id: entry.promptId ?? null,
      payload: entry.payload ? (typeof entry.payload === "string" ? entry.payload : JSON.stringify(entry.payload)) : null,
      output: entry.output ? (typeof entry.output === "string" ? entry.output : JSON.stringify(entry.output)) : null,
      error: entry.error ? String(entry.error) : null
    });
  } catch {}
}
/* ===== 统一响应打包（兼容旧字段） ===== */
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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    userMessage,
    userId,
    therapistCode,
    browserTz = "UTC",
    lang = "zh-CN",
    actor = "user",
    targetUserId = null
  } = req.body || {};

  if (!userMessage || !userId) {
    const msg = lang.startsWith("zh")
      ? "可以先跟我说说最近在意的事，或告诉我一个时间范围（例如“明天下午”），我来帮你查看可预约时间。"
      : "Tell me what's on your mind, or share a time window (e.g., 'tomorrow afternoon') and I can check availability.";
    return res.status(200).json(compat(msg, []));
  }

  try {
    const greetings = /(你好|您好|hello|hi|嗨|在吗|hey)/i;
    let wantBooking = isBookingIntent(userMessage) && !greetings.test(userMessage);

    if (!wantBooking) {
      const findTherapistHard = /(找|约)\s*([a-z\u4e00-\u9fa5\. ]+)/i.test(String(userMessage) || "");
      if (findTherapistHard && !greetings.test(userMessage)) wantBooking = true;
    }
    try {
      await logAILine("chat", {
        ok: true,
        model: "none",
        payload: { phase: "intent_check", wantBooking, text: userMessage }
      });
    } catch {}


    if (wantBooking) {
      let resolved = null;
      try { resolved = await resolveTherapistFromText(userMessage); } catch {}
      const code = therapistCode || resolved?.code || DEFAULT_CODE;

      let options = await fetchSlotsWithNames(code, 8, 72);
      if (!options.length && code) {
        options = await fetchSlotsWithNames(code, 8, 96);
      }
      const opts = options.length ? options : await fetchSlotsWithNames(null, 8, 72);

      if (opts.length) {
        try {
          await logAILine("chat", {
            ok: true,
            model: "none",
            payload: { wantBooking: true, resolvedCode: code, requestedCode: therapistCode || null, optionsForCode: options.length, optionsFinal: opts.length }
          });
        } catch {}
        const text = lang.startsWith("zh")
          ? `已为您找到 ${opts.length} 个可预约时间，请选择：`
          : `I found ${opts.length} available time slots. Please pick one:`;
        const createEnabled = actor === "user" || !!targetUserId;
        return res.status(200).json(
          compat(text, [{ type: "TIME_CONFIRM", options: opts.map(o => ({ ...o, targetUserId })), createEnabled, targetUserId }])
        );
      }

      try {
        await logAILine("chat", {
          ok: true,
          model: "none",
          payload: { wantBooking: true, resolvedCode: code, requestedCode: therapistCode || null, optionsForCode: options.length, optionsFinal: 0 }
        });
      } catch {}
      const noSlot = lang.startsWith("zh")
        ? "当前时段暂无可约。可以换个时间范围（如“这周末下午”），我再帮你查。"
        : "No open slots in that window. Try another time range and I’ll check again.";
      return res.status(200).json(compat(noSlot, []));
    }

    const payload = { message: userMessage, context: { browserTz, lang } };
    try {
      const resp = await openai.responses.create(
        {
          model: "gpt-4o",
          input: [
            { role: "system", content: SYSTEM_PROMPT_USER },
            { role: "user", content: JSON.stringify(payload) }
          ],
          max_output_tokens: 600
        },
        { timeout: 12000 }
      );
      const text = resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? "");
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
