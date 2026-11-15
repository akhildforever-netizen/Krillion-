import { useEffect, useMemo, useState } from 'react';
import type { GamePack, RoundResult, ScoreEntry } from '../types/game';
import {
  buildEmojiGridString,
  buildShareSummary,
  categoryById,
  downloadFile,
  emojiForCategory,
  normalize,
  pointsOf,
  slugifyTitle,
} from '../utils/pack';

interface ResultsScreenProps {
  pack: GamePack;
  activePackId: string;
  results: RoundResult[];
  totalPoints: number;
  isSignedIn: boolean;
  defaultPlayerName: string;
  defaultCollege: string;
  packScores: ScoreEntry[];
  onSignIn: () => Promise<void>;
  onSubmitScore: (payload: {
    playerName: string;
    college: string;
    maxPoints: number;
    acceptedCount: number;
    emojiGrid: string;
  }) => Promise<string>;
  onOpenLeaderboard: () => void;
  onReplay: () => void;
  onHome: () => void;
  onToast: (message: string) => void;
  onCopyFallback: (text: string) => void;
}

function QuestionAccordion({
  index,
  pack,
  result,
}: {
  index: number;
  pack: GamePack;
  result: RoundResult;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const question = pack.questions[index];
  const cat = result.category ? categoryById(result.category, pack) : undefined;

  const groupedCategories = useMemo(() => {
    if (!open || !question) return [];
    const n = normalize(filter);
    return [...pack.categories]
      .sort((a, b) => b.points - a.points)
      .map((category) => {
        const answers = question.answers
          .filter(
            (a) =>
              a.category === category.id &&
              [a.text, ...a.aliases].some((s) => normalize(s).includes(n)),
          )
          .sort((a, b) => a.text.localeCompare(b.text));
        return { category, answers };
      })
      .filter((group) => group.answers.length > 0);
  }, [open, filter, pack.categories, question]);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="my-2.5 bg-[#0b172bea] border border-[#425671]"
      style={
        {
          '--tier': cat?.color ?? '#91a4be',
        } as React.CSSProperties
      }
    >
      <summary className="cursor-pointer px-3 py-3.5 md:px-5 md:py-[18px] grid grid-cols-[25px_1fr_auto] md:grid-cols-[35px_minmax(0,1fr)_auto] gap-2 md:gap-3 items-center list-none [&::-webkit-details-marker]:hidden hover:bg-[#1a2b44]">
        <span className="text-[#667c9d] text-[28px] leading-none">
          {index + 1}
        </span>
        <span className="min-w-0 text-[#e0e9f5]">
          {result.prompt}
          <small className="block text-[18px] mt-1 text-[#93a6c4] truncate">
            {result.answer ?? result.raw}
            {result.corrected ? ' · typo corrected' : ''}
          </small>
        </span>
        <span className="text-right text-[var(--tier)] text-[23px] md:text-[27px] leading-tight">
          {result.points} pts
          <small className="block text-[16px] text-[#93a6c4] max-w-[105px] md:max-w-none truncate">
            {cat?.name ?? 'No answer'} ▾
          </small>
        </span>
      </summary>

      <div className="border-t border-[#354963] p-5">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label={`Search answers for question ${index + 1}`}
          placeholder="search all answers…"
          className="krillion-input text-[19px] p-2.5 mb-3.5"
        />

        <div
          tabIndex={0}
          aria-label={`Possible answers for question ${index + 1}`}
          className="answer-scroll"
        >
          {groupedCategories.length === 0 ? (
            <p className="text-[#93a6c4] text-[20px] m-0">No matching answers.</p>
          ) : (
            groupedCategories.map(({ category, answers }) => (
              <section
                key={category.id}
                className="mb-[18px]"
                style={
                  {
                    '--tier': category.color,
                  } as React.CSSProperties
                }
              >
                <h3 className="text-[22px] font-normal flex justify-between text-[var(--tier)] border-b border-[#35465c] pb-1.5 mb-2.5">
                  <span>
                    {category.name} ({answers.length})
                  </span>
                  <span>{category.points} pts</span>
                </h3>
                {answers.map((answer) => {
                  const isMine = result.answer === answer.text;
                  return (
                    <div
                      key={answer.text}
                      className={`flex justify-between gap-2.5 py-[7px] px-[9px] border-b border-[#253951] text-[21px] ${
                        isMine ? 'bg-[#26483f99] text-[#abf0d5]' : 'text-[#e0e9f5]'
                      }`}
                    >
                      <span>{answer.text}</span>
                      {isMine && (
                        <small className="text-[16px] text-[#abf0d5] shrink-0">
                          YOUR ANSWER ✓
                        </small>
                      )}
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </details>
  );
}

export function ResultsScreen({
  pack,
  activePackId,
  results,
  totalPoints,
  isSignedIn,
  defaultPlayerName,
  defaultCollege,
  packScores,
  onSignIn,
  onSubmitScore,
  onOpenLeaderboard,
  onReplay,
  onHome,
  onToast,
  onCopyFallback,
}: ResultsScreenProps) {
  const [playerName, setPlayerName] = useState(defaultPlayerName);
  const [college, setCollege] = useState(defaultCollege);
  const [submitting, setSubmitting] = useState(false);
  const [submittedScoreId, setSubmittedScoreId] = useState<string | null>(null);

  useEffect(() => {
    if (!playerName && defaultPlayerName) {
      setPlayerName(defaultPlayerName);
    }
  }, [defaultPlayerName, playerName]);

  useEffect(() => {
    if (!college && defaultCollege) {
      setCollege(defaultCollege);
    }
  }, [defaultCollege, college]);

  const maxPoints = useMemo(
    () =>
      pack.questions.reduce(
        (sum, q) => sum + Math.max(0, ...q.answers.map((a) => pointsOf(a, pack))),
        0,
      ),
    [pack],
  );

  const maxCatPoints = useMemo(
    () => Math.max(1, ...pack.categories.map((c) => c.points)),
    [pack.categories],
  );

  const acceptedCount = useMemo(
    () => results.filter((r) => Boolean(r.answer)).length,
    [results],
  );

  const emojiGrid = useMemo(
    () => buildEmojiGridString(pack, results),
    [pack, results],
  );

  const submittedRank = useMemo(() => {
    if (!submittedScoreId) return null;
    const sorted = [...packScores].sort(
      (a, b) => b.depth - a.depth || b.createdAtMs - a.createdAtMs,
    );
    const idx = sorted.findIndex((s) => s.id === submittedScoreId);
    return idx >= 0 ? idx + 1 : null;
  }, [packScores, submittedScoreId]);

  const handleAnnounceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      onToast('Enter your full name so you can be recognized for free event entry.');
      return;
    }
    setSubmitting(true);
    try {
      const scoreId = await onSubmitScore({
        playerName: playerName.trim(),
        college: college.trim(),
        maxPoints,
        acceptedCount,
        emojiGrid,
      });
      setSubmittedScoreId(scoreId);
      onToast('Score announced on the live leaderboard!');
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Could not announce your score.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyResults = async () => {
    const summary = buildShareSummary(pack, results, totalPoints, maxPoints);
    try {
      await navigator.clipboard.writeText(summary);
      onToast('Results copied.');
    } catch {
      onCopyFallback(summary);
    }
  };

  const handleSaveResults = () => {
    const summary = buildShareSummary(pack, results, totalPoints, maxPoints);
    downloadFile(
      summary,
      `${slugifyTitle(pack.title)}-results.txt`,
      'text/plain',
    );
  };

  return (
    <section className="max-w-[730px] mx-auto mt-[35px]">
      <div className="krillion-panel p-5 md:p-[30px] text-center">
        <div className="text-[17px] tracking-[3px] text-[#ff528d] uppercase">
          {pack.title}
        </div>
        <h1 className="text-[46px] md:text-[55px] tracking-[5px] font-normal mt-[18px] mb-[15px] text-[#5de3f9] leading-none">
          YOU SURFACED.
        </h1>
        <div className="text-[65px] md:text-[80px] leading-none text-[#5de3f9] krillion-depth-shadow">
          {(totalPoints * 10).toLocaleString()}
          <span className="text-[35px]"> m</span>
        </div>
        <p className="text-[20px] text-[#93a6c4] my-4">
          {totalPoints.toLocaleString()} / {maxPoints.toLocaleString()} points ·{' '}
          {acceptedCount} / {pack.questions.length} accepted
        </p>

        {/* Spoiler-free emoji share grid */}
        <div
          aria-label="Spoiler-free dive summary grid"
          className="inline-flex flex-wrap justify-center gap-2 my-3 px-4 py-3 bg-[#081426] border border-[#354963]"
        >
          {results.map((r, i) => {
            const cat = r.category ? categoryById(r.category, pack) : undefined;
            const emoji = emojiForCategory(cat, maxCatPoints);
            return (
              <div
                key={i}
                title={`Prompt ${i + 1}: ${cat?.name ?? 'Surfaced'} (${(r.points * 10).toLocaleString()}m)`}
                className="flex flex-col items-center gap-1 min-w-[34px]"
                style={
                  {
                    '--tier': cat?.color ?? '#49607d',
                  } as React.CSSProperties
                }
              >
                <span className="text-[24px] leading-none">{emoji}</span>
                <span className="block w-6 h-1 bg-[var(--tier)]" />
              </div>
            );
          })}
        </div>

        {/* Official Score Announcement & Free Event Entry Form */}
        <div className="my-5 p-4 md:p-5 bg-[#081426] border-2 border-[#5de3f9] text-left">
          <div className="text-[15px] tracking-[2px] text-[#ff528d] uppercase mb-1">
            🎟 FREE EVENT ENTRY LEADERBOARD
          </div>
          <h2 className="text-[26px] md:text-[30px] font-normal text-[#e0e9f5] mb-2">
            ANNOUNCE YOUR SCORE
          </h2>

          {submittedScoreId ? (
            <div>
              <p className="text-[20px] text-[#6af0bb] mb-3">
                ✓ Announced for <b>{playerName}</b>
                {college ? ` (${college})` : ''} at{' '}
                <b>{(totalPoints * 10).toLocaleString()}m</b>
                {submittedRank ? ` · Currently Rank #${submittedRank}!` : '!'}
              </p>
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="krillion-btn krillion-btn-primary text-[19px]"
              >
                🏆 VIEW LIVE SCORE ANNOUNCEMENTS
              </button>
            </div>
          ) : !isSignedIn ? (
            <div>
              <p className="text-[19px] text-[#93a6c4] mb-3">
                Sign in with Google so your verified name and score are
                announced on the leaderboard to qualify for free entry.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => void onSignIn()}
                  className="krillion-btn krillion-btn-pink text-[20px]"
                >
                  SIGN IN WITH GOOGLE TO ANNOUNCE SCORE
                </button>
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="krillion-btn text-[19px]"
                >
                  🏆 VIEW STANDINGS
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAnnounceSubmit} className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="announce-name"
                    className="block text-[#93a6c4] text-[16px] mb-1"
                  >
                    Your Full Name (for Free Event Entry) *
                  </label>
                  <input
                    id="announce-name"
                    required
                    maxLength={80}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="e.g. Dr. Ananya Sharma"
                    className="krillion-input text-[20px] p-2.5"
                  />
                </div>
                <div>
                  <label
                    htmlFor="announce-college"
                    className="block text-[#93a6c4] text-[16px] mb-1"
                  >
                    College / Batch (optional)
                  </label>
                  <input
                    id="announce-college"
                    maxLength={100}
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g. AIMS BG Nagara · Batch '23"
                    className="krillion-input text-[20px] p-2.5"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="krillion-btn krillion-btn-pink text-[20px]"
                >
                  {submitting
                    ? 'ANNOUNCING…'
                    : `📢 ANNOUNCE ${(totalPoints * 10).toLocaleString()}m SCORE`}
                </button>
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="krillion-btn text-[19px]"
                >
                  🏆 VIEW STANDINGS ({packScores.length})
                </button>
              </div>
              <div className="text-[15px] text-[#7a94b1]">
                Pack ID: {activePackId} · Your verified Google email is shared
                only with the event organizer.
              </div>
            </form>
          )}
        </div>

        <div className="flex items-center justify-center gap-2.5 flex-wrap mt-4">
          <button
            type="button"
            onClick={handleCopyResults}
            className="krillion-btn krillion-btn-primary text-[20px]"
          >
            COPY RESULTS
          </button>
          <button
            type="button"
            onClick={handleSaveResults}
            className="krillion-btn text-[20px]"
          >
            SAVE RESULTS
          </button>
          <button
            type="button"
            onClick={onReplay}
            className="krillion-btn text-[20px]"
          >
            DIVE AGAIN
          </button>
        </div>
      </div>

      <p className="text-center text-[#93a6c4] my-[25px] mb-[15px] text-[20px]">
        ▼ Click a question to explore every possible answer ▼
      </p>

      <div className="mt-4">
        {results.map((r, i) => (
          <QuestionAccordion key={i} index={i} pack={pack} result={r} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2.5 flex-wrap mt-[22px]">
        <button
          type="button"
          onClick={onHome}
          className="krillion-btn text-[20px]"
        >
          BACK TO SURFACE
        </button>
      </div>
    </section>
  );
}
