import { useState, useEffect } from "react";
import { me } from "playroomkit";
import type { PlayerState } from "playroomkit";
import { ordinal } from "./gameUtils.ts";
import type { StandingEntry } from "./buildStandings.ts";
import { useTranslation } from "../../hooks/useTranslation.ts";

interface FinishOverlayProps {
  raceResult: number | null;
  // Builds the live, ordered standings (humans + bot) on demand — see
  // buildStandings. Called during this overlay's own ~3 Hz re-render so it never
  // re-renders the parent App/Canvas (which would jitter the running game).
  getStandings: () => StandingEntry[];
  // A spectator never finishes: hide the personal position + restart vote and
  // show a neutral "Race finished" header instead.
  spectator?: boolean;
  playersList: PlayerState[];
  onReturnToLobby: () => void;
  onToggleRestart: (v: boolean) => void;
}

// The finish screen is a deliberately cinematic dark overlay, so its text is a
// fixed light tone and the scrim is dark in both modes. Colours come from the
// frontend palette tokens (index.css) rather than hardcoded hex — INK is the
// light text, SCRIM the dark backdrop.
const INK = "var(--color-light-white)";
const INK_DIM = "color-mix(in srgb, var(--color-light-white) 50%, transparent)";
const INK_WASH =
  "color-mix(in srgb, var(--color-light-white) 12%, transparent)";

const btnBase: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  letterSpacing: "0.2em",
  color: INK,
  background: "transparent",
  border: `2px solid ${INK_DIM}`,
  padding: "12px 36px",
  cursor: "pointer",
  textTransform: "uppercase",
  transition: "border-color 0.15s, background 0.15s",
};

function hover(e: React.MouseEvent<HTMLButtonElement>, on: boolean) {
  const el = e.currentTarget;
  el.style.background = on ? INK_WASH : "transparent";
  el.style.borderColor = on ? INK : INK_DIM;
}

export function FinishOverlay({
  raceResult,
  getStandings,
  spectator,
  playersList,
  onReturnToLobby,
  onToggleRestart,
}: FinishOverlayProps) {
  const t = useTranslation("game");
  const [restartReady, setRestartReady] = useState(false);

  // Re-render at ~3 Hz so the live restart-vote count + standings stay current.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 350);
    return () => clearInterval(id);
  }, []);

  // Rebuilt each render (3 Hz) — contained to this overlay, never the game tree.
  const standings = getStandings();

  const myId = me()?.id;
  const racers = playersList.filter((p) => p.state.spectator !== true);
  const readyCount = racers.filter((p) =>
    p.id === myId
      ? restartReady
      : (p.state.restartReady as boolean | undefined) === true,
  ).length;
  const total = racers.length;

  function toggleRestart() {
    const next = !restartReady;
    setRestartReady(next);
    onToggleRestart(next);
  }

  // For the local racer the position resolves a beat after crossing (raceResult);
  // a spectator's view is "resolved" the moment the overlay mounts (race over).
  const resolved = spectator || raceResult !== null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 25,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "color-mix(in srgb, var(--color-black) 78%, transparent)",
        gap: "24px",
      }}
    >
      {spectator ? (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.4rem, 9vw, 5.5rem)",
            letterSpacing: "0.04em",
            color: INK,
            lineHeight: 1,
            textShadow:
              "0 0 60px color-mix(in srgb, var(--color-light-white) 25%, transparent)",
          }}
        >
          {t("raceFinished")}
        </span>
      ) : (
        <>
          <span
            style={{
              fontFamily: "var(--font-condensed)",
              fontSize: "clamp(1rem, 3vw, 1.6rem)",
              letterSpacing: "0.45em",
              color: INK,
              textTransform: "uppercase",
              opacity: 0.7,
            }}
          >
            {t("finished")}
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(5rem, 18vw, 11rem)",
              letterSpacing: "0.04em",
              color: INK,
              lineHeight: 1,
              textShadow:
                "0 0 60px color-mix(in srgb, var(--color-light-white) 25%, transparent)",
            }}
          >
            {raceResult !== null ? ordinal(raceResult).toUpperCase() : "..."}
          </span>
        </>
      )}

      {resolved && standings.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            width: "min(420px, 80vw)",
            marginTop: "8px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-condensed)",
              fontSize: "11px",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: INK_DIM,
              marginBottom: "4px",
            }}
          >
            {t("standings")}
          </span>
          {standings.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 14px",
                background: s.isMe ? INK_WASH : "transparent",
                borderBottom: `1px solid ${INK_WASH}`,
                fontFamily: "var(--font-condensed)",
                fontSize: "15px",
                color: INK,
                fontWeight: s.isMe ? 700 : 400,
              }}
            >
              <span
                style={{
                  width: "2.5ch",
                  textAlign: "right",
                  opacity: 0.6,
                  fontSize: "12px",
                }}
              >
                {ordinal(i + 1)}
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.name}
                {s.isMe ? " ★" : ""}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: s.finished ? INK : INK_DIM,
                }}
              >
                {s.finished
                  ? t("finished")
                  : s.lap > 0
                    ? t("lapShort", { n: s.lap })
                    : t("racing")}
              </span>
            </div>
          ))}
        </div>
      )}

      {resolved && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {!spectator && (
              <button
                onClick={toggleRestart}
                style={{
                  ...btnBase,
                  borderColor: restartReady ? INK : INK_DIM,
                  background: restartReady ? INK_WASH : "transparent",
                }}
                onMouseEnter={(e) => hover(e, true)}
                onMouseLeave={(e) => hover(e, restartReady)}
              >
                {restartReady ? t("waiting") : t("restart")} ({readyCount}/
                {total})
              </button>
            )}
            <button
              onClick={onReturnToLobby}
              style={btnBase}
              onMouseEnter={(e) => hover(e, true)}
              onMouseLeave={(e) => hover(e, false)}
            >
              {t("returnToLobby")}
            </button>
          </div>
          {!spectator && (
            <span
              style={{
                fontFamily: "var(--font-condensed)",
                fontSize: "11px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color:
                  "color-mix(in srgb, var(--color-light-white) 55%, transparent)",
              }}
            >
              {t("restartWhenReady")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
