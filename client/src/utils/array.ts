/**
 * Fisher-Yates shuffle algorithm.
 * Returns a new shuffled array without mutating the original.
 * 
 * @param array - The array to shuffle
 * @param rng - Optional random number generator function (defaults to Math.random)
 * @returns A new array with elements in random order
 */
export function shuffleArray<T>(array: T[], rng: () => number = Math.random): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
