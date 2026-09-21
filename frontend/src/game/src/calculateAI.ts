import type { AIFrame, AIResponse, AIState } from "./aiTypes.ts";

// Speed & Scale
// Defines the base spatial unit for the track and the two governing speed limits for the car.
const tileSize = 20.0;
const carMaxSpeed = 200.0;
const carApexSpeed = 70.0;

// Steering PID Controller
// Tuned the PID controller that converts heading-angle error into steering decision (left/right).
const kP = 1.4;
const kI = 0.04;
const kD = 0.35;
const steerDeadzone = 0.06;

// Cornering Angle Thresholds
// Defuned angle (radians) thresholds used to detect how sharp a turn is, which in rutn drives speed-capping behaviour/
const hardSteerAngle = 0.55;
const brakeAngle = 0.9;

// Cornering Line & Gate Approach
// Controls how the AI smooths its path through checkpoints and slows down near gates.
const turnInRadius = tileSize * 0.7;
const maxRoundBlend = 0.35;
const easeGateRadius = 6.0;

// Stall Detection & Recovery
// Detects when the car is stuck and manages a timed reverse maneuver to recover.
const stallSpeed = 2.5;
const stallMove = 0.05;
const stallLimit = 18;
const reverseLimit = 22;

/**
 * Main entry point for the AI driving logic. Computes steering and throttle/brake inputs for a single simulation tick based on the car's physics state and target checkpoints.
 * @param frame Current frame data
 * @param state Persistent bot state carried between ticks (PID error terms, stall/reverse counters, last known position)
 * @returns Object containing forward, backward, left, right boolean controll flags plus the updated botState
 */
export function calculateAI(frame: AIFrame, state: AIState): AIResponse {
  const px = frame.position[0];
  const pz = frame.position[2];

  const qx = frame.quaternion[0];
  const qy = frame.quaternion[1];
  const qz = frame.quaternion[2];
  const qw = frame.quaternion[3];

  const vx = frame.velocity[0];
  const vy = frame.velocity[1];
  const vz = frame.velocity[2];

  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

  if (state.initialized) {
    const moved = Math.hypot(
      px - state.lastPosition[0],
      pz - state.lastPosition[2],
    );
    if (moved < stallMove && speed < stallSpeed) {
      state.stallTicks++;
    } else if (state.reverseTicks === 0 && state.stallTicks > 0) {
      state.stallTicks++;
    }
  }

  state.lastPosition = frame.position;
  state.initialized = true;

  const { fx, fz } = forwardVector(qx, qy, qz, qw);
  const { target, gateDistance } = aimTarget(frame, px, pz);

  let dx = target[0] - px;
  let dz = target[2] - pz;

  const d = Math.hypot(dx, dz);
  if (d > 0) {
    dx /= d;
    dz /= d;
  }

  const dot = fx * dx + fz * dz;
  const cross = fz * dx - fx * dz;
  const angle = Math.atan2(cross, dot);

  return createResponse(state, angle, speed, gateDistance);
}

/**
 * Converts a steering angle error and current speed into discrete control inputs (steer left/right, throttle, brake) using a PID controller, plus stall-recovery (reverse) handling.
 * @param state Bot state (read/wrtitten for PID intedral/derivative terms and stall counters)
 * @param angle Signed angle (radians) between the car's geading and the disired direction to target.
 * @param speed Current car speed magnitude.
 * @param gateDistance Distance from car to the current checkpoint/gate.
 * @returns AIResponse with control flags and updated botState
 */
