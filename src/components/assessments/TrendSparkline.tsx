import { useEffect, useState } from "react";
import { getAssessmentHistory, type AssessmentPoint } from "@/lib/api/assessments";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LineSkeleton } from "@/components/shared/Skeletons";

type Props = {
  type: "phq9" | "gad7";
};

export function TrendSparkline({ type }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<AssessmentPoint[]>([]);

  useEffect(() => {
    if (!user) return;
    
    (async () => {
      setLoading(true);
      try {
        const data = await getAssessmentHistory({ user_id: user.id, type, limit: 10 });
        setPoints(data);
      } catch (error) {
        console.error("Failed to load assessment history:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, type]);

  if (loading) {
    return <LineSkeleton h={120} />;
  }

  if (points.length === 0) {
    return (
      <div className="text-center text-[var(--muted)] py-8">
        No previous assessments found. Complete more assessments to see your trend.
      </div>
    );
  }

  const maxScore = type === "phq9" ? 27 : 21;
  const w = 600;
  const h = 120;
  const padding = 20;

  const xStep = (w - padding * 2) / (points.length - 1 || 1);
  const yScale = (h - padding * 2) / maxScore;

  const pathData = points
    .map((p, i) => {
      const x = padding + i * xStep;
      const y = h - padding - p.score * yScale;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="space-y-4">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="border border-[var(--line)] rounded">
        <path
          d={pathData}
          fill="none"
          stroke="var(--brand-600)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const x = padding + i * xStep;
          const y = h - padding - p.score * yScale;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill="var(--brand-600)"
              stroke="white"
              strokeWidth="2"
            />
          );
        })}
        <line
          x1={padding}
          y1={h - padding}
          x2={w - padding}
          y2={h - padding}
          stroke="var(--line)"
          strokeWidth="1"
        />
      </svg>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs text-[var(--muted)]">
        {points.slice(0, 8).map((p, i) => (
          <div key={i}>
            <div className="font-medium">Score: {p.score}</div>
            <div>{new Date(p.date).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
