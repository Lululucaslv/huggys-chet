import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAssessmentHistory } from "../../lib/api/assessments";
import { LineSkeleton } from "../shared/Skeletons";
import { useAuthGate } from "../../lib/useAuthGate";
import { track } from "../../lib/analytics";

function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const w = 72;
  const h = 28;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / (max - min || 1)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-70">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function AssessmentCard({
  title,
  type
}: {
  title: string;
  type: "phq9" | "gad7";
}) {
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await getAssessmentHistory({
        user_id: "u_demo",
        type,
        limit: 6
      });
      setPoints(data.map((d) => d.score));
      setLoading(false);
    })();
  }, [type]);

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-4 bg-[var(--card)]">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium">{title}</h4>
        {loading ? (
          <LineSkeleton w={72} h={28} />
        ) : (
          <Sparkline points={points} />
        )}
      </div>
      <button
        className="h-9 px-3 rounded-[var(--radius-input)] border border-[var(--line)]"
        onClick={() => {
          const allowed = requireAuth({
            type: "ASSESSMENT_START",
            payload: {
              kind: type,
              onAllow: () => {
                track("assessment_start", { type });
                navigate(`/app/tests/${type}`);
              }
            }
          });
          if (allowed.allowed) {
            track("assessment_start", { type });
            navigate(`/app/tests/${type}`);
          }
        }}
      >
        Start
      </button>
    </div>
  );
}

export function AssessmentsSection() {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Quick assessments</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <AssessmentCard title="Depression (PHQ-9)" type="phq9" />
        <AssessmentCard title="Anxiety (GAD-7)" type="gad7" />
      </div>
    </div>
  );
}
