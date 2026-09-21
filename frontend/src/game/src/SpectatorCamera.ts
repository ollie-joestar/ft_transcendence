import * as THREE from "three";
import type { CamConfig } from "./options.ts";

// ── Spectator chase camera ───────────────────────────────────────────────────
//
// This is a *deliberately loose* follow camera, separate from PlayerCamera. It
// does NOT try to stay pinned to the exact car position each frame. Instead it
// runs a critically-damped spring (SmoothDamp) toward the watched car's pose,
// so it eases in like a real chase cam and trails the car by a soft lag.
//
// Why a spring instead of the old `lerp(1 - exp(-k·dt))`:
//   - The watched car's position comes from RemoteInterpolator, which advances
//     on the real wall clock, while the frame loop feeds the camera a *clamped*
//     dt. With a tight exponential follow, that timebase mismatch (and ordinary
//     per-frame dt jitter) showed up as a periodic lurch / stutter.
//   - SmoothDamp is C1-continuous: it carries a velocity, so it never makes a
//     sudden positional jump when dt wobbles or the source steps unevenly. A
//     long frame just means it's momentarily a bit further behind, then it
//     glides back — no pop. The generous smooth times below (~0.25s) give the
//     camera a big enough lag buffer to absorb the mismatch entirely.
//
// Net effect: smooth viewing with a ~200-300ms soft trail, jitter-free, at the
// cost of the camera not being perfectly glued to the car (which is fine — and
// actually nicer — for spectating).

// Spring response times (seconds). Larger = looser / more lag / smoother.
const ANCHOR_SMOOTH_TIME = 0.22; // the look-at point chasing the car
const CAM_SMOOTH_TIME = 0.28; // the camera body chasing its desired offset
const YAW_SMOOTH_TIME = 0.3; // the follow heading easing toward the car heading

// Clamp dt inside the camera so a huge stall (background tab, GC mega-pause)
// can't make the spring take one enormous step. Beyond this we'd rather lag.
const DT_MAX = 0.1;

// Snap (no easing) when the target jumps more than this — i.e. cycling to a
// far-away car with A/D, or a race-restart teleport.
const SNAP_DIST_SQ = 25 * 25;

// Unity-style critically-damped smoothing for one scalar. Returns the new
// value and writes the new velocity back via the `vel` single-element array.
// Frame-rate independent and overshoot-free.
function smoothDampScalar(
  current: number,
  target: number,
  vel: [number],
  smoothTime: number,
  dt: number,
): number {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel[0] + omega * change) * dt;
  vel[0] = (vel[0] - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  // Prevent overshooting past the target.
  if (target - current > 0 === output > target) {
    output = target;
    vel[0] = (output - target) / dt;
  }
  return output;
}

// Shortest signed angular difference, wrapped to (-π, π].
function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class SpectatorCamera {
  private readonly anchor = new THREE.Vector3(); // smoothed look-at point
  private readonly anchorVel: [number, number, number] = [0, 0, 0];
  private readonly camPos = new THREE.Vector3(); // smoothed camera position
  private readonly camVel: [number, number, number] = [0, 0, 0];
  private yaw = 0; // smoothed follow heading
  private yawVel: [number] = [0];
  private initialized = false;

  // Scratch
  private readonly fwd = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly scalarVel: [number] = [0];

  /** Reset spring state so the next update snaps (e.g. on a fresh spectate). */
  reset(): void {
    this.initialized = false;
  }

  private computeDesired(
    config: CamConfig,
    anchor: THREE.Vector3,
    yaw: number,
  ): THREE.Vector3 {
    this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    return this.desired
      .copy(anchor)
      .addScaledVector(this.fwd, config.scale)
      .add(this.target.set(0, config.height, 0));
  }

  update(
    camera: THREE.Camera,
    config: CamConfig,
    followX: number,
    followY: number,
    followZ: number,
    followYaw: number,
    dt: number,
  ): void {
    const d = Math.min(dt, DT_MAX);
    this.target.set(followX, followY, followZ);

    // First frame, or a big jump (target swap / teleport): snap everything and
    // zero the spring velocities so we don't fling the camera afterwards.
    if (
      !this.initialized ||
      this.anchor.distanceToSquared(this.target) > SNAP_DIST_SQ
    ) {
      this.anchor.copy(this.target);
      this.yaw = followYaw;
      this.anchorVel[0] = this.anchorVel[1] = this.anchorVel[2] = 0;
      this.yawVel[0] = 0;
      const desired = this.computeDesired(config, this.anchor, this.yaw);
      this.camPos.copy(desired);
      this.camVel[0] = this.camVel[1] = this.camVel[2] = 0;
      this.initialized = true;
      camera.position.copy(this.camPos);
      camera.lookAt(this.anchor.x, this.anchor.y + 0.5, this.anchor.z);
      return;
    }

    // Ease the look-at anchor toward the car (component-wise spring).
    this.scalarVel[0] = this.anchorVel[0];
    this.anchor.x = smoothDampScalar(
      this.anchor.x,
      this.target.x,
      this.scalarVel,
      ANCHOR_SMOOTH_TIME,
      d,
    );
    this.anchorVel[0] = this.scalarVel[0];
    this.scalarVel[0] = this.anchorVel[1];
    this.anchor.y = smoothDampScalar(
      this.anchor.y,
      this.target.y,
      this.scalarVel,
      ANCHOR_SMOOTH_TIME,
      d,
    );
    this.anchorVel[1] = this.scalarVel[0];
    this.scalarVel[0] = this.anchorVel[2];
    this.anchor.z = smoothDampScalar(
      this.anchor.z,
      this.target.z,
      this.scalarVel,
      ANCHOR_SMOOTH_TIME,
      d,
    );
    this.anchorVel[2] = this.scalarVel[0];

    // Ease the follow heading. Smooth toward (yaw + shortestDelta) so wrap-around
    // never causes a 2π spin, then re-normalise.
    const yawTarget = this.yaw + angleDelta(this.yaw, followYaw);
    this.yaw = smoothDampScalar(
      this.yaw,
      yawTarget,
      this.yawVel,
      YAW_SMOOTH_TIME,
      d,
    );

    // Desired camera position from the smoothed anchor + heading, then spring
    // the camera body toward it (a second, looser stage of smoothing).
    const desired = this.computeDesired(config, this.anchor, this.yaw);
    this.scalarVel[0] = this.camVel[0];
    this.camPos.x = smoothDampScalar(
      this.camPos.x,
      desired.x,
      this.scalarVel,
      CAM_SMOOTH_TIME,
      d,
    );
    this.camVel[0] = this.scalarVel[0];
    this.scalarVel[0] = this.camVel[1];
    this.camPos.y = smoothDampScalar(
      this.camPos.y,
      desired.y,
      this.scalarVel,
      CAM_SMOOTH_TIME,
      d,
    );
    this.camVel[1] = this.scalarVel[0];
    this.scalarVel[0] = this.camVel[2];
    this.camPos.z = smoothDampScalar(
      this.camPos.z,
      desired.z,
      this.scalarVel,
      CAM_SMOOTH_TIME,
      d,
    );
    this.camVel[2] = this.scalarVel[0];

    camera.position.copy(this.camPos);
    camera.lookAt(this.anchor.x, this.anchor.y + 0.5, this.anchor.z);
  }
}
