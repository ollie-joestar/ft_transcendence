import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SKIDMARK, WHEEL_OFFSETS } from "./options.ts";
import { getScheme, useTheme } from "./theme.ts";

export interface SkidmarksHandle {
  // Stamp one segment quad spanning (fromX, fromZ) → (toX, toZ) at height y.
  // Consecutive segments sharing endpoints form a continuous stroke.
  stamp: (
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    y: number,
  ) => void;
  // Clear all marks (call on race restart)
  reset: () => void;
}

// Per-car skid trail state: tracks each rear wheel's previous stamp point so
// consecutive stamps form connected segments. One instance per car — player,
// bot, and remote cars all stamp into the same shared Skidmarks pool.
export class CarSkidTrail {
  private lastLeft = new THREE.Vector3();
  private lastRight = new THREE.Vector3();
  private leftActive = false;
  private rightActive = false;
  // Ground distance (metres) travelled while drifting, since the last takeDrift().
  // Accumulated only on frames where both the speed and slip gates pass — i.e.
  // exactly when skidmarks are being laid — so it's free to compute here.
  private driftMeters = 0;

  // Read-and-reset the accumulated drift distance (metres). Called at lap
  // boundaries to fold the completed lap's drift into the player's stats.
  takeDrift(): number {
    const m = this.driftMeters;
    this.driftMeters = 0;
    return m;
  }

  reset() {
    this.leftActive = false;
    this.rightActive = false;
  }

  // Sample the car pose once per frame; stamps both rear wheels when sliding.
  // (x, z, yaw) = car pose, (velX, velZ) = world velocity in m/s, dt = frame seconds.
  sample(
    sm: SkidmarksHandle,
    x: number,
    z: number,
    yaw: number,
    velX: number,
    velZ: number,
    dt: number,
  ) {
    const spd = Math.sqrt(velX * velX + velZ * velZ);
    if (spd <= SKIDMARK.minSpeed) {
      this.reset();
      return;
    }

    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    // Lateral slip = how much the velocity direction diverges from car forward
    const dot = (velX / spd) * sinY + (velZ / spd) * cosY;
    if (1 - Math.abs(dot) <= SKIDMARK.minSlip) {
      this.reset();
      return;
    }

    // Drifting this frame — add the ground distance covered (speed × dt).
    this.driftMeters += spd * dt;

    // Rear wheel world positions (local offsets rotated by yaw)
    const [llx, , llz] = WHEEL_OFFSETS.rearLeft;
    const [rlx, , rlz] = WHEEL_OFFSETS.rearRight;
    this.leftActive = this.sampleWheel(
      sm,
      this.lastLeft,
      this.leftActive,
      x + cosY * llx + sinY * llz,
      z - sinY * llx + cosY * llz,
    );
    this.rightActive = this.sampleWheel(
      sm,
      this.lastRight,
      this.rightActive,
      x + cosY * rlx + sinY * rlz,
      z - sinY * rlx + cosY * rlz,
    );
  }

  // First slipping frame anchors the trail; afterwards stamp a segment once
  // the wheel has moved minStampDistance. Returns the new active flag.
  private sampleWheel(
    sm: SkidmarksHandle,
    last: THREE.Vector3,
    active: boolean,
    wx: number,
    wz: number,
  ): boolean {
    if (!active) {
      last.set(wx, 0, wz);
      return true;
    }
    const dx = wx - last.x;
    const dz = wz - last.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= SKIDMARK.minStampDistance) {
      if (d <= SKIDMARK.maxSegmentLength) {
        sm.stamp(last.x, last.z, wx, wz, SKIDMARK.floorY);
      }
      last.set(wx, 0, wz);
    }
    return true;
  }
}

// Unit-length flat quad on the XZ plane (normal = +Y); each instance is
// scaled along Z to span the actual distance between its two stamp points.
// PlaneGeometry is in XY by default, so we rotate it once at module load.
const _geo = new THREE.PlaneGeometry(SKIDMARK.quadWidth, 1);
_geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

