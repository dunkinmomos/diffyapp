import { useEffect, useMemo, useRef, useState } from 'react';

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

const WORDS = [
  'cat',
  'sun',
  'map',
  'jar',
  'sky',
  'fox',
  'pen',
  'bug',
  'owl',
  'net',
  'jam',
  'zip',
  'hug',
  'cup',
  'bed',
  'fig',
  'kid',
  'ice',
  'van',
  'hat',
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const LETTER_SIZE = 48;

const pickWord = () => WORDS[Math.floor(Math.random() * WORDS.length)];

const getId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildGameSize = (): GameSize => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isWide = width / height > 1.1;
  const maxHeight = Math.min(height * 0.82, 720);
  const maxWidth = Math.min(width * 0.92, isWide ? maxHeight * 1.1 : maxHeight * 0.72);
  return {
    width: Math.max(320, Math.round(maxWidth)),
    height: Math.max(520, Math.round(maxHeight)),
  };
};

const pickLetter = (target: string) => {
  if (Math.random() < 0.72) {
    return target[Math.floor(Math.random() * target.length)];
  }
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
};

export const App = () => {
  const [targetWord, setTargetWord] = useState(() => pickWord());
  const [letters, setLetters] = useState<FallingLetter[]>([]);
  const [buckets, setBuckets] = useState<(string | null)[]>(Array(3).fill(null));
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('');
  const [gameSize, setGameSize] = useState<GameSize>({ width: 480, height: 640 });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const gameRef = useRef<HTMLDivElement | null>(null);
  const bucketRefs = useRef<Array<HTMLDivElement | null>>([]);
  const gameSizeRef = useRef(gameSize);

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
          char: pickLetter(targetWord),
          x: Math.random() * (gameSizeRef.current.width - LETTER_SIZE),
          y: -LETTER_SIZE,
          speed: 1.2 + Math.random() * 1.8,
          isDragging: false,
        };
        return [...prev, next].slice(-14);
      });
    }, 1200);

    return () => window.clearInterval(spawnInterval);
  }, [targetWord]);

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
          .filter((letter) => letter.y < gameSizeRef.current.height + LETTER_SIZE),
      );
    }, 40);

    return () => window.clearInterval(fallInterval);
  }, []);

  useEffect(() => {
    if (buckets.some((slot) => slot === null)) {
      return;
    }
    const formed = buckets.join('');
    if (formed === targetWord) {
      setScore((prev) => prev + 10);
      setStatus('Nice! Word completed.');
      window.setTimeout(() => {
        setBuckets(Array(3).fill(null));
        setLetters([]);
        setTargetWord(pickWord());
        setStatus('');
      }, 900);
    } else {
      setStatus('Not quite! Try again.');
      window.setTimeout(() => {
        setBuckets(Array(3).fill(null));
        setStatus('');
      }, 900);
    }
  }, [buckets, targetWord]);

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
        setBuckets((prev) =>
          prev.map((slot, slotIndex) =>
            slotIndex === dropTargetIndex
              ? letters.find((letter) => letter.id === draggedId)?.char ?? slot
              : slot,
          ),
        );
        setLetters((prev) => prev.filter((letter) => letter.id !== draggedId));
      } else {
        setLetters((prev) =>
          prev.map((letter) =>
            letter.id === draggedId
              ? {
                  ...letter,
                  isDragging: false,
                }
              : letter,
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
  }, [buckets, dragOffset.x, dragOffset.y, draggedId, letters]);

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

  const handleReset = () => {
    setBuckets(Array(3).fill(null));
    setLetters([]);
    setTargetWord(pickWord());
    setStatus('');
  };

  const bucketHint = useMemo(() => targetWord.toUpperCase().split(''), [targetWord]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 p-4 text-white">
      <div className="flex w-full max-w-5xl flex-col items-center gap-4">
        <header className="flex w-full flex-col items-center gap-2 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Bucket Sorter</p>
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
          <div className="absolute left-6 top-5 flex flex-col gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Target</div>
            <div className="flex items-center gap-2 text-2xl font-semibold">
              {bucketHint.map((letter) => (
                <span key={letter} className="rounded-lg bg-white/10 px-2 py-1">
                  {letter}
                </span>
              ))}
            </div>
          </div>

          <div className="absolute right-6 top-5 flex flex-col gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Score</div>
            <div className="text-2xl font-semibold">{score}</div>
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

          <div className="absolute bottom-6 left-1/2 flex w-[88%] -translate-x-1/2 justify-between gap-3">
            {buckets.map((bucket, index) => (
              <div
                key={`bucket-${index}`}
                ref={(node) => {
                  bucketRefs.current[index] = node;
                }}
                className="flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 text-center text-sm transition"
              >
                <span className="text-xs uppercase tracking-[0.3em] text-slate-300">
                  Bucket {index + 1}
                </span>
                <span className="text-2xl font-semibold text-white">
                  {bucket ? bucket.toUpperCase() : '?'}
                </span>
              </div>
            ))}
          </div>

          <div className="absolute bottom-28 left-1/2 w-[90%] -translate-x-1/2 text-center text-sm text-slate-200">
            {status || 'Hint: place letters in order to match the target word.'}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300">
          <button
            className="rounded-full bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20"
            onClick={handleReset}
          >
            New Word
          </button>
          <div className="rounded-full border border-white/10 px-4 py-2">
            Aspect-aware layout adapts to your screen size.
          </div>
        </div>
      </div>
    </div>
  );
};
