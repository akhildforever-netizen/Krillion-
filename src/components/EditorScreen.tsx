import { useEffect, useRef, useState } from 'react';
import type { Answer, Category, GamePack } from '../types/game';
import { clone, normalize } from '../utils/pack';

interface EditorScreenProps {
  draft: GamePack;
  selectedQuestion: number;
  statusNote: string;
  isAdmin: boolean;
  onSelectQuestion: (index: number) => void;
  onUpdateDraft: (updater: (prev: GamePack) => GamePack) => void;
  onSaveAndPlay: () => void;
  onExportFromEditor: () => void;
  onPublishOnline: (options: {
    featured: boolean;
    eventBanner: string;
  }) => Promise<void>;
  onToast: (message: string) => void;
  onRequestConfirmDeleteQuestion: (onConfirm: () => void) => void;
}

function AliasInput({
  aliases,
  ariaLabel,
  onChangeAliases,
}: {
  aliases: string[];
  ariaLabel: string;
  onChangeAliases: (next: string[]) => void;
}) {
  const joined = aliases.join(' | ');
  const [text, setText] = useState(joined);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setText(joined);
    }
  }, [joined]);

  return (
    <input
      aria-label={ariaLabel}
      value={text}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        const parsed = text
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        setText(parsed.join(' | '));
        onChangeAliases(parsed);
      }}
      onChange={(e) => {
        const val = e.target.value;
        setText(val);
        const parsed = val
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        onChangeAliases(parsed);
      }}
      className="krillion-input text-[12px] md:text-[14px] p-2 md:p-3"
    />
  );
}

