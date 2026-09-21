import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  initPhysics,
  createCarBody,
  createGround,
  type PhysicsContext,
} from "./Physics";
import type { RigidBody } from "./Physics";
import { CarController } from "./CarController";
import { Input } from "./Input";
import { useBotBridge } from "./useBotBridge.ts";
import { Car } from "./Car.tsx";
import { BotCar } from "./BotCar.tsx";
import { Track } from "./Track.tsx";
import { RemoteCarRenderer } from "./RemoteCarRenderer.tsx";
import type { TrackLoadInfo, CheckpointDef } from "./TrackTypes";
import type { RemotePlayer } from "./useMultiplayer.ts";
import type { PlayerState } from "playroomkit";
import {
  CAR_CONFIGS,
  CAM_CONFIGS,
  getBotConfig,
  type BotDifficulty,
} from "./options.ts";
import { useTheme } from "./theme.ts";
import { Skidmarks, CarSkidTrail, type SkidmarksHandle } from "./Skidmarks.tsx";
import { PlayerCamera } from "./PlayerCamera.ts";
import { SpectatorCamera } from "./SpectatorCamera.ts";
import {
  makeDebugArrow,
  yawToQuat,
  insideCheckpointXZ,
  rearWheelWorldPositions,
  trackTangentAt,
  type CarPoseRegistry,
} from "./scene/sceneMath.ts";
import { WrongWayDetector } from "./scene/WrongWayDetector.ts";
import { useSpectatorView } from "./scene/useSpectatorView.ts";
import type { RaceState } from "./useRaceOrchestration.ts";

// Re-exported so existing `import { CarPoseRegistry } from './Scene.tsx'`
// callers (App, Minimap, the remote renderers) keep working.
export type { CarPoseRegistry } from "./scene/sceneMath.ts";

// Fallback track when App doesn't pass one (e.g. the standalone dev entry).
// The active track is normally chosen in the race-setup menu and threaded in
// via the `trackPath` prop. The trailing path segment ("Tengu") is the
// stable track identifier used for leaderboard records.
const DEFAULT_TRACK_PATH = "/tracks/Tengu";

// Debug-arrow scratch (forward = blue, velocity = red) — no per-frame alloc.
const _fwdDebug = new THREE.Vector3();
const _velDebug = new THREE.Vector3();
// Rear-wheel world-position scratch (reused each frame by the debug spheres).
const _wheelL: [number, number, number] = [0, 0, 0];
const _wheelR: [number, number, number] = [0, 0, 0];