function createResponse(
  state: AIState,
  angle: number,
  speed: number,
  gateDistance: number,
): AIResponse {
  const out: AIResponse = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    botState: {
      previousAngleError: 0,
      integralError: 0,
      lastPosition: [0, 0, 0],
      stallTicks: 0,
      reverseTicks: 0,
      initialized: false,
    },
  };

  const absAngle = Math.abs(angle);

  state.integralError = clamp(state.integralError + angle, -5, 5);

  const derived = angle - state.previousAngleError;

  state.previousAngleError = angle;

  const control = kP * angle + kI * state.integralError + kD * derived;
  if (control > steerDeadzone) {
    out.left = true;
  } else if (control < -steerDeadzone) {
    out.right = true;
  }

  if (state.stallTicks > stallLimit) {
    state.reverseTicks++;
    out.backward = true;
    out.forward = false;
    out.left = [out.right, (out.right = out.left)][0];
    if (state.reverseTicks > reverseLimit) {
      state.stallTicks = 0;
      state.reverseTicks = 0;
    }
    return out;
  }

  let speedCap = carMaxSpeed;

  if (absAngle > brakeAngle) {
    speedCap = carApexSpeed * 0.6;
  } else if (absAngle > hardSteerAngle) {
    speedCap = carApexSpeed;
  }

  if (gateDistance < easeGateRadius) {
    speedCap = Math.min(speedCap, carApexSpeed);
  }

  if (speed < speedCap) {
    out.forward = true;
  } else if (speed > speedCap * 1.15 && absAngle > hardSteerAngle) {
    out.backward = true;
  }

  out.botState = state;
  return out;
}

/**
 * Standard clamping utility - restrics a value to a given range
 * @param v Value to clamp
 * @param lo Minimum allowed value
 * @param hi Maximum allowed value
 * @returns lo if v < lo, hi if v > hi, otherwise v.
 */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Derived the car's 2D (X/Z plane) forward-facing unit vector from its orientation quaternion.
 * @param qx Component of the orientation quaternion.
 * @param qy Component of the orientation quaternion.
 * @param qz Component of the orientation quaternion.
 * @param qw Component of the orientation quaternion.
 * @returns Normalized forward direction in the X/Z plane.
 */
function forwardVector(
  qx: number,
  qy: number,
  qz: number,
  qw: number,
): { fx: number; fz: number } {
  const out = { fx: 0, fz: 0 };

  out.fx = 2 * (qx * qz + qw * qy);
  out.fz = 1 - 2 * (qx * qx + qy * qy);

  const n = Math.hypot(out.fx, out.fz);

  if (n > 0) {
    out.fx /= n;
    out.fz /= n;
  }
  return out;
}

/**
 * Computes the point the AI should currently steer toward, blending between the next two checkpoints to produce a smoother "racing line" through corners, rather than aiming straigt at the next gate.
 * @param frame Provied next 2 checkpoints
 * @param px Car's current X position
 * @param pz Car's current Z position
 * @returns target [x, y, z] point to steer toward; gateDistance is the car's distance to checkpoint 0.
 */
function aimTarget(
  frame: AIFrame,
  px: number,
  pz: number,
): { target: number[]; gateDistance: number } {
  const out: { target: number[]; gateDistance: number } = {
    target: [],
    gateDistance: 0,
  };
  const checkpoint0 = frame.checkpoints["0"];
  const checkpoint1 = frame.checkpoints["1"];

  const gateDistanceX = checkpoint0[0] - px;
  const gateDistanceZ = checkpoint0[1] - pz;

  out.gateDistance = Math.hypot(gateDistanceX, gateDistanceZ);

  let blend = 0;
  if (out.gateDistance < turnInRadius) {
    const blendJitter = 0.85 + Math.random() * 0.3; // 0.85–1.15
    blend = (1 - out.gateDistance / turnInRadius) * maxRoundBlend * blendJitter;
  }

  out.target[0] = checkpoint0[0] + (checkpoint1[0] - checkpoint0[0]) * blend;
  out.target[1] = checkpoint0[1] + (checkpoint1[1] - checkpoint0[1]) * blend;
  out.target[2] = checkpoint0[2] + (checkpoint1[2] - checkpoint0[2]) * blend;

  return out;
}
