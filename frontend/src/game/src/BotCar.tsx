import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { NameLabel } from "./NameLabel.tsx";
import { CAR_MODEL } from "./options.ts";

interface BotCarProps {
  groupRef: React.RefObject<THREE.Group>;
}

export function BotCar({ groupRef }: BotCarProps) {
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
