import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { calculateAI } from "./calculateAI.ts";
import type { AIFrame, Checkpoints, AIState } from "./aiTypes.ts";
import type { MutableRefObject } from "react";
import type { CarController } from "./CarController.ts";
import type { CheckpointDef } from "./TrackTypes.ts";
import type { InputLike } from "./Input.ts";

// Module-level scratch — no per-frame allocation
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3(0, 1, 0);

interface BotBridgeOptions {
  enabled: boolean;
  carControllerRef: MutableRefObject<CarController | null>;
  playerControllerRef: MutableRefObject<CarController | null>;
  checkpointsRef: MutableRefObject<CheckpointDef[]>;
  nextCpRef: MutableRefObject<number>;
  playerNextCpRef: MutableRefObject<number>;
  takeover: boolean;
}

export function useBotBridge({
  enabled,
  carControllerRef,
  playerControllerRef,
  checkpointsRef,
  nextCpRef,
  playerNextCpRef,
  takeover,
}: BotBridgeOptions): { botInput: MutableRefObject<InputLike> } {
  const botInput = useRef<InputLike>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
  });

  const botState = useRef<AIState>({
    previousAngleError: 0,
    integralError: 0,
    lastPosition: [0, 0, 0],
    stallTicks: 0,
    reverseTicks: 0,
    initialized: false,
  });

  useFrame(() => {
    const b = botInput.current;
    if (!enabled) {
      b.forward = b.backward = b.left = b.right = b.handbrake = false;
      return;
    }

    const car = takeover
      ? playerControllerRef.current
      : carControllerRef.current;
    if (!car) return;
    const cps = checkpointsRef.current;
    const total = cps.length;
    if (!total) return;

    // Next 3 checkpoints as a sliding window
    const nextIdx = takeover ? playerNextCpRef.current : nextCpRef.current;
    const checkpoints: Checkpoints = {
      0: cps[(nextIdx + 0) % total].position,
      1: cps[(nextIdx + 1) % total].position,
      2: cps[(nextIdx + 2) % total].position,
    };

    // Derive quaternion from current yaw
    _q.setFromAxisAngle(_axis, car.yaw);
    const pos = car.position;
    const vel = car.velocity;

    const frame: AIFrame = {
      position: [pos.x, pos.y, pos.z],
      quaternion: [_q.x, _q.y, _q.z, _q.w],
      velocity: [vel.x, vel.y, vel.z],
      totalCheckpoints: total,
      currentCheckpoint: nextIdx,
      checkpoints,
    };
    // Compute the AI response inline (same-frame, no network round-trip).
    const r = calculateAI(frame, botState.current);
    botState.current = r.botState;

    b.forward = r.forward;
    b.backward = r.backward;
    b.left = r.left;
    b.right = r.right;
    b.handbrake = false;
  });

  return { botInput };
}
