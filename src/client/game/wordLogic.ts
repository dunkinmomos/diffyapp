export type WordSet = {
  label: string;
  words: string[];
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

export const WORD_SETS: WordSet[] = [
  { label: 'R* words', words: ['rat', 'rag', 'ram'] },
  { label: 'C* words', words: ['cat', 'cap', 'car'] },
  { label: 'H* words', words: ['hat', 'ham', 'has'] },
  { label: 'M* words', words: ['map', 'man', 'mad'] },
  { label: 'B* words', words: ['bed', 'bee', 'beg'] },
  { label: 'P* words', words: ['pen', 'pet', 'peg'] },
  { label: 'F* words', words: ['fox', 'fog', 'for'] },
  { label: 'J* words', words: ['jar', 'jam', 'jaw'] },
  { label: 'B* words (u)', words: ['bug', 'bun', 'but'] },
];

export const pickWordSet = () => WORD_SETS[Math.floor(Math.random() * WORD_SETS.length)];

export const buildBlurredLetters = (length: number) =>
  Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);

export const getValidLettersByIndex = (wordSet: WordSet) =>
  wordSet.words[0].split('').map((_, index) =>
    new Set(wordSet.words.map((word) => word[index])),
  );

export const isWordComplete = (buckets: Array<string | null>, wordSet: WordSet) => {
  if (buckets.some((slot) => slot === null)) {
    return false;
  }
  return wordSet.words.includes(buckets.join(''));
};
