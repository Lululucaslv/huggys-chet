export type PHQ9Question = {
  id: string;
  text: string;
};

export const PHQ9_QUESTIONS: PHQ9Question[] = [
  { id: "q1", text: "Little interest or pleasure in doing things" },
  { id: "q2", text: "Feeling down, depressed, or hopeless" },
  { id: "q3", text: "Trouble falling/staying asleep, or sleeping too much" },
  { id: "q4", text: "Feeling tired or having little energy" },
  { id: "q5", text: "Poor appetite or overeating" },
  { id: "q6", text: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down" },
  { id: "q7", text: "Trouble concentrating on things, such as reading the newspaper or watching television" },
  { id: "q8", text: "Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual" },
  { id: "q9", text: "Thoughts that you would be better off dead, or of hurting yourself in some way" }
];

export const PHQ9_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" }
];

export type PHQ9Answers = Record<string, number>;

export const PHQ9_METADATA = {
  type: "phq9" as const,
  title: "PHQ-9 Depression Assessment",
  description: "Over the last 2 weeks, how often have you been bothered by the following problems?",
  maxScore: 27,
  interpretations: [
    { range: [0, 4], severity: "Minimal", color: "green", description: "Minimal or no depression" },
    { range: [5, 9], severity: "Mild", color: "yellow", description: "Mild depression" },
    { range: [10, 14], severity: "Moderate", color: "orange", description: "Moderate depression" },
    { range: [15, 19], severity: "Moderately Severe", color: "red", description: "Moderately severe depression" },
    { range: [20, 27], severity: "Severe", color: "darkred", description: "Severe depression" }
  ]
};
