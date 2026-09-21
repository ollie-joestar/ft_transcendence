import RAPIER from "@dimforge/rapier3d-compat";

export type { World, RigidBody } from "@dimforge/rapier3d-compat";

export interface PhysicsContext {
  world: RAPIER.World;
  R: typeof RAPIER;
}

export async function initPhysics(): Promise<PhysicsContext> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  return { world, R: RAPIER };
}

export function createGround(
  { world, R }: PhysicsContext,
  halfSize = 2000,
): void {
  const body = world.createRigidBody(
    R.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
  );
  world.createCollider(R.ColliderDesc.cuboid(halfSize, 0.1, halfSize), body);
}

// Collision groups:
//   Group 1 (0x0001) — player car
//   Group 2 (0x0002) — bot car
//   Default (0xFFFF) — track walls, ground (collides with everything)
//
// Each car's filter excludes the other car's group so they pass through each other,
// but both still collide with track geometry (default membership 0xFFFF).
//
// Bit layout Rapier expects: high-16 = filter, low-16 = membership
// JavaScript << on values > 0x7FFF produces a negative signed int, but the
// bit pattern is preserved and WASM interprets it as u32 — so the math is correct.

export function createCarBody(
  { world, R }: PhysicsContext,
  isBot = false,
): RAPIER.RigidBody {
  const desc = R.RigidBodyDesc.dynamic()
    .setTranslation(0, 0.5, 0)
    .setLinearDamping(0)
    .setAngularDamping(0);
  const body = world.createRigidBody(desc);
  // Disable physics-driven rotation on all axes — we set it manually each frame
  body.setEnabledRotations(false, false, false, false);
  // Half-extents match the BoxGeometry(1, 0.5, 2) car mesh
  const collider = R.ColliderDesc.cuboid(0.5, 0.25, 1.1);
  if (isBot) {
    // Member of group 2; collides with everything except group 1 (player)
    collider.setCollisionGroups((0xfffe << 16) | 0x0002);
  } else {
    // Member of group 1; collides with everything except group 2 (bot)
    collider.setCollisionGroups((0xfffd << 16) | 0x0001);
  }
  world.createCollider(collider, body);
  return body;
}

// export function createWall(
//   { world, R }: PhysicsContext,
//   x: number, y: number, z: number,
//   hw: number, hh: number, hd: number,
// ): void {
//   const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z));
//   world.createCollider(R.ColliderDesc.cuboid(hw, hh, hd), body);
// }
