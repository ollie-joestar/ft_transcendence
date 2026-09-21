import * as THREE from "three";
import { WHEEL_OFFSETS } from "../options.ts";
import type { CheckpointDef } from "../TrackTypes.ts";

// A car the spectator camera can follow (a remote racer or the bot).
export interface SpectateTarget {
  x: number;
  z: number;
  yaw: number;
  name: string;
}

// Live, frame-lerped car poses keyed by player id (or 'bot'), written by the
// remote renderers each frame and read by the spectator camera so it follows
// the smoothed rendered position rather than the raw ~20 Hz broadcast.
export type CarPoseRegistry = Map<
  string,
  { x: number; z: number; yaw: number }
>;

// ── Debug arrow sizing ──────────────────────────────────────────────────────
// Car is ~2 units long (collider half-extent 1.0); 1.5 cars = 3 units.
export const ARROW_LENGTH = 3;
export const ARROW_HEAD_LENGTH = 0.6;
export const ARROW_HEAD_WIDTH = 0.3;

// A hidden-by-default ArrowHelper pointing +Z, used for the forward/velocity
// debug arrows.
export function makeDebugArrow(color: number): THREE.ArrowHelper {
  const a = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, 0),
    ARROW_LENGTH,
    color,
    ARROW_HEAD_LENGTH,
    ARROW_HEAD_WIDTH,
  );
  a.visible = false;
  return a;
}

// ── Heading helpers ─────────────────────────────────────────────────────────
const _yawQuat = new THREE.Quaternion();
const _yawFwd = new THREE.Vector3();

// Heading (yaw) from a car quaternion — cars only rotate about Y, so the
// forward vector's XZ angle is the heading.
export function yawFromQuat(q: [number, number, number, number]): number {
  _yawQuat.set(q[0], q[1], q[2], q[3]);
  _yawFwd.set(0, 0, 1).applyQuaternion(_yawQuat);
  return Math.atan2(_yawFwd.x, _yawFwd.z);
}

const _toQuat = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

// Quaternion (as a [x,y,z,w] tuple) for a Y-axis rotation — used when
// broadcasting a car's orientation. Reuses module scratch (no per-frame alloc;
// the returned tuple is the only allocation, consumed immediately).
export function yawToQuat(yaw: number): [number, number, number, number] {
  _toQuat.setFromAxisAngle(_yAxis, yaw);
  return [_toQuat.x, _toQuat.y, _toQuat.z, _toQuat.w];
}

// ── Geometry ────────────────────────────────────────────────────────────────
// XZ axis-aligned bounding-box test against a checkpoint tile.
export function insideCheckpointXZ(
  x: number,
  z: number,
  cp: CheckpointDef,
): boolean {
  return (
    Math.abs(x - cp.position[0]) <= cp.size[0] / 2 &&
    Math.abs(z - cp.position[2]) <= cp.size[2] / 2
  );
}

// Unit forward tangent of the track at the car's XZ position. The checkpoints
// form a closed polyline around the circuit (in travel order), so the nearest
// segment's direction (earlier→later) is the correct local "track forward".
// Writes the unit tangent into `out` and returns true when one was found (needs
// ≥2 checkpoints). Used by wrong-way detection so the reference is the local
// road direction rather than a far-off bearing to a single checkpoint (which
// rotates around and flips sign when you drive far backward on a closed loop).
export function trackTangentAt(
  cps: CheckpointDef[],
  x: number,
  z: number,
  out: [number, number],
): boolean {
  const n = cps.length;
  if (n < 2) return false;
  let bestDistSq = Infinity;
  let bestDx = 0,
    bestDz = 0;
  for (let i = 0; i < n; i++) {
    const a = cps[i].position;
    const b = cps[(i + 1) % n].position;
    const ax = a[0],
      az = a[2];
    const sx = b[0] - ax,
      sz = b[2] - az;
    const segLenSq = sx * sx + sz * sz;
    if (segLenSq < 1e-6) continue;
    // Project (x,z) onto the segment, clamped to its endpoints.
    let t = ((x - ax) * sx + (z - az) * sz) / segLenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const ddx = x - (ax + t * sx),
      ddz = z - (az + t * sz);
    const distSq = ddx * ddx + ddz * ddz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestDx = sx;
      bestDz = sz;
    }
  }
  const len = Math.hypot(bestDx, bestDz);
  if (len < 1e-6) return false;
  out[0] = bestDx / len;
  out[1] = bestDz / len;
  return true;
}

// Rear wheel world positions from the car-local WHEEL_OFFSETS rotated by yaw.
// Writes into the provided out-arrays to avoid per-frame allocation:
//   worldX = carX + cos(yaw)*lx + sin(yaw)*lz
//   worldZ = carZ - sin(yaw)*lx + cos(yaw)*lz
export function rearWheelWorldPositions(
  px: number,
  py: number,
  pz: number,
  yaw: number,
  outLeft: [number, number, number],
  outRight: [number, number, number],
): void {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const [llx, lly, llz] = WHEEL_OFFSETS.rearLeft;
  outLeft[0] = px + cosY * llx + sinY * llz;
  outLeft[1] = py + lly;
  outLeft[2] = pz - sinY * llx + cosY * llz;
  const [rlx, rly, rlz] = WHEEL_OFFSETS.rearRight;
  outRight[0] = px + cosY * rlx + sinY * rlz;
  outRight[1] = py + rly;
  outRight[2] = pz - sinY * rlx + cosY * rlz;
}
