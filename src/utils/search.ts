/** Splits what the user typed into lower-case words ("  Minal  DHO " → ["minal", "dho"]). */
export function searchWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** Case-insensitive; every typed word must appear somewhere in the text ("minal dho" finds "Minal Dhote"). */
export function matchesSearch(text: string, words: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return words.every((word) => lower.includes(word));
}
