import { useCallback, useEffect, useRef } from "react";
import type { PlayerState } from "playroomkit";
import type { RemotePlayer } from "../useMultiplayer.ts";
import type { CarController } from "../CarController.ts";
import {
  yawFromQuat,
  type SpectateTarget,
  type CarPoseRegistry,
} from "./sceneMath.ts";

interface Params {
  spectator: boolean;
  remotePlayers?: RemotePlayer[];
  hostPlayerState?: PlayerState | null;
  // Room-wide bot flag (host-or-not) — spectators need it to follow the bot.
  sharedBotEnabled: boolean;
  // True when THIS client runs the bot locally (host) — its controller is the
  // frame-smooth source for the bot's spectate position.
  botEnabled: boolean;
  onSpectateTarget?: (name: string | null) => void;
  // Smoothed rendered poses for remote cars + the non-host bot.
  carRegistry?: CarPoseRegistry;
  // The host's local bot controller (owned by Scene).
  botControllerRef: React.RefObject<CarController | null>;
}

// Owns the spectator-camera target list + selection. The local player's car is
// followed directly by Scene; this hook only governs which OTHER car a
// spectator watches and how A/D cycles between them. Scene reads the returned
// refs in its frame loop and calls buildSpectateTargets() each frame.
export function useSpectatorView({
  spectator,
  remotePlayers,
  hostPlayerState,
  sharedBotEnabled,
  botEnabled,
  onSpectateTarget,
  carRegistry,
  botControllerRef,
}: Params) {
  // Synced each render from props so the frame loop / key handler read live values.
  const spectatorRef = useRef(spectator);
  spectatorRef.current = spectator;
  const remotePlayersRef = useRef<RemotePlayer[]>([]);
  remotePlayersRef.current = remotePlayers ?? [];
  const hostPlayerStateRef = useRef<PlayerState | null>(
    hostPlayerState ?? null,
  );
  hostPlayerStateRef.current = hostPlayerState ?? null;
  const sharedBotEnabledRef = useRef(sharedBotEnabled);
  sharedBotEnabledRef.current = sharedBotEnabled;
  const onSpectateTargetRef = useRef(onSpectateTarget);
  onSpectateTargetRef.current = onSpectateTarget;

  const spectateIndexRef = useRef(0);
  const spectateCountRef = useRef(0);
  const spectateNameRef = useRef<string | null>(null);

  // Build the list of cars a spectator can watch: every non-spectator remote
  // racer plus the bot. Bot position comes from the local controller (host) or
  // the host's broadcast (non-host).
  const buildSpectateTargets = useCallback((): SpectateTarget[] => {
    const targets: SpectateTarget[] = [];
    for (const r of remotePlayersRef.current) {
      const st = r.playerState?.state;
      if (!st || st.spectator === true) continue;
      const name = (st.username as string | undefined) ?? r.id.slice(0, 8);
      // Prefer the smoothed rendered pose; fall back to the raw broadcast only
      // until the renderer has produced its first lerped frame.
      const pose = carRegistry?.get(r.id);
      if (pose) {
        targets.push({ x: pose.x, z: pose.z, yaw: pose.yaw, name });
        continue;
      }
      const pos = st.pos as [number, number, number] | undefined;
      if (!pos) continue;
      const quat = st.quat as [number, number, number, number] | undefined;
      targets.push({
        x: pos[0],
        z: pos[2],
        yaw: quat ? yawFromQuat(quat) : 0,
        name,
      });
    }
    if (sharedBotEnabledRef.current) {
      if (botEnabled && botControllerRef.current) {
        // Host runs the bot locally — already frame-smooth
        const b = botControllerRef.current;
        targets.push({
          x: b.position.x,
          z: b.position.z,
          yaw: b.yaw,
          name: "Bot",
        });
      } else {
        const pose = carRegistry?.get("bot");
        if (pose) {
          targets.push({ x: pose.x, z: pose.z, yaw: pose.yaw, name: "Bot" });
        } else {
          const bp = hostPlayerStateRef.current?.state.botPos as
            | [number, number, number]
            | undefined;
          if (bp) {
            const bq = hostPlayerStateRef.current?.state.botQuat as
              | [number, number, number, number]
              | undefined;
            targets.push({
              x: bp[0],
              z: bp[2],
              yaw: bq ? yawFromQuat(bq) : 0,
              name: "Bot",
            });
          }
        }
      }
    }
    return targets;
  }, [botEnabled, carRegistry, botControllerRef]);

  // A/D (or ←/→) cycle the spectated car while spectating
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!spectatorRef.current) return;
      const n = spectateCountRef.current;
      if (n <= 0) return;
      if (e.code === "KeyA" || e.code === "ArrowLeft") {
        spectateIndexRef.current =
          (((spectateIndexRef.current - 1) % n) + n) % n;
      } else if (e.code === "KeyD" || e.code === "ArrowRight") {
        spectateIndexRef.current = (spectateIndexRef.current + 1) % n;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    spectatorRef,
    spectateIndexRef,
    spectateCountRef,
    spectateNameRef,
    onSpectateTargetRef,
    buildSpectateTargets,
  };
}
