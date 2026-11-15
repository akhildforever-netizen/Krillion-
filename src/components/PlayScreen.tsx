import { useCallback, useEffect, useRef, useState } from 'react';
import { ASSETS } from '../data/defaults';
import type { Answer, Category, GamePack, RoundResult, RunState } from '../types/game';
import { soundEngine } from '../utils/audio';
import { categoryById, normalize, oneOff } from '../utils/pack';

interface PlayScreenProps {
  pack: GamePack;
  run: RunState;
  depthElementRef: React.RefObject<HTMLDivElement | null>;
  onUpdateRun: React.Dispatch<React.SetStateAction<RunState | null>>;
  onSetTargetDepth: (depth: number) => void;
  onOpenTypo: (payload: {
    raw: string;
    matches: Answer[];
    onSelect: (answer: Answer) => void;
    onRetry: () => void;
    onSubmitAsTyped: () => void;
  }) => void;
  onCloseModal: () => void;
  onCompleteGame: (finalResults: RoundResult[], finalTotal: number) => void;
  onToast: (message: string) => void;
}

function TierBadge({ category }: { category: Category | undefined }) {
  if (category?.id === 'krillion') {
    return (
      <img
        src={ASSETS.krill}
        alt=""
        className="w-[85px] h-[85px] [image-rendering:pixelated] object-contain block mx-auto"
      />
    );
  }
  if (category?.id === 'rare') {
    return (
      <img
        src={ASSETS.rare}
        alt=""
        className="w-[85px] h-[85px] [image-rendering:pixelated] object-contain block mx-auto"
      />
    );
  }
  const glyph =
    category?.id === 'plankton'
      ? '·°·'
      : category?.id === 'too-clever'
        ? '¿?'
        : category?.id === 'schooler'
          ? '≋'
          : category?.id === 'deep-cut'
            ? '✦'
            : category
              ? '◈'
              : '×';

  return (
    <div
      aria-hidden="true"
      className="h-[70px] text-[57px] leading-none text-[var(--tier)] [text-shadow:3px_3px_#020b19] flex items-center justify-center"
    >
      {glyph}
    </div>
  );
}

