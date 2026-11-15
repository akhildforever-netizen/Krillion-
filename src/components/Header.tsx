import type { ScreenMode } from '../types/game';

interface HeaderProps {
  screen: ScreenMode;
  soundEnabled: boolean;
  playerName: string | null;
  isSignedIn: boolean;
  isAdmin: boolean;
  onHome: () => void;
  onLeaderboard: () => void;
  onAuthClick: () => void;
  onToggleSound: () => void;
}

export function Header({
  screen,
  soundEnabled,
  playerName,
  isSignedIn,
  isAdmin,
  onHome,
  onLeaderboard,
  onAuthClick,
  onToggleSound,
}: HeaderProps) {
  const isDarkSky =
    screen === 'editor' || screen === 'results' || screen === 'leaderboard';
  const isPlay = screen === 'play';

  return (
    <header
      className={`flex items-center justify-between gap-2 md:gap-4 relative z-30 flex-wrap ${
        isPlay ? 'mb-1' : ''
      }`}
    >
      <div
        className={`tracking-[2px] md:tracking-[3px] whitespace-nowrap shrink-0 ${
          isDarkSky
            ? 'text-[20px] md:text-[21px] text-[#5de3f9]'
            : isPlay
              ? 'text-[15px] text-[#132a49] [text-shadow:1px_1px_#ffffff60]'
              : 'text-[20px] md:text-[21px] text-[#102638] [text-shadow:1px_1px_#ffffff60]'
        }`}
      >
        KRIL
        <span className={isDarkSky ? 'text-[#ff528d]' : 'text-[#bd2461]'}>
          LION
        </span>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2.5 flex-wrap justify-end">
        <button
          type="button"
          onClick={onLeaderboard}
          className="krillion-btn krillion-btn-quiet text-[15px] sm:text-[17px] md:text-[19px] whitespace-nowrap shrink-0 px-2.5 md:px-3.5 py-1.5 min-h-[34px] md:min-h-[42px]"
        >
          🏆 RANKS
        </button>

        {!isPlay && (
          <button
            type="button"
            onClick={onAuthClick}
            title={
              isSignedIn
                ? 'Click to manage player pass or sign out'
                : 'Sign in with Google to announce scores'
            }
            className="krillion-btn krillion-btn-quiet text-[15px] sm:text-[17px] md:text-[19px] whitespace-nowrap shrink-0 px-2.5 md:px-3.5 py-1.5 min-h-[34px] md:min-h-[42px] max-w-[165px] truncate"
          >
            {isSignedIn
              ? `${isAdmin ? '★ ' : '● '}${playerName || 'DIVER'}`
              : 'SIGN IN'}
          </button>
        )}

        <button
          type="button"
          onClick={onHome}
          className="krillion-btn krillion-btn-quiet text-[15px] sm:text-[17px] md:text-[19px] whitespace-nowrap shrink-0 px-2.5 md:px-3.5 py-1.5 min-h-[34px] md:min-h-[42px]"
        >
          ⌂ HOME
        </button>

        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundEnabled}
          className="krillion-btn krillion-btn-quiet text-[15px] sm:text-[17px] md:text-[19px] whitespace-nowrap shrink-0 px-2.5 md:px-3.5 py-1.5 min-h-[34px] md:min-h-[42px]"
        >
          {soundEnabled ? '♫ ON' : '♫ OFF'}
        </button>
      </div>
    </header>
  );
}
