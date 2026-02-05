// src/client/game/BucketGame.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildBlurredLetters,
  getValidLettersByIndex,
  isWordComplete,
  pickWordSet,
  type WordSet,
} from './wordLogic';

type FallingLetter = {
  id: string;
  char: string;
  x: number;
  y: number;
  speed: number;
  isDragging: boolean;
};

type GameSize = {
  width: number;
  height: number;
};

type BucketGameProps = {
  showHintImage?: boolean;
};

const LETTER_SIZE = 48;

// --- Layout constants (px) ---
const BUCKET_BOTTOM = 24;
const BUCKET_HEIGHT = 112; // h-28 (28*4)
const HINT_GAP_ABOVE_BUCKETS = 16;

const getId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Fit playfield within viewport without scrolling.
 * Clamped to keep UI stable across devices.
 */
const buildGameSize = (): GameSize => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  const outerPadding = 16;
  const maxHeight = Math.min(height - outerPadding * 2, 760);
  const isWide = width / height > 1.1;
  const maxWidth = Math.min(width - outerPadding * 2, isWide ? maxHeight * 1.18 : maxHeight * 0.86);

  return {
    width: Math.max(320, Math.round(maxWidth)),
    height: Math.max(520, Math.round(maxHeight)),
  };
};

const pickLetter = (targetSet: WordSet) => {
  const letters = targetSet.words.join('');
  if (Math.random() < 0.72) {
    return letters[Math.floor(Math.random() * letters.length)];
  }
  return String.fromCharCode(97 + Math.floor(Math.random() * 26));
};