export function PlayScreen({
  pack,
  run,
  depthElementRef,
  onUpdateRun,
  onSetTargetDepth,
  onOpenTypo,
  onCloseModal,
  onCompleteGame,
  onToast,
}: PlayScreenProps) {
  const [readCount, setReadCount] = useState(3);
  const [guess, setGuess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [shaking, setShaking] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const clockRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLElement | null>(null);

  const readTimerRef = useRef<number | null>(null);
  const answerTimerRef = useRef<number | null>(null);
  const deadlineRef = useRef<number>(0);
  const remainingRef = useRef<number>(pack.seconds * 1000);
  const lastTickSecRef = useRef<number>(-1);
  const runRef = useRef<RunState>(run);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const stopTimers = useCallback(() => {
    if (readTimerRef.current !== null) {
      window.clearInterval(readTimerRef.current);
      readTimerRef.current = null;
    }
    if (answerTimerRef.current !== null) {
      window.clearInterval(answerTimerRef.current);
      answerTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTimers();
  }, [stopTimers]);

  const finishRound = useCallback(
    (answer: Answer | null, raw: string, corrected = false) => {
      const current = runRef.current;
      if (!['answer', 'confirm'].includes(current.phase)) return;
      stopTimers();

      const cat = answer ? categoryById(answer.category, pack) : undefined;
      const points = cat?.points ?? 0;
      const newTotal = current.total + points;
      const promptText = pack.questions[current.index]?.prompt ?? '';

      const roundResult: RoundResult = {
        prompt: promptText,
        raw,
        answer: answer?.text ?? null,
        category: cat?.id ?? null,
        points,
        corrected,
        attempts: current.attempts,
      };

      onSetTargetDepth(newTotal * 10);
      if (answer) {
        soundEngine.chime(points, pack.categories);
        soundEngine.splash();
      } else {
        soundEngine.tone(110, 0.45, 0, 'triangle');
      }

      onUpdateRun((prev) =>
        prev
          ? {
              ...prev,
              total: newTotal,
              phase: 'result',
              results: [...prev.results, roundResult],
            }
          : null,
      );
    },
    [onSetTargetDepth, onUpdateRun, pack, stopTimers],
  );

  const tickAnswerClock = useCallback(() => {
    if (runRef.current.phase !== 'answer') return;
    const ms = deadlineRef.current - performance.now();
    const s = Math.max(0, Math.ceil(ms / 1000));

    if (clockRef.current) {
      clockRef.current.textContent = String(s);
      if (s <= 5) {
        clockRef.current.classList.add('text-[#ff528d]', 'border-[#ff528d]');
        clockRef.current.classList.remove('text-[#5de3f9]', 'border-[#67dced88]');
      } else {
        clockRef.current.classList.remove('text-[#ff528d]', 'border-[#ff528d]');
        clockRef.current.classList.add('text-[#5de3f9]', 'border-[#67dced88]');
      }
    }

    if (barRef.current) {
      const pct = Math.max(0, ms / (pack.seconds * 10));
      barRef.current.style.width = `${pct}%`;
    }

    if (s <= 5 && s > 0 && s !== lastTickSecRef.current) {
      soundEngine.tone(650, 0.06, 0, 'sine', 0.02);
      lastTickSecRef.current = s;
    }

    if (ms <= 0) {
      finishRound(null, 'Time ran out');
    }
  }, [finishRound, pack.seconds]);

  const startAnswerClock = useCallback(
    (durationMs: number) => {
      stopTimers();
      deadlineRef.current = performance.now() + durationMs;
      lastTickSecRef.current = -1;
      answerTimerRef.current = window.setInterval(tickAnswerClock, 80);
      tickAnswerClock();
    },
    [stopTimers, tickAnswerClock],
  );

  // Initialize reading countdown whenever question index resets to 'reading'
  useEffect(() => {
    if (run.phase !== 'reading') return;
    stopTimers();
    setReadCount(3);
    setGuess('');
    setErrorMsg('');
    setShaking(false);

    const readEnd = performance.now() + 3000;
    readTimerRef.current = window.setInterval(() => {
      const left = Math.ceil((readEnd - performance.now()) / 1000);
      if (left <= 0) {
        if (readTimerRef.current !== null) {
          window.clearInterval(readTimerRef.current);
          readTimerRef.current = null;
        }
        soundEngine.tone(440, 0.13);
        remainingRef.current = pack.seconds * 1000;
        onUpdateRun((prev) => (prev ? { ...prev, phase: 'answer' } : null));
        startAnswerClock(pack.seconds * 1000);
        window.setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      } else {
        setReadCount(left);
      }
    }, 80);

    return () => {
      if (readTimerRef.current !== null) {
        window.clearInterval(readTimerRef.current);
        readTimerRef.current = null;
      }
    };
  }, [run.index, run.phase, pack.seconds, onUpdateRun, startAnswerClock, stopTimers]);

  // Focus next button on result phase
  useEffect(() => {
    if (run.phase === 'result') {
      window.setTimeout(() => {
        nextBtnRef.current?.focus();
      }, 0);
    }
  }, [run.phase]);

  const triggerInvalid = (raw: string, resumeFromConfirm: boolean) => {
    if (resumeFromConfirm) {
      onCloseModal();
      onUpdateRun((prev) =>
        prev ? { ...prev, phase: 'answer', attempts: prev.attempts + 1 } : null,
      );
      startAnswerClock(remainingRef.current);
    } else {
      onUpdateRun((prev) => (prev ? { ...prev, attempts: prev.attempts + 1 } : null));
    }

    setErrorMsg(`“${raw}” isn't in this game's answer list. Try again.`);
    setShaking(false);
    window.requestAnimationFrame(() => {
      setShaking(true);
    });
    soundEngine.tone(150, 0.16, 0, 'triangle', 0.035, 95);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const resumeFromTypo = () => {
    onCloseModal();
    if (runRef.current.phase === 'confirm') {
      onUpdateRun((prev) => (prev ? { ...prev, phase: 'answer' } : null));
      startAnswerClock(remainingRef.current);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (run.phase !== 'answer') return;
    if (performance.now() >= deadlineRef.current) {
      finishRound(null, 'Time ran out');
      return;
    }

    const raw = guess.trim();
    if (!raw) {
      onToast('Type an answer, or skip this round.');
      return;
    }

    const q = pack.questions[run.index];
    if (!q) return;
    const n = normalize(raw);

    const exact = q.answers.find((a) =>
      [a.text, ...a.aliases].some((s) => normalize(s) === n),
    );
    if (exact) {
      finishRound(exact, raw, false);
      return;
    }

    const matches = q.answers.filter((a) =>
      [a.text, ...a.aliases].some((s) => oneOff(n, normalize(s))),
    );
    if (!matches.length) {
      triggerInvalid(raw, false);
      return;
    }

    remainingRef.current = Math.max(0, deadlineRef.current - performance.now());
    stopTimers();
    onUpdateRun((prev) => (prev ? { ...prev, phase: 'confirm' } : null));

    onOpenTypo({
      raw,
      matches,
      onSelect: (chosen) => {
        onCloseModal();
        finishRound(chosen, raw, true);
      },
      onRetry: resumeFromTypo,
      onSubmitAsTyped: () => triggerInvalid(raw, true),
    });
  };

  const handleNext = () => {
    const nextIndex = run.index + 1;
    if (nextIndex >= pack.questions.length) {
      onCompleteGame(run.results, run.total);
    } else {
      onUpdateRun((prev) =>
        prev
          ? {
              ...prev,
              index: nextIndex,
              phase: 'reading',
              attempts: 0,
            }
          : null,
      );
    }
  };

  const totalQuestions = pack.questions.length;
  const currentQuestion = pack.questions[run.index];
  const lastResult = run.results[run.results.length - 1];
  const lastCategory = lastResult?.category
    ? categoryById(lastResult.category, pack)
    : undefined;

  return (
    <section>
      <div className="relative min-h-[calc(100svh-105px)] md:min-h-[calc(100svh-160px)] max-w-[760px] mx-auto flex flex-col">
        {/* Krillion HUD */}
        <div className="grid grid-cols-[110px_1fr_110px] md:grid-cols-[150px_1fr_150px] max-w-[700px] w-full mx-auto gap-2 md:gap-5 items-start">
          <div className="bg-[#0d1c30ec] pixel-cut px-3 md:px-[18px] py-2.5 md:py-3 min-h-[77px]">
            <div className="text-[11px] sm:text-[12px] md:text-[13px] tracking-[1px] sm:tracking-[2px] md:tracking-[4px] text-[#a4b6d3]">
              DEPTH
            </div>
            <div
              ref={depthElementRef}
              className="text-[30px] md:text-[35px] text-[#5de3f9] [font-variant-numeric:tabular-nums] leading-[1.2]"
            >
              {(run.total * 10).toLocaleString()}m
            </div>
          </div>

          <div className="text-center pt-[18px] text-[11px] md:text-[13px] tracking-[1px] md:tracking-[2px] text-[#9bbad0]">
            <div className="flex gap-[3px] md:gap-1 justify-center mb-2 flex-wrap">
              {Array.from({ length: Math.min(totalQuestions, 30) }, (_, i) => {
                const stateClass =
                  i < run.index
                    ? 'bg-[#5de3f9] border-[#93e4f2]'
                    : i === run.index
                      ? 'bg-[#ff528d] border-[#ff91bc] shadow-[0_0_8px_#ff528d88]'
                      : 'bg-[#09172b] border-[#7d8fa8]';
                return (
                  <i
                    key={i}
                    className={`block w-[9px] h-[10px] md:w-[13px] md:h-[13px] border ${stateClass}`}
                  />
                );
              })}
            </div>
            PROMPT {Math.min(run.index + 1, totalQuestions)} OF {totalQuestions}
          </div>

          <div className="bg-[#0d1c30ec] pixel-cut px-3 md:px-[18px] py-2.5 md:py-3 min-h-[77px] text-right">
            <div className="text-[11px] sm:text-[12px] md:text-[13px] tracking-[1px] sm:tracking-[2px] md:tracking-[4px] text-[#a4b6d3]">
              SCORE
            </div>
            <div className="text-[30px] md:text-[35px] text-[#ff528d] [font-variant-numeric:tabular-nums] leading-[1.2]">
              {run.total.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Question or Round Reward */}
        {run.phase !== 'result' && currentQuestion && (
          <>
            <div className="pixel-panel w-full max-w-[510px] mt-[40px] md:mt-[clamp(35px,8vh,100px)] mx-auto shadow-[4px_6px_#0006]">
              <div className="text-[17px] tracking-[3px] text-[#ff528d] uppercase mb-3.5">
                PROMPT {run.index + 1} OF {totalQuestions}
              </div>
              <h2 className="text-[28px] sm:text-[31px] md:text-[36px] leading-[1.15] font-normal mb-3.5 [overflow-wrap:anywhere] text-[#e0e9f5]">
                {currentQuestion.prompt}
              </h2>
              <small className="text-[16px] tracking-[1px] text-[#93a6c4]">
                ▼ rarer answers sink deeper ▼
              </small>
            </div>

            {run.phase === 'reading' && (
              <div className="pixel-panel text-center self-center mt-auto tracking-[2px] text-[22px] py-4 px-7 text-[#abc4db]">
                descending · the clock starts in{' '}
                <b className="text-[#5de3f9]">{readCount}</b>
              </div>
            )}

            {(run.phase === 'answer' || run.phase === 'confirm') && (
              <div className="mt-auto pt-[38px] w-full max-w-[640px] self-center">
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-[44px_minmax(0,1fr)_70px] md:grid-cols-[60px_minmax(0,1fr)_90px] gap-2 md:gap-3 items-center">
                    <div
                      ref={clockRef}
                      aria-label="Seconds remaining"
                      className="w-[40px] h-[40px] md:w-[56px] md:h-[56px] border-2 border-[#67dced88] shadow-[0_0_0_6px_#4ed7ef12,0_0_22px_#38c0e533] text-[#5de3f9] rounded-full grid place-items-center text-[23px] md:text-[28px] relative"
                    >
                      {pack.seconds}
                    </div>

                    <input
                      ref={inputRef}
                      value={guess}
                      onChange={(e) => {
                        setGuess(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={150}
                      aria-label="Your answer"
                      aria-invalid={Boolean(errorMsg)}
                      placeholder="type one answer…"
                      className={`krillion-input text-[24px] md:text-[27px] p-3.5 border-2 border-[#4aa6c1] h-[59px] ${
                        shaking ? 'shake' : ''
                      }`}
                    />

                    <button
                      type="submit"
                      className="krillion-btn krillion-btn-pink h-[57px] text-[24px] px-2"
                    >
                      DIVE
                    </button>
                  </div>

                  <div className="h-[4px] mt-[5px] ml-[52px] mr-[78px] md:ml-[72px] md:mr-[102px] bg-[#102336]">
                    <i ref={barRef} className="block bg-[#5de3f9] h-full w-full" />
                  </div>

                  <p
                    role="status"
                    aria-live="polite"
                    className="text-[#ffbad0] min-h-[28px] text-[20px] mt-[7px] mb-0 text-center"
                  >
                    {errorMsg}
                  </p>

                  <div className="flex justify-between items-center min-h-[49px] gap-3">
                    <small className="text-[14px] sm:text-[16px] text-[#93a6c4]">
                      Invalid answers? Keep trying until time runs out.
                    </small>
                    <button
                      type="button"
                      onClick={() => finishRound(null, 'Skipped')}
                      className="cursor-pointer border-0 bg-transparent text-[#93a6c4] hover:text-[#e0e9f5] text-[17px] py-1.5 px-0 min-h-[25px] whitespace-nowrap"
                    >
                      skip round →
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}

        {run.phase === 'result' && lastResult && (
          <>
            <div
              className="pixel-panel w-full max-w-[530px] text-center mt-[clamp(30px,6vh,70px)] mx-auto p-7"
              style={
                {
                  '--tier': lastCategory?.color ?? '#8ea5c2',
                } as React.CSSProperties
              }
            >
              <TierBadge category={lastCategory} />
              <div className="text-[40px] tracking-[2px] my-2 text-[var(--tier)]">
                {lastCategory?.name ?? 'DRIFTING'}
              </div>
              <div className="text-[32px] text-[#e6edff] [overflow-wrap:anywhere] my-3.5">
                {lastResult.answer ? `“${lastResult.answer}”` : lastResult.raw}
              </div>
              <div className="text-[25px] text-[var(--tier)]">
                {lastResult.answer
                  ? `+${lastResult.points} PTS · SINK ${(lastResult.points * 10).toLocaleString()}m`
                  : 'NO DESCENT THIS ROUND'}
              </div>
              <p className="text-[20px] text-[#93a6c4] mt-3 mb-0">
                {lastResult.corrected
                  ? 'Typo corrected. Answer locked.'
                  : lastResult.answer
                    ? 'Answer locked. Down we go.'
                    : 'Another question waits below.'}
              </p>
            </div>

            <div className="mt-auto w-full max-w-[570px] self-center pt-[26px]">
              <button
                ref={nextBtnRef}
                type="button"
                onClick={handleNext}
                className="krillion-btn krillion-btn-primary w-full text-[26px] tracking-[4px] py-5 px-4"
              >
                {run.index + 1 === totalQuestions
                  ? '▲ SURFACE & VIEW RESULTS'
                  : 'DESCEND ▼'}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
