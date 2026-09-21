/**
 * RacesPage (/races) — the player's profile / race history.
 *
 * Loads the caller's aggregate stats and recent race rows in parallel and
 * renders a stats summary (races / wins / best lap) plus a history table.
 * Auth is required by the backend; an unauthenticated request surfaces the
 * error state.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyStats, getMyHistory } from "../lib/races";
import { formatTime, ordinal } from "../game/src/gameUtils";
import { useTranslation } from "../hooks/useTranslation";
import type { UserStats, RaceResultRow } from "../types";

export default function RacesPage() {
  const navigate = useNavigate();
  const t = useTranslation("races");
  const [stats, setStats] = useState<UserStats | null>(null);
  const [history, setHistory] = useState<RaceResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Compact relative timestamp, e.g. "3h ago" / "2d ago". Inside the component
  // so it can localize through the translation hook.
  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t("justNow");
    if (m < 60) return t("minutesAgo", { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("hoursAgo", { count: h });
    const d = Math.floor(h / 24);
    return t("daysAgo", { count: d });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([getMyStats(), getMyHistory()])
      .then(([s, h]) => {
        if (!cancelled) {
          setStats(s);
          setHistory(h);
        }
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
  }, []);

  const bestLapMs =
    stats && stats.bestLapPerTrack.length > 0
      ? Math.min(...stats.bestLapPerTrack.map((b) => b.lapTimeMs))
      : null;

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center px-6 py-10">
      {/* Header */}
      <div className="w-full max-w-[760px] flex items-center justify-between mb-8">
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

      {/* Stats summary */}
      <div className="w-full max-w-[760px] grid grid-cols-3 border border-[var(--border)] rounded-lg bg-white/25 divide-x divide-[var(--border)] mb-6">
        <div className="px-6 py-5">
          <p className="[font-family:var(--font-condensed)] text-[9px] tracking-[0.18em] uppercase text-[var(--muted)]">
            {t("statRaces")}
          </p>
          <p className="[font-family:var(--font-display)] text-[22px] text-[var(--text)]">
            {stats?.totalRaces ?? 0}
          </p>
        </div>
        <div className="px-6 py-5">
          <p className="[font-family:var(--font-condensed)] text-[9px] tracking-[0.18em] uppercase text-[var(--muted)]">
            {t("statWins")}
          </p>
          <p className="[font-family:var(--font-display)] text-[22px] text-[var(--text)]">
            {stats?.wins ?? 0}
          </p>
        </div>
        <div className="px-6 py-5">
          <p className="[font-family:var(--font-condensed)] text-[9px] tracking-[0.18em] uppercase text-[var(--muted)]">
            {t("statBestLap")}
          </p>
          <p className="[font-family:var(--font-mono)] text-[20px] text-[var(--text)]">
            {bestLapMs !== null ? formatTime(bestLapMs) : "--:--.--"}
          </p>
        </div>
      </div>

      {/* History */}
      <div className="w-full max-w-[760px] border border-[var(--border)] rounded-lg bg-white/25 overflow-hidden">
        <div className="grid grid-cols-[1fr_110px_110px_90px] px-6 py-3 border-b border-[var(--border)] [font-family:var(--font-condensed)] text-[9px] tracking-[0.18em] uppercase text-[var(--muted)]">
          <span>{t("colTrack")}</span>
          <span className="text-right">{t("colBestLap")}</span>
          <span className="text-right">{t("colRaceTime")}</span>
          <span className="text-right">{t("colPos")}</span>
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
        {!loading && !error && history.length === 0 && (
          <div className="px-6 py-8 text-center [font-family:var(--font-body)] text-[13px] text-[var(--muted)]">
            {t("empty")}
          </div>
        )}

        {!loading &&
          !error &&
          history.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_110px_110px_90px] items-center px-6 py-3 border-b border-[var(--border)] last:border-b-0"
            >
              <span className="[font-family:var(--font-body)] text-[14px] text-[var(--text)] truncate">
                {row.track}
                <span className="ml-2 [font-family:var(--font-mono)] text-[10px] text-[var(--muted)]">
                  {timeAgo(row.createdAt)}
                </span>
              </span>
              <span className="[font-family:var(--font-mono)] text-[14px] text-[var(--text)] text-right">
                {formatTime(row.lapTimeMs)}
              </span>
              <span className="[font-family:var(--font-mono)] text-[14px] text-[var(--muted)] text-right">
                {row.raceTimeMs !== null ? formatTime(row.raceTimeMs) : "—"}
              </span>
              <span className="[font-family:var(--font-display)] text-[14px] text-[var(--accent)] text-right">
                {row.position !== null ? ordinal(row.position) : "—"}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
