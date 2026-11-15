import type {
  GamePack,
  PublishedPackRecord,
  ScoreEntry,
} from '../types/game';

interface HomeScreenProps {
  pack: GamePack;
  activePackId: string;
  activeEventBanner: string;
  availablePacks: PublishedPackRecord[];
  scores: ScoreEntry[];
  onSelectPack: (record: PublishedPackRecord) => void;
  onStart: () => void;
  onEdit: () => void;
  onNewGame: () => void;
  onImport: () => void;
  onShare: () => void;
  onRestoreDraft: () => void;
  onHelp: () => void;
  onOpenLeaderboard: () => void;
}

export function HomeScreen({
  pack,
  activePackId,
  activeEventBanner,
  availablePacks,
  scores,
  onSelectPack,
  onStart,
  onEdit,
  onNewGame,
  onImport,
  onShare,
  onRestoreDraft,
  onHelp,
  onOpenLeaderboard,
}: HomeScreenProps) {
  const packScores = scores.filter((s) => s.packId === activePackId);
  const topForPack = [...packScores].sort((a, b) => b.depth - a.depth)[0];
  const latestOverall = [...scores].sort(
    (a, b) => b.createdAtMs - a.createdAtMs,
  )[0];

  return (
    <section className="min-h-[calc(100svh-110px)] md:min-h-[calc(100svh-135px)] flex flex-col items-center text-center">
      <div className="mt-[clamp(30px,6vh,80px)] text-[#132a49]">
        <h1 className="text-[60px] sm:text-[72px] md:text-[clamp(62px,9vw,112px)] font-normal tracking-[4px] md:tracking-[9px] text-[#def9ff] krillion-title-shadow m-0 leading-none">
          KRILLION
        </h1>
        <div className="text-[#188aa8] text-[23px] md:text-[28px] tracking-[3px] md:tracking-[6px] mt-4 mb-4">
          THE DAILY DEEP DIVE
        </div>
        <div className="text-[#466981] text-[18px] md:text-[20px] tracking-[1px]">
          {pack.questions.length} prompts · {pack.seconds} seconds each · rarer
          answers sink deeper
        </div>
      </div>

      <div className="mt-auto pt-[90px] md:pt-[125px] w-full max-w-[640px]">
        {/* Uploaded Theme Packs Switcher */}
        {availablePacks.length > 0 && (
          <div className="mb-4">
            <div className="text-[14px] tracking-[2px] text-[#79cfdf] uppercase mb-2">
              UPLOADED THEME PACKS
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {availablePacks.map((record) => {
                const isSelected = record.id === activePackId;
                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => onSelectPack(record)}
                    className={`krillion-btn text-[16px] md:text-[18px] py-1.5 px-3 min-h-[38px] ${
                      isSelected
                        ? 'krillion-btn-primary text-[#def9ff]'
                        : 'krillion-btn-quiet'
                    }`}
                  >
                    {record.featured ? '★ ' : ''}
                    {record.pack.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeEventBanner && (
          <div className="mb-3 py-2 px-3 bg-[#17122dcc] border border-[#ff528d] text-[#ffd6e6] text-[17px] md:text-[18px] tracking-[0.5px]">
            🎟 {activeEventBanner}
          </div>
        )}

        <h2 className="text-[25px] text-[#f0ecff] font-normal mb-1.5 leading-tight">
          {pack.title}
        </h2>
        <p className="text-[19px] text-[#a7bcd4] mx-auto mb-3.5 max-w-[600px] leading-[1.45]">
          {pack.description}
        </p>

        {/* Live Score Announcer Strip */}
        {(topForPack || latestOverall) && (
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="w-full mb-3.5 py-2 px-3 bg-[#091628dd] border border-[#3a5778] hover:border-[#5de3f9] text-left cursor-pointer transition-colors"
          >
            {topForPack ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[17px]">
                <span className="text-[#5de3f9]">
                  🏆 LEADER: <b className="text-[#e0e9f5] font-normal">{topForPack.playerName}</b>
                  {topForPack.college ? ` (${topForPack.college})` : ''}
                </span>
                <span className="text-[#ff528d]">
                  {topForPack.depth.toLocaleString()}m · VIEW RANKS →
                </span>
              </div>
            ) : latestOverall ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[17px]">
                <span className="text-[#5de3f9]">
                  📢 LATEST: <b className="text-[#e0e9f5] font-normal">{latestOverall.playerName}</b>{' '}
                  surfaced at {latestOverall.depth.toLocaleString()}m
                </span>
                <span className="text-[#ff528d]">VIEW RANKS →</span>
              </div>
            ) : null}
          </button>
        )}

        <button
          type="button"
          onClick={onStart}
          className="krillion-btn krillion-btn-primary w-full text-[27px] tracking-[5px] py-[21px] px-3"
        >
          ▼ BEGIN DESCENT ▼
        </button>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-3.5">
          <button
            type="button"
            onClick={onEdit}
            className="krillion-btn text-[17px] md:text-[19px] py-2.5 px-2 md:px-3 whitespace-nowrap min-w-0"
          >
            EDIT GAME
          </button>
          <button
            type="button"
            onClick={onImport}
            className="krillion-btn text-[17px] md:text-[19px] py-2.5 px-2 md:px-3 whitespace-nowrap min-w-0"
          >
            IMPORT PACK ↑
          </button>
          <button
            type="button"
            onClick={onShare}
            className="krillion-btn col-span-2 sm:col-span-1 text-[17px] md:text-[19px] py-2.5 px-2 md:px-3 whitespace-nowrap min-w-0"
          >
            EXPORT / SHARE ↗
          </button>
        </div>

        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="cursor-pointer border-0 bg-transparent text-[#5de3f9] hover:text-[#ff528d] text-[18px] px-2 py-1.5"
          >
            🏆 Leaderboard ({scores.length})
          </button>
          <button
            type="button"
            onClick={onNewGame}
            className="cursor-pointer border-0 bg-transparent text-[#a6bed6] hover:text-[#5de3f9] text-[18px] px-2 py-1.5"
          >
            ＋ New game
          </button>
          <button
            type="button"
            onClick={onRestoreDraft}
            className="cursor-pointer border-0 bg-transparent text-[#a6bed6] hover:text-[#5de3f9] text-[18px] px-2 py-1.5"
          >
            Restore draft
          </button>
          <button
            type="button"
            onClick={onHelp}
            className="cursor-pointer border-0 bg-transparent text-[#a6bed6] hover:text-[#5de3f9] text-[18px] px-2 py-1.5"
          >
            ▸ How to play
          </button>
        </div>

        <div className="text-[14px] tracking-[2px] text-[#7a94b1] mt-3">
          ONLINE LEADERBOARD · THEME PACKS · FREE EVENT ENTRY STANDINGS
        </div>
      </div>
    </section>
  );
}
