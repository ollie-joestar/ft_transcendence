/**
 * LobbiesPage (/lobby) — live multiplayer lobby browser.
 *
 * Lists the currently-active PlayroomKit rooms (announced by each room's host
 * via the backend lobby registry) and lets the player join one. Joining is a
 * hard navigation to `/game#r=<roomCode>` so PlayroomKit reads the room code
 * from the URL hash and joins that room instead of creating a new one.
 *
 * Refresh is manual (a button) rather than polled — the list is only a snapshot
 * of what's open when you look.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getLobbies } from "../lib/lobbies";
import { useTranslation } from "../hooks/useTranslation";
import type { LobbyRow } from "../types";

// Hard-navigate into the game, joining the chosen room via the URL hash. A full
// load (not react-router) so the Canvas / Rapier / PlayroomKit all init fresh
// and PlayroomKit picks up `#r=<code>` on insertCoin.
function joinLobby(roomCode: string) {
  window.location.href = `/game#r=R${encodeURIComponent(roomCode)}`;
}

export default function LobbiesPage() {
  const navigate = useNavigate();
  const t = useTranslation("lobbies");
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getLobbies()
      .then(setLobbies)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

      {/* Actions: host a new room + refresh */}
      <div className="w-full max-w-[680px] flex items-center justify-between gap-2 mb-5">
        <button
          onClick={() => navigate("/game")}
          className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.15em] uppercase rounded px-4 py-2 border border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 transition-colors"
        >
          {t("hostLobby")}
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.15em] uppercase rounded px-4 py-2 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
        >
          {loading ? t("refreshing") : t("refresh")}
        </button>
      </div>

      {/* Table */}
      <div className="w-full max-w-[680px] border border-[var(--border)] rounded-lg bg-white/25 overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_90px_90px] px-6 py-3 border-b border-[var(--border)] [font-family:var(--font-condensed)] text-[9px] tracking-[0.18em] uppercase text-[var(--muted)]">
          <span>{t("colHostTrack")}</span>
          <span className="text-center">{t("colPlayers")}</span>
          <span className="text-center">{t("colStatus")}</span>
          <span className="text-right">{t("colJoin")}</span>
        </div>

        {loading && lobbies.length === 0 && (
          <div className="px-6 py-8 text-center [font-family:var(--font-body)] text-[13px] text-[var(--muted)]">
            {t("loading")}
          </div>
        )}

        {!loading && error && (
          <div className="px-6 py-8 text-center [font-family:var(--font-body)] text-[13px] text-[var(--muted)]">
            {t("error")}
          </div>
        )}

        {!loading && !error && lobbies.length === 0 && (
          <div className="px-6 py-8 text-center [font-family:var(--font-body)] text-[13px] text-[var(--muted)]">
            {t("empty")}
          </div>
        )}

        {!error &&
          lobbies.map((lobby) => {
            const full = lobby.racerCount >= lobby.maxRacers;
            const racing = lobby.phase === "racing";
            // You can always enter — a full or in-progress room just seats you
            // as a spectator (the game enforces the cap on join).
            const action =
              full || racing ? t("actionSpectate") : t("actionJoin");
            return (
              <div
                key={lobby.roomCode}
                className="grid grid-cols-[1fr_120px_90px_90px] items-center px-6 py-3 border-b border-[var(--border)] last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="[font-family:var(--font-body)] text-[14px] text-[var(--text)] truncate">
                    {lobby.hostName || t("unknownHost")}
                  </p>
                  <p className="[font-family:var(--font-condensed)] text-[10px] tracking-[0.12em] uppercase text-[var(--muted)] truncate">
                    {lobby.track}
                  </p>
                </div>

                <div className="text-center">
                  <span className="[font-family:var(--font-mono)] text-[15px] text-[var(--text)]">
                    {lobby.racerCount}/{lobby.maxRacers}
                  </span>
                  {lobby.playerCount > lobby.racerCount && (
                    <span className="block [font-family:var(--font-condensed)] text-[9px] tracking-[0.12em] uppercase text-[var(--muted)]">
                      +{lobby.playerCount - lobby.racerCount} {t("specSuffix")}
                    </span>
                  )}
                </div>

                <div className="text-center">
                  <span
                    className={`[font-family:var(--font-condensed)] text-[9px] tracking-[0.15em] uppercase px-2 py-1 rounded border
								${
                  racing
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
                  >
                    {racing ? t("statusRacing") : t("statusLobby")}
                  </span>
                </div>

                <div className="text-right">
                  <button
                    onClick={() => joinLobby(lobby.roomCode)}
                    className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.15em] uppercase text-[var(--accent)] border border-[var(--accent)]/40 rounded px-4 py-1.5 hover:bg-[var(--accent)]/5 transition-colors"
                  >
                    {action}
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
