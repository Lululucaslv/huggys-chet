import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PHQ9_QUESTIONS, PHQ9_OPTIONS, PHQ9_METADATA } from "@/lib/assessments/phq9";
import { GAD7_QUESTIONS, GAD7_OPTIONS, GAD7_METADATA } from "@/lib/assessments/gad7";
import { calculateScore } from "@/lib/assessments/scoring";
import { saveAssessmentResult } from "@/lib/api/assessments";
import { useAuth } from "@/lib/auth/AuthProvider";
import { track } from "@/lib/analytics";

export function AssessmentForm() {
  const { type } = useParams<{ type: "phq9" | "gad7" }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!type || (type !== "phq9" && type !== "gad7")) {
    return <div>Invalid assessment type</div>;
  }

  const metadata = type === "phq9" ? PHQ9_METADATA : GAD7_METADATA;
  const questions = type === "phq9" ? PHQ9_QUESTIONS : GAD7_QUESTIONS;
  const options = type === "phq9" ? PHQ9_OPTIONS : GAD7_OPTIONS;

  const allAnswered = questions.every((q: { id: string }) => answers[q.id] !== undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered || !user) return;

    setSubmitting(true);
    try {
      const score = calculateScore(answers);
      await saveAssessmentResult({
        user_id: user.id,
        type,
        score,
        answers
      });
      track("assessment_submit", { type, score });
      navigate(`/app/tests/${type}/result?score=${score}`);
    } catch (error) {
      console.error("Failed to save assessment:", error);
      alert("Failed to save assessment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{metadata.title}</h2>
        <p className="text-[var(--muted)]">{metadata.description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((question: { id: string; text: string }, idx: number) => (
          <div key={question.id} className="rounded-[var(--radius-card)] border border-[var(--line)] p-4 bg-[var(--card)]">
            <div className="mb-3">
              <span className="text-sm text-[var(--muted)] mr-2">{idx + 1}.</span>
              <span className="font-medium">{question.text}</span>
            </div>
            <div className="space-y-2">
              {options.map((option: { value: number; label: string }) => (
                <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name={question.id}
                    value={option.value}
                    checked={answers[question.id] === option.value}
                    onChange={() => setAnswers(prev => ({ ...prev, [question.id]: option.value }))}
                    className="h-4 w-4 text-[var(--brand-600)] focus:ring-[var(--brand-400)]"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={() => navigate("/app/tests")}
            className="h-10 px-4 rounded-[var(--radius-input)] border border-[var(--line)]
                       hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!allAnswered || submitting}
            className="h-10 px-6 rounded-[var(--radius-input)] bg-[var(--brand-600)] text-white font-medium
                       hover:bg-[var(--brand-500)] transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]"
          >
            {submitting ? "Submitting..." : "Submit Assessment"}
          </button>
        </div>
      </form>
    </div>
  );
}
