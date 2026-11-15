import type { GamePack } from '../types/game';

interface HomeScreenProps {
  pack: GamePack;
  onStart: () => void;
  onEdit: () => void;
  onNewGame: () => void;
  onImport: () => void;
  onShare: () => void;
  onRestoreDraft: () => void;
  onHelp: () => void;
}

export function HomeScreen({
  pack,
  onStart,
  onEdit,
  onNewGame,
  onImport,
  onShare,
  onRestoreDraft,
  onHelp,
}: HomeScreenProps) {
  return (
    <section className="min-h-[calc(100svh-110px)] md:min-h-[calc(100svh-135px)] flex flex-col items-center text-center">
      <div className="mt-[clamp(35px,7vh,90px)] text-[#132a49]">
        <h1 className="text-[60px] sm:text-[72px] md:text-[clamp(62px,9vw,112px)] font-normal tracking-[4px] md:tracking-[9px] text-[#def9ff] krillion-title-shadow m-0 leading-none">
          KRILLION
        </h1>
        <div className="text-[#188aa8] text-[23px] md:text-[28px] tracking-[3px] md:tracking-[6px] mt-4 mb-5">
          THE DAILY DEEP DIVE
        </div>
        <div className="text-[#466981] text-[18px] md:text-[20px] tracking-[1px]">
          {pack.questions.length} prompts · {pack.seconds} seconds each · rarer answers sink deeper
        </div>
      </div>

      <div className="mt-auto pt-[110px] md:pt-[150px] w-full max-w-[600px]">
        <h2 className="text-[25px] text-[#f0ecff] font-normal mb-1.5 leading-tight">
          {pack.title}
        </h2>
        <p className="text-[19px] text-[#a7bcd4] mx-auto mb-4 max-w-[600px] leading-[1.45]">
          {pack.description}
        </p>

        <button
          type="button"
          onClick={onStart}
          className="krillion-btn krillion-btn-primary w-full text-[27px] tracking-[5px] py-[21px] px-3"
        >
          ▼ BEGIN DESCENT ▼
        </button>

        <div className="grid grid-cols-3 gap-1.5 md:gap-2 my-3.5">
          <button
            type="button"
            onClick={onEdit}
            className="krillion-btn text-[17px] md:text-[19px] py-2.5 px-1.5 md:px-3 whitespace-nowrap"
          >
            EDIT GAME
          </button>
          <button
            type="button"
            onClick={onImport}
            className="krillion-btn text-[17px] md:text-[19px] py-2.5 px-1.5 md:px-3 whitespace-nowrap"
          >
            IMPORT PACK ↑
          </button>
          <button
            type="button"
            onClick={onShare}
            className="krillion-btn text-[17px] md:text-[19px] py-2.5 px-1.5 md:px-3 whitespace-nowrap"
          >
            EXPORT / SHARE ↗
          </button>
        </div>

        <div className="flex items-center justify-center gap-2.5 flex-wrap">
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
          ONE FILE · NO ACCOUNTS · NO INTERNET NEEDED
        </div>
      </div>
    </section>
  );
}
