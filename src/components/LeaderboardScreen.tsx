import { useEffect, useMemo, useState } from 'react';
import { deleteScoreFromCloud, fetchAllRegisteredUsers } from '../firebase';
import type {
  PlayerProfile,
  PublishedPackRecord,
  ScoreEntry,
} from '../types/game';
import { downloadFile } from '../utils/pack';

interface LeaderboardScreenProps {
  packs: PublishedPackRecord[];
  scores: ScoreEntry[];
  activePackId: string;
  currentUserUid: string | null;
  isAdmin: boolean;
  onPlayPack: (record: PublishedPackRecord) => void;
  onHome: () => void;
  onToast: (message: string) => void;
}

function formatTimeAgo(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ms).toLocaleDateString();
}

export function LeaderboardScreen({
  packs,
  scores,
  activePackId,
  currentUserUid,
  isAdmin,
  onPlayPack,
  onHome,
  onToast,
}: LeaderboardScreenProps) {
  const [filterPackId, setFilterPackId] = useState<string>(activePackId || 'all');
  const [showRoster, setShowRoster] = useState(false);
  const [roster, setRoster] = useState<PlayerProfile[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const filteredScores = useMemo(() => {
    const list =
      filterPackId === 'all'
        ? scores
        : scores.filter((s) => s.packId === filterPackId);
    return [...list].sort(
      (a, b) => b.depth - a.depth || b.createdAtMs - a.createdAtMs,
    );
  }, [scores, filterPackId]);

  const recentAnnouncements = useMemo(
    () =>
      [...scores]
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, 6),
    [scores],
  );

  useEffect(() => {
    if (!isAdmin || !showRoster) return;
    let active = true;
    setLoadingRoster(true);
    fetchAllRegisteredUsers()
      .then((list) => {
        if (active) setRoster(list);
      })
      .catch(() => {
        if (active) onToast('Could not load organizer player roster.');
      })
      .finally(() => {
        if (active) setLoadingRoster(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, showRoster, onToast]);

  const handleDeleteScore = async (scoreId: string, name: string) => {
    try {
      await deleteScoreFromCloud(scoreId);
      onToast(`Removed score entry for ${name}.`);
    } catch {
      onToast('Could not remove score entry.');
    }
  };

  const handleExportRosterCsv = () => {
    const header = 'Rank,Player Name,College,Verified Email,Best Depth (m)\n';
    const rows = roster
      .map((u, idx) => {
        const csvCell = (v: string | number) =>
          `"${String(v).replace(/"/g, '""')}"`;
        return [
          idx + 1,
          csvCell(u.playerName),
          csvCell(u.college || '-'),
          csvCell(u.email),
          u.bestDepth,
        ].join(',');
      })
      .join('\n');
    downloadFile(header + rows, 'sapientia-event-roster.csv', 'text/csv');
    onToast('Downloaded event roster CSV.');
  };

  const topScore = filteredScores[0];

  return (
    <section className="max-w-[820px] mx-auto mt-[26px]">
      <div className="krillion-panel p-5 md:p-7 text-center mb-5">
        <div className="text-[16px] tracking-[3px] text-[#ff528d] uppercase">
          ONLINE DIVE STANDINGS
        </div>
        <h1 className="text-[40px] md:text-[52px] tracking-[4px] font-normal mt-2 mb-2 text-[#5de3f9] leading-none">
          SCORE ANNOUNCEMENTS
        </h1>
        <p className="text-[19px] text-[#93a6c4] m-0">
          Top verified divers are announced here for free entry into SAPIENTIA.
        </p>

        {topScore && (
          <div className="mt-4 p-3.5 bg-[#081426] border border-[#5de3f9]">
            <div className="text-[15px] tracking-[2px] text-[#ff528d] uppercase">
              🏆 CURRENT FREE-ENTRY LEADER
            </div>
            <div className="text-[28px] text-[#e0e9f5] leading-tight mt-1">
              {topScore.playerName}
              {topScore.college ? (
                <span className="text-[#93a6c4] text-[20px]">
                  {' '}
                  · {topScore.college}
                </span>
              ) : null}
            </div>
            <div className="text-[22px] text-[#5de3f9] mt-0.5">
              {topScore.depth.toLocaleString()}m · {topScore.points} pts ·{' '}
              {topScore.packTitle}
            </div>
          </div>
        )}
      </div>

      {/* Live Announcements Ticker */}
      <div className="krillion-panel p-4 md:p-5 mb-5">
        <div className="text-[16px] tracking-[3px] text-[#ff528d] uppercase mb-2.5">
          📢 RECENTLY ANNOUNCED DIVES
        </div>
        {recentAnnouncements.length === 0 ? (
          <p className="text-[19px] text-[#93a6c4] m-0">
            No dives announced yet. Complete a pack and sign in to claim the first
            spot!
          </p>
        ) : (
          <div className="grid gap-2">
            {recentAnnouncements.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-[#081426] border border-[#283d57] text-[19px]"
              >
                <div className="min-w-0">
                  <span className="text-[#5de3f9]">{item.playerName}</span>
                  {item.college ? (
                    <span className="text-[#93a6c4]"> ({item.college})</span>
                  ) : null}{' '}
                  <span className="text-[#e0e9f5]">
                    surfaced at {item.depth.toLocaleString()}m
                  </span>{' '}
                  <span className="text-[#93a6c4] text-[17px]">
                    in {item.packTitle}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 text-[18px]">
                  <span>{item.emojiGrid}</span>
                  <span className="text-[#7a94b1] text-[15px]">
                    {formatTimeAgo(item.createdAtMs)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pack Filter & Standings */}
      <div className="krillion-panel p-4 md:p-6 mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-[28px] font-normal text-[#e0e9f5] m-0">
            LEADERBOARD ({filteredScores.length})
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterPackId('all')}
              className={`krillion-btn text-[16px] py-1.5 px-3 min-h-[36px] ${
                filterPackId === 'all' ? 'krillion-btn-primary' : 'krillion-btn-quiet'
              }`}
            >
              ALL PACKS
            </button>
            {packs.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setFilterPackId(record.id)}
                className={`krillion-btn text-[16px] py-1.5 px-3 min-h-[36px] ${
                  filterPackId === record.id
                    ? 'krillion-btn-primary'
                    : 'krillion-btn-quiet'
                }`}
              >
                {record.pack.title}
              </button>
            ))}
          </div>
        </div>

        {filteredScores.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[20px] text-[#93a6c4] mb-4">
              No scores recorded for this pack yet. Be the first on the board!
            </p>
            {filterPackId !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  const found = packs.find((p) => p.id === filterPackId);
                  if (found) onPlayPack(found);
                }}
                className="krillion-btn krillion-btn-primary text-[20px]"
              >
                DIVE THIS PACK NOW
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredScores.map((entry, idx) => {
              const isMe = currentUserUid === entry.uid;
              const isFirst = idx === 0;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between gap-3 py-2.5 px-3.5 border ${
                    isFirst
                      ? 'bg-[#13263d] border-[#5de3f9]'
                      : isMe
                        ? 'bg-[#16332f] border-[#6af0bb]'
                        : 'bg-[#081426] border-[#304560]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-[26px] w-9 text-center shrink-0 ${
                        isFirst ? 'text-[#ff528d]' : 'text-[#7a94b1]'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[22px] text-[#e0e9f5] truncate">
                        {entry.playerName}
                        {isMe && (
                          <span className="text-[#6af0bb] text-[15px] ml-2">
                            (YOU)
                          </span>
                        )}
                      </div>
                      <div className="text-[16px] text-[#93a6c4] truncate">
                        {entry.college ? `${entry.college} · ` : ''}
                        {entry.packTitle} · {entry.acceptedCount}/
                        {entry.totalQuestions} accepted · {entry.emojiGrid}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[25px] text-[#5de3f9] leading-none">
                        {entry.depth.toLocaleString()}m
                      </div>
                      <div className="text-[15px] text-[#ff528d]">
                        {entry.points}/{entry.maxPoints} pts
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        title="Remove score entry"
                        onClick={() =>
                          handleDeleteScore(entry.id, entry.playerName)
                        }
                        className="krillion-btn text-[#ff9cba] text-[16px] py-1 px-2 min-h-[32px]"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Organizer Panel for Free Event Entry Verification */}
      {isAdmin && (
        <div className="krillion-panel p-4 md:p-6 mb-5 border-[#ff528d]">
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            <div>
              <div className="text-[15px] tracking-[2px] text-[#ff528d] uppercase">
                ORGANIZER TOOLS
              </div>
              <h3 className="text-[26px] font-normal text-[#e0e9f5] m-0">
                FREE EVENT ENTRY ROSTER
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowRoster((prev) => !prev)}
                className="krillion-btn krillion-btn-primary text-[17px]"
              >
                {showRoster ? 'HIDE VERIFIED EMAILS' : 'VIEW VERIFIED PLAYERS'}
              </button>
              {showRoster && roster.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportRosterCsv}
                  className="krillion-btn text-[17px]"
                >
                  EXPORT CSV
                </button>
              )}
            </div>
          </div>

          {showRoster && (
            <div className="mt-4">
              {loadingRoster ? (
                <p className="text-[19px] text-[#93a6c4] m-0">
                  Loading registered players…
                </p>
              ) : roster.length === 0 ? (
                <p className="text-[19px] text-[#93a6c4] m-0">
                  No registered players yet.
                </p>
              ) : (
                <div className="grid gap-2">
                  {roster.map((u, i) => (
                    <div
                      key={u.uid}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-[#081426] border border-[#354963] text-[18px]"
                    >
                      <div>
                        <span className="text-[#ff528d] mr-2">#{i + 1}</span>
                        <span className="text-[#e0e9f5]">{u.playerName}</span>
                        {u.college ? (
                          <span className="text-[#93a6c4]"> · {u.college}</span>
                        ) : null}
                        <span className="block sm:inline text-[#5de3f9] sm:ml-3 text-[16px]">
                          {u.email}
                        </span>
                      </div>
                      <div className="text-[#6af0bb]">
                        Best: {u.bestDepth.toLocaleString()}m
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center">
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
