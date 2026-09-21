export interface Checkpoints {
  0: [number, number, number];
  1: [number, number, number];
  2: [number, number, number];
}

export interface AIFrame {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  velocity: [number, number, number];
  totalCheckpoints: number;
  currentCheckpoint: number;
  checkpoints: Checkpoints;
}

// Shape of the JSON the Go AI server sends back each tick.
export interface AIResponse {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  botState: AIState;
}

export interface AIState {
  previousAngleError: number;
  integralError: number;
  lastPosition: [number, number, number];
  stallTicks: number;
  reverseTicks: number;
  initialized: boolean;
}
