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

const getId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildGameSize = (): GameSize => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isWide = width / height > 1.1;
  const maxHeight = Math.min(height * 0.68, 620);
  const maxWidth = Math.min(width * 0.92, isWide ? maxHeight * 1.1 : maxHeight * 0.78);
  return {
    width: Math.max(300, Math.round(maxWidth)),
    height: Math.max(460, Math.round(maxHeight)),
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
  const gameRef = useRef<HTMLDivElement | null>(null);
  const bucketRefs = useRef<Array<HTMLDivElement | null>>([]);
  const gameSizeRef = useRef(gameSize);
  const lineYRef = useRef(0);

  // Falling speed multiplier.
  // Example: set to 0.6 for slower letters, 1.0 for default, 1.5 for faster.
  // You can wire this to a difficulty control later if desired.
  const [fallSpeedMultiplier] = useState(1);

  const validLettersByIndex = useMemo(() => getValidLettersByIndex(wordSet), [wordSet]);

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
    () =>
      buckets.map((letter, index) =>
        Boolean(letter && validLettersByIndex[index].has(letter)),
      ),
    [buckets, validLettersByIndex],
  );

  const layoutMetrics = useMemo(() => {
    const bucketBottom = 16;
    const bucketsHeight = 96;
    const hintGap = 8;
    const hintHeight = 20;
    const lineGap = 8;
    const lineY =
      gameSize.height - (bucketBottom + bucketsHeight + hintGap + hintHeight + lineGap);
    return {
      bucketBottom,
      bucketsHeight,
      hintY: gameSize.height - (bucketBottom + bucketsHeight + hintGap + hintHeight),
      lineY,
      statusY: lineY - 24,
    };
  }, [gameSize.height]);

  useEffect(() => {
    lineYRef.current = layoutMetrics.lineY;
  }, [layoutMetrics.lineY]);

  useEffect(() => {
    const updateSize = () => {
      setGameSize((prev) => {
        const next = buildGameSize();
        gameSizeRef.current = next;
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
          .map((letter) =>
            letter.isDragging
              ? letter
              : {
                  ...letter,
                  y: letter.y + letter.speed,
                },
          )
          .filter((letter) =>
            letter.isDragging
              ? true
              : letter.y < lineYRef.current + LETTER_SIZE,
          ),
      );
    }, 40);

    return () => window.clearInterval(fallInterval);
  }, []);

  useEffect(() => {
    if (!isWordComplete(buckets, wordSet)) {
      return;
    }
    setScore((prev) => prev + 10);
    setStatus('Nice! Word completed.');
    window.setTimeout(() => {
      startNewRound();
      setStatus('');
    }, 900);
  }, [buckets, wordSet]);

  useEffect(() => {
    if (!draggedId) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!gameRef.current) {
        return;
      }
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
        prev.map((letter) =>
          letter.id === draggedId
            ? {
                ...letter,
                x: nextX,
                y: nextY,
              }
            : letter,
        ),
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!gameRef.current) {
        return;
      }
      const dropTargetIndex = bucketRefs.current.findIndex((bucket) => {
        if (!bucket) {
          return false;
        }
        const rect = bucket.getBoundingClientRect();
        return (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
      });

      if (dropTargetIndex !== -1 && !buckets[dropTargetIndex]) {
        const draggedLetter = letters.find((letter) => letter.id === draggedId);
        const isValidDrop = draggedLetter
          ? validLettersByIndex[dropTargetIndex].has(draggedLetter.char)
          : false;
        if (draggedLetter && isValidDrop) {
          setBuckets((prev) =>
            prev.map((slot, slotIndex) =>
              slotIndex === dropTargetIndex ? draggedLetter.char : slot,
            ),
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
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [buckets, dragOffset.x, dragOffset.y, draggedId, letters, validLettersByIndex]);

  const handlePointerDown = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (!gameRef.current) {
      return;
    }
    const bounds = gameRef.current.getBoundingClientRect();
    const letter = letters.find((item) => item.id === id);
    if (!letter) {
      return;
    }
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

  const handleReset = () => {
    startNewRound();
    setStatus('');
  };

  return (
    <div className="flex h-dvh items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-3 text-white">
      <div className="flex w-full max-w-5xl flex-col items-center gap-3">
        <header className="flex w-full flex-col items-center gap-2 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Bucket Sorter</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Build the word before the letters drop!</h1>
          <p className="text-sm text-slate-300">
            Drag the falling letters into the buckets to spell a valid word. Score points for each
            correct word.
          </p>
        </header>

        <section
          ref={gameRef}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-800/90 via-slate-900/90 to-slate-950/90 shadow-2xl"
          style={{ width: `${gameSize.width}px`, height: `${gameSize.height}px` }}
        >
          <div className="absolute left-5 right-5 top-4 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Target</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  {displayLetters.map((letter, index) => (
                    <span
                      key={`target-${letter}-${index}`}
                      className={`rounded-lg px-2 py-1 text-white transition ${
                        revealedIndexes[index] ? 'bg-white/20' : 'bg-white/10 blur-sm'
                      }`}
                    >
                      {letter.toUpperCase()}
                    </span>
                  ))}
                </div>
                {showHintImage ? (
                  <img
                    className="h-14 w-14 rounded-xl border border-white/20 bg-white/10 object-cover"
                    src="/hint-placeholder.svg"
                    alt="Hint placeholder"
                  />
                ) : null}
              </div>
            </div>

            <button
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
              onClick={handleReset}
            >
              New Word
            </button>

            <div className="flex flex-col gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Score</div>
              <div className="text-2xl font-semibold">{score}</div>
            </div>
          </div>

          <div className="absolute inset-0">
            {letters.map((letter) => (
              <div
                key={letter.id}
                onPointerDown={(event) => handlePointerDown(letter.id, event)}
                className="absolute flex h-12 w-12 cursor-grab touch-none items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl font-semibold text-white shadow-lg backdrop-blur"
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

          <div
            className="absolute left-1/2 w-[90%] -translate-x-1/2 text-center text-sm text-slate-200"
            style={{ top: `${layoutMetrics.statusY}px` }}
          >
            <span className={`transition ${status ? 'opacity-100' : 'opacity-0'}`}>
              {status}
            </span>
          </div>

          <div
            className="absolute left-1/2 h-px w-[90%] -translate-x-1/2 bg-white/20"
            style={{ top: `${layoutMetrics.lineY}px` }}
          />

          <div
            className="absolute left-1/2 w-[90%] -translate-x-1/2 text-center text-xs text-slate-400"
            style={{ top: `${layoutMetrics.hintY}px` }}
          >
            {status ? '' : `Hint: words are like ${wordSet.words.join(', ')}.`}
          </div>

          <div
            className="absolute left-1/2 flex w-[90%] -translate-x-1/2 justify-between gap-4"
            style={{ bottom: `${layoutMetrics.bucketBottom}px` }}
          >
            {buckets.map((bucket, index) => (
              <div
                key={`bucket-${index}`}
                ref={(node) => {
                  bucketRefs.current[index] = node;
                }}
                className="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-white/30 bg-white/5 text-center text-sm transition"
                style={{ height: `${layoutMetrics.bucketsHeight}px` }}
              >
                <span className="text-xs uppercase tracking-[0.3em] text-slate-300">
                  Bucket {index + 1}
                </span>
                <span className="text-3xl font-semibold text-white">
                  {bucket ? bucket.toUpperCase() : '?'}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
