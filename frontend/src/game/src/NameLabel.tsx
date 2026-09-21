import { useRef, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

const FADE_START = 15;
const FADE_END = 30;
const _wp = new THREE.Vector3();

interface NameLabelProps {
  name: string;
  color: string;
}

export function NameLabel({ name, color }: NameLabelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<{ material?: THREE.Material | null }>(null);
  const bgRef =
    useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    groupRef.current.getWorldPosition(_wp);
    const dist = camera.position.distanceTo(_wp);
    const alpha = THREE.MathUtils.clamp(
      1 - (dist - FADE_START) / (FADE_END - FADE_START),
      0,
      1,
    );
    const mat = textRef.current?.material;
    if (mat) {
      if (!mat.transparent) {
        mat.transparent = true;
        mat.depthWrite = false;
      }
      mat.opacity = alpha;
    }
    if (bgRef.current) bgRef.current.material.opacity = alpha * 0.15;
  });

  return (
    <group ref={groupRef} position={[0, 1.8, 0]}>
      <Suspense fallback={null}>
        <Billboard>
          <mesh ref={bgRef} renderOrder={1}>
            <planeGeometry args={[1, 0.42]} />
            <meshBasicMaterial
              color="#1B1717"
              transparent
              opacity={0.1}
              depthWrite={false}
            />
          </mesh>
          <Text
            ref={textRef}
            fontSize={0.22}
            color={color}
            anchorX="center"
            anchorY="middle"
            renderOrder={2}
            position={[0, 0, 0.01]}
            letterSpacing={0.08}
            onSync={(troika: {
              geometry?: { boundingBox?: THREE.Box3 | null };
            }) => {
              if (!bgRef.current || !troika.geometry?.boundingBox) return;
              const bb = troika.geometry.boundingBox;
              bgRef.current.scale.x = bb.max.x - bb.min.x + 0.3;
            }}
          >
            {name.toUpperCase()}
          </Text>
        </Billboard>
      </Suspense>
    </group>
  );
}
