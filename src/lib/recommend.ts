import { catalog } from './catalog';
import type { Book } from './types';

export interface QuizAnswers {
  mood?: string;
  pace?: string;
  ending?: string;
}

/* Weighted match across all three answers (not just mood), with rating as a
   gentle tiebreaker. Returns the top `n` books. */
export function recommend(answers: QuizAnswers, n = 3): Book[] {
  const scored = catalog.map((b) => {
    let score = 0;
    if (answers.mood && b.mood && b.mood.includes(answers.mood)) score += 3;
    if (answers.pace && b.pace === answers.pace) score += 2;
    if (answers.ending && b.ending === answers.ending) score += 2;
    score += (Number(b.rating) || 0) * 0.1;
    return { b, score };
  });
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, n).map((x) => x.b);
}
