import { useEffect, useMemo, useState } from 'react';

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

  useEffect(() => {
    const updateSize = () => setGameSize(buildGameSize());
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
          x: 8 + Math.random() * 84,
          y: -10,
          speed: 0.8 + Math.random() * 1.4,
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
          .filter((letter) => letter.y < 105),
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

  const handleDragStart = (id: string) => {
    setLetters((prev) =>
      prev.map((letter) => (letter.id === id ? { ...letter, isDragging: true } : letter)),
    );
  };

  const handleDragEnd = (id: string) => {
    setLetters((prev) =>
      prev.map((letter) => (letter.id === id ? { ...letter, isDragging: false } : letter)),
    );
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    if (buckets[index]) {
      return;
    }
    const id = event.dataTransfer.getData('text/plain');
    const picked = letters.find((letter) => letter.id === id);
    if (!picked) {
      return;
    }
    setBuckets((prev) => prev.map((slot, slotIndex) => (slotIndex === index ? picked.char : slot)));
    setLetters((prev) => prev.filter((letter) => letter.id !== id));
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
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', letter.id);
                  handleDragStart(letter.id);
                }}
                onDragEnd={() => handleDragEnd(letter.id)}
                className="absolute flex h-12 w-12 cursor-grab items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl font-semibold text-white shadow-lg backdrop-blur"
                style={{
                  left: `${letter.x}%`,
                  top: `${letter.y}%`,
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
                className="flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 text-center text-sm transition"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, index)}
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
