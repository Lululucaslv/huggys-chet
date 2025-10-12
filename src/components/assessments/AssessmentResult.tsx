import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PHQ9_METADATA } from "../../lib/assessments/phq9";
import { GAD7_METADATA } from "../../lib/assessments/gad7";
import { getInterpretation, getRecommendations } from "../../lib/assessments/scoring";
import { track } from "../../lib/analytics";
import { TrendSparkline } from "./TrendSparkline";

export function AssessmentResult() {
  const { type } = useParams<{ type: "phq9" | "gad7" }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const score = parseInt(searchParams.get("score") || "0");

  useEffect(() => {
    if (type) {
      track("assessment_result_view", { type, score });
    }
  }, [type, score]);

  if (!type || (type !== "phq9" && type !== "gad7")) {
    return <div>Invalid assessment type</div>;
  }

  const metadata = type === "phq9" ? PHQ9_METADATA : GAD7_METADATA;
  const interpretation = getInterpretation(type, score);
  const recommendations = getRecommendations(type, score);

  const severityColors: Record<string, string> = {
    green: "text-green-700 bg-green-50 border-green-200",
    yellow: "text-yellow-700 bg-yellow-50 border-yellow-200",
    orange: "text-orange-700 bg-orange-50 border-orange-200",
    red: "text-red-700 bg-red-50 border-red-200",
    darkred: "text-red-900 bg-red-100 border-red-300"
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{metadata.title} Results</h2>
        <p className="text-[var(--muted)]">Completed {new Date().toLocaleDateString()}</p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-6 bg-[var(--card)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-4xl font-bold">{score}</div>
            <div className="text-sm text-[var(--muted)]">out of {metadata.maxScore}</div>
          </div>
          <div className={`px-4 py-2 rounded-full border ${severityColors[interpretation.color]}`}>
            <span className="font-medium">{interpretation.severity}</span>
          </div>
        </div>
        <p className="text-[var(--muted)]">{interpretation.description}</p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-6 bg-[var(--card)]">
        <h3 className="font-semibold mb-4">Recommendations</h3>
        <ul className="space-y-2">
          {recommendations.map((rec: string, idx: number) => (
            <li key={idx} className="flex gap-2">
              <span className="text-[var(--brand-600)]">•</span>
              <span className="text-sm">{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-6 bg-[var(--card)]">
        <h3 className="font-semibold mb-4">Your Trend</h3>
        <TrendSparkline type={type} />
      </div>

      <div className="rounded-[var(--radius-card)] border border-yellow-200 p-4 bg-yellow-50">
        <p className="text-sm text-yellow-900">
          <strong>Important:</strong> This is a screening tool, not a diagnosis. 
          Please consult with a mental health professional to discuss your results and treatment options.
        </p>
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => navigate("/app/tests")}
          className="h-10 px-4 rounded-[var(--radius-input)] border border-[var(--line)]
                     hover:bg-gray-50 transition-colors"
        >
          Back to Assessments
        </button>
        <button
          onClick={() => navigate("/app")}
          className="h-10 px-6 rounded-[var(--radius-input)] bg-[var(--brand-600)] text-white font-medium
                     hover:bg-[var(--brand-500)] transition-colors
                     focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
