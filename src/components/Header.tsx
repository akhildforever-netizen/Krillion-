import type { ScreenMode } from '../types/game';

interface HeaderProps {
  screen: ScreenMode;
  soundEnabled: boolean;
  onHome: () => void;
  onToggleSound: () => void;
}

export function Header({
  screen,
  soundEnabled,
  onHome,
  onToggleSound,
}: HeaderProps) {
  const isDarkSky = screen === 'editor' || screen === 'results';
  const isPlay = screen === 'play';

  return (
    <header
      className={`flex items-center justify-between gap-4 relative z-30 ${
        isPlay ? 'mb-1' : ''
      }`}
    >
      <div
        className={`tracking-[3px] whitespace-nowrap shrink-0 ${
          isDarkSky
            ? 'text-[21px] text-[#5de3f9]'
            : isPlay
              ? 'text-[15px] text-[#132a49] [text-shadow:1px_1px_#ffffff60]'
              : 'text-[21px] text-[#102638] [text-shadow:1px_1px_#ffffff60]'
        }`}
      >
        KRIL
        <span className={isDarkSky ? 'text-[#ff528d]' : 'text-[#bd2461]'}>
          LION
        </span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onHome}
          className="krillion-btn krillion-btn-quiet text-[17px] md:text-[20px] whitespace-nowrap shrink-0 px-3 md:px-4 py-1.5 min-h-[35px] md:min-h-[42px]"
        >
          ⌂ HOME
        </button>
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundEnabled}
          className="krillion-btn krillion-btn-quiet text-[17px] md:text-[20px] whitespace-nowrap shrink-0 px-3 md:px-4 py-1.5 min-h-[35px] md:min-h-[42px]"
        >
          {soundEnabled ? '♫ SOUND ON' : '♫ SOUND OFF'}
        </button>
      </div>
    </header>
  );
}
