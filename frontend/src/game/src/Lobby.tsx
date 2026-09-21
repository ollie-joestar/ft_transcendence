import { useState, useEffect } from "react";
import { me } from "playroomkit";
import type { PlayerState } from "playroomkit";
import { useAuthOptional } from "./useAuthOptional.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Badge } from "../../components/ui/Badge.tsx";
import { Card, CardHeader } from "../../components/ui/Card.tsx";
import { LapSelector } from "./LapSelector.tsx";
import { MAX_RACERS } from "./useMultiplayer.ts";
import { useFriends } from "../../hooks/useFriends.ts";
import { useTranslation } from "../../hooks/useTranslation.ts";
import api from "../../lib/api.ts";

interface LobbyProps {
  playersList: PlayerState[];
  amHost: boolean;
  amSpectator: boolean;
  startGame: () => void;
  // Multiplayer lobby has no bots; the host chooses the lap count instead.
  laps: number;
  onLaps: (n: number) => void;
  // True once the host has opened a Multiplayer lobby. Until then a non-host is
  // locked as a spectator and can't take a racer seat.
  lobbyOpen: boolean;
  // Host-only: return to the race-setup menu.
  onBackToMenu: () => void;
  // Non-host: leave the lobby and return to the dashboard.
  onExitToDashboard: () => void;
  onToggleReady: (v: boolean) => void;
  onToggleSpectator: (v: boolean) => void;
}

