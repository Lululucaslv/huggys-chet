import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLatestThreadSummary } from "../../lib/api/chat";
import { LineSkeleton } from "../shared/Skeletons";
import { useAuthGate } from "../../lib/useAuthGate";
import { track } from "../../lib/analytics";

export function ContinueChatCard() {
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    title: string;
    lastAt: string;
    snippet: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getLatestThreadSummary({ user_id: "u_demo" });
      setData(res);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LineSkeleton h={80} />;
  if (!data) return null;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-4 bg-[var(--card)]">
      <div className="text-sm text-[var(--muted)] mb-1">Continue chat</div>
      <div className="font-medium">{data.title}</div>
      <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">
        {data.snippet}
      </p>
      <button
        className="mt-3 h-9 px-3 rounded-[var(--radius-input)] border border-[var(--line)]"
        onClick={() => {
          const allowed = requireAuth({
            type: "CHAT_CONTINUE",
            payload: {
              onAllow: () => {
                track("chat_continue", {});
                navigate("/chat");
              }
            }
          });
          if (allowed.allowed) {
            track("chat_continue", {});
            navigate("/chat");
          }
        }}
      >
        AI Chat
      </button>
    </div>
  );
}
