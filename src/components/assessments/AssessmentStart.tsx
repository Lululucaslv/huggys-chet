import { useAuthGate } from "../../lib/useAuthGate";
import { track } from "../../lib/analytics";
import { useNavigate } from "react-router-dom";

type AssessmentCardProps = {
  type: "phq9" | "gad7";
  title: string;
  description: string;
  duration: string;
};

function AssessmentCard({ type, title, description, duration }: AssessmentCardProps) {
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();

  const handleStart = () => {
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
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-6 bg-[var(--card)]">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted)] mb-4">{description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--muted)]">{duration}</span>
        <button
          onClick={handleStart}
          className="h-10 px-4 rounded-[var(--radius-input)] bg-[var(--brand-600)] text-white font-medium
                     hover:bg-[var(--brand-500)] transition-colors
                     focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]"
        >
          Start Assessment
        </button>
      </div>
    </div>
  );
}

export function AssessmentStart() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Mental Health Assessments</h2>
        <p className="text-[var(--muted)]">
          Take a standardized assessment to track your mental health over time.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AssessmentCard
          type="phq9"
          title="PHQ-9 Depression"
          description="Patient Health Questionnaire for depression screening"
          duration="~2 minutes"
        />
        <AssessmentCard
          type="gad7"
          title="GAD-7 Anxiety"
          description="Generalized Anxiety Disorder scale"
          duration="~2 minutes"
        />
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-4 bg-[var(--card)]">
        <p className="text-sm text-[var(--muted)]">
          <strong>Note:</strong> These assessments are screening tools, not diagnostic instruments.
          Results should be discussed with a qualified mental health professional.
        </p>
      </div>
    </div>
  );
}
