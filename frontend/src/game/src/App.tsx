import "../../index.css";
import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene.tsx";
import type { CarPoseRegistry } from "./Scene.tsx";
import { RemoteBotRenderer } from "./RemoteBotRenderer.tsx";
import { useTheme, setTheme } from "./theme.ts";
import { useDarkMode } from "../../contexts/DarkMode.ts";
import { useMultiplayer } from "./useMultiplayer.ts";
import { Minimap } from "./Minimap.tsx";
import type { MinimapHandle } from "./Minimap.tsx";
import type { CheckpointDef } from "./TrackTypes.ts";
import { useAuthOptional } from "./useAuthOptional.ts";
import { Lobby } from "./Lobby.tsx";
import { RaceSetupMenu, type RaceType } from "./RaceSetupMenu.tsx";
import {
  trackById,
  DEFAULT_TRACK_ID,
  DEFAULT_LAPS,
  MIN_LAPS,
  MAX_LAPS,
  type BotDifficulty,
} from "./options.ts";
import { Help } from "./Help.tsx";
import { LeavePrompt } from "./LeavePrompt.tsx";
import { useTranslation } from "../../hooks/useTranslation.ts";
import { useMultiplayerState } from "playroomkit";
import type { PlayerState } from "playroomkit";
import { useRaceOrchestration } from "./useRaceOrchestration.ts";
import { formatTime, BLANK } from "./gameUtils.ts";
import { removeLobby } from "../../lib/lobbies.ts";
import { useStandings } from "./useStandings.ts";
import { useStaleRacers } from "./useStaleRacers.ts";
import { ConnectingOverlay } from "./ConnectingOverlay.tsx";
import { LeavingOverlay } from "./LeavingOverlay.tsx";
import { RoomFullOverlay } from "./RoomFullOverlay.tsx";
import { HudPanel } from "./hud/HudPanel.tsx";
import { Standings } from "./hud/Standings.tsx";
import { DebugOverlay } from "./hud/DebugOverlay.tsx";
import { SpectatorBanner } from "./hud/SpectatorBanner.tsx";
import { useRaceResultSubmission } from "./useRaceResultSubmission.ts";
import { useNextRival } from "./useNextRival.ts";
import { useLobbyHeartbeat } from "./useLobbyHeartbeat.ts";
import { useHostMigration } from "./useHostMigration.ts";
import { useRestartVote } from "./useRestartVote.ts";
import { useGameHotkeys } from "./useGameHotkeys.ts";
import { PreparingOverlay } from "./PreparingOverlay.tsx";
import { CountdownOverlay } from "./CountdownOverlay.tsx";
import { HostChangeOverlay } from "./HostChangeOverlay.tsx";
import { FinishOverlay } from "./FinishOverlay.tsx";
import { buildStandings } from "./buildStandings.ts";
import { WrongWayIndicator } from "./WrongWayIndicator.tsx";
import { LapDeltaPopup } from "./LapDeltaPopup.tsx";
import type { LapDeltaHandle } from "./LapDeltaPopup.tsx";
import type { SkidmarksHandle } from "./Skidmarks.tsx";

