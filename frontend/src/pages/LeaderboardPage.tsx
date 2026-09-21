/**
 * LeaderboardPage (/leaderboard) — per-track ranking by best lap.
 *
 * Picks a track, fetches the ranked best-lap-per-user list from the backend,
 * and renders it; the current user's row is highlighted. Reuses the game's
 * `formatTime` so lap times read identically to the in-game HUD.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { getLeaderboard } from "../lib/races";
import { formatTime } from "../game/src/gameUtils";
import { useTranslation } from "../hooks/useTranslation";
import type { LeaderboardEntry } from "../types";

// Selectable tracks. `id` is the stored track identifier (the trailing path
// segment used when submitting results); `label` is the display name.
// Keep this list in sync with the TRACKS registry in game/src/options.ts.
const TRACKS = [
  { id: "Tengu", label: "Tengu" },
  { id: "Kirin", label: "Kirin" },
  { id: "Orochi", label: "Orochi" },
  { id: "Raijin", label: "Raijin" },
];

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useTranslation("leaderboard");
  const [track, setTrack] = useState(TRACKS[0].id);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getLeaderboard(track)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [track]);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center px-6 py-10">
      {/* Header */}
      <div className="w-full max-w-[680px] flex items-center justify-between mb-8">
        <div>
          <p className="[font-family:var(--font-condensed)] text-[12px] tracking-[0.22em] uppercase text-[var(--accent)] mb-1">
            {t("eyebrow")}
          </p>
          <h1 className="[font-family:var(--font-display)] text-[42px] leading-none tracking-[0.02em] text-[var(--text)]">
            {t("title")}
          </h1>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.15em] uppercase text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          {t("backDashboard")}
        </button>
      </div>

      {/* Track selector */}
      <div className="w-full max-w-[680px] flex gap-2 mb-5">
        {TRACKS.map((tr) => (
          <button
            key={tr.id}
            onClick={() => setTrack(tr.id)}
            className={`[font-family:var(--font-condensed)] text-[11px] tracking-[0.15em] uppercase rounded px-4 py-2 border transition-colors
						${
              tr.id === track
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {tr.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="w-full max-w-[680px] border border-[var(--border)] rounded-lg bg-white/25 overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[60px_1fr_120px] px-6 py-3 border-b border-[var(--border)] [font-family:var(--font-condensed)] text-[9px] tracking-[0.18em] uppercase text-[var(--muted)]">
          <span>{t("colRank")}</span>
          <span>{t("colDriver")}</span>
          <span className="text-right">{t("colBestLap")}</span>
        </div>

        {loading && (
          <div className="px-6 py-8 text-center [font-family:var(--font-body)] text-[13px] text-[var(--muted)]">
            {t("loading")}
          </div>
        )}

        {!loading && error && (
          <div className="px-6 py-8 text-center [font-family:var(--font-body)] text-[13px] text-[var(--muted)]">
            {t("error")}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="px-6 py-8 text-center [font-family:var(--font-body)] text-[13px] text-[var(--muted)]">
            {t("empty")}
          </div>
        )}

        {!loading &&
          !error &&
          entries.map((entry) => {
            const isMe = !!user && entry.userId === user.id;
            return (
              <div
                key={entry.userId}
                className={`grid grid-cols-[60px_1fr_120px] items-center px-6 py-3 border-b border-[var(--border)] last:border-b-0
							${isMe ? "bg-[var(--accent)]/10" : ""}`}
              >
                <span className="[font-family:var(--font-display)] text-[18px] text-[var(--text)]">
                  {entry.rank}
                </span>
                <span className="[font-family:var(--font-body)] text-[14px] text-[var(--text)] truncate">
                  {entry.username ?? t("unknown")}
                  {isMe && (
                    <span className="ml-2 [font-family:var(--font-condensed)] text-[9px] tracking-[0.15em] uppercase text-[var(--accent)]">
                      {t("you")}
                    </span>
                  )}
                </span>
                <span className="[font-family:var(--font-mono)] text-[15px] text-[var(--text)] text-right">
                  {formatTime(entry.lapTimeMs)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
