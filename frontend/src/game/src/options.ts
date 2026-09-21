import type { CarConfig } from "./CarController.ts";

export const CAR_MODEL = {
  path: "/models/ae86-new.glb",
  scale: 0.51,
  position: [0, -0.28, -0.1] as [number, number, number],
  rotation: [0, Math.PI, 0] as [number, number, number],
};

export type CamConfig = {
  height: number; // vertical offset of the camera from the car
  lerp: number; // how quickly the camera moves to its target position (higher = snappier)
  scale: number; // how far back the camera is from the car (higher = further)
};

export const CAM_CONFIGS: Record<string, CamConfig> = {
  close: {
    height: 2.5,
    lerp: 12,
    scale: -5,
  },
  far: {
    height: 4.5,
    lerp: 6,
    scale: -7,
  },
  bird: {
    height: 25,
    lerp: 4,
    scale: -20,
  },
};

export const CAR_CONFIGS: Record<string, CarConfig> = {
  player: {
    acceleration: 28,
    reverseAcceleration: 18,
    maxSpeed: 69, // m/s
    drag: 0.5,
    steeringStrength: 2.4,
    traction: 1.5,
    brakeTraction: 0.3,
  },
  aiEasy: {
    acceleration: 168,
    reverseAcceleration: 168,
    maxSpeed: 138,
    drag: 8.5,
    steeringStrength: 2.2,
    traction: 10,
    brakeTraction: 0.3,
  },
  aiHard: {
    acceleration: 300,
    reverseAcceleration: 240,
    maxSpeed: 400,
    drag: 6.5,
    steeringStrength: 2.7,
    traction: 10,
    brakeTraction: 0.3,
  },
};

// ── Bot difficulty ──────────────────────────────────────────────────────────
// The race-setup menu lets the host pick a bot difficulty; `getBotConfig` maps
// that choice to the matching CarController config: 'easy' → aiEasy (slower,
// forgiving), 'hard' → aiHard (faster). Add new tiers here + in `BotDifficulty`.
export type BotDifficulty = "easy" | "hard";

export function getBotConfig(difficulty: BotDifficulty): CarConfig {
  return difficulty === "easy" ? CAR_CONFIGS.aiEasy : CAR_CONFIGS.aiHard;
}

// ── Track registry ──────────────────────────────────────────────────────────
// Single source of truth for the selectable tracks (the menu's track picker
// reads this). Extensible — adding a track is one entry here. `path` is the
// public track file passed to <Scene trackPath>; `id` is the stable identifier
// used for leaderboard records and the shared multiplayer `track` state.
export interface TrackDef {
  id: string; // stable identifier (also the trailing path segment)
  name: string; // display name shown in the picker
  path: string; // public path, e.g. '/tracks/Tengu'
}

export const TRACKS: TrackDef[] = [
  { id: "Tengu", name: "Tengu", path: "/tracks/Tengu" },
  { id: "Kirin", name: "Kirin", path: "/tracks/Kirin" },
  { id: "Orochi", name: "Orochi", path: "/tracks/Orochi" },
  { id: "Raijin", name: "Raijin", path: "/tracks/Raijin" },
];

export const DEFAULT_TRACK_ID = TRACKS[0].id;

// Resolve a track id to its definition, falling back to the first track.
export function trackById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

// ── Lap count ────────────────────────────────────────────────────────────────
// Bounds for the lap-count selector (bot race + multiplayer lobby). Time trial
// ignores these — it runs an infinite (0) lap count. DEFAULT_LAPS seeds a fresh
// selector before the host picks.
export const MIN_LAPS = 1;
export const MAX_LAPS = 20;
export const DEFAULT_LAPS = 3;

// --- Multiplayer networking ---------------------------------------------
// Single source of truth for the pose-broadcast rate (player + host bot).
// Higher = smoother remote motion at the cost of more PlayroomKit traffic.
// Both the send-throttle (useMultiplayer) and the receive-side interpolation
// buffer sizing (RemoteInterpolator.snapCapacity) derive from this, so the two
// stay in lockstep — change the rate here and nothing else needs touching.
//
// 30 Hz = one send every other frame on a 60 Hz display (≈ every 2 ticks),
// which the render-loop gate (useFrame ≈ refresh rate) hits cleanly. Picking a
// rate that isn't a whole divisor of the refresh rate (e.g. 40 Hz on 60 Hz)
// would alias down to the nearest frame multiple instead.
export const NET_BROADCAST_HZ = 30;
export const NET_BROADCAST_INTERVAL_MS = 1000 / NET_BROADCAST_HZ;

// Remote-car interpolation tuning (RemoteInterpolator), shared by
// RemoteCarRenderer + RemoteBotRenderer. `delayMs` is how far in the past a
// remote car is rendered (independent of the broadcast rate — see the note on
// snapCapacity for how the two relate). Racers keep low latency; a spectator
// gets a deeper buffer + outlier rejection for a smoother watched car at the
// cost of a little more latency.
export const RACER_INTERP = { delayMs: 110, rejectOutliers: false };
export const SPECTATOR_INTERP = { delayMs: 250, rejectOutliers: true };

