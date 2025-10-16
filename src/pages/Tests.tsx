import { Routes, Route } from "react-router-dom";
import { AssessmentStart } from "../components/assessments/AssessmentStart";
import { AssessmentForm } from "../components/assessments/AssessmentForm";
import { AssessmentResult } from "../components/assessments/AssessmentResult";
import MotionSection from "../components/MotionSection";

export default function Tests() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <h1 className="text-xl font-semibold">Mental Health Assessments</h1>
        </div>
      </header>

      <MotionSection as="main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" variant="fadeUp">
        <Routes>
          <Route index element={<AssessmentStart />} />
          <Route path=":type" element={<AssessmentForm />} />
          <Route path=":type/result" element={<AssessmentResult />} />
        </Routes>
      </MotionSection>
    </div>
  );
}
