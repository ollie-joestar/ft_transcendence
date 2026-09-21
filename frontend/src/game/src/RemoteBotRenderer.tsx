import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { PlayerState } from "playroomkit";
import { NameLabel } from "./NameLabel.tsx";
import { CAR_MODEL, RACER_INTERP, SPECTATOR_INTERP } from "./options.ts";
import { CarSkidTrail, type SkidmarksHandle } from "./Skidmarks.tsx";
import type { CarPoseRegistry } from "./Scene.tsx";
import { RemoteInterpolator } from "./RemoteInterpolator.ts";

interface RemoteBotRendererProps {
  playerState: PlayerState;
  // Shared skidmark pool — sliding is derived locally from the lerped motion
  skidmarks?: React.RefObject<SkidmarksHandle | null>;
  // Shared live pose registry — written each frame for the spectator camera
  carRegistry?: CarPoseRegistry;
  // True when the LOCAL client is spectating — smoother bot interpolation.
  spectator?: boolean;
}

const _tp = new THREE.Vector3();
const _tq = new THREE.Quaternion();
const _fwd = new THREE.Vector3();

export function RemoteBotRenderer({
  playerState,
  skidmarks,
  carRegistry,
  spectator = false,
}: RemoteBotRendererProps) {
  const { scene } = useGLTF(CAR_MODEL.path);

  const botScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#cc2222"),
        });
      }
    });
    return clone;
  }, [scene]);

  const groupRef = useRef<THREE.Group | null>(null);
  const interpRef = useRef<RemoteInterpolator>(null!);
  if (!interpRef.current) {
    interpRef.current = new RemoteInterpolator(
      spectator ? SPECTATOR_INTERP : RACER_INTERP,
    );
  }
  useEffect(() => {
    interpRef.current.configure(spectator ? SPECTATOR_INTERP : RACER_INTERP);
  }, [spectator]);
  const trailRef = useRef(new CarSkidTrail());
  const prevPosRef = useRef(new THREE.Vector3());
  const havePrevRef = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    const s = playerState?.state;
    const pos = s?.botPos as [number, number, number] | undefined;
    const quat = s?.botQuat as [number, number, number, number] | undefined;
    if (!pos || !quat) return;

    // Snapshot interpolation → constant-velocity, jitter-free remote motion
    if (
      !interpRef.current.sample(
        pos[0],
        pos[1],
        pos[2],
        quat[0],
        quat[1],
        quat[2],
        quat[3],
        _tp,
        _tq,
      )
    )
      return;
    group.position.copy(_tp);
    group.quaternion.copy(_tq);

    // Publish the smoothed rendered pose for the spectator camera
    if (carRegistry) {
      _fwd.set(0, 0, 1).applyQuaternion(group.quaternion);
      carRegistry.set("bot", {
        x: _tp.x,
        z: _tp.z,
        yaw: Math.atan2(_fwd.x, _fwd.z),
      });
    }

    // Skidmarks — velocity from the interpolated position delta, yaw from the quaternion
    if (skidmarks?.current && delta > 0) {
      const p = group.position;
      if (havePrevRef.current) {
        const velX = (p.x - prevPosRef.current.x) / delta;
        const velZ = (p.z - prevPosRef.current.z) / delta;
        _fwd.set(0, 0, 1).applyQuaternion(group.quaternion);
        trailRef.current.sample(
          skidmarks.current,
          p.x,
          p.z,
          Math.atan2(_fwd.x, _fwd.z),
          velX,
          velZ,
          delta,
        );
      }
      prevPosRef.current.copy(p);
      havePrevRef.current = true;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={botScene}
        scale={CAR_MODEL.scale}
        position={CAR_MODEL.position}
        rotation={CAR_MODEL.rotation}
      />
      <NameLabel name="BOT" color="#cc2222" />
    </group>
  );
}