interface SceneProps {
  onHudUpdate: (
    kmh: number,
    lapMs: number | null,
    bestMs: number | null,
    lastMs: number | null,
  ) => void;
  onDebugUpdate?: (
    carX: number,
    carZ: number,
    cpsPassed: number,
    cpsTotal: number,
    next3: [number, number][],
  ) => void;
  showDebug?: boolean;
  // Multiplayer
  remotePlayers?: RemotePlayer[];
  broadcast?: (
    pos: [number, number, number],
    quat: [number, number, number, number],
    lap: number,
    cp: number,
  ) => void;
  onProgressUpdate?: (lap: number, cp: number) => void;
  // Track to load (public path). Defaults to DEFAULT_TRACK_PATH.
  trackPath?: string;
  // Bot
  botEnabled?: boolean;
  // Bot difficulty — picks the AI car config ('easy' → aiEasy, 'hard' → aiHard)
  botDifficulty?: BotDifficulty;
  // Effective laps to enforce for finishing (App owns this — combines the chosen
  // race laps with the track default). 0 = free-roam / infinite (no finish).
  totalLaps?: number;
  // Race control: the canonical lifecycle state. Car driving + finish detection
  // run only while this is 'racing', so they can't fire back in the lobby.
  raceState?: RaceState;
  // Freeze the simulation (skip the physics step + car updates) without losing
  // body velocities — used for the host-handover pause so the race resumes
  // exactly where it left off.
  frozen?: boolean;
  onReady?: () => void;
  onBotProgressUpdate?: (lap: number, cp: number) => void;
  // Bot multiplayer broadcast (host only)
  broadcastBot?: (
    pos: [number, number, number],
    quat: [number, number, number, number],
    lap: number,
    cp: number,
  ) => void;
  // Dev: bot takeover of player car
  onBotTakeover?: (active: boolean) => void;
  // Win/lose
  onPlayerFinished?: () => void;
  onBotFinished?: () => void;
  // Fired on every completed lap (finish-line crossing) with the lap time + lap number.
  // Fires in free-roam too, so a solo time-trial can report each lap.
  onLapComplete?: (
    lapMs: number,
    lapNumber: number,
    driftMeters: number,
  ) => void;
  onTrackLoaded?: (
    laps: number,
    checkpoints: CheckpointDef[],
    trackName: string,
  ) => void;
  onMinimapUpdate?: (
    playerX: number,
    playerZ: number,
    yaw: number,
    botPos: [number, number] | null,
  ) => void;
  onWrongWay?: (active: boolean) => void;
  // Incremented each time a new race starts — triggers car position reset
  raceKey?: number;
  // Shared skidmark pool — owned by App so RemoteBotRenderer can stamp into it too
  skidmarksRef?: React.RefObject<SkidmarksHandle | null>;
  // Spectator mode: no own car; camera follows other racers, cycled with A/D
  spectator?: boolean;
  // Room-wide bot flag (host-or-not) — spectators need it to follow the bot
  sharedBotEnabled?: boolean;
  // Host's PlayerState — source for the bot's position on non-host spectators
  hostPlayerState?: PlayerState | null;
  // Reports the display name of the currently spectated car (null = no one)
  onSpectateTarget?: (name: string | null) => void;
  // Shared live car-pose registry (smoothed positions for the spectator camera)
  carRegistry?: CarPoseRegistry;
}