// All colours of the minimap. These float over the 3D scene, so they are
// chosen per-scheme to stay legible against that scheme's floor/wall colours
// rather than reusing them (which would let the map blend into the background).
export interface MinimapColors {
  road: number; // track centerline fill
  roadOutline: number; // contrast edge drawn around the road (and the circle border)
  player: number; // local player dot fill
  dotOutline: number; // stroke shared by every dot (player / bot / remote)
  bot: number; // bot dot fill
  remote: number; // remote human dot fill
  border: number; // minimap circle border
}

export interface ColorScheme {
  directionalLight: number;
  ambientLight: number;
  fog: [number, number];
  floor: number;
  wall: number;
  sky: number;
  skidmark: number;
  minimap: MinimapColors;
}

export const COLORS = {
  light: 0xf0eee6, // --color-light-white
  red: 0xa80100, // --color-dark-red (light-theme accent/border)
  darkRed: 0x6e0100, // deeper accent for outlines
  white: 0xeae4e4, // --color-white (light bg)
  black: 0x15161c, // --color-light-black
  blue: 0xb0deeb, // --color-light-blue (sky)
  midBlue: 0x374976, // --color-blue (surfaces / minimap dots)
  pureWhite: 0xffffff,
  grey: 0x56585b, // --color-grey
  green: 0x60ca78, // --color-green
  darkGreen: 0x2f5d38,
  darkBlue: 0x0c162d, // --color-dark-blue (dark bg)
};

export const COLOR_SCHEMES: Record<string, ColorScheme> = {
  // Matches the site's design system: cream bg, dark-red accent, light-blue sky
  default: {
    directionalLight: COLORS.light,
    ambientLight: COLORS.light,
    fog: [COLORS.white, 0.01],
    floor: COLORS.white,
    wall: COLORS.red,
    sky: COLORS.blue,
    skidmark: COLORS.black,
    minimap: {
      road: COLORS.black,
      roadOutline: COLORS.darkRed,
      player: COLORS.pureWhite,
      dotOutline: COLORS.black,
      bot: COLORS.blue,
      remote: COLORS.blue,
      border: COLORS.darkRed,
    },
  },
  dark: {
    directionalLight: COLORS.light,
    ambientLight: COLORS.light,
    fog: [COLORS.darkBlue, 0.01],
    floor: COLORS.darkBlue,
    wall: COLORS.midBlue,
    sky: COLORS.darkBlue,
    skidmark: COLORS.pureWhite,
    minimap: {
      road: COLORS.white,
      roadOutline: COLORS.red,
      player: COLORS.pureWhite,
      dotOutline: COLORS.black,
      bot: COLORS.blue,
      remote: COLORS.blue,
      border: COLORS.red,
    },
  },
};

// Minimap layout/sizing only — colours live in each ColorScheme's `minimap`
// group (see COLOR_SCHEMES) so they switch with the active theme.
export const MINIMAP_STYLE = {
  roadWidthFactor: 0.75, // lineWidth = max(4, tileSize * scale * factor)
  roadOutlineWidth: 1, // px added each side of road stroke
  playerOutlineWidth: 2, // px stroke for local player dot
  playerRadius: 5,
  botOutlineWidth: 2, // px stroke for bot dot
  botRadius: 4,
  remoteOutlineWidth: 2, // px stroke for remote player dots
  remoteRadius: 4,
  borderWidth: 1, // px width of the circle border
};

// Rear wheel positions in car-local space (physics frame: forward = +Z at yaw=0)
// Tune these using the red debug spheres (toggle with I key)
export const WHEEL_OFFSETS = {
  rearLeft: [-0.42, -0.2, -0.85] as [number, number, number],
  rearRight: [0.42, -0.2, -0.85] as [number, number, number],
};

export const SKIDMARK = {
  // tyre mark colour comes from the active ColorScheme's `skidmark` (theme.ts)
  poolSize: 8192, // max simultaneous stamps across the whole race
  ttlMs: 120_000, // marks vanish after 60 s (instant pop, no fade)
  quadWidth: 0.16, // world-unit width of each tyre stamp
  segmentOverlap: 0.0, // extra length per segment quad to hide joints between segments
  maxSegmentLength: 1.5, // gaps longer than this (frame hitch / teleport) re-anchor instead of stamping
  minStampDistance: 0.2, // min world-unit gap between consecutive stamps per wheel
  minSpeed: 3.0, // m/s below which no marks are drawn
  minSlip: 0.05, // lateral-slip threshold (0 = perfectly aligned, 1 = sideways)
  floorY: 0.02, // height above y=0 floor to avoid z-fighting
  opacity: 1.0, // 0 = invisible, 1 = fully opaque
};
