import * as THREE from "three";
import type { CamConfig } from "./options.ts";

// Follow camera for the **local player**.
//
// It looks at the car's *raw* position — the exact same value the car mesh is
// rendered at each frame — so the car stays pinned to screen-centre and only
// the background pans (smoothed by the camera-position lerp). This is the
// behaviour from before the "camera fix": do NOT low-pass the follow point
// here. Smoothing the look target decouples it from the mesh (which still
// renders at the raw body position), and because the per-frame lerp factor
// depends on the variable frame time, that decoupled offset breathes from
// frame to frame and reads as jitter. The local body position is already
// frame-coherent with the mesh, so following it directly is the smoothest
// option. See SpectatorCamera for the smoothed variant (justified there because
// it eases between watched cars when cycling targets).
export class PlayerCamera {
  private readonly camPos = new THREE.Vector3(0, 8, -12);
  private readonly camTarget = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly height = new THREE.Vector3();

  update(
    camera: THREE.Camera,
    config: CamConfig,
    followX: number,
    followY: number,
    followZ: number,
    followYaw: number,
    dt: number,
  ): void {
    this.fwd.set(Math.sin(followYaw), 0, Math.cos(followYaw));
    this.desired
      .set(followX, followY, followZ)
      .addScaledVector(this.fwd, config.scale)
      .add(this.height.set(0, config.height, 0));
    this.camPos.lerp(this.desired, Math.min(1, config.lerp * dt));
    camera.position.copy(this.camPos);
    this.camTarget.set(followX, followY + 0.5, followZ);
    camera.lookAt(this.camTarget);
  }
}