export function Scene({
  onHudUpdate,
  onDebugUpdate,
  showDebug = false,
  remotePlayers,
  broadcast,
  onProgressUpdate,
  trackPath = DEFAULT_TRACK_PATH,
  botEnabled = false,
  botDifficulty = "hard",
  totalLaps = 0,
  raceState = "idle",
  frozen = false,
  onReady,
  onBotProgressUpdate,
  broadcastBot,
  onBotTakeover,
  onPlayerFinished,
  onBotFinished,
  onLapComplete,
  onTrackLoaded,
  onMinimapUpdate,
  onWrongWay,
  raceKey = 0,
  skidmarksRef: skidmarksRefProp,
  spectator = false,
  sharedBotEnabled = false,
  hostPlayerState = null,
  onSpectateTarget,
  carRegistry,
}: SceneProps) {
  // Active colour scheme — drives the scene lights (re-renders on theme switch)
  const scheme = useTheme();

  // Stable track identifier (trailing path segment) for leaderboard records,
  // kept in a ref so handleTrackLoad (a stable callback) reads the current value.
  const trackNameRef = useRef("");
  trackNameRef.current = trackPath.split("/").pop() ?? trackPath;

  // Live bot difficulty — read when the bot body is (re)created below.
  const botDifficultyRef = useRef(botDifficulty);
  botDifficultyRef.current = botDifficulty;

  // ── Player car ───────────────────────────────────────────────────────────
  const carRef = useRef<THREE.Mesh>(null!);
  const physicsRef = useRef<PhysicsContext | null>(null);
  const [physics, setPhysics] = useState<PhysicsContext | null>(null);
  const carControllerRef = useRef<CarController | null>(null);
  const inputRef = useRef<Input | null>(null);
  const readyRef = useRef(false);
  const pendingCarStartRef = useRef<[number, number, number] | null>(null);
  const pendingCarYawRef = useRef<number | null>(null);
  const lapStartRef = useRef<number | null>(null);
  const bestLapRef = useRef<number | null>(null);
  const lastLapRef = useRef<number | null>(null);
  const checkpointsRef = useRef<CheckpointDef[]>([]);
  const nextCpRef = useRef(0);
  const currentLapRef = useRef(0);
  // Saved so the bot knows where to spawn
  const carStartPositionRef = useRef<[number, number, number]>([0, 0.5, 0]);
  const carStartYawRef = useRef(0);

  // ── Ready detection — fires onReady once both physics + track are loaded ──
  const physicsLoadedRef = useRef(false);
  const trackLoadedRef = useRef(false);
  const onReadyFiredRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // ── Finish / win condition ───────────────────────────────────────────────
  // True only while the race is live — gates car driving, lap/finish logic and
  // wrong-way detection. Derived from raceState so none of it can run once we
  // return to the lobby (raceState → 'idle').
  const racingRef = useRef(raceState === "racing");
  racingRef.current = raceState === "racing";
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  // Effective laps come from App (race choice + track default), synced each
  // render so finish/bot-finish logic reads the live value.
  const totalLapsRef = useRef(0);
  totalLapsRef.current = totalLaps;
  const playerFinishedRef = useRef(false);
  const botFinishedRef = useRef(false);
  const onPlayerFinishedRef = useRef(onPlayerFinished);
  onPlayerFinishedRef.current = onPlayerFinished;
  const onLapCompleteRef = useRef(onLapComplete);
  onLapCompleteRef.current = onLapComplete;
  const onBotFinishedRef = useRef(onBotFinished);
  onBotFinishedRef.current = onBotFinished;
  const onTrackLoadedRef = useRef(onTrackLoaded);
  onTrackLoadedRef.current = onTrackLoaded;
  const onMinimapUpdateRef = useRef(onMinimapUpdate);
  onMinimapUpdateRef.current = onMinimapUpdate;
  const onWrongWayRef = useRef(onWrongWay);
  onWrongWayRef.current = onWrongWay;

  // Wrong-way detection state machine (owns duration/shown internally).
  const wrongWayDetectorRef = useRef(new WrongWayDetector());
  const wrongWayTangent = useRef<[number, number]>([0, 0]);

  // ── Bot progress tracking ────────────────────────────────────────────────
  const botLapRef = useRef(0);
  const onBotProgressRef = useRef(onBotProgressUpdate);
  onBotProgressRef.current = onBotProgressUpdate;

  // ── Bot car ──────────────────────────────────────────────────────────────
  const botGroupRef = useRef<THREE.Group>(null!);
  const botBodyRef = useRef<RigidBody | null>(null);
  const botCarControllerRef = useRef<CarController | null>(null);
  const botReadyRef = useRef(false);
  const botNextCpRef = useRef(1); // bot starts counting from cp 1

  // ── Skidmarks ────────────────────────────────────────────────────────────
  // The shared pool ref can be owned by App (so RemoteBotRenderer, mounted
  // outside Scene, stamps into the same mesh); fall back to a local ref.
  const internalSkidmarksRef = useRef<SkidmarksHandle | null>(null);
  const skidmarksRef = skidmarksRefProp ?? internalSkidmarksRef;
  const leftWheelDebugRef = useRef<THREE.Mesh>(null!);
  const rightWheelDebugRef = useRef<THREE.Mesh>(null!);
  const playerTrailRef = useRef(new CarSkidTrail());
  const botTrailRef = useRef(new CarSkidTrail());

  // ── Bot takeover (dev) — 'B' hands AI control to the player car ──────────
  const [botTakeover, setBotTakeover] = useState(false);
  const botTakeoverRef = useRef(false);
  botTakeoverRef.current = botTakeover;
  const onBotTakeoverRef = useRef(onBotTakeover);
  onBotTakeoverRef.current = onBotTakeover;

  // ── Camera ───────────────────────────────────────────────────────────────
  const { camera } = useThree();
  const camModeRef = useRef<keyof typeof CAM_CONFIGS>("close");
  const carWorldPos = useRef(new THREE.Vector3());
  // Two follow cameras: the local player uses a raw-position follow (car pinned,
  // no look-target smoothing — see PlayerCamera), the spectator uses a smoothed
  // focus so cycling watched cars eases instead of snapping (see SpectatorCamera).
  const playerCamRef = useRef(new PlayerCamera());
  const spectatorCamRef = useRef(new SpectatorCamera());

  // ── Spectator view ─────────────────────────────────────────────────────────
  // Owns the watch list + A/D cycling. spectatorRef is read pervasively in the
  // frame loop below (input/skid/checkpoint/broadcast gating + camera choice).
  const {
    spectatorRef,
    spectateIndexRef,
    spectateCountRef,
    spectateNameRef,
    onSpectateTargetRef,
    buildSpectateTargets,
  } = useSpectatorView({
    spectator,
    remotePlayers,
    hostPlayerState,
    sharedBotEnabled,
    botEnabled,
    onSpectateTarget,
    carRegistry,
    botControllerRef: botCarControllerRef,
  });

  // ── Debug arrows (forward = blue, velocity = red) ─────────────────────────
  const showDebugRef = useRef(showDebug);
  showDebugRef.current = showDebug;

  const forwardArrow = useMemo(() => makeDebugArrow(0x00aaff), []);
  const velocityArrow = useMemo(() => makeDebugArrow(0xff4400), []);

  // ── Bot bridge — sends BOT's state to AI WS, returns AI commands ─────────
  // useBotBridge uses the bot's own controller and checkpoint refs, NOT the player's.
  const { botInput } = useBotBridge({
    enabled: botEnabled || botTakeover,
    carControllerRef: botCarControllerRef,
    playerControllerRef: carControllerRef,
    checkpointsRef,
    nextCpRef: botNextCpRef,
    playerNextCpRef: nextCpRef,
    takeover: botTakeover,
  });

  // ── Physics + player input init ──────────────────────────────────────────
  useEffect(() => {
    const input = new Input();
    inputRef.current = input;

    initPhysics().then((ctx) => {
      createGround(ctx);
      physicsRef.current = ctx;
      // Player car
      const ctrl = new CarController(createCarBody(ctx), CAR_CONFIGS.player);
      // const ctrl = new CarController(createCarBody(ctx), CAR_CONFIGS.aiEasy)
      carControllerRef.current = ctrl;
      if (pendingCarStartRef.current) {
        const [x, y, z] = pendingCarStartRef.current;
        ctrl.teleportTo(x, y, z, pendingCarYawRef.current ?? undefined);
        pendingCarStartRef.current = null;
        pendingCarYawRef.current = null;
      }
      readyRef.current = true;
      physicsLoadedRef.current = true;
      if (trackLoadedRef.current && !onReadyFiredRef.current) {
        onReadyFiredRef.current = true;
        onReadyRef.current?.();
      }
      setPhysics(ctx);
    });

    return () => {
      input.destroy();
    };
  }, []);

  // ── Camera mode key (C: toggle close / far / bird) ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "c" && e.key !== "C") return;
      const modes = Object.keys(CAM_CONFIGS) as (keyof typeof CAM_CONFIGS)[];
      const idx = modes.indexOf(camModeRef.current);
      camModeRef.current = modes[(idx + 1) % modes.length];
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Disable takeover if a real bot joins mid-session
  useEffect(() => {
    if (botEnabled && botTakeoverRef.current) {
      setBotTakeover(false);
      onBotTakeoverRef.current?.(false);
    }
  }, [botEnabled]);

  // Reset car positions + lap state when a new race starts
  useEffect(() => {
    if (raceKey === 0) return; // first mount — handleTrackLoad handles initial position
    playerFinishedRef.current = false;
    botFinishedRef.current = false;
    lapStartRef.current = null;
    lastLapRef.current = null;
    bestLapRef.current = null;
    nextCpRef.current = 0;
    currentLapRef.current = 0;
    onProgressUpdate?.(0, 0);
    if (wrongWayDetectorRef.current.clear()) onWrongWayRef.current?.(false);
    if (carControllerRef.current) {
      const [x, y, z] = carStartPositionRef.current;
      carControllerRef.current.teleportTo(x, y, z, carStartYawRef.current);
    }
    if (botCarControllerRef.current) {
      const [sx, sy, sz] = carStartPositionRef.current;
      botCarControllerRef.current.teleportTo(
        sx + 3,
        sy,
        sz,
        carStartYawRef.current,
      );
      botNextCpRef.current = 1;
      botLapRef.current = 1;
    }
    skidmarksRef.current?.reset();
    playerTrailRef.current.reset();
    botTrailRef.current.reset();
    // Discard any drift carried over from the previous race (read-and-reset).
    playerTrailRef.current.takeDrift();
  }, [raceKey, onProgressUpdate, skidmarksRef]);

  // ── Bot physics body — created/destroyed when botEnabled or physics changes ──
  useEffect(() => {
    if (!botEnabled || !physics) {
      // Clean up bot body if physics disappeared (unlikely but safe)
      if (botBodyRef.current && physicsRef.current) {
        physicsRef.current.world.removeRigidBody(botBodyRef.current);
        botBodyRef.current = null;
        botCarControllerRef.current = null;
        botReadyRef.current = false;
      }
      return;
    }

    const [sx, sy, sz] = carStartPositionRef.current;
    const body = createCarBody(physics, true); // isBot=true → group 2, no collision with player
    // Bot car config — chosen difficulty (easy → aiEasy, hard → aiHard)
    const ctrl = new CarController(
      body,
      getBotConfig(botDifficultyRef.current),
    );
    // Spawn slightly to the side so bot doesn't overlap the player
    ctrl.teleportTo(sx + 3, sy, sz, carStartYawRef.current);

    botBodyRef.current = body;
    botCarControllerRef.current = ctrl;
    botNextCpRef.current = 1;
    botLapRef.current = 1; // start at 1 — "currently on lap 1" matches player semantics
    botReadyRef.current = true;

    return () => {
      if (physicsRef.current) {
        physicsRef.current.world.removeRigidBody(body);
      }
      botBodyRef.current = null;
      botCarControllerRef.current = null;
      botReadyRef.current = false;
    };
  }, [botEnabled, physics, botDifficulty]);

  // ── Lap / finish handling ────────────────────────────────────────────────
  const handleFinishCross = useCallback(() => {
    if (!racingRef.current) return;
    if (playerFinishedRef.current) return;

    const now = performance.now();
    const cps = checkpointsRef.current;

    if (lapStartRef.current === null) {
      lapStartRef.current = now;
      nextCpRef.current = 1;
      currentLapRef.current = 1;
      onProgressUpdate?.(1, 1);
      // Discard any pre-lap drift so lap 1 starts its drift count from zero.
      playerTrailRef.current.takeDrift();
      return;
    }

    if (nextCpRef.current < cps.length) return;

    const lapMs = now - lapStartRef.current;
    lastLapRef.current = lapMs;
    if (bestLapRef.current === null || lapMs < bestLapRef.current) {
      bestLapRef.current = lapMs;
    }
    // Report the lap that was just completed (its number = current lap before
    // increment), with the drift distance accumulated during it (read-and-reset).
    onLapCompleteRef.current?.(
      lapMs,
      currentLapRef.current,
      playerTrailRef.current.takeDrift(),
    );
    nextCpRef.current = 1;
    currentLapRef.current++;
    onProgressUpdate?.(currentLapRef.current, 1);

    if (
      totalLapsRef.current > 0 &&
      currentLapRef.current > totalLapsRef.current
    ) {
      lapStartRef.current = null;
      playerFinishedRef.current = true;
      onPlayerFinishedRef.current?.();
    } else {
      lapStartRef.current = now;
    }
  }, [onProgressUpdate]);

  const handleTrackLoad = useCallback(
    ({ carStart, carYaw, checkpoints, laps }: TrackLoadInfo) => {
      checkpointsRef.current = checkpoints;
      // `laps` here is the track file's default; App combines it with the chosen
      // race laps and feeds the result back via the `totalLaps` prop.
      carStartPositionRef.current = carStart;
      carStartYawRef.current = carYaw;
      onTrackLoadedRef.current?.(laps, checkpoints, trackNameRef.current);
      if (carControllerRef.current) {
        carControllerRef.current.teleportTo(
          carStart[0],
          carStart[1],
          carStart[2],
          carYaw,
        );
      } else {
        pendingCarStartRef.current = carStart;
        pendingCarYawRef.current = carYaw;
      }
      trackLoadedRef.current = true;
      if (physicsLoadedRef.current && !onReadyFiredRef.current) {
        onReadyFiredRef.current = true;
        onReadyRef.current?.();
      }
    },
    [],
  );

  // ── Frame steps ──────────────────────────────────────────────────────────
  // The per-frame work, split into ordered steps. Each closes over the
  // component's refs/props (fresh each render, exactly like the original inline
  // loop); the useFrame below calls them in sequence.

  // Apply this frame's inputs and advance the shared physics world one step.
  // Frozen (host handover): skip the step so bodies hold position but keep
  // velocity, so the race resumes seamlessly at GO.
  const advancePhysics = (clampedDt: number, car: CarController) => {
    // Player input: keyboard normally, AI when takeover is active. Spectators
    // have no controllable car.
    if (racingRef.current && !spectatorRef.current && !frozenRef.current) {
      const input = botTakeoverRef.current
        ? botInput.current
        : inputRef.current;
      if (input) car.update(clampedDt, input);
    }
    // Bot (if active) uses AI commands — gated on the same racing state
    if (
      botEnabled &&
      botReadyRef.current &&
      botCarControllerRef.current &&
      racingRef.current &&
      !frozenRef.current
    ) {
      botCarControllerRef.current.update(clampedDt, botInput.current);
    }
    // Single world step covers both bodies; step with the real (clamped) frame
    // dt instead of Rapier's fixed 1/60 so the sim tracks the variable render
    // cadence (removes camera-jitter aliasing; keeps speed right off 60 Hz).
    if (!frozenRef.current) {
      physicsRef.current!.world.timestep = clampedDt;
      physicsRef.current!.world.step();
    }
  };

  // Player readback → mesh sync, debug arrows, wheel debug spheres, skidmarks.
  const syncPlayer = (clampedDt: number, car: CarController) => {
    car.readbackFromBody();
    const pos = car.position;
    carWorldPos.current.set(pos.x, pos.y, pos.z);
    carRef.current.position.set(pos.x, pos.y, pos.z);
    carRef.current.rotation.set(0, car.yaw, 0);
    // Spectators don't have a visible car of their own
    carRef.current.visible = !spectatorRef.current;

    // Debug arrows — forward (blue) and velocity (red)
    if (showDebugRef.current) {
      const ay = pos.y + 0.3;
      _fwdDebug.set(Math.sin(car.yaw), 0, Math.cos(car.yaw));
      forwardArrow.position.set(pos.x, ay, pos.z);
      forwardArrow.setDirection(_fwdDebug);
      forwardArrow.visible = true;

      const velLen = car.velocity.length();
      if (velLen > 0.3) {
        _velDebug.copy(car.velocity).normalize();
        velocityArrow.position.set(pos.x, ay, pos.z);
        velocityArrow.setDirection(_velDebug);
        velocityArrow.visible = true;
      } else {
        velocityArrow.visible = false;
      }
    } else {
      forwardArrow.visible = false;
      velocityArrow.visible = false;
    }

    // Rear wheel debug spheres
    rearWheelWorldPositions(pos.x, pos.y, pos.z, car.yaw, _wheelL, _wheelR);
    if (leftWheelDebugRef.current)
      leftWheelDebugRef.current.position.set(
        _wheelL[0],
        _wheelL[1],
        _wheelL[2],
      );
    if (rightWheelDebugRef.current)
      rightWheelDebugRef.current.position.set(
        _wheelR[0],
        _wheelR[1],
        _wheelR[2],
      );

    // Skidmark stamping (skipped for spectators)
    if (skidmarksRef.current && !spectatorRef.current) {
      playerTrailRef.current.sample(
        skidmarksRef.current,
        pos.x,
        pos.z,
        car.yaw,
        car.velocity.x,
        car.velocity.z,
        clampedDt,
      );
    }
  };

  // Bot readback → mesh sync, skidmarks, broadcast, checkpoint/finish advance.
  // Caller guards botEnabled + bot readiness.
  const updateBot = (clampedDt: number) => {
    const bot = botCarControllerRef.current!;
    bot.readbackFromBody();
    const bp = bot.position;
    if (botGroupRef.current) {
      botGroupRef.current.position.set(bp.x, bp.y, bp.z);
      botGroupRef.current.rotation.set(0, bot.yaw, 0);
    }
    // Bot skidmarks — stamps into the same shared pool as the player
    if (skidmarksRef.current) {
      botTrailRef.current.sample(
        skidmarksRef.current,
        bp.x,
        bp.z,
        bot.yaw,
        bot.velocity.x,
        bot.velocity.z,
        clampedDt,
      );
    }
    // Broadcast bot position to remote clients
    if (broadcastBot) {
      broadcastBot(
        [bp.x, bp.y, bp.z],
        yawToQuat(bot.yaw),
        botLapRef.current,
        botNextCpRef.current,
      );
    }

    // Bot checkpoint advancement
    const cps = checkpointsRef.current;
    const bni = botNextCpRef.current;
    if (bni < cps.length) {
      const bcp = cps[bni];
      if (insideCheckpointXZ(bp.x, bp.z, bcp)) {
        if (bni === 0) {
          // Crossed the finish area — complete the lap (symmetric with player)
          botLapRef.current++;
          botNextCpRef.current = 1;
          onBotProgressRef.current?.(botLapRef.current, 1);
          if (
            totalLapsRef.current > 0 &&
            botLapRef.current > totalLapsRef.current
          ) {
            botFinishedRef.current = true;
            onBotFinishedRef.current?.();
          }
        } else {
          botNextCpRef.current++;
          onBotProgressRef.current?.(botLapRef.current, botNextCpRef.current);
        }
      }
    } else if (!botFinishedRef.current) {
      // All intermediate checkpoints done — wait for the bot to cross the finish area (cp 0)
      botNextCpRef.current = 0;
    }
  };

  // Player checkpoint detection → wrong-way → broadcast → HUD/debug readout.
  const updatePlayerProgress = (clampedDt: number, car: CarController) => {
    const pos = car.position;
    const cps = checkpointsRef.current;

    // Player checkpoint AABB detection (skipped for spectators)
    const nextIdx = nextCpRef.current;
    if (!spectatorRef.current && nextIdx < cps.length) {
      const cp = cps[nextIdx];
      if (
        insideCheckpointXZ(carWorldPos.current.x, carWorldPos.current.z, cp)
      ) {
        nextCpRef.current++;
        onProgressUpdate?.(currentLapRef.current, nextCpRef.current);
      }
    }

    // Wrong-way detection: compare the car's motion against the local track
    // tangent (nearest point on the checkpoint centerline), not a bearing to the
    // next checkpoint — so it stays correct however far the car drives backward.
    const isRacing =
      !spectatorRef.current &&
      racingRef.current &&
      lapStartRef.current !== null &&
      !playerFinishedRef.current;
    const haveTangent = trackTangentAt(
      cps,
      pos.x,
      pos.z,
      wrongWayTangent.current,
    );
    const wwChange = wrongWayDetectorRef.current.update(
      isRacing,
      car.velocity.x,
      car.velocity.z,
      haveTangent ? wrongWayTangent.current : null,
      clampedDt,
    );
    if (wwChange !== null) onWrongWayRef.current?.(wwChange);

    // Broadcast player position + race progress to remote peers (spectators
    // have no car to broadcast)
    if (broadcast && !spectatorRef.current) {
      broadcast(
        [pos.x, pos.y, pos.z],
        yawToQuat(car.yaw),
        currentLapRef.current,
        nextCpRef.current,
      );
    }

    const lapMs =
      lapStartRef.current !== null
        ? performance.now() - lapStartRef.current
        : null;
    onHudUpdate(
      car.velocity.length() * 3.6,
      lapMs,
      bestLapRef.current,
      lastLapRef.current,
    );

    if (onDebugUpdate && cps.length > 0) {
      const ni = nextCpRef.current;
      const next3 = Array.from({ length: 3 }, (_, i): [number, number] => {
        const cp = cps[(ni + i) % cps.length];
        return [cp.position[0], cp.position[2]];
      });
      onDebugUpdate(
        carWorldPos.current.x,
        carWorldPos.current.z,
        Math.max(0, ni - 1),
        cps.length - 1,
        next3,
      );
    }
  };

  // Camera + minimap follow. The local player follows their own car's raw
  // position (car pinned, no look-target lag); a spectator follows the selected
  // watched car (eased target-switching via SpectatorCamera).
  const updateCameraAndMinimap = (clampedDt: number) => {
    const camConfig = CAM_CONFIGS[camModeRef.current];

    let followX = carWorldPos.current.x;
    let followY = carWorldPos.current.y;
    let followZ = carWorldPos.current.z;
    let followYaw = carControllerRef.current?.yaw ?? 0;

    const minimapBotXZ: [number, number] | null =
      botEnabled && botReadyRef.current && botCarControllerRef.current
        ? [
            botCarControllerRef.current.position.x,
            botCarControllerRef.current.position.z,
          ]
        : null;

    if (spectatorRef.current) {
      const targets = buildSpectateTargets();
      spectateCountRef.current = targets.length;
      if (targets.length > 0) {
        if (spectateIndexRef.current >= targets.length)
          spectateIndexRef.current = 0;
        const t = targets[spectateIndexRef.current];
        followX = t.x;
        followY = 0.5;
        followZ = t.z;
        followYaw = t.yaw;
        if (spectateNameRef.current !== t.name) {
          spectateNameRef.current = t.name;
          onSpectateTargetRef.current?.(t.name);
        }
        onMinimapUpdateRef.current?.(t.x, t.z, t.yaw, minimapBotXZ);
      } else if (spectateNameRef.current !== null) {
        spectateNameRef.current = null;
        onSpectateTargetRef.current?.(null);
      }
    } else {
      onMinimapUpdateRef.current?.(followX, followZ, followYaw, minimapBotXZ);
    }

    const cam = spectatorRef.current
      ? spectatorCamRef.current
      : playerCamRef.current;
    cam.update(
      camera,
      camConfig,
      followX,
      followY,
      followZ,
      followYaw,
      clampedDt,
    );
  };

  // ── Frame loop ───────────────────────────────────────────────────────────
  useFrame((_, dt) => {
    const clampedDt = Math.min(dt, 0.05);

    if (
      readyRef.current &&
      physicsRef.current &&
      carControllerRef.current &&
      inputRef.current
    ) {
      const car = carControllerRef.current;
      advancePhysics(clampedDt, car);
      syncPlayer(clampedDt, car);
      if (botEnabled && botReadyRef.current && botCarControllerRef.current) {
        updateBot(clampedDt);
      }
      updatePlayerProgress(clampedDt, car);
    }

    updateCameraAndMinimap(clampedDt);
  });

  return (
    <>
      <directionalLight
        color={scheme.directionalLight}
        intensity={2.5}
        position={[15, 30, 10]}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <ambientLight color={scheme.ambientLight} intensity={1.2} />

      <Track
        // Key on the track path so switching tracks fully remounts the track
        // subtree. Wall colliders are built in a `[physics]`-only effect that
        // won't re-run on a prop change, so without a remount React reuses the
        // old Wall instances and their colliders stay where the first-loaded
        // track put them (visuals update, physics goes stale). Remounting tears
        // down the old bodies (Wall cleanup) and builds fresh ones.
        key={trackPath}
        physics={physics}
        trackPath={trackPath}
        showCheckpoints={showDebug}
        onLoad={handleTrackLoad}
        carPositionRef={carWorldPos}
        onFinishCross={handleFinishCross}
      />

      <Car showdebug={showDebug} carRef={carRef} />
      <primitive object={forwardArrow} />
      <primitive object={velocityArrow} />

      <Skidmarks ref={skidmarksRef} />

      {/* Debug: rear wheel positions — toggle with I key */}
      <mesh ref={leftWheelDebugRef} visible={showDebug}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="red" wireframe />
      </mesh>
      <mesh ref={rightWheelDebugRef} visible={showDebug}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="red" wireframe />
      </mesh>

      {botEnabled && <BotCar groupRef={botGroupRef} />}

      {remotePlayers?.map((remote) => (
        <RemoteCarRenderer
          key={remote.id}
          remote={remote}
          skidmarks={skidmarksRef}
          carRegistry={carRegistry}
          spectator={spectator}
        />
      ))}
    </>
  );
}