export const BucketGame = ({ showHintImage = false }: BucketGameProps) => {
  const [wordSet, setWordSet] = useState<WordSet>(() => pickWordSet());
  const [blurredLetters, setBlurredLetters] = useState<string[]>(() =>
    buildBlurredLetters(wordSet.words[0].length),
  );
  const [letters, setLetters] = useState<FallingLetter[]>([]);
  const [buckets, setBuckets] = useState<(string | null)[]>(
    Array(wordSet.words[0].length).fill(null),
  );
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('');
  const [gameSize, setGameSize] = useState<GameSize>({ width: 480, height: 640 });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoverBucketIndex, setHoverBucketIndex] = useState<number | null>(null);

  const gameRef = useRef<HTMLDivElement | null>(null);
  const bucketRefs = useRef<Array<HTMLDivElement | null>>([]);
  const gameSizeRef = useRef(gameSize);

  // Falling speed multiplier (keep for future tuning).
  const [fallSpeedMultiplier] = useState(1);

  const validLettersByIndex = useMemo(() => getValidLettersByIndex(wordSet), [wordSet]);

  // Target display letters (existing effect).
  const displayLetters = useMemo(
    () =>
      blurredLetters.map((randomLetter, index) => {
        const bucketLetter = buckets[index];
        if (bucketLetter && validLettersByIndex[index].has(bucketLetter)) {
          return bucketLetter;
        }
        return randomLetter;
      }),
    [blurredLetters, buckets, validLettersByIndex],
  );

  const revealedIndexes = useMemo(
    () => buckets.map((letter, index) => Boolean(letter && validLettersByIndex[index].has(letter))),
    [buckets, validLettersByIndex],
  );

  // Hint position relative to the bucket box.
  const hintBottomPx = BUCKET_BOTTOM + BUCKET_HEIGHT + HINT_GAP_ABOVE_BUCKETS;

  useEffect(() => {
    const updateSize = () => {
      setGameSize((prev) => {
        const next = buildGameSize();
        gameSizeRef.current = next;

        // Keep existing falling letters proportionally positioned on resize.
        setLetters((current) =>
          current.map((letter) => ({
            ...letter,
            x: (letter.x / prev.width) * next.width,
            y: (letter.y / prev.height) * next.height,
          })),
        );

        return next;
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const spawnInterval = window.setInterval(() => {
      setLetters((prev) => {
        const next = {
          id: getId(),
          char: pickLetter(wordSet),
          x: Math.random() * (gameSizeRef.current.width - LETTER_SIZE),
          y: -LETTER_SIZE,
          speed: (1.2 + Math.random() * 1.8) * fallSpeedMultiplier,
          isDragging: false,
        };
        return [...prev, next].slice(-14);
      });
    }, 1200);

    return () => window.clearInterval(spawnInterval);
  }, [wordSet, fallSpeedMultiplier]);

  useEffect(() => {
    const fallInterval = window.setInterval(() => {
      setLetters((prev) =>
        prev
          .map((letter) => (letter.isDragging ? letter : { ...letter, y: letter.y + letter.speed }))
          .filter((letter) => letter.y < gameSizeRef.current.height + LETTER_SIZE),
      );
    }, 40);

    return () => window.clearInterval(fallInterval);
  }, []);

  useEffect(() => {
    if (!isWordComplete(buckets, wordSet)) return;

    setScore((prev) => prev + 10);
    setStatus('Nice! Word completed.');

    window.setTimeout(() => {
      startNewRound();
      setStatus('');
    }, 900);
  }, [buckets, wordSet]);

  useEffect(() => {
    if (!draggedId) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!gameRef.current) return;

      const bounds = gameRef.current.getBoundingClientRect();
      const nextX = Math.min(
        Math.max(event.clientX - bounds.left - dragOffset.x, 0),
        bounds.width - LETTER_SIZE,
      );
      const nextY = Math.min(
        Math.max(event.clientY - bounds.top - dragOffset.y, 0),
        bounds.height - LETTER_SIZE,
      );

      setLetters((prev) =>
        prev.map((letter) => (letter.id === draggedId ? { ...letter, x: nextX, y: nextY } : letter)),
      );

      // Hover feedback + slightly bigger effective drop zone
      const hitPad = 14;
      const hoverIndex = bucketRefs.current.findIndex((bucket) => {
        if (!bucket) return false;
        const rect = bucket.getBoundingClientRect();
        return (
          event.clientX >= rect.left - hitPad &&
          event.clientX <= rect.right + hitPad &&
          event.clientY >= rect.top - hitPad &&
          event.clientY <= rect.bottom + hitPad
        );
      });

      setHoverBucketIndex(hoverIndex === -1 ? null : hoverIndex);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!gameRef.current) return;

      const hitPad = 14;
      const dropTargetIndex = bucketRefs.current.findIndex((bucket) => {
        if (!bucket) return false;
        const rect = bucket.getBoundingClientRect();
        return (
          event.clientX >= rect.left - hitPad &&
          event.clientX <= rect.right + hitPad &&
          event.clientY >= rect.top - hitPad &&
          event.clientY <= rect.bottom + hitPad
        );
      });

      if (dropTargetIndex !== -1 && !buckets[dropTargetIndex]) {
        const draggedLetter = letters.find((letter) => letter.id === draggedId);
        const isValidDrop = draggedLetter
          ? validLettersByIndex[dropTargetIndex].has(draggedLetter.char)
          : false;

        if (draggedLetter && isValidDrop) {
          setBuckets((prev) =>
            prev.map((slot, slotIndex) => (slotIndex === dropTargetIndex ? draggedLetter.char : slot)),
          );
          setLetters((prev) => prev.filter((letter) => letter.id !== draggedId));
        } else {
          setLetters((prev) =>
            prev.map((letter) =>
              letter.id === draggedId ? { ...letter, isDragging: false } : letter,
            ),
          );
        }
      } else {
        setLetters((prev) =>
          prev.map((letter) =>
            letter.id === draggedId ? { ...letter, isDragging: false } : letter,
          ),
        );
      }

      setDraggedId(null);
      setHoverBucketIndex(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [buckets, dragOffset.x, dragOffset.y, draggedId, letters, validLettersByIndex]);

  const handlePointerDown = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (!gameRef.current) return;

    const bounds = gameRef.current.getBoundingClientRect();
    const letter = letters.find((item) => item.id === id);
    if (!letter) return;

    setDraggedId(id);
    setDragOffset({
      x: event.clientX - bounds.left - letter.x,
      y: event.clientY - bounds.top - letter.y,
    });

    setLetters((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isDragging: true } : item)),
    );
  };

  const startNewRound = () => {
    const nextSet = pickWordSet();
    setWordSet(nextSet);
    setBlurredLetters(buildBlurredLetters(nextSet.words[0].length));
    setBuckets(Array(nextSet.words[0].length).fill(null));
    setLetters([]);
  };

  // NOTE: still used programmatically (e.g., you might wire a button later), but icon removed.
  const handleReset = () => {
    startNewRound();
    setStatus('');
  };

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 p-3 text-white sm:p-4">
      <div className="flex w-full max-w-5xl flex-col items-center">
        <section
          ref={gameRef}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-800/90 via-slate-900/90 to-slate-950/90 shadow-2xl"
          style={{ width: `${gameSize.width}px`, height: `${gameSize.height}px` }}
        >
          {/* App title + description */}
          <div className="pointer-events-none absolute left-1/2 top-4 w-[92%] -translate-x-1/2 text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400 sm:text-sm">
              Bucket Sorter
            </p>
            <h1 className="mt-1 text-base font-semibold leading-tight sm:text-xl">
              Build the word before the letters drop!
            </h1>
            <p className="mt-1 hidden text-xs text-slate-300 sm:block">
              Drag the falling letters into the buckets to spell a valid word. Score points for each correct word.
            </p>
          </div>

          {/* Responsive HUD: smaller in mobile; prevents overflow */}
          <div className="absolute left-3 right-3 top-20 sm:left-6 sm:right-6 sm:top-5">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-start sm:justify-between sm:gap-4">
              {/* Target */}
              <div className="min-w-0 rounded-2xl bg-white/10 px-3 py-2 text-sm sm:px-4 sm:py-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-300 sm:text-xs">
                  Target
                </div>

                <div className="mt-2 flex min-w-0 items-center gap-2">
                  {/* Wrap and clamp so it never overflows the box (desktop + mobile) */}
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {displayLetters.map((letter, index) => (
                      <span
                        key={`target-${letter}-${index}`}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg font-semibold text-white transition sm:h-11 sm:w-11 sm:text-xl ${
                          revealedIndexes[index] ? 'bg-white/20' : 'bg-white/10 blur-sm'
                        }`}
                      >
                        {letter.toUpperCase()}
                      </span>
                    ))}
                  </div>

                  {showHintImage ? (
                    <img
                      className="hidden h-14 w-14 shrink-0 rounded-xl border border-white/20 bg-white/10 object-cover sm:block"
                      src="/hint-placeholder.svg"
                      alt="Hint placeholder"
                    />
                  ) : null}
                </div>
              </div>

              {/* Score (no refresh icon in any view) */}
              <div className="min-w-0 rounded-2xl bg-white/10 px-3 py-2 text-sm sm:px-4 sm:py-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-300 sm:text-xs">
                  Score
                </div>
                <div className="mt-2 text-2xl font-semibold leading-none sm:text-2xl">{score}</div>
              </div>
            </div>
          </div>

          {/* Falling letters */}
          <div className="absolute inset-0">
            {letters.map((letter) => (
              <div
                key={letter.id}
                onPointerDown={(event) => handlePointerDown(letter.id, event)}
                className="absolute flex h-12 w-12 cursor-grab touch-none items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl font-semibold text-white shadow-lg backdrop-blur active:cursor-grabbing"
                style={{
                  left: `${letter.x}px`,
                  top: `${letter.y}px`,
                  zIndex: letter.isDragging ? 20 : 1,
                }}
              >
                {letter.char.toUpperCase()}
              </div>
            ))}
          </div>

          {/* Hint (just above buckets) */}
          <div
            className="absolute left-1/2 w-[92%] -translate-x-1/2 text-center text-sm text-slate-200"
            style={{ bottom: hintBottomPx }}
          >
            {status || `Hint: words are like ${wordSet.words.join(', ')}.`}
          </div>

          {/* Buckets */}
          <div
            className="absolute left-1/2 flex w-[92%] -translate-x-1/2 justify-between gap-3"
            style={{ bottom: BUCKET_BOTTOM }}
          >
            {buckets.map((bucket, index) => {
              const isHovering = Boolean(draggedId) && hoverBucketIndex === index;
              const isFilled = Boolean(bucket);
              return (
                <div
                  key={`bucket-${index}`}
                  ref={(node) => {
                    bucketRefs.current[index] = node;
                  }}
                  className={[
                    'flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed bg-white/5 text-center text-sm transition',
                    'h-28', // matches BUCKET_HEIGHT
                    isHovering ? 'border-white/50 bg-white/10' : 'border-white/20',
                    isFilled ? 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : '',
                  ].join(' ')}
                >
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-300">
                    Bucket {index + 1}
                  </span>
                  <span className="text-3xl font-semibold text-white sm:text-4xl">
                    {bucket ? bucket.toUpperCase() : '?'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* keep for future use; not shown */}
        <button onClick={handleReset} className="hidden" aria-hidden="true" tabIndex={-1}>
          reset
        </button>
      </div>
    </div>
  );
};