// Colour is seeded from the active theme and updated in the component below
// whenever the theme switches (recolours all live marks in one shot).
const _mat = new THREE.MeshBasicMaterial({
  color: getScheme().skidmark,
  transparent: SKIDMARK.opacity < 1,
  opacity: SKIDMARK.opacity,
  depthWrite: SKIDMARK.opacity >= 1,
  side: THREE.DoubleSide,
});

// Module-level scratch objects — safe since JS is single-threaded
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _mtx = new THREE.Matrix4();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

// One instance matrix = 16 floats — used for partial GPU buffer uploads so a
// stamp only re-uploads its own slot, not the whole pool (matters on iGPUs).
const MATRIX_FLOATS = 16;

export const Skidmarks = forwardRef<SkidmarksHandle>(
  function Skidmarks(_, ref) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const headRef = useRef(0); // next write slot
    const tailRef = useRef(0); // oldest live slot
    const countRef = useRef(0); // number of live stamps
    const timestamps = useRef(new Float64Array(SKIDMARK.poolSize));

    // Recolour the shared material when the theme changes
    const scheme = useTheme();
    useLayoutEffect(() => {
      _mat.color.setHex(scheme.skidmark);
    }, [scheme]);

    // Start with count=0 so Three.js renders nothing until the first stamp
    useLayoutEffect(() => {
      if (meshRef.current) meshRef.current.count = 0;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        stamp(fromX, fromZ, toX, toZ, y) {
          const mesh = meshRef.current;
          if (!mesh) return;

          const dx = toX - fromX;
          const dz = toZ - fromZ;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len < 1e-4) return;

          const i = headRef.current;
          _pos.set((fromX + toX) / 2, y, (fromZ + toZ) / 2);
          _quat.setFromAxisAngle(_yAxis, Math.atan2(dx, dz));
          _scale.set(1, 1, len + SKIDMARK.segmentOverlap);
          _mtx.compose(_pos, _quat, _scale);
          mesh.setMatrixAt(i, _mtx);
          mesh.instanceMatrix.addUpdateRange(i * MATRIX_FLOATS, MATRIX_FLOATS);
          mesh.instanceMatrix.needsUpdate = true;
          timestamps.current[i] = performance.now();

          headRef.current = (i + 1) % SKIDMARK.poolSize;

          if (countRef.current < SKIDMARK.poolSize) {
            countRef.current++;
            mesh.count = countRef.current;
          } else {
            // Pool full — overwrite oldest, advance tail
            tailRef.current = (tailRef.current + 1) % SKIDMARK.poolSize;
          }
        },

        reset() {
          const mesh = meshRef.current;
          if (!mesh) return;
          const used = mesh.count;
          for (let i = 0; i < used; i++) {
            mesh.setMatrixAt(i, _zero);
            timestamps.current[i] = 0;
          }
          // Drop any pending partial ranges — empty ranges = full buffer upload
          mesh.instanceMatrix.clearUpdateRanges();
          mesh.instanceMatrix.needsUpdate = true;
          mesh.count = 0;
          headRef.current = 0;
          tailRef.current = 0;
          countRef.current = 0;
        },
      }),
      [],
    );

    useFrame(() => {
      const mesh = meshRef.current;
      if (!mesh || countRef.current === 0) return;

      const now = performance.now();
      let didExpire = false;

      while (countRef.current > 0) {
        const tail = tailRef.current;
        if (now - timestamps.current[tail] > SKIDMARK.ttlMs) {
          mesh.setMatrixAt(tail, _zero);
          mesh.instanceMatrix.addUpdateRange(
            tail * MATRIX_FLOATS,
            MATRIX_FLOATS,
          );
          tailRef.current = (tail + 1) % SKIDMARK.poolSize;
          countRef.current--;
          didExpire = true;
        } else {
          break; // Tail is the oldest — if it hasn't expired, nothing newer has either
        }
      }

      if (didExpire) mesh.instanceMatrix.needsUpdate = true;
    });

    return (
      <instancedMesh
        ref={meshRef}
        args={[_geo, _mat, SKIDMARK.poolSize]}
        frustumCulled={false}
        renderOrder={1}
      />
    );
  },
);
