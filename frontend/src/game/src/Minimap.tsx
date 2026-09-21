import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { PlayerState } from "playroomkit";
import type { RemotePlayer } from "./useMultiplayer.ts";
import type { CheckpointDef } from "./TrackTypes.ts";
import type { CarPoseRegistry } from "./Scene.tsx";
import { MINIMAP_STYLE } from "./options.ts";
import type { ColorScheme } from "./options.ts";
import { getScheme, hex } from "./theme.ts";

export interface MinimapHandle {
  update: (
    playerX: number,
    playerZ: number,
    yaw: number,
    botPos: [number, number] | null,
  ) => void;
  setTrack: (checkpoints: CheckpointDef[]) => void;
}

interface MinimapProps {
  remotePlayers: RemotePlayer[];
  hostPlayerState: PlayerState | null;
  amHost: boolean;
  botEnabled: boolean;
  visible: boolean;
  // When true, the local player is a spectator → don't draw the own-player dot
  spectator: boolean;
  // Shared live car-pose registry — smoothed (interpolated) positions so dots
  // don't jitter at the ~20 Hz broadcast rate
  carRegistry?: CarPoseRegistry;
}

const CSS_SIZE = 240;

type MinimapCss = Record<keyof ColorScheme["minimap"], string>;

export const Minimap = forwardRef<MinimapHandle, MinimapProps>(
  (
    {
      remotePlayers,
      hostPlayerState,
      amHost,
      botEnabled,
      visible,
      spectator,
      carRegistry,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const checkpointsRef = useRef<CheckpointDef[]>([]);
    const tileSizeRef = useRef(36);
    const modeRef = useRef(0); // 0=50u, 1=100u, 2=ALL
    const rotatingRef = useRef(false); // car-up GPS orientation

    // Keep live refs for values read inside the draw callback
    const remotePlayersRef = useRef(remotePlayers);
    remotePlayersRef.current = remotePlayers;
    const hostPlayerStateRef = useRef(hostPlayerState);
    hostPlayerStateRef.current = hostPlayerState;
    const amHostRef = useRef(amHost);
    amHostRef.current = amHost;
    const botEnabledRef = useRef(botEnabled);
    botEnabledRef.current = botEnabled;
    const spectatorRef = useRef(spectator);
    spectatorRef.current = spectator;
    const carRegistryRef = useRef(carRegistry);
    carRegistryRef.current = carRegistry;

    // Active-theme colours as CSS hex strings, memoised by scheme reference so
    // the strings are only rebuilt when the theme actually switches.
    const cssCacheRef = useRef<{ scheme: ColorScheme; css: MinimapCss } | null>(
      null,
    );
    const minimapCss = (scheme: ColorScheme): MinimapCss => {
      if (cssCacheRef.current?.scheme === scheme)
        return cssCacheRef.current.css;
      const m = scheme.minimap;
      const css: MinimapCss = {
        road: hex(m.road),
        roadOutline: hex(m.roadOutline),
        player: hex(m.player),
        dotOutline: hex(m.dotOutline),
        bot: hex(m.bot),
        remote: hex(m.remote),
        border: hex(m.border),
      };
      cssCacheRef.current = { scheme, css };
      return css;
    };

    // M: cycle zoom  |  Shift+M: toggle GPS rotation
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if ((e.key === "m" || e.key === "M") && e.shiftKey) {
          rotatingRef.current = !rotatingRef.current;
        } else if (e.key === "m" || e.key === "M") {
          modeRef.current = (modeRef.current + 1) % 3; // 0=ALL, 1=50u, 2=100u
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    const draw = useCallback(
      (
        playerX: number,
        playerZ: number,
        yaw: number,
        botPos: [number, number] | null,
      ) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(CSS_SIZE * dpr)) {
          canvas.width = Math.round(CSS_SIZE * dpr);
          canvas.height = Math.round(CSS_SIZE * dpr);
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const css = minimapCss(getScheme());

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, CSS_SIZE, CSS_SIZE);

        // Clip all drawing to the square canvas (keeps dots from spilling at edges)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, CSS_SIZE, CSS_SIZE);
        ctx.clip();

        const checkpoints = checkpointsRef.current;
        const mode = modeRef.current; // 0=ALL, 1=50u, 2=100u
        const tileSize = tileSizeRef.current;
        const rotating = rotatingRef.current && mode !== 0;

        const cx = CSS_SIZE / 2;
        const cy = CSS_SIZE / 2;

        let scale: number;
        let originX: number;
        let originZ: number;

        if (mode === 0 && checkpoints.length > 0) {
          const xs = checkpoints.map((c) => c.position[0]);
          const zs = checkpoints.map((c) => c.position[2]);
          const minX = Math.min(...xs) - tileSize / 2;
          const maxX = Math.max(...xs) + tileSize / 2;
          const minZ = Math.min(...zs) - tileSize / 2;
          const maxZ = Math.max(...zs) + tileSize / 2;
          scale = (CSS_SIZE * 0.85) / Math.max(maxX - minX, maxZ - minZ);
          originX = (minX + maxX) / 2;
          originZ = (minZ + maxZ) / 2;
        } else {
          const radius = mode === 1 ? 50 : 100;
          scale = cx / radius;
          originX = playerX;
          originZ = playerZ;
        }

        const cosA = rotating ? Math.cos(yaw - Math.PI) : 1;
        const sinA = rotating ? Math.sin(yaw - Math.PI) : 0;

        const toCanvas = (wx: number, wz: number): [number, number] => {
          const dx = (wx - originX) * scale;
          const dz = (wz - originZ) * scale;
          return [cx + cosA * dx - sinA * dz, cy + sinA * dx + cosA * dz];
        };

        // Track road
        if (checkpoints.length > 1) {
          const roadWidth = Math.max(
            4,
            tileSize * scale * MINIMAP_STYLE.roadWidthFactor,
          );
          const buildPath = () => {
            ctx.beginPath();
            checkpoints.forEach((cp, i) => {
              const [sx, sy] = toCanvas(cp.position[0], cp.position[2]);
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            });
            ctx.closePath();
          };

          ctx.save();
          ctx.lineJoin = "round";
          ctx.lineCap = "round";

          // Wall outline — contrast colour, slightly wider than the road
          ctx.strokeStyle = css.roadOutline;
          ctx.lineWidth = roadWidth + MINIMAP_STYLE.roadOutlineWidth * 2;
          buildPath();
          ctx.stroke();

          // Road fill
          ctx.strokeStyle = css.road;
          ctx.lineWidth = roadWidth;
          buildPath();
          ctx.stroke();

          ctx.restore();

          // Finish line — a solid stripe across the road at the start/finish tile
          // (checkpoint 0), perpendicular to the cp0→cp1 track direction.
          const fcx = checkpoints[0].position[0];
          const fcz = checkpoints[0].position[2];
          let fdx = checkpoints[1].position[0] - fcx;
          let fdz = checkpoints[1].position[2] - fcz;
          const flen = Math.hypot(fdx, fdz) || 1;
          fdx /= flen;
          fdz /= flen;
          // perpendicular direction in XZ, spanning the road width
          const half = roadWidth / scale / 2;
          const [ax, ay] = toCanvas(fcx - fdz * half, fcz + fdx * half);
          const [bx, by] = toCanvas(fcx + fdz * half, fcz - fdx * half);
          ctx.save();
          ctx.lineCap = "butt";
          // dark edge underneath for contrast on any road colour
          ctx.strokeStyle = css.dotOutline;
          ctx.lineWidth = Math.max(4, roadWidth * 0.28) + 2;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
          // bright stripe on top
          ctx.strokeStyle = css.player;
          ctx.lineWidth = Math.max(4, roadWidth * 0.28);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.restore();
        }

        // Remote human players (spectators have no car on track). Prefer the
        // smoothed interpolated pose from the registry; fall back to the raw
        // broadcast until the renderer has produced its first frame.
        remotePlayersRef.current.forEach((remote) => {
          if (remote.playerState?.state?.spectator === true) return;
          const pose = carRegistryRef.current?.get(remote.id);
          let wx: number, wz: number;
          if (pose) {
            wx = pose.x;
            wz = pose.z;
          } else {
            const pos = remote.playerState?.state?.pos as
              | [number, number, number]
              | undefined;
            if (!pos) return;
            wx = pos[0];
            wz = pos[2];
          }
          const [sx, sy] = toCanvas(wx, wz);
          ctx.beginPath();
          ctx.arc(sx, sy, MINIMAP_STYLE.remoteRadius, 0, Math.PI * 2);
          ctx.fillStyle = css.remote;
          ctx.strokeStyle = css.dotOutline;
          ctx.lineWidth = MINIMAP_STYLE.remoteOutlineWidth;
          ctx.fill();
          ctx.stroke();
        });

        // Bot — host reads its frame-stepped controller (smooth); non-host reads
        // the interpolated registry pose, falling back to the raw broadcast
        if (botEnabledRef.current) {
          let botXZ: [number, number] | null = amHostRef.current
            ? botPos
            : null;
          if (!amHostRef.current) {
            const pose = carRegistryRef.current?.get("bot");
            if (pose) {
              botXZ = [pose.x, pose.z];
            } else {
              const bp = hostPlayerStateRef.current?.state.botPos as
                | [number, number, number]
                | undefined;
              if (bp) botXZ = [bp[0], bp[2]];
            }
          }
          if (botXZ) {
            const [sx, sy] = toCanvas(botXZ[0], botXZ[1]);
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(sx, sy, MINIMAP_STYLE.botRadius, 0, Math.PI * 2);
            ctx.fillStyle = css.bot;
            ctx.strokeStyle = css.dotOutline;
            ctx.lineWidth = MINIMAP_STYLE.botOutlineWidth;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }

        // Player dot (always on top) — spectators have no car of their own, so
        // skip it (for a spectator, playerX/Z is the watched car, already drawn)
        if (!spectatorRef.current) {
          const [psx, psy] = toCanvas(playerX, playerZ);
          ctx.beginPath();
          ctx.arc(psx, psy, MINIMAP_STYLE.playerRadius, 0, Math.PI * 2);
          ctx.fillStyle = css.player;
          ctx.strokeStyle = css.dotOutline;
          ctx.lineWidth = MINIMAP_STYLE.playerOutlineWidth;
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore(); // end square clip
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        update: draw,
        setTrack: (checkpoints: CheckpointDef[]) => {
          checkpointsRef.current = checkpoints;
          if (checkpoints.length >= 2) {
            const dx = checkpoints[1].position[0] - checkpoints[0].position[0];
            const dz = checkpoints[1].position[2] - checkpoints[0].position[2];
            tileSizeRef.current = Math.round(Math.sqrt(dx * dx + dz * dz));
          }
        },
      }),
      [draw],
    );

    return (
      <canvas
        ref={canvasRef}
        width={CSS_SIZE}
        height={CSS_SIZE}
        style={{
          position: "fixed",
          bottom: 16,
          left: 16,
          width: CSS_SIZE,
          height: CSS_SIZE,
          pointerEvents: "none",
          display: visible ? "block" : "none",
        }}
      />
    );
  },
);
