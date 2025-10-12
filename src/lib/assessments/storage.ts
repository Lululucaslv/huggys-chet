export type StoredAssessment = {
  id: string;
  type: "phq9" | "gad7";
  userId: string;
  score: number;
  answers: Record<string, number>;
  completedAt: string;
};

const STORAGE_KEY = "huggys_assessments";

export function saveAssessment(assessment: Omit<StoredAssessment, "id">): StoredAssessment {
  const stored = getAssessments();
  const newAssessment: StoredAssessment = {
    ...assessment,
    id: `${assessment.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  };
  stored.push(newAssessment);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return newAssessment;
}

export function getAssessments(filters?: {
  userId?: string;
  type?: "phq9" | "gad7";
  limit?: number;
}): StoredAssessment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let assessments: StoredAssessment[] = raw ? JSON.parse(raw) : [];
    
    if (filters?.userId) {
      assessments = assessments.filter(a => a.userId === filters.userId);
    }
    
    if (filters?.type) {
      assessments = assessments.filter(a => a.type === filters.type);
    }
    
    assessments.sort((a, b) => 
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
    
    if (filters?.limit) {
      assessments = assessments.slice(0, filters.limit);
    }
    
    return assessments;
  } catch {
    return [];
  }
}

export function clearAssessments() {
  localStorage.removeItem(STORAGE_KEY);
}
