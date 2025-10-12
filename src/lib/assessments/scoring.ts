import { PHQ9_METADATA } from "./phq9";
import { GAD7_METADATA } from "./gad7";

export type AssessmentType = "phq9" | "gad7";

export function calculateScore(answers: Record<string, number>): number {
  return Object.values(answers).reduce((sum, val) => sum + val, 0);
}

export function getInterpretation(type: AssessmentType, score: number) {
  const metadata = type === "phq9" ? PHQ9_METADATA : GAD7_METADATA;
  const interp = metadata.interpretations.find(
    (i) => score >= i.range[0] && score <= i.range[1]
  );
  return interp || metadata.interpretations[0];
}

export function getRecommendations(type: AssessmentType, score: number): string[] {
  const interp = getInterpretation(type, score);
  
  if (interp.severity === "Minimal") {
    return [
      "Your responses suggest minimal symptoms.",
      "Continue to monitor your mental health and practice self-care.",
      "Consider speaking with a therapist if symptoms worsen."
    ];
  }
  
  if (interp.severity === "Mild") {
    return [
      "Your responses suggest mild symptoms.",
      "Consider lifestyle changes like regular exercise and good sleep habits.",
      "Speaking with a therapist could be beneficial.",
      "Monitor your symptoms over time."
    ];
  }
  
  if (interp.severity === "Moderate") {
    return [
      "Your responses suggest moderate symptoms.",
      "We recommend scheduling a consultation with a mental health professional.",
      "Treatment options like therapy can be very effective.",
      "Continue tracking your symptoms."
    ];
  }
  
  return [
    "Your responses suggest significant symptoms.",
    "We strongly recommend consulting with a mental health professional soon.",
    "Professional treatment can make a significant difference.",
    "If you're in crisis, please contact emergency services immediately."
  ];
}
