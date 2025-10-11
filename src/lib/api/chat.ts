export async function getLatestThreadSummary(_p: {
  user_id: string;
}): Promise<{ title: string; lastAt: string; snippet: string } | null> {
  return {
    title: "Coping with work stress",
    lastAt: new Date().toISOString(),
    snippet: "We discussed breathing exercises and scheduling boundaries…"
  };
}
