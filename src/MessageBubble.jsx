import React, { useState } from "react";
import { createBooking } from "./utils/api"; // 已在 src/utils/api.js 提供

// —— 小工具：UTC -> 本地可读
const fmtLocal = (iso) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

/**
 * TIME_CONFIRM 渲染块
 * props:
 *  - options: [{ availabilityId, therapistCode, startUTC, endUTC }]
 *  - userId: 当前用户 id（若未传，则尝试从 localStorage.userId 读取）
 *  - therapistCode: 兜底用（若 option 里没带）
 *  - onBooked: (booking) => void 预约成功回调（父组件可用来追加“预约成功”气泡）
 */
function TimeConfirm({ options = [], userId, therapistCode, onBooked, createEnabled = true, targetUserId = null }) {
  const [busyId, setBusyId] = useState(null);
  const [status, setStatus] = useState(null); // 'ok' | 'conflict' | 'error'

  if (!options.length) return null;

  const realUserId =
    userId ||
    (typeof window !== "undefined" && (localStorage.getItem("userId") || localStorage.getItem("uid"))) ||
    "";

  const pick = async (opt) => {
    if (!createEnabled) return;
    const uid = targetUserId || realUserId;
    if (!uid) {
      setStatus("error");
      return;
    }
    setBusyId(opt.availabilityId);
    setStatus(null);
    try {
      const res = await createBooking({
        availabilityId: opt.availabilityId,
        therapistCode: opt.therapistCode || therapistCode,
        userId: uid,
        startUTC: opt.startUTC,
      });
      if (res?.booking) {
        setStatus("ok");
        setBusyId(null);
        onBooked && onBooked(res.booking);
      } else if (String(res?.error || "").includes("slot_unavailable") || res?.status === 409) {
        setStatus("conflict");
        setBusyId(null);
      } else {
        setStatus("error");
        setBusyId(null);
      }
    } catch {
      setStatus("error");
      setBusyId(null);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.availabilityId}
            onClick={() => pick(opt)}
            disabled={busyId === opt.availabilityId || !createEnabled}
            className={`px-3 py-1 rounded-lg text-white ${
              busyId === opt.availabilityId || !createEnabled ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:opacity-90"
            }`}
            title={opt.startUTC}
          >
            {opt.therapistName ? `${opt.therapistName} — ${fmtLocal(opt.startUTC)}` : fmtLocal(opt.startUTC)}
          </button>
        ))}
      </div>

      {status === "ok" && (
        <div className="text-green-500 text-sm mt-2">预约成功！我已为你锁定该时间。</div>
      )}
      {status === "conflict" && (
        <div className="text-yellow-400 text-sm mt-2">刚刚被别人抢订了 😥 请再选一个时间。</div>
      )}
      {status === "error" && (
        <div className="text-red-400 text-sm mt-2">预约失败，请重试或换个时间范围。</div>
      )}
    </div>
  );
}

/**
 * 原有消息气泡 + TIME_CONFIRM 区块
 * 新增 props:
 *  - userId: 当前用户 id
 *  - therapistCode: 当前/默认咨询师 code（可不传，option 内带了也可以）
 *  - onBooked: 预约成功回调
 */
const MessageBubble = ({ message, isSelf, userId, therapistCode, onBooked }) => {
  const containerClass = `flex mb-3 ${isSelf ? "justify-end" : "justify-start"}`;
  const bubbleClass = `max-w-[75%] break-words rounded-2xl px-4 py-2 shadow ${
    isSelf ? "bg-blue-500 text-white rounded-br-none" : "bg-white text-gray-900 rounded-bl-none"
  }`;

  // 从消息对象里拿 TIME_CONFIRM 结构化块
  const tcBlock = Array.isArray(message?.toolResults)
    ? message.toolResults.find((b) => b?.type === "TIME_CONFIRM")
    : null;

  return (
    <div className={containerClass}>
      {!isSelf && (
        <img
          src={message.avatar || "/ai-avatar.png"}
          alt="AI头像"
          className="w-8 h-8 rounded-full mr-2 self-end"
          loading="lazy"
        />
      )}

      <div className={bubbleClass}>
        {/* 图片消息（保持你原有逻辑） */}
        {message.imageBase64 && (
          <img
            src={message.imageBase64}
            className="max-w-full rounded-lg cursor-pointer"
            onClick={() => window.open(message.imageBase64, "_blank")}
            loading="lazy"
          />
        )}

        {/* 文本内容 */}
        {message.content && <span>{message.content}</span>}

        {/* TIME_CONFIRM 芯片（有就渲染） */}
        {tcBlock && (
          <TimeConfirm
            options={Array.isArray(tcBlock.options) ? tcBlock.options : []}
            userId={userId}
            therapistCode={therapistCode}
            onBooked={onBooked}
            createEnabled={tcBlock.createEnabled !== false}
            targetUserId={tcBlock.targetUserId || null}
          />
        )}

        {/* 时间戳（保持你原样式） */}
        {message.time && (
          <div className="text-xs text-gray-400 mt-1 text-right">{message.time}</div>
        )}
      </div>

      {isSelf && (
        <img
          src={message.avatar || "/user-avatar.png"}
          alt="用户头像"
          className="w-8 h-8 rounded-full ml-2 self-end"
          loading="lazy"
        />
      )}
    </div>
  );
};

export default MessageBubble;
