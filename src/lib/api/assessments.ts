import { getAssessments, saveAssessment, type StoredAssessment } from "../assessments/storage";

export type AssessmentPoint = { date: string; score: number };

const MOCK = true;

export async function getAssessmentHistory(p: {
  user_id: string;
  type: "phq9" | "gad7";
  limit?: number;
}): Promise<AssessmentPoint[]> {
  if (MOCK) {
    const stored = getAssessments({ userId: p.user_id, type: p.type, limit: p.limit || 10 });
    if (stored.length > 0) {
      return stored.map(a => ({ date: a.completedAt, score: a.score }));
    }
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
  
  return [];
}

export async function saveAssessmentResult(p: {
  user_id: string;
  type: "phq9" | "gad7";
  score: number;
  answers: Record<string, number>;
}): Promise<StoredAssessment> {
  if (MOCK) {
    return saveAssessment({
      userId: p.user_id,
      type: p.type,
      score: p.score,
      answers: p.answers,
      completedAt: new Date().toISOString()
    });
  }
  
  throw new Error("Real API not implemented");
}