export function Lobby({
  playersList,
  amHost,
  amSpectator,
  startGame,
  laps,
  onLaps,
  lobbyOpen,
  onBackToMenu,
  onExitToDashboard,
  onToggleReady,
  onToggleSpectator,
}: LobbyProps) {
  const { user } = useAuthOptional();
  const { friends } = useFriends();
  const t = useTranslation("game");
  const [copied, setCopied] = useState(false);
  // Tracks the "Invite Friends" button feedback: idle → sending → sent / none.
  const [inviteStatus, setInviteStatus] = useState<
    "idle" | "sending" | "sent" | "none"
  >("idle");
  const myId = me()?.id;

  // Re-render at ~3 Hz so remote players' ready/spectator state (mutated in
  // place on PlayerState by PlayroomKit) is reflected without a setState.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 350);
    return () => clearInterval(id);
  }, []);

  const myReady = me()?.state.lobbyReady === true;
  // Players who must ready up before the host can start (everyone but the
  // host and spectators).
  const racers = playersList.filter(
    (p) =>
      p.state.spectator !== true &&
      (p.state.isHost as boolean | undefined) !== true,
  );
  const allReady = racers.every((p) => p.state.lobbyReady === true);
  const racerCount = playersList.filter(
    (p) => p.state.spectator !== true,
  ).length;
  // Non-hosts can only pick a role once the host has opened the lobby; until
  // then they're locked as spectators. Joining as a racer is also blocked when
  // the racer slots are full.
  const canPickRole = amHost || lobbyOpen;
  const racersFull = racerCount >= MAX_RACERS;

  // PlayroomKit sets window.location.hash to "#r=R<code>" when the room is created
  const inviteUrl = window.location.href;

  function copyInvite() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Message every friend the clickable invite link to this lobby.
  async function inviteFriends() {
    if (inviteStatus === "sending") return;
    if (friends.length === 0) {
      setInviteStatus("none");
      setTimeout(() => setInviteStatus("idle"), 2000);
      return;
    }
    setInviteStatus("sending");
    const host = user?.username ?? t("aFriend");
    const body = t("inviteMessage", { host, url: inviteUrl });
    await Promise.allSettled(
      friends.map((f) => api.post("/messages", { toUserId: f.id, body })),
    );
    setInviteStatus("sent");
    setTimeout(() => setInviteStatus("idle"), 2000);
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        color: "var(--text)",
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "3.5rem",
          letterSpacing: "0.15em",
          color: "var(--accent)",
          margin: 0,
          marginBottom: "4px",
        }}
      >
        SAKURA DRIFT
      </h1>
      <p
        style={{
          fontFamily: "var(--font-condensed)",
          fontSize: "11px",
          letterSpacing: "0.3em",
          color: "var(--muted)",
          marginBottom: "32px",
          textTransform: "uppercase",
          margin: "0 0 32px",
        }}
      >
        {t("lobby")}
      </p>

      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Invite link */}
        <Card>
          <CardHeader title={t("inviteLink")} />
          <div
            style={{
              padding: "12px 20px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--muted)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {inviteUrl}
            </span>
            <Button variant="sm" onClick={copyInvite}>
              {copied ? t("copied") : t("copy")}
            </Button>
            <Button
              variant="sm"
              onClick={inviteFriends}
              disabled={inviteStatus === "sending"}
            >
              {inviteStatus === "sending"
                ? t("sending")
                : inviteStatus === "sent"
                  ? t("sent")
                  : inviteStatus === "none"
                    ? t("noFriends")
                    : t("inviteFriends")}
            </Button>
          </div>
        </Card>

        {/* Race settings — host picks the lap count (1–20); others see it. */}
        <Card>
          <CardHeader title={t("laps")} />
          <div
            style={{
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--muted)",
              }}
            >
              {amHost ? t("setNumberOfLaps") : t("lapsSetByHost")}
            </span>
            <LapSelector value={laps} onChange={onLaps} disabled={!amHost} />
          </div>
        </Card>

        {/* Player list */}
        <Card>
          <CardHeader title={t("players", { count: playersList.length })} />
          <div
            style={{
              padding: "12px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {playersList.map((p) => {
              const isMe = p.id === myId;
              const isPlayerHost = isMe
                ? amHost
                : ((p.state.isHost as boolean | undefined) ?? false);
              const name = isMe
                ? (user?.username ?? t("guest"))
                : ((p.state.username as string | undefined) ??
                  p.id.slice(0, 8));
              const avatar = isMe
                ? user?.avatarUrl
                : (p.state.avatarUrl as string | null | undefined);
              const isSpectator = isMe
                ? amSpectator
                : (p.state.spectator as boolean | undefined) === true;
              const isReady = isMe
                ? myReady
                : (p.state.lobbyReady as boolean | undefined) === true;

              return (
                <div
                  key={p.id}
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      fontFamily: "var(--font-display)",
                      fontSize: "15px",
                      color: "var(--color-white)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Name */}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "13px",
                      flex: 1,
                      color: "var(--text)",
                    }}
                  >
                    {name}
                  </span>

                  {/* Badges */}
                  <div style={{ display: "flex", gap: "4px" }}>
                    {/* Current status: spectating / ready / in-menu */}
                    {isSpectator ? (
                      <Badge variant="muted">{t("spectator")}</Badge>
                    ) : isReady ? (
                      <Badge variant="success">{t("ready")}</Badge>
                    ) : (
                      <Badge variant="muted">{t("inMenu")}</Badge>
                    )}
                    {isPlayerHost && (
                      <Badge variant="accent">{t("host")}</Badge>
                    )}
                    {isMe && <Badge variant="muted">{t("you")}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Single-player notice — shown to a non-host who can't pick a role
            because the host hasn't opened a Multiplayer lobby. Full-width banner
            (its own row) so it never shifts the action buttons out of alignment. */}
        {!canPickRole && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "12px 16px",
              borderRadius: "6px",
              borderLeft: "3px solid var(--accent)",
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
            }}
          >
            <span
              style={{ fontSize: "16px", lineHeight: 1.3, flexShrink: 0 }}
              aria-hidden
            >
              👀
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: "var(--text)",
                }}
              >
                {t("singlePlayerNotice")}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  lineHeight: 1.5,
                }}
              >
                {t("singlePlayerNoticeBody")}
              </span>
            </div>
          </div>
        )}

        {/* Actions — back-to-setup on the left (host), toggles/start on the right */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            {amHost ? (
              <Button variant="ghost" onClick={onBackToMenu}>
                {t("backRaceSetup")}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onExitToDashboard}>
                {t("backDashboard")}
              </Button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {/* Role toggle — only once the host has opened the lobby. Non-hosts
              are locked to spectator until then (see the single-player notice
              banner above the action row). */}
            {canPickRole && (
              <Button
                variant="ghost"
                onClick={() => onToggleSpectator(!amSpectator)}
                disabled={amSpectator && racersFull}
                title={
                  amSpectator && racersFull
                    ? t("racerSlotsFull", { max: MAX_RACERS })
                    : undefined
                }
              >
                {amSpectator ? t("joinAsRacer") : t("spectate")}
              </Button>
            )}

            {/* Ready toggle — racers only (spectators don't ready up) */}
            {!amSpectator && (
              <Button
                variant={myReady ? "ghost" : "primary"}
                onClick={() => onToggleReady(!myReady)}
              >
                {myReady ? t("notReady") : t("ready")}
              </Button>
            )}

            {amHost ? (
              <Button
                variant="primary"
                onClick={startGame}
                disabled={racerCount === 0 || !allReady}
                title={
                  racerCount === 0
                    ? t("needAtLeastOneRacer")
                    : !allReady
                      ? t("waitingForAllReady")
                      : undefined
                }
              >
                {t("startRace")}
              </Button>
            ) : (
              // Wrapper carries the hover (a disabled button doesn't emit hover in
              // some browsers) so the tooltip shows instantly via group-hover.
              <span className="group relative inline-flex">
                <Button variant="primary" disabled>
                  {t("startRace")}
                </Button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {t("waitingForHost")}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