export function EditorScreen({
  draft,
  selectedQuestion,
  statusNote,
  isAdmin,
  onSelectQuestion,
  onUpdateDraft,
  onSaveAndPlay,
  onExportFromEditor,
  onPublishOnline,
  onToast,
  onRequestConfirmDeleteQuestion,
}: EditorScreenProps) {
  const [bulkText, setBulkText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [featured, setFeatured] = useState(true);
  const [eventBanner, setEventBanner] = useState(
    'Top scorer wins FREE ENTRY into SAPIENTIA!',
  );
  const categoryListRef = useRef<HTMLDivElement | null>(null);
  const answerListRef = useRef<HTMLDivElement | null>(null);

  const safeIndex = Math.min(selectedQuestion, Math.max(0, draft.questions.length - 1));
  const currentQuestion = draft.questions[safeIndex];

  const makeBlankAnswer = (categories: Category[]): Answer => ({
    text: '',
    category:
      categories.find((c) => c.id === 'schooler')?.id ?? categories[0]?.id ?? 'plankton',
    aliases: [],
  });

  const handleAddCategory = () => {
    if (draft.categories.length >= 50) {
      onToast('Maximum 50 categories.');
      return;
    }
    let n = 1;
    while (draft.categories.some((c) => normalize(c.name) === normalize(`Custom ${n}`))) {
      n++;
    }
    const newCat: Category = {
      id: `custom-${Date.now().toString(36)}-${n}`,
      name: `Custom ${n}`,
      points: 100,
      color: '#f4d77b',
    };
    onUpdateDraft((prev) => ({
      ...prev,
      categories: [...prev.categories, newCat],
    }));
    window.setTimeout(() => {
      const lastInput = categoryListRef.current?.lastElementChild?.querySelector(
        'input[data-kind="cat-name"]',
      ) as HTMLInputElement | null;
      lastInput?.focus();
    }, 0);
  };

  const handleDeleteCategory = (catIndex: number) => {
    if (draft.categories.length <= 1) {
      onToast('Keep at least one category.');
      return;
    }
    const target = draft.categories[catIndex];
    if (!target) return;
    const usageCount = draft.questions.reduce(
      (sum, q) => sum + q.answers.filter((a) => a.category === target.id).length,
      0,
    );
    if (usageCount > 0) {
      onToast(
        `“${target.name}” is used by ${usageCount} answers. Reassign those answers before deleting it.`,
      );
      return;
    }
    onUpdateDraft((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, idx) => idx !== catIndex),
    }));
  };

  const handleAddQuestion = () => {
    if (draft.questions.length >= 100) {
      onToast('Maximum 100 questions.');
      return;
    }
    const nextIdx = draft.questions.length;
    onUpdateDraft((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { prompt: '', answers: [makeBlankAnswer(prev.categories)] },
      ],
    }));
    onSelectQuestion(nextIdx);
  };

  const handleDeleteQuestion = () => {
    if (draft.questions.length <= 1) {
      onToast('Keep at least one question.');
      return;
    }
    onRequestConfirmDeleteQuestion(() => {
      onUpdateDraft((prev) => ({
        ...prev,
        questions: prev.questions.filter((_, idx) => idx !== safeIndex),
      }));
      onSelectQuestion(Math.min(safeIndex, Math.max(0, draft.questions.length - 2)));
    });
  };

  const handleMoveQuestion = (delta: -1 | 1) => {
    const targetIdx = safeIndex + delta;
    if (targetIdx < 0 || targetIdx >= draft.questions.length) return;
    onUpdateDraft((prev) => {
      const next = [...prev.questions];
      [next[safeIndex], next[targetIdx]] = [next[targetIdx], next[safeIndex]];
      return { ...prev, questions: next };
    });
    onSelectQuestion(targetIdx);
  };

  const handleAddAnswer = () => {
    if (!currentQuestion) return;
    if (currentQuestion.answers.length >= 1000) {
      onToast('Maximum 1,000 answers per question.');
      return;
    }
    onUpdateDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q, idx) =>
        idx === safeIndex
          ? { ...q, answers: [...q.answers, makeBlankAnswer(prev.categories)] }
          : q,
      ),
    }));
    window.setTimeout(() => {
      const lastInput = answerListRef.current?.lastElementChild?.querySelector(
        'input[data-kind="answer-text"]',
      ) as HTMLInputElement | null;
      lastInput?.focus();
    }, 0);
  };

  const handleBulkAdd = () => {
    if (!currentQuestion) return;
    try {
      const lines = bulkText.split('\n').filter((s) => s.trim());
      if (!lines.length) {
        throw new Error('Paste some answers first.');
      }

      const nextCats = clone(draft.categories);
      const added: Answer[] = lines.map((line, i) => {
        const parts = line.split(';').map((s) => s.trim());
        if (parts.length < 2 || parts.length > 3 || !parts[0] || !parts[1]) {
          throw new Error(
            `Line ${i + 1}: use answer ; category ; optional aliases.`,
          );
        }

        let cat = nextCats.find((c) => normalize(c.name) === normalize(parts[1]));
        if (!cat && /^\d+$/.test(parts[1])) {
          const pts = Number(parts[1]);
          if (pts > 10000) {
            throw new Error(`Line ${i + 1}: maximum 10,000 points.`);
          }
          const matches = nextCats.filter((c) => c.points === pts);
          if (matches.length > 1) {
            throw new Error(
              `Line ${i + 1}: more than one category has ${pts} points. Use its name.`,
            );
          }
          cat = matches[0];
          if (!cat) {
            cat = {
              id: `points-${pts}-${Date.now().toString(36)}-${i}`,
              name: `${pts} points`,
              points: pts,
              color: '#9fb8df',
            };
            nextCats.push(cat);
          }
        }

        if (!cat) {
          throw new Error(`Line ${i + 1}: category “${parts[1]}” not found.`);
        }

        return {
          text: parts[0],
          category: cat.id,
          aliases: (parts[2] ?? '')
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean),
        };
      });

      if (nextCats.length > 50) {
        throw new Error('Maximum 50 categories.');
      }

      const existingNonEmpty = currentQuestion.answers.filter(
        (a) => a.text.trim() || a.aliases.length > 0,
      );
      const nextAnswers = [...existingNonEmpty, ...added];
      if (nextAnswers.length > 1000) {
        throw new Error('Maximum 1,000 answers per question.');
      }

      onUpdateDraft((prev) => ({
        ...prev,
        categories: nextCats,
        questions: prev.questions.map((q, idx) =>
          idx === safeIndex ? { ...q, answers: nextAnswers } : q,
        ),
      }));
      setBulkText('');
      onToast(`${added.length} answers added.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not parse bulk answers.');
    }
  };

  if (!currentQuestion) return null;

  return (
    <section className="mt-[30px] font-editor text-[15px]">
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        <div>
          <div className="font-pixel text-[17px] tracking-[3px] text-[#ff528d] uppercase">
            THE EXPEDITION WORKSHOP
          </div>
          <h2 className="font-pixel text-[40px] font-normal leading-[1.1] text-[#e0e9f5] mb-5">
            Make it your ocean.
          </h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onSaveAndPlay}
            className="krillion-btn krillion-btn-primary text-[14px] tracking-normal"
          >
            Save &amp; play
          </button>
          <button
            type="button"
            onClick={onExportFromEditor}
            className="krillion-btn text-[14px] tracking-normal"
          >
            Export / share
          </button>
          {isAdmin && (
            <button
              type="button"
              disabled={publishing}
              onClick={async () => {
                setPublishing(true);
                try {
                  await onPublishOnline({ featured, eventBanner });
                } finally {
                  setPublishing(false);
                }
              }}
              className="krillion-btn krillion-btn-pink text-[14px] tracking-normal"
            >
              {publishing ? 'Publishing…' : '☁ Publish online'}
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mt-3 p-3.5 bg-[#0c182bed] border border-[#ff528d] flex flex-wrap items-center gap-3">
          <span className="font-pixel text-[15px] tracking-[2px] text-[#ff528d] uppercase">
            ONLINE PUBLISH SETTINGS:
          </span>
          <input
            aria-label="Event announcement banner"
            value={eventBanner}
            maxLength={200}
            onChange={(e) => setEventBanner(e.target.value)}
            placeholder="Event prize / free entry banner (optional)"
            className="krillion-input text-[13px] py-1.5 px-2.5 flex-1 min-w-[220px]"
          />
          <label className="flex items-center gap-2 text-[13px] text-[#e0e9f5] cursor-pointer">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 accent-[#ff528d]"
            />
            Featured pack
          </label>
        </div>
      )}

      <div className="min-h-[20px] text-[13px] text-[#93a6c4] mt-3">
        {statusNote}
      </div>

      {/* Scoring Categories Manager */}
      <details className="my-[22px] border border-[#354963] bg-[#0c182bed] p-4 md:py-[18px] md:px-6">
        <summary className="font-pixel text-[25px] text-[#5de3f9] cursor-pointer">
          Scoring categories{' '}
          <small className="text-[#93a6c4] text-[18px]">
            · {draft.categories.length} tiers · rename, rescore, or add your own
          </small>
        </summary>
        <p className="text-[13px] text-[#93a6c4] my-2.5 leading-[1.45]">
          Each answer belongs to one category. Changing its points updates every
          answer in that category. Default scores match Krillion; 1 point = 10
          metres.
        </p>

        <div className="grid grid-cols-[32px_1fr_65px_28px] sm:grid-cols-[36px_1fr_80px_30px] md:grid-cols-[44px_1fr_110px_36px] gap-[7px] md:gap-2.5 my-2.5 items-center text-[12px] text-[#93a6c4]">
          <span>Color</span>
          <span>Category name</span>
          <span>Points</span>
          <span />
        </div>

        <div ref={categoryListRef}>
          {draft.categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="grid grid-cols-[32px_1fr_65px_28px] sm:grid-cols-[36px_1fr_80px_30px] md:grid-cols-[44px_1fr_110px_36px] gap-[7px] md:gap-2.5 my-2.5 items-center"
            >
              <input
                type="color"
                aria-label={`Color for category ${idx + 1}`}
                value={cat.color}
                onChange={(e) => {
                  const color = e.target.value;
                  onUpdateDraft((prev) => ({
                    ...prev,
                    categories: prev.categories.map((c, i) =>
                      i === idx ? { ...c, color } : c,
                    ),
                  }));
                }}
                className="krillion-input p-[3px] h-[43px] cursor-pointer"
              />
              <input
                data-kind="cat-name"
                aria-label={`Name for category ${idx + 1}`}
                value={cat.name}
                maxLength={60}
                onChange={(e) => {
                  const name = e.target.value;
                  onUpdateDraft((prev) => ({
                    ...prev,
                    categories: prev.categories.map((c, i) =>
                      i === idx ? { ...c, name } : c,
                    ),
                  }));
                }}
                className="krillion-input text-[14px] p-[7px] md:p-3"
              />
              <input
                aria-label={`Points for category ${idx + 1}`}
                type="number"
                min={0}
                max={10000}
                step={1}
                value={Number.isFinite(cat.points) ? cat.points : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? Number.NaN : Number(e.target.value);
                  onUpdateDraft((prev) => ({
                    ...prev,
                    categories: prev.categories.map((c, i) =>
                      i === idx ? { ...c, points: val } : c,
                    ),
                  }));
                }}
                className="krillion-input text-[14px] p-[7px] md:p-3"
              />
              <button
                type="button"
                title={`Remove category ${idx + 1}`}
                onClick={() => handleDeleteCategory(idx)}
                className="krillion-btn text-[#ff9cba] text-[14px] tracking-normal p-1.5"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddCategory}
          className="krillion-btn text-[14px] tracking-normal mt-2"
        >
          ＋ Add category
        </button>
      </details>

      {/* Two-Column Workshop Layout */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-5">
        {/* Sidebar: Game Details & Question List */}
        <aside className="krillion-panel p-[18px] md:p-[26px] self-start md:sticky md:top-5">
          <h3 className="font-pixel text-[27px] font-normal text-[#e0e9f5] mb-3.5">
            Game details
          </h3>

          <label
            htmlFor="editor-title"
            className="block text-[#93a6c4] text-[13px] font-semibold mt-[15px] mb-[7px]"
          >
            Title
          </label>
          <input
            id="editor-title"
            maxLength={120}
            value={draft.title}
            onChange={(e) => {
              const title = e.target.value;
              onUpdateDraft((prev) => ({ ...prev, title }));
            }}
            className="krillion-input text-[14px]"
          />

          <label
            htmlFor="editor-desc"
            className="block text-[#93a6c4] text-[13px] font-semibold mt-[15px] mb-[7px]"
          >
            Description
          </label>
          <textarea
            id="editor-desc"
            rows={3}
            maxLength={2000}
            value={draft.description}
            onChange={(e) => {
              const description = e.target.value;
              onUpdateDraft((prev) => ({ ...prev, description }));
            }}
            className="krillion-input text-[14px] resize-y"
          />

          <label
            htmlFor="editor-seconds"
            className="block text-[#93a6c4] text-[13px] font-semibold mt-[15px] mb-[7px]"
          >
            Seconds per question
          </label>
          <input
            id="editor-seconds"
            type="number"
            min={5}
            max={180}
            value={Number.isFinite(draft.seconds) ? draft.seconds : ''}
            onChange={(e) => {
              const seconds =
                e.target.value === '' ? Number.NaN : Number(e.target.value);
              onUpdateDraft((prev) => ({ ...prev, seconds }));
            }}
            className="krillion-input text-[14px]"
          />

          <div className="mt-6">
            {draft.questions.map((q, idx) => {
              const active = idx === safeIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectQuestion(idx)}
                  className={`krillion-btn block w-full text-left my-2 whitespace-nowrap overflow-hidden text-ellipsis p-2.5 text-[14px] tracking-normal ${
                    active ? 'border-[#5de3f9] text-[#5de3f9]' : ''
                  }`}
                >
                  {idx + 1}. {q.prompt || 'Untitled question'}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddQuestion}
            className="krillion-btn text-[14px] tracking-normal mt-2 w-full"
          >
            ＋ Add question
          </button>
        </aside>

        {/* Main Panel: Active Question Editor */}
        <section className="krillion-panel p-[18px] md:p-[26px]">
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            <span className="font-pixel text-[17px] tracking-[3px] text-[#ff528d] uppercase">
              QUESTION {safeIndex + 1} / {draft.questions.length}
            </span>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                title="Move question earlier"
                disabled={safeIndex === 0}
                onClick={() => handleMoveQuestion(-1)}
                className="krillion-btn text-[14px] tracking-normal"
              >
                ↑
              </button>
              <button
                type="button"
                title="Move question later"
                disabled={safeIndex === draft.questions.length - 1}
                onClick={() => handleMoveQuestion(1)}
                className="krillion-btn text-[14px] tracking-normal"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={handleDeleteQuestion}
                className="krillion-btn text-[#ff9cba] text-[14px] tracking-normal"
              >
                Delete
              </button>
            </div>
          </div>

          <label
            htmlFor="editor-prompt"
            className="block text-[#93a6c4] text-[13px] font-semibold mt-[15px] mb-[7px]"
          >
            What would you like to ask?
          </label>
          <textarea
            id="editor-prompt"
            maxLength={500}
            rows={2}
            placeholder="e.g. Name someone in our friend group."
            value={currentQuestion.prompt}
            onChange={(e) => {
              const prompt = e.target.value;
              onUpdateDraft((prev) => ({
                ...prev,
                questions: prev.questions.map((q, idx) =>
                  idx === safeIndex ? { ...q, prompt } : q,
                ),
              }));
            }}
            className="krillion-input text-[14px] resize-y"
          />

          <p className="text-[13px] text-[#93a6c4] my-2.5 leading-[1.45]">
            Choose a category for each answer. Separate alternate spellings with{' '}
            <b className="text-[#e0e9f5]">|</b>.
          </p>

          <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_135px_30px] md:grid-cols-[minmax(100px,1.2fr)_minmax(90px,1fr)_minmax(150px,1.3fr)_36px] gap-[5px] md:gap-2 my-2 text-[12px] text-[#93a6c4]">
            <span>Accepted answer</span>
            <span>Aliases (optional)</span>
            <span>Scoring category</span>
            <span />
          </div>

          <div ref={answerListRef}>
            {currentQuestion.answers.map((answer, aIdx) => (
              <div
                key={aIdx}
                className="grid grid-cols-[1fr_32px] sm:grid-cols-[1fr_1fr_135px_30px] md:grid-cols-[minmax(100px,1.2fr)_minmax(90px,1fr)_minmax(150px,1.3fr)_36px] gap-[5px] md:gap-2 my-2 py-3 sm:py-0 border-b border-[#354963] sm:border-b-0"
              >
                <input
                  data-kind="answer-text"
                  aria-label={`Answer ${aIdx + 1}`}
                  maxLength={150}
                  value={answer.text}
                  onChange={(e) => {
                    const text = e.target.value;
                    onUpdateDraft((prev) => ({
                      ...prev,
                      questions: prev.questions.map((q, qIdx) =>
                        qIdx === safeIndex
                          ? {
                              ...q,
                              answers: q.answers.map((a, idx) =>
                                idx === aIdx ? { ...a, text } : a,
                              ),
                            }
                          : q,
                      ),
                    }));
                  }}
                  className="krillion-input text-[12px] md:text-[14px] p-2 md:p-3 col-start-1 sm:col-auto"
                />

                <div className="col-start-1 sm:col-auto">
                  <AliasInput
                    ariaLabel={`Aliases for answer ${aIdx + 1}`}
                    aliases={answer.aliases}
                    onChangeAliases={(aliases) => {
                      onUpdateDraft((prev) => ({
                        ...prev,
                        questions: prev.questions.map((q, qIdx) =>
                          qIdx === safeIndex
                            ? {
                                ...q,
                                answers: q.answers.map((a, idx) =>
                                  idx === aIdx ? { ...a, aliases } : a,
                                ),
                              }
                            : q,
                        ),
                      }));
                    }}
                  />
                </div>

                <select
                  aria-label={`Category for answer ${aIdx + 1}`}
                  value={answer.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    onUpdateDraft((prev) => ({
                      ...prev,
                      questions: prev.questions.map((q, qIdx) =>
                        qIdx === safeIndex
                          ? {
                              ...q,
                              answers: q.answers.map((a, idx) =>
                                idx === aIdx ? { ...a, category } : a,
                              ),
                            }
                          : q,
                      ),
                    }));
                  }}
                  className="krillion-input text-[12px] md:text-[14px] p-2 md:p-3 col-start-1 sm:col-auto"
                >
                  {draft.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name || 'Unnamed category'} ·{' '}
                      {Number.isFinite(cat.points) ? cat.points : '?'} pts
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  title={`Remove answer ${aIdx + 1}`}
                  onClick={() => {
                    onUpdateDraft((prev) => ({
                      ...prev,
                      questions: prev.questions.map((q, qIdx) =>
                        qIdx === safeIndex
                          ? {
                              ...q,
                              answers: q.answers.filter((_, idx) => idx !== aIdx),
                            }
                          : q,
                      ),
                    }));
                  }}
                  className="krillion-btn text-[#ff9cba] p-1 text-[14px] tracking-normal col-start-2 row-start-1 row-end-4 sm:col-auto sm:row-auto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddAnswer}
            className="krillion-btn text-[14px] tracking-normal mt-2"
          >
            ＋ Add answer
          </button>

          <details className="mt-6">
            <summary className="cursor-pointer text-[#e0e9f5] font-medium">
              Bulk add answers
            </summary>
            <p className="text-[13px] text-[#93a6c4] my-2.5 leading-[1.45]">
              One per line:{' '}
              <b className="text-[#e0e9f5]">
                answer ; category name ; alias | alias
              </b>
              <br />
              Example: Neptune ; Deep Cut ; Neptun
              <br />
              You can also use a point value. If no category uses it, one is
              created.
            </p>
            <textarea
              rows={5}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Earth ; Plankton ; Terra\nNeptune ; Deep Cut'}
              className="krillion-input text-[14px] resize-y"
            />
            <button
              type="button"
              onClick={handleBulkAdd}
              className="krillion-btn text-[14px] tracking-normal mt-2.5"
            >
              Add these answers
            </button>
          </details>
        </section>
      </div>
    </section>
  );
}