export default function App() {
  const t = useTranslation("game");
  const speedRef = useRef<HTMLSpanElement>(null);
  const lapTimeRef = useRef<HTMLSpanElement>(null);
  const bestLapRef = useRef<HTMLSpanElement>(null);
  const lastLapRef = useRef<HTMLSpanElement>(null);
  const lapNumRef = useRef<HTMLSpanElement>(null);
  const wrongWayRef = useRef<HTMLDivElement>(null);

  const minimapRef = useRef<MinimapHandle>(null);

  // Active colour scheme — drives sky/fog here and re-renders on theme switch
  const scheme = useTheme();

  // Keep the game's 3D/minimap colour scheme in lockstep with the site's
  // light/dark mode, so the world + minimap + DOM panels all switch together.
  const { isDarkMode } = useDarkMode();
  useEffect(() => {
    setTheme(isDarkMode ? "dark" : "default");
  }, [isDarkMode]);

  // Shared skidmark pool (mounted inside Scene) — owned here so the
  // RemoteBotRenderer below can stamp into the same mesh
  const skidmarksRef = useRef<SkidmarksHandle>(null);

  // Shared live car-pose registry — remote renderers write their smoothed
  // per-frame pose here so the spectator camera follows the rendered car
  // (not the raw ~20 Hz broadcast, which would look jittery)
  const carRegistryRef = useRef<CarPoseRegistry>(new Map());

  const [showDebug] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);
  // Set the instant the player leaves for the dashboard — covers the menu while
  // the full-page reload in exitToDashboard completes (slow on a cold server).
  const [leaving, setLeaving] = useState(false);
  const debugContentRef = useRef<HTMLPreElement>(null);
  const botTakeoverLabelRef = useRef<HTMLSpanElement>(null);

  // Stable track identifier — written on track load, read by the submission
  // hook (race/trial posts) and the lobby heartbeat. Owned here since both
  // hooks plus handleTrackLoaded touch it.
  const trackNameRef = useRef<string | null>(null);
  // Live data for the standings sub-checkpoint progress (see buildStandings):
  // the checkpoint centerline (set on track load) and the latest local-car / bot
  // XZ positions (written every frame from handleMinimapUpdate). Lets the board
  // order cars by how far they are *between* gates, not just gate count.
  const standingsCheckpointsRef = useRef<CheckpointDef[]>([]);
  const localPosRef = useRef<[number, number]>([0, 0]);
  const botPosRef = useRef<[number, number] | null>(null);
  // Per-lap delta popup handle (mounted in the JSX below; driven by the
  // submission hook's handleLapComplete).
  const lapDeltaRef = useRef<LapDeltaHandle>(null);

  // These two must be called before useMultiplayer/insertCoin to preserve
  // PlayroomKit's subscription registration order
  const [phaseRaw, setPhaseState] = useMultiplayerState("phase", "lobby");
  const phase = (phaseRaw as string) === "racing" ? "racing" : "lobby";
  const startGame = useCallback(() => setPhaseState("racing"), [setPhaseState]);

  const [botEnabledRaw, setBotEnabledState] = useMultiplayerState(
    "botEnabled",
    false,
  );
  const sharedBotEnabled = botEnabledRaw === true;
  const botEnabledRef = useRef(false);
  botEnabledRef.current = sharedBotEnabled;

  // True only once the host has explicitly opened a Multiplayer lobby (Start
  // with race type = multiplayer). Until then a joiner is force-spectated and
  // can't take a racer seat (see useMultiplayer join logic). Declared before
  // useMultiplayer to preserve PlayroomKit's subscription-registration order.
  const [lobbyOpenRaw, setLobbyOpenState] = useMultiplayerState(
    "lobbyOpen",
    false,
  );
  const lobbyOpen = lobbyOpenRaw === true;

  // Room-wide restart counter — bumped by the host once every racer has voted
  // to restart on the finish screen. Must be declared before useMultiplayer to
  // preserve PlayroomKit's subscription-registration order.
  const [raceEpochRaw, setRaceEpochState] = useMultiplayerState("raceEpoch", 0);
  const raceEpoch = typeof raceEpochRaw === "number" ? raceEpochRaw : 0;
  const raceEpochRef = useRef(raceEpoch);
  raceEpochRef.current = raceEpoch;

  // Bumped by whoever becomes host mid-race (PlayroomKit migration). Every client
  // watches it and runs the "changing host" pause + re-countdown. Declared before
  // useMultiplayer to preserve PlayroomKit's subscription order.
  const [hostEpochRaw, setHostEpochState] = useMultiplayerState("hostEpoch", 0);
  const hostEpoch = typeof hostEpochRaw === "number" ? hostEpochRaw : 0;
  const hostEpochRef = useRef(hostEpoch);
  hostEpochRef.current = hostEpoch;

  // Race-setup choices shared so every client races the same track / difficulty.
  // Declared here (before useMultiplayer) to preserve PlayroomKit's subscription
  // registration order — same constraint as phase/botEnabled/raceEpoch above.
  const [trackIdRaw, setTrackIdState] = useMultiplayerState(
    "track",
    DEFAULT_TRACK_ID,
  );
  const trackId =
    typeof trackIdRaw === "string" ? trackIdRaw : DEFAULT_TRACK_ID;
  const trackDef = trackById(trackId);

  const [botDiffRaw, setBotDiffState] = useMultiplayerState(
    "botDifficulty",
    "hard",
  );
  const botDifficulty: BotDifficulty = botDiffRaw === "easy" ? "easy" : "hard";

  // Chosen lap count, shared so every client agrees. 0 = infinite (time trial);
  // >= 1 = fixed. Picked in the menu (bot race) or the lobby (multiplayer).
  const [raceLapsRaw, setRaceLapsState] = useMultiplayerState(
    "raceLaps",
    DEFAULT_LAPS,
  );
  const raceLaps = typeof raceLapsRaw === "number" ? raceLapsRaw : DEFAULT_LAPS;

  // Pre-lobby race-setup menu (local). The host configures the race here before
  // the lobby; joiners (non-host) skip it and go straight to the lobby.
  const [menuDone, setMenuDone] = useState(false);
  const [raceType, setRaceType] = useState<RaceType>("bot");

  const { user } = useAuthOptional();
  const userRef = useRef(user);
  userRef.current = user;

  const {
    remotePlayers,
    broadcast,
    broadcastBot,
    playersList,
    isConnected,
    amHost,
    amSpectator,
    roomFull,
    roomCode,
    markReady,
    setLobbyReady,
    setRestartReady,
    setStatus,
    setSpectator,
    autoSpectate,
    clearAutoSpectator,
  } = useMultiplayer({
    username: user?.username ?? null,
    avatarUrl: user?.avatarUrl ?? null,
  });

  const amHostRef = useRef(false);
  amHostRef.current = amHost;

  // Keep a stable ref to playersList so intervals don't go stale
  const playersListRef = useRef<PlayerState[]>([]);
  playersListRef.current = playersList;

  // Racers whose broadcast has gone silent (disconnected). Drop them from the
  // rendered ghosts/minimap/spectate list and the leaderboard so a dropped peer
  // doesn't leave a frozen car or stale row behind. Only checked while racing.
  const staleIds = useStaleRacers(remotePlayers, phase === "racing");
  const staleIdsRef = useRef(staleIds);
  staleIdsRef.current = staleIds;
  const liveRemotePlayers = useMemo(
    () =>
      staleIds.size
        ? remotePlayers.filter((r) => !staleIds.has(r.id))
        : remotePlayers,
    [remotePlayers, staleIds],
  );

  const {
    raceState,
    waitingForPlayers,
    countdown,
    controlsEnabled,
    controlsEnabledRef,
    raceKey,
    hostHandover,
    racePaused,
    triggerHostHandover,
    finishPending,
    raceResult,
    totalLapsRef,
    finishedOpponentIdsRef,
    localProgressRef,
    botProgressRef,
    handleSceneReady,
    handlePlayerFinished,
    handleBotFinished,
    handleBotProgressUpdate,
  } = useRaceOrchestration({
    phase,
    raceEpoch,
    markReady,
    playersListRef,
    staleIdsRef,
  });

  // The host's PlayerState — used both for the remote-bot renderer (non-host)
  // and for spectators following the host-simulated bot.
  const hostPlayerState: PlayerState | null =
    playersList.find((p) => (p.state.isHost as boolean | undefined) === true) ??
    null;

  const [spectateName, setSpectateName] = useState<string | null>(null);
  const handleSpectateTarget = useCallback(
    (name: string | null) => setSpectateName(name),
    [],
  );

  // Effective laps = the chosen race laps (0 = infinite). Keep the orchestration
  // lap count in sync so finish/position logic uses the live value, and feed the
  // same number to Scene via the totalLaps prop.
  useEffect(() => {
    totalLapsRef.current = raceLaps;
  }, [raceLaps, totalLapsRef]);

  // Host migration: announce a handover when we become host mid-race, and run
  // the "changing host" pause + re-countdown when the shared hostEpoch changes.
  useHostMigration({
    amHost,
    phase,
    hostEpoch,
    hostEpochRef,
    setHostEpochState,
    triggerHostHandover,
  });

  // Keep this player's broadcast status in sync with what they're doing.
  useEffect(() => {
    if (amSpectator) setStatus("spectating");
    else if (raceResult !== null || finishPending) setStatus("finished");
    else if (phase === "racing") setStatus("racing");
    else setStatus("lobby");
  }, [amSpectator, phase, finishPending, raceResult, setStatus]);

  // Returning to the lobby: drop the auto-spectator flag (late joiners rejoin
  // as racers) and reset the ready/restart checklists for the next round.
  useEffect(() => {
    if (phase === "lobby") {
      clearAutoSpectator();
      setLobbyReady(false);
      setRestartReady(false);
    }
  }, [phase, clearAutoSpectator, setLobbyReady, setRestartReady]);

  // Host switched the lobby from Multiplayer to a bot / time-trial race
  // (lobbyOpen → false): only the host drives those, so any non-host still
  // holding a racer seat must drop to spectator. autoSpectate no-ops for the
  // host or an existing spectator.
  useEffect(() => {
    if (!amHost && !lobbyOpen) autoSpectate();
  }, [amHost, lobbyOpen, autoSpectate]);

  // Host-only end-of-race restart tally → bumps raceEpoch on a unanimous vote.
  useRestartVote({
    amHost,
    phase,
    playersListRef,
    raceEpochRef,
    setRaceEpochState,
  });

  // Host-only lobby discovery heartbeat (dashboard lobby browser).
  useLobbyHeartbeat({
    amHost,
    isConnected,
    roomCode,
    user,
    phase,
    rosterSize: playersList.length,
    playersListRef,
    trackNameRef,
  });

  // "Next Rival" HUD slot — the closest driver still ahead of you on this track
  // (or the fastest-lap banner). Seeded from the leaderboard on track load;
  // recompute() is fed to the submission hook's onPbChange so the rival advances
  // as your PB drops mid-race.
  const { rival, seedRival, recompute: recomputeRival } = useNextRival(user);

  // Race-result + per-lap personal-best submission (backend). Owns the
  // submission refs/effects; returns the HUD best-lap mirror, the per-track PB
  // (drives the HUD "Best" + rival), the lap-complete handler, and the seeder.
  const { bestLapMsRef, pbLapMsRef, handleLapComplete, seedPb } =
    useRaceResultSubmission({
      user,
      userRef,
      amSpectator,
      raceKey,
      controlsEnabled,
      finishPending,
      raceResult,
      trackNameRef,
      totalLapsRef,
      lapDeltaRef,
      onPbChange: recomputeRival,
    });

  const { standingsBodyRef } = useStandings({
    playersListRef,
    localProgressRef,
    botProgressRef,
    botEnabledRef,
    amHostRef,
    totalLapsRef,
    controlsEnabledRef,
    finishedOpponentIdsRef,
    staleIdsRef,
    checkpointsRef: standingsCheckpointsRef,
    localPosRef,
    botPosRef,
  });

  // Standings snapshot for the finish overlay. Stable callback (all refs) — the
  // overlay calls it during its own ~3 Hz re-render, so building the board never
  // triggers an App/Canvas re-render (which would jitter the running game).
  const getStandings = useCallback(
    () =>
      buildStandings({
        playersList: playersListRef.current,
        localProgressRef,
        botProgressRef,
        botEnabledRef,
        amHostRef,
        totalLapsRef,
        staleIdsRef,
        checkpointsRef: standingsCheckpointsRef,
        localPosRef,
        botPosRef,
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
    [],
  );

  // Race-over signal for spectators (no shared "race over" flag): a fixed-lap
  // race in which every non-stale racer has finished. Polled, but setState only
  // fires on the false→true flip (React bails on same-value), so the overlay
  // mounts with a single re-render at race end — no per-tick jitter.
  const [raceOver, setRaceOver] = useState(false);
  useEffect(() => {
    if (!(amSpectator && phase === "racing" && raceLaps > 0)) {
      setRaceOver(false);
      return;
    }
    const id = setInterval(() => {
      const s = getStandings();
      if (s.length > 0 && s.every((e) => e.finished)) setRaceOver(true);
    }, 500);
    return () => clearInterval(id);
  }, [amSpectator, phase, raceLaps, getStandings]);

  // Leave the room entirely and return to the dashboard. Hard navigation so the
  // Canvas, Rapier world and PlayroomKit room all tear down cleanly. Best-effort
  // lobby removal first (the staleness reaper is the real safety net).
  const exitToDashboard = useCallback(() => {
    setLeaving(true); // cover the menu immediately so the exit reads as instant
    if (amHost && roomCode) removeLobby(roomCode).catch(() => {});
    window.location.href = "/dashboard";
  }, [amHost, roomCode]);

  // "Leave race" (Esc → Yes). Role-aware so leaving is never a destructive
  // shared-state write for a joiner:
  //  - Host of a Multiplayer race returns to the open lobby (keeps it open so
  //    joiners hold their seats) rather than all the way back to the setup menu.
  //  - Host of a bot / time-trial race returns to its own setup menu in place
  //    (resets the room to lobby — intended "host ends the race / reconfigures").
  //  - A non-host leaving is a purely LOCAL action: it must not touch the shared
  //    phase (that would yank everyone back to the lobby), so it tears down and
  //    returns to the dashboard. PlayroomKit's quit removes it from the roster
  //    and everyone else keeps racing.
  const exitToMenu = useCallback(() => {
    setShowLeavePrompt(false);
    if (amHost) {
      if (lobbyOpen) {
        setPhaseState("lobby"); // Multiplayer: back to the open lobby
      } else {
        setMenuDone(false);
        setLobbyOpenState(false); // back in the setup menu → lobby is closed again
        setPhaseState("lobby");
      }
    } else {
      exitToDashboard();
    }
  }, [amHost, lobbyOpen, setPhaseState, setLobbyOpenState, exitToDashboard]);

  // Host-only pre-lobby menu: shown once before the lobby. Joiners skip it.
  const showMenu = isConnected && amHost && phase === "lobby" && !menuDone;

  // Confirm the Esc "leave" prompt. In the race-setup menu there's no race to
  // leave, so confirming returns to the dashboard; everywhere else it's the
  // role-aware leave-race action (host → setup menu, joiner → dashboard).
  const confirmLeave = useCallback(() => {
    setShowLeavePrompt(false);
    if (showMenu) exitToDashboard();
    else exitToMenu();
  }, [showMenu, exitToDashboard, exitToMenu]);

  // Window-level hotkeys (H/Esc toggles, Enter-confirms-leave) + the hash-room
  // reload fix for switching #r= in the same tab.
  useGameHotkeys({
    setShowHelp,
    setShowLeavePrompt,
    showLeavePrompt,
    onConfirmLeave: confirmLeave,
    roomCode,
  });

  // Confirm the race-setup menu. Behaviour per race type:
  //  - bot:        enable the AI car (chosen difficulty) + start immediately
  //                on the chosen laps (1–20).
  //  - multiplayer: no bot, go to the lobby; the host tunes laps there.
  //  - timetrial:  no bot, start immediately with infinite (0) laps.
  const handleStart = useCallback(() => {
    const clampLaps = (n: number) =>
      Math.min(MAX_LAPS, Math.max(MIN_LAPS, Math.round(n)));
    setMenuDone(true);
    if (raceType === "multiplayer") {
      setBotEnabledState(false);
      setRaceLapsState(clampLaps(raceLaps));
      setLobbyOpenState(true); // open the lobby so joiners can take a racer seat
    } else if (raceType === "bot") {
      setBotEnabledState(true);
      setRaceLapsState(clampLaps(raceLaps));
      setLobbyOpenState(false);
      startGame();
    } else {
      // timetrial
      setBotEnabledState(false);
      setRaceLapsState(0); // infinite — chase a personal best
      setLobbyOpenState(false);
      startGame();
    }
  }, [
    raceType,
    raceLaps,
    setBotEnabledState,
    setRaceLapsState,
    setLobbyOpenState,
    startGame,
  ]);

  const handleHudUpdate = useCallback(
    (
      kmh: number,
      lapMs: number | null,
      bestMs: number | null,
      lastMs: number | null,
    ) => {
      bestLapMsRef.current = bestMs;
      if (speedRef.current)
        speedRef.current.textContent = `${kmh.toFixed(0)} km/h`;
      if (lapTimeRef.current)
        lapTimeRef.current.textContent =
          lapMs !== null ? formatTime(lapMs) : BLANK;
      // "Best" shows your all-time PB for *this* track. It's seeded per-track from
      // the backend on load and drops live via handleLapComplete the moment you
      // beat it, so it's always the current track's record — never mix in Scene's
      // session best, which carries across tracks and would leak another track's
      // time in. Guests (no backend PB) fall back to the session best.
      if (bestLapRef.current) {
        const pb = pbLapMsRef.current;
        const display = pb !== null ? pb : bestMs;
        bestLapRef.current.textContent =
          display !== null ? formatTime(display) : BLANK;
      }
      if (lastLapRef.current)
        lastLapRef.current.textContent =
          lastMs !== null ? formatTime(lastMs) : BLANK;
    },
    [bestLapMsRef, pbLapMsRef],
  );

  const handleDebugUpdate = useCallback(
    (
      carX: number,
      carZ: number,
      cpsPassed: number,
      cpsTotal: number,
      next3: [number, number][],
    ) => {
      if (!debugContentRef.current) return;
      const nextLines = next3.map(
        (p, i) => `  CP+${i + 1}: (${p[0].toFixed(1)}, ${p[1].toFixed(1)})`,
      );
      debugContentRef.current.textContent = [
        `Pos:  ${carX.toFixed(1)}, ${carZ.toFixed(1)}`,
        `CPs:  ${cpsPassed} / ${cpsTotal}`,
        ...nextLines,
      ].join("\n");
    },
    [],
  );

  const handleTrackLoaded = useCallback(
    (_laps: number, checkpoints: CheckpointDef[], trackName: string) => {
      // `_laps` is the track file's default — ignored here; the effective lap count
      // comes from the chosen `raceLaps` (synced into totalLapsRef by the effect
      // below). We keep the track name + checkpoints for records and the minimap.
      trackNameRef.current = trackName;
      standingsCheckpointsRef.current = checkpoints;
      minimapRef.current?.setTrack(checkpoints);
      // Seed the personal-best baseline for this track (used by handleLapComplete).
      seedPb(trackName);
      // Fetch this track's leaderboard for the HUD "Next Rival" slot. Pass a getter
      // (not a value): the PB is filled asynchronously by seedPb, so the board must
      // recompute against the live PB when it resolves. onPbChange → recompute then
      // refines it further if the PB lands after the board.
      seedRival(trackName, () => pbLapMsRef.current);
    },
    [seedPb, seedRival, pbLapMsRef],
  );

  const handleMinimapUpdate = useCallback(
    (
      playerX: number,
      playerZ: number,
      yaw: number,
      botPos: [number, number] | null,
    ) => {
      // Stash the live local-car (and bot) XZ for the standings sub-checkpoint
      // progress. For a spectator playerX/Z is the watched car (the local player
      // isn't in the board anyway), so it's harmless.
      localPosRef.current[0] = playerX;
      localPosRef.current[1] = playerZ;
      botPosRef.current = botPos;
      minimapRef.current?.update(playerX, playerZ, yaw, botPos);
    },
    [],
  );

  const handleProgressUpdate = useCallback((lap: number, cp: number) => {
    localProgressRef.current = { lap, cp };
    if (lapNumRef.current) {
      if (lap <= 0) {
        lapNumRef.current.textContent = "";
      } else {
        const total = totalLapsRef.current;
        lapNumRef.current.textContent =
          total > 0 ? `LAP ${lap}/${total}` : `LAP ${lap}`;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBotTakeover = useCallback((active: boolean) => {
    if (botTakeoverLabelRef.current) {
      botTakeoverLabelRef.current.style.display = active ? "inline" : "none";
    }
  }, []);

  const handleWrongWay = useCallback((active: boolean) => {
    if (wrongWayRef.current) {
      wrongWayRef.current.style.display = active ? "block" : "none";
    }
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Canvas
        camera={{ fov: 60, near: 0.1, far: 500, position: [0, 8, -12] }}
        gl={{ antialias: true }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        <color attach="background" args={[scheme.sky]} />
        <fogExp2 attach="fog" args={scheme.fog} />
        <Scene
          onHudUpdate={handleHudUpdate}
          onDebugUpdate={handleDebugUpdate}
          showDebug={showDebug}
          remotePlayers={liveRemotePlayers}
          broadcast={broadcast}
          onProgressUpdate={handleProgressUpdate}
          trackPath={trackDef.path}
          // Only host runs bot physics; non-host clients render via RemoteBotRenderer below
          botEnabled={amHost && sharedBotEnabled}
          botDifficulty={botDifficulty}
          totalLaps={raceLaps}
          broadcastBot={amHost && sharedBotEnabled ? broadcastBot : undefined}
          raceState={raceState}
          frozen={racePaused}
          onReady={handleSceneReady}
          onBotProgressUpdate={handleBotProgressUpdate}
          onBotTakeover={handleBotTakeover}
          onPlayerFinished={handlePlayerFinished}
          onBotFinished={
            amHost && sharedBotEnabled ? handleBotFinished : undefined
          }
          onLapComplete={handleLapComplete}
          onTrackLoaded={handleTrackLoaded}
          onMinimapUpdate={handleMinimapUpdate}
          onWrongWay={handleWrongWay}
          raceKey={raceKey}
          skidmarksRef={skidmarksRef}
          spectator={amSpectator}
          sharedBotEnabled={sharedBotEnabled}
          hostPlayerState={hostPlayerState}
          onSpectateTarget={handleSpectateTarget}
          carRegistry={carRegistryRef.current}
        />
        {/* Non-host clients render bot from host's broadcast position */}
        {!amHost && sharedBotEnabled && hostPlayerState && (
          <RemoteBotRenderer
            playerState={hostPlayerState}
            skidmarks={skidmarksRef}
            carRegistry={carRegistryRef.current}
            spectator={amSpectator}
          />
        )}
      </Canvas>

      {/* Connecting screen */}
      {!isConnected && <ConnectingOverlay />}

      {/* Leaving screen — covers the menu while the exit reload completes */}
      {leaving && <LeavingOverlay />}

      {/* Room-full screen — joined a room already at capacity (24 connections) */}
      {roomFull && (
        <RoomFullOverlay
          onExit={() => {
            window.location.href = "/lobby";
          }}
        />
      )}

      {/* Race-setup menu — host configures the race before the lobby */}
      {showMenu && (
        <RaceSetupMenu
          raceType={raceType}
          onRaceType={setRaceType}
          botDifficulty={botDifficulty}
          onBotDifficulty={(d) => setBotDiffState(d)}
          laps={raceLaps}
          onLaps={(n) => setRaceLapsState(n)}
          trackId={trackId}
          onTrackId={(id) => setTrackIdState(id)}
          onStart={handleStart}
          onExit={exitToDashboard}
        />
      )}

      {/* Lobby overlay */}
      {isConnected && phase === "lobby" && !showMenu && (
        <Lobby
          playersList={playersList}
          amHost={amHost}
          amSpectator={amSpectator}
          startGame={startGame}
          laps={raceLaps}
          onLaps={(n) => setRaceLapsState(n)}
          lobbyOpen={lobbyOpen}
          onBackToMenu={() => {
            setLobbyOpenState(false);
            setMenuDone(false);
          }}
          onExitToDashboard={() => setShowLeavePrompt(true)}
          onToggleReady={setLobbyReady}
          onToggleSpectator={setSpectator}
        />
      )}

      {/* Preparing overlay */}
      {phase === "racing" && waitingForPlayers && <PreparingOverlay />}

      {/* Countdown overlay */}
      {phase === "racing" && <CountdownOverlay countdown={countdown} />}

      {/* Host-handover pause (grey overlay before the re-countdown) */}
      <HostChangeOverlay visible={hostHandover} />

      {/* Finish overlay — for a racer it shows immediately on crossing (pending
          "...", then position after 250ms); for a spectator it appears once every
          racer has finished. Both see the live standings. */}
      {(finishPending || raceResult !== null || (amSpectator && raceOver)) && (
        <FinishOverlay
          raceResult={raceResult}
          getStandings={getStandings}
          spectator={amSpectator}
          playersList={playersList}
          onReturnToLobby={() => setPhaseState("lobby")}
          onToggleRestart={setRestartReady}
        />
      )}

      {/* Spectator banner */}
      {isConnected && phase === "racing" && amSpectator && (
        <SpectatorBanner spectateName={spectateName} />
      )}

      {/* Wrong-way indicator */}
      <WrongWayIndicator ref={wrongWayRef} />

      {/* Per-lap delta vs personal best (mainly for solo / time-trial runs).
          Always mounted (self-hides); handleLapComplete only fires while racing. */}
      <LapDeltaPopup ref={lapDeltaRef} />

      {/* Main HUD */}
      <HudPanel
        visible={phase === "racing" && !amSpectator}
        lapNumRef={lapNumRef}
        speedRef={speedRef}
        lapTimeRef={lapTimeRef}
        bestLapRef={bestLapRef}
        lastLapRef={lastLapRef}
        botTakeoverLabelRef={botTakeoverLabelRef}
        rival={rival}
      />

      {/* Leaderboard */}
      {isConnected && phase === "racing" && (
        <Standings bodyRef={standingsBodyRef} />
      )}

      {/* Debug overlay */}
      <DebugOverlay visible={showDebug} contentRef={debugContentRef} />

      <Help visible={showHelp} />

      {/* Leave confirmation (Esc). In the race-setup menu it asks about
          returning to the dashboard; otherwise it's the leave-race prompt. */}
      <LeavePrompt
        visible={showLeavePrompt}
        title={showMenu ? t("returnToDashboardQ") : t("leaveRace")}
        message={
          showMenu
            ? t("leaveSetupMsg")
            : amHost
              ? lobbyOpen
                ? t("returnToLobbyMsg")
                : t("returnToSetupMsg")
              : t("leaveRoomMsg")
        }
        confirmLabel={showMenu ? t("yesExit") : t("yesLeave")}
        onConfirm={confirmLeave}
        onCancel={() => setShowLeavePrompt(false)}
      />

      {/* Minimap — always mounted so setTrack fires correctly; visibility controlled via prop */}
      <Minimap
        ref={minimapRef}
        remotePlayers={liveRemotePlayers}
        hostPlayerState={hostPlayerState}
        amHost={amHost}
        botEnabled={sharedBotEnabled}
        visible={phase === "racing"}
        spectator={amSpectator}
        carRegistry={carRegistryRef.current}
      />
    </div>
  );
}
