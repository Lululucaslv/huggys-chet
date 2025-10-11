export type AssessmentPoint = { date: string; score: number };

export async function getAssessmentHistory(_p: {
  user_id: string;
  type: "phq9" | "gad7";
  limit?: number;
}): Promise<AssessmentPoint[]> {
  const now = new Date();
  const pts = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i) * 7);
    return {
      date: d.toISOString(),
      score: Math.max(0, Math.round(10 + Math.sin(i) * 3 + (i % 2) * 2))
    };
  });
  return pts;
}
