import { describe, expect, it, vi } from 'vitest';
import {
  buildBlurredLetters,
  getValidLettersByIndex,
  isWordComplete,
  type WordSet,
} from './wordLogic';

describe('wordLogic', () => {
  it('builds blurred letters with requested length', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const letters = buildBlurredLetters(3);
    expect(letters).toHaveLength(3);
    expect(letters.every((letter) => /^[a-z]$/.test(letter))).toBe(true);
    vi.restoreAllMocks();
  });

  it('collects valid letters for each index', () => {
    const wordSet: WordSet = { label: 'Test', words: ['rat', 'rag', 'ram'] };
    const [first, second, third] = getValidLettersByIndex(wordSet);
    expect(first.has('r')).toBe(true);
    expect(second.has('a')).toBe(true);
    expect(third.has('t')).toBe(true);
    expect(third.has('g')).toBe(true);
    expect(third.has('m')).toBe(true);
  });

  it('detects completed words from bucket letters', () => {
    const wordSet: WordSet = { label: 'Test', words: ['cat', 'cap', 'car'] };
    expect(isWordComplete(['c', 'a', 't'], wordSet)).toBe(true);
    expect(isWordComplete(['c', 'a', 'r'], wordSet)).toBe(true);
    expect(isWordComplete(['c', 'a', 'p'], wordSet)).toBe(true);
    expect(isWordComplete(['c', 'o', 't'], wordSet)).toBe(false);
    expect(isWordComplete(['c', null, 't'], wordSet)).toBe(false);
  });
});
