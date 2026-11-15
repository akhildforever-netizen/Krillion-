/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorScreen } from './components/EditorScreen';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { ModalDialog, type ActiveModal } from './components/ModalDialog';
import { OceanCanvas } from './components/OceanCanvas';
import { PlayScreen } from './components/PlayScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { BUILTIN_PACKS, DEFAULT_CATEGORIES } from './data/defaults';
import {
  auth,
  isAdminUser,
  loadPlayerProfile,
  publishPackToCloud,
  sanitizePackId,
  signInWithGoogle,
  signOutPlayer,
  submitScoreEntry,
  subscribePublishedPacks,
  subscribeScores,
} from './firebase';
import type {
  GamePack,
  PlayerProfile,
  PublishedPackRecord,
  RoundResult,
  RunState,
  ScoreEntry,
  ScreenMode,
} from './types/game';
import { soundEngine } from './utils/audio';
import {
  buildPortableHtml,
  clone,
  downloadFile,
  DRAFT_STORAGE_KEY_V1,
  DRAFT_STORAGE_KEY_V2,
  migratePack,
  slugifyTitle,
  validatePack,
} from './utils/pack';

function createBlankDraft(): GamePack {
  const categories = clone(DEFAULT_CATEGORIES);
  return {
    format: 'deep-dive',
    version: 2,
    title: 'My custom dive',
    description: 'How well do you know our world?',
    seconds: 25,
    categories,
    questions: [
      {
        prompt: '',
        answers: [
          {
            text: '',
            category:
              categories.find((c) => c.id === 'schooler')?.id ?? categories[0].id,
            aliases: [],
          },
        ],
      },
    ],
  };
}

