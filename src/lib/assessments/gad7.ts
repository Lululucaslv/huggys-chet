export type GAD7Question = {
  id: string;
  text: string;
};

export const GAD7_QUESTIONS: GAD7Question[] = [
  { id: "q1", text: "Feeling nervous, anxious, or on edge" },
  { id: "q2", text: "Not being able to stop or control worrying" },
  { id: "q3", text: "Worrying too much about different things" },
  { id: "q4", text: "Trouble relaxing" },
  { id: "q5", text: "Being so restless that it's hard to sit still" },
  { id: "q6", text: "Becoming easily annoyed or irritable" },
  { id: "q7", text: "Feeling afraid as if something awful might happen" }
];

export const GAD7_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" }
];

export type GAD7Answers = Record<string, number>;

export const GAD7_METADATA = {
  type: "gad7" as const,
  title: "GAD-7 Anxiety Assessment",
  description: "Over the last 2 weeks, how often have you been bothered by the following problems?",
  maxScore: 21,
  interpretations: [
    { range: [0, 4], severity: "Minimal", color: "green", description: "Minimal or no anxiety" },
    { range: [5, 9], severity: "Mild", color: "yellow", description: "Mild anxiety" },
    { range: [10, 14], severity: "Moderate", color: "orange", description: "Moderate anxiety" },
    { range: [15, 21], severity: "Severe", color: "red", description: "Severe anxiety" }
  ]
};
