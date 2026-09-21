import * as THREE from "three";
import { NET_BROADCAST_INTERVAL_MS } from "./options.ts";

interface Snapshot {
  t: number; // local arrival time (ms)
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
}

export interface InterpolatorOptions {
  // How far in the past to render (ms). Larger = smoother but more latency.
  delayMs?: number;
  // Reject physically-implausible single broadcasts (a faulty packet or an
  // out-of-order one whose stale position would otherwise yank the car a long
  // way and snap back). Spectator-only — off by default so racing, the minimap
  // and the competitive remote-car view keep their low-latency behaviour.
  rejectOutliers?: boolean;
}

// A step more than OUTLIER_FACTOR× the recent-average step is treated as a
// glitch — but never below OUTLIER_FLOOR units, so genuine acceleration from a
// standstill (where the average step is tiny) is not mistaken for an outlier.
const OUTLIER_FACTOR = 5;
const OUTLIER_FLOOR = 3;
// After this many rejects in a row, trust the new position — it's a real
// teleport (race reset / respawn), not a one-off bad packet. Relearn the norm.
const MAX_CONSECUTIVE_REJECTS = 3;
// EMA weight for the running average step distance.
const STEP_EMA = 0.2;

/**
 * Snapshot interpolation for a remote car driven by NET_BROADCAST_HZ broadcasts
 * (see options.ts).
 *
 * "Lerp toward the latest sample" pulses at the packet rate: between packets
 * the target is frozen, so the car eases out (decelerates), then jumps to a
 * fresh target and accelerates again — a velocity discontinuity every packet.
 *
 * Instead we buffer recent samples and render `delayMs` in the past, linearly
 * interpolating between the two samples that bracket that render time. Motion
 * is then constant-velocity between samples (continuous velocity → smooth),
 * at the cost of a small fixed latency.
 *
 * With `rejectOutliers` on (spectator view) the buffer is deeper and a single
 * broadcast that lands implausibly far from the trajectory is dropped — since
 * the deep buffer still has bracketing samples, skipping one bad packet leaves
 * the motion smooth instead of jumping out and snapping back.
 */
export class RemoteInterpolator {
  private buf: Snapshot[] = [];
  private delayMs: number;
  private rejectOutliers: boolean;
  private maxSnaps: number;

  // Outlier-detection state
  private avgStep = 0;
  private haveAvg = false;
  private consecutiveRejects = 0;

  constructor(opts: InterpolatorOptions = {}) {
    this.delayMs = opts.delayMs ?? 110;
    this.rejectOutliers = opts.rejectOutliers ?? false;
    this.maxSnaps = this.snapCapacity();
  }

  // Hold enough samples to cover the delay window (one sample per broadcast
  // interval — see NET_BROADCAST_INTERVAL_MS) plus headroom for jitter and
  // rejected packets. Scales automatically with the broadcast rate: a faster
  // rate packs more samples into the same delay window, so the buffer grows.
  private snapCapacity(): number {
    return Math.max(
      12,
      Math.ceil(this.delayMs / NET_BROADCAST_INTERVAL_MS) + 8,
    );
  }

  // Re-apply options at runtime (e.g. when the local player toggles spectate).
  // Resets the buffer so the new delay/rejection regime starts clean.
  configure(opts: InterpolatorOptions): void {
    const delay = opts.delayMs ?? 110;
    const reject = opts.rejectOutliers ?? false;
    if (delay === this.delayMs && reject === this.rejectOutliers) return;
    this.delayMs = delay;
    this.rejectOutliers = reject;
    this.maxSnaps = this.snapCapacity();
    this.reset();
  }

  reset(): void {
    this.buf.length = 0;
    this.avgStep = 0;
    this.haveAvg = false;
    this.consecutiveRejects = 0;
  }

  /**
   * Feed the latest received broadcast pose and read back the interpolated
   * pose into `outPos` / `outQuat`. Returns false until at least one sample
   * has been seen.
   */
  sample(
    px: number,
    py: number,
    pz: number,
    qx: number,
    qy: number,
    qz: number,
    qw: number,
    outPos: THREE.Vector3,
    outQuat: THREE.Quaternion,
  ): boolean {
    const now = performance.now();

    // Record a new snapshot only when the broadcast actually changed
    const last = this.buf[this.buf.length - 1];
    const changed =
      !last ||
      last.pos.x !== px ||
      last.pos.y !== py ||
      last.pos.z !== pz ||
      last.quat.x !== qx ||
      last.quat.y !== qy ||
      last.quat.z !== qz ||
      last.quat.w !== qw;

    if (changed) {
      let stepDist = 0;
      let isOutlier = false;
      if (last && this.rejectOutliers) {
        const dx = px - last.pos.x,
          dy = py - last.pos.y,
          dz = pz - last.pos.z;
        stepDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (this.haveAvg) {
          const threshold = Math.max(
            OUTLIER_FLOOR,
            OUTLIER_FACTOR * this.avgStep,
          );
          isOutlier = stepDist > threshold;
        }
      }

      if (
        this.rejectOutliers &&
        isOutlier &&
        this.consecutiveRejects < MAX_CONSECUTIVE_REJECTS
      ) {
        // Drop this packet — the deep buffer still brackets the render cursor.
        this.consecutiveRejects++;
      } else {
        if (this.rejectOutliers && last) {
          if (isOutlier) {
            // Forced-accept after repeated rejects → a real teleport. Relearn.
            this.avgStep = 0;
            this.haveAvg = false;
          } else {
            this.avgStep = this.haveAvg
              ? this.avgStep + STEP_EMA * (stepDist - this.avgStep)
              : stepDist;
            this.haveAvg = true;
          }
        }
        this.consecutiveRejects = 0;
        this.buf.push({
          t: now,
          pos: new THREE.Vector3(px, py, pz),
          quat: new THREE.Quaternion(qx, qy, qz, qw),
        });
        while (this.buf.length > this.maxSnaps) this.buf.shift();
      }
    }

    if (this.buf.length === 0) return false;
    if (this.buf.length === 1) {
      outPos.copy(this.buf[0].pos);
      outQuat.copy(this.buf[0].quat);
      return true;
    }

    const renderT = now - this.delayMs;
    const newest = this.buf[this.buf.length - 1];

    // Before the oldest sample → clamp to oldest
    if (renderT <= this.buf[0].t) {
      outPos.copy(this.buf[0].pos);
      outQuat.copy(this.buf[0].quat);
      return true;
    }
    // Past the newest sample (starved) → clamp to newest
    if (renderT >= newest.t) {
      outPos.copy(newest.pos);
      outQuat.copy(newest.quat);
      return true;
    }
    // Interpolate within the bracketing pair
    for (let i = 0; i < this.buf.length - 1; i++) {
      const a = this.buf[i];
      const b = this.buf[i + 1];
      if (renderT >= a.t && renderT <= b.t) {
        const span = b.t - a.t;
        const alpha = span > 0 ? (renderT - a.t) / span : 0;
        outPos.copy(a.pos).lerp(b.pos, alpha);
        outQuat.copy(a.quat).slerp(b.quat, alpha);
        return true;
      }
    }

    outPos.copy(newest.pos);
    outQuat.copy(newest.quat);
    return true;
  }
}