export default function App() {
  const [screen, setScreen] = useState<ScreenMode>('home');
  const [activePackId, setActivePackId] = useState<string>(BUILTIN_PACKS[0].id);
  const [pack, setPack] = useState<GamePack>(() => clone(BUILTIN_PACKS[0].pack));
  const [activeEventBanner, setActiveEventBanner] = useState<string>(
    BUILTIN_PACKS[0].eventBanner,
  );
  const [cloudPacks, setCloudPacks] = useState<PublishedPackRecord[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  const [draft, setDraft] = useState<GamePack>(() => clone(BUILTIN_PACKS[0].pack));
  const [dirty, setDirty] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [editorStatus, setEditorStatus] = useState(
    'Your prompts. Your answers. Your rules.',
  );

  const [run, setRun] = useState<RunState | null>(null);
  const [finalResults, setFinalResults] = useState<{
    results: RoundResult[];
    total: number;
  } | null>(null);
  const [targetDepth, setTargetDepth] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const depthElementRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMsg(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
      toastTimerRef.current = null;
    }, 4500);
  }, []);

  const availablePacks = useMemo(() => {
    const map = new Map<string, PublishedPackRecord>();
    for (const b of BUILTIN_PACKS) {
      map.set(b.id, b);
    }
    for (const c of cloudPacks) {
      map.set(c.id, c);
    }
    return Array.from(map.values()).sort(
      (a, b) => Number(b.featured) - Number(a.featured),
    );
  }, [cloudPacks]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        loadPlayerProfile(nextUser.uid)
          .then((loaded) => setProfile(loaded))
          .catch(() => {
            // Profile may not exist yet before first score submission
            setProfile(null);
          });
      } else {
        setProfile(null);
      }
    });

    const unsubPacks = subscribePublishedPacks(
      (records) => setCloudPacks(records),
      () => {
        // Keep builtin packs if offline or unavailable
      },
    );

    const unsubScores = subscribeScores(
      (entries) => setScores(entries),
      () => {
        // Ignore transient offline read issues
      },
    );

    return () => {
      unsubAuth();
      unsubPacks();
      unsubScores();
    };
  }, []);

  useEffect(() => {
    document.body.dataset.screen = screen;
  }, [screen]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (screen === 'editor' && dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [screen, dirty]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const admin = isAdminUser(user);
  const displayPlayerName =
    profile?.playerName || user?.displayName || null;

  const goHomeImmediate = useCallback(() => {
    setModal(null);
    setRun((prev) =>
      prev && prev.phase !== 'done' ? { ...prev, phase: 'abandoned' } : prev,
    );
    setTargetDepth(0);
    setScreen('home');
  }, []);

  const navigateSafely = (onProceed: () => void) => {
    if (screen === 'play') {
      setModal({
        type: 'confirm',
        eyebrow: 'ABANDON DIVE?',
        title: 'SURFACE EARLY?',
        message: 'Leave this dive? Your current run will end.',
        confirmLabel: 'LEAVE DIVE',
        onConfirm: onProceed,
      });
      return;
    }
    if (screen === 'editor' && dirty) {
      setModal({
        type: 'confirm',
        eyebrow: 'UNSAVED CHANGES',
        title: 'LEAVE WORKSHOP?',
        message:
          'Export or publish first for a reliable copy. Your browser draft is kept when storage is available.',
        confirmLabel: 'LEAVE WORKSHOP',
        onConfirm: onProceed,
      });
      return;
    }
    onProceed();
  };

  const handleHomeClick = () => {
    if (screen === 'home') return;
    navigateSafely(goHomeImmediate);
  };

  const handleOpenLeaderboard = () => {
    if (screen === 'leaderboard') return;
    navigateSafely(() => {
      setModal(null);
      setTargetDepth(0);
      setScreen('leaderboard');
    });
  };

  const handleSignIn = async () => {
    try {
      const signedIn = await signInWithGoogle();
      showToast(`Signed in as ${signedIn.displayName || signedIn.email}`);
    } catch {
      showToast('Google sign-in was cancelled or blocked.');
    }
  };

  const handleAuthClick = () => {
    if (!user) {
      void handleSignIn();
      return;
    }
    setModal({
      type: 'confirm',
      eyebrow: admin ? 'ORGANIZER ACCOUNT' : 'PLAYER PASS',
      title: displayPlayerName || 'SIGNED IN',
      message: `Signed in with ${user.email ?? 'Google'}. Would you like to sign out?`,
      confirmLabel: 'SIGN OUT',
      onConfirm: () => {
        void signOutPlayer().then(() => showToast('Signed out.'));
      },
    });
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    soundEngine.enabled = next;
    setSoundEnabled(next);
    if (next) {
      soundEngine.tone(440);
    }
  };

  const handleSelectPack = (record: PublishedPackRecord) => {
    setActivePackId(record.id);
    setPack(clone(record.pack));
    setActiveEventBanner(record.eventBanner);
  };

  const startDive = useCallback(() => {
    setModal(null);
    setFinalResults(null);
    setTargetDepth(0);
    setRun({
      index: 0,
      total: 0,
      results: [],
      phase: 'reading',
      attempts: 0,
    });
    setScreen('play');
    soundEngine.splash();
  }, []);

  const openEditor = (fresh: boolean) => {
    setDraft(fresh ? createBlankDraft() : clone(pack));
    setSelectedQuestion(0);
    setDirty(false);
    setEditorStatus('Your prompts. Your answers. Your rules.');
    setTargetDepth(1800);
    setScreen('editor');
  };

  const handleRestoreDraft = () => {
    try {
      const saved =
        window.localStorage.getItem(DRAFT_STORAGE_KEY_V2) ??
        window.localStorage.getItem(DRAFT_STORAGE_KEY_V1);
      if (!saved) {
        showToast('No saved draft in this browser.');
        return;
      }
      const migrated = migratePack(JSON.parse(saved)) as GamePack;
      if (
        !Array.isArray(migrated.questions) ||
        migrated.questions.length === 0 ||
        !Array.isArray(migrated.categories) ||
        migrated.categories.length === 0
      ) {
        throw new Error('Invalid draft structure.');
      }
      setDraft(migrated);
      setSelectedQuestion(0);
      setDirty(false);
      setEditorStatus('Draft restored from this browser.');
      setTargetDepth(1800);
      setScreen('editor');
      showToast('Draft restored.');
    } catch {
      showToast('Could not restore this draft. Import a saved pack instead.');
    }
  };

  const handleUpdateDraft = useCallback(
    (updater: (prev: GamePack) => GamePack) => {
      setDraft((prev) => {
        const next = updater(prev);
        setDirty(true);
        try {
          window.localStorage.setItem(DRAFT_STORAGE_KEY_V2, JSON.stringify(next));
          setEditorStatus(
            'Draft saved in this browser. Export or publish to keep it.',
          );
        } catch {
          setEditorStatus('Browser saving unavailable — export to keep your work.');
        }
        return next;
      });
    },
    [],
  );

  const handleSaveAndPlay = () => {
    try {
      const validated = validatePack(draft);
      setPack(validated);
      setActivePackId(sanitizePackId(validated.title));
      setActiveEventBanner('');
      setDirty(false);
      setTargetDepth(0);
      setScreen('home');
      showToast('Game ready. Begin descent to play.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check your game fields.');
    }
  };

  const handleExportFromEditor = () => {
    try {
      const validated = validatePack(draft);
      setPack(validated);
      setDirty(false);
      setModal({ type: 'share' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check your game fields.');
    }
  };

  const handlePublishOnline = async (options: {
    featured: boolean;
    eventBanner: string;
  }) => {
    if (!user || !admin) {
      showToast('Sign in as the event organizer to publish packs online.');
      return;
    }
    try {
      const validated = validatePack(draft);
      const packId = sanitizePackId(validated.title);
      await publishPackToCloud({
        packId,
        pack: validated,
        featured: options.featured,
        eventBanner: options.eventBanner,
        authorUid: user.uid,
      });
      setPack(validated);
      setActivePackId(packId);
      setActiveEventBanner(options.eventBanner);
      setDirty(false);
      showToast(`Published “${validated.title}” online for all players!`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not publish pack online.',
      );
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Choose a game pack smaller than 5 MB.');
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      const imported = validatePack(parsed);
      setPack(imported);
      setActivePackId(sanitizePackId(imported.title));
      setActiveEventBanner('');
      setDirty(false);
      setTargetDepth(0);
      setScreen('home');
      showToast(`Imported: ${imported.title}`);
    } catch (err) {
      showToast(
        `Import failed: ${err instanceof Error ? err.message : 'Invalid JSON pack.'}`,
      );
    }
  };

  const handleExportJson = () => {
    downloadFile(
      JSON.stringify(pack, null, 2),
      `${slugifyTitle(pack.title)}.deepdive.json`,
      'application/json',
    );
  };

  const handleExportHtml = async () => {
    try {
      const html = await buildPortableHtml(pack);
      downloadFile(html, `${slugifyTitle(pack.title)}.html`, 'text/html');
      showToast('Portable game exported.');
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Could not export standalone HTML.',
      );
    }
  };

  const handleCompleteGame = useCallback(
    (results: RoundResult[], total: number) => {
      setFinalResults({ results, total });
      setRun((prev) => (prev ? { ...prev, phase: 'done' } : null));
      setTargetDepth(0);
      setScreen('results');
      soundEngine.splash();
    },
    [],
  );

  const handleSubmitScore = async (payload: {
    playerName: string;
    college: string;
    maxPoints: number;
    acceptedCount: number;
    emojiGrid: string;
  }) => {
    if (!user) {
      throw new Error('Sign in with Google first to announce your score.');
    }
    if (!finalResults) {
      throw new Error('No dive result to announce.');
    }
    const scoreId = await submitScoreEntry({
      uid: user.uid,
      email: user.email ?? '',
      playerName: payload.playerName,
      college: payload.college,
      packId: activePackId,
      packTitle: pack.title,
      points: finalResults.total,
      maxPoints: payload.maxPoints,
      acceptedCount: payload.acceptedCount,
      totalQuestions: pack.questions.length,
      emojiGrid: payload.emojiGrid,
    });
    setProfile({
      uid: user.uid,
      playerName: payload.playerName,
      college: payload.college,
      email: user.email ?? '',
      bestDepth: Math.max(profile?.bestDepth ?? 0, finalResults.total * 10),
    });
    return scoreId;
  };

  const activePackScores = useMemo(
    () => scores.filter((s) => s.packId === activePackId),
    [scores, activePackId],
  );

  return (
    <>
      <OceanCanvas
        screen={screen}
        targetDepth={targetDepth}
        depthElementRef={depthElementRef}
      />
      <div className="scanlines" aria-hidden="true" />

      <div className="relative z-[2] max-w-[1160px] mx-auto px-[18px] pt-4 pb-[25px] md:px-8 md:pt-[22px] md:pb-[35px]">
        <Header
          screen={screen}
          soundEnabled={soundEnabled}
          playerName={displayPlayerName}
          isSignedIn={Boolean(user)}
          isAdmin={admin}
          onHome={handleHomeClick}
          onLeaderboard={handleOpenLeaderboard}
          onAuthClick={handleAuthClick}
          onToggleSound={handleToggleSound}
        />

        <main>
          {screen === 'home' && (
            <HomeScreen
              pack={pack}
              activePackId={activePackId}
              activeEventBanner={activeEventBanner}
              availablePacks={availablePacks}
              scores={scores}
              onSelectPack={handleSelectPack}
              onStart={startDive}
              onEdit={() => openEditor(false)}
              onNewGame={() => openEditor(true)}
              onImport={() => fileInputRef.current?.click()}
              onShare={() => setModal({ type: 'share' })}
              onRestoreDraft={handleRestoreDraft}
              onHelp={() => setModal({ type: 'help' })}
              onOpenLeaderboard={handleOpenLeaderboard}
            />
          )}

          {screen === 'play' && run && (
            <PlayScreen
              pack={pack}
              run={run}
              depthElementRef={depthElementRef}
              onUpdateRun={setRun}
              onSetTargetDepth={setTargetDepth}
              onOpenTypo={(payload) => setModal({ type: 'typo', ...payload })}
              onCloseModal={() => setModal(null)}
              onCompleteGame={handleCompleteGame}
              onToast={showToast}
            />
          )}

          {screen === 'results' && finalResults && (
            <ResultsScreen
              pack={pack}
              activePackId={activePackId}
              results={finalResults.results}
              totalPoints={finalResults.total}
              isSignedIn={Boolean(user)}
              defaultPlayerName={profile?.playerName || user?.displayName || ''}
              defaultCollege={profile?.college || ''}
              packScores={activePackScores}
              onSignIn={handleSignIn}
              onSubmitScore={handleSubmitScore}
              onOpenLeaderboard={handleOpenLeaderboard}
              onReplay={startDive}
              onHome={goHomeImmediate}
              onToast={showToast}
              onCopyFallback={(text) =>
                setModal({ type: 'copyFallback', text })
              }
            />
          )}

          {screen === 'leaderboard' && (
            <LeaderboardScreen
              packs={availablePacks}
              scores={scores}
              activePackId={activePackId}
              currentUserUid={user?.uid ?? null}
              isAdmin={admin}
              onPlayPack={(record) => {
                handleSelectPack(record);
                setModal(null);
                setFinalResults(null);
                setTargetDepth(0);
                setRun({
                  index: 0,
                  total: 0,
                  results: [],
                  phase: 'reading',
                  attempts: 0,
                });
                setScreen('play');
                soundEngine.splash();
              }}
              onHome={goHomeImmediate}
              onToast={showToast}
            />
          )}

          {screen === 'editor' && (
            <EditorScreen
              draft={draft}
              selectedQuestion={selectedQuestion}
              statusNote={editorStatus}
              isAdmin={admin}
              onSelectQuestion={setSelectedQuestion}
              onUpdateDraft={handleUpdateDraft}
              onSaveAndPlay={handleSaveAndPlay}
              onExportFromEditor={handleExportFromEditor}
              onPublishOnline={handlePublishOnline}
              onToast={showToast}
              onRequestConfirmDeleteQuestion={(onConfirm) =>
                setModal({
                  type: 'confirm',
                  eyebrow: 'REMOVE QUESTION',
                  title: 'DELETE QUESTION?',
                  message: 'Delete this question and all of its answers?',
                  confirmLabel: 'DELETE QUESTION',
                  onConfirm,
                })
              }
            />
          )}
        </main>

        {screen !== 'play' && (
          <footer className="text-center text-[14px] text-[#90a8c6] tracking-[1px] mt-[30px]">
            KRILLION ONLINE · THEME PACKS &amp; EVENT LEADERBOARD ·{' '}
            <button
              type="button"
              onClick={() => setModal({ type: 'credits' })}
              className="cursor-pointer border-0 bg-transparent text-[#90a8c6] hover:text-[#5de3f9] text-[14px] py-0.5 px-2"
            >
              ABOUT / CREDITS
            </button>
          </footer>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.deepdive,.sapientia,application/json"
        hidden
        onChange={handleFileImport}
      />

      <ModalDialog
        modal={modal}
        onClose={() => setModal(null)}
        onExportJson={handleExportJson}
        onExportHtml={handleExportHtml}
        onToast={showToast}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-[25px] left-1/2 -translate-x-1/2 py-3.5 px-[22px] border border-[#5db4bd] bg-[#142b3c] text-[#e1f2ff] z-40 max-w-[90vw] shadow-[4px_4px_#030915] text-[21px]"
        >
          {toastMsg}
        </div>
      )}
    </>
  );
}
