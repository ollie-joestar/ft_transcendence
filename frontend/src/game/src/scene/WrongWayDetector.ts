// Wrong-way detection state machine. The caller projects the car onto the track
// centerline (trackTangentAt) and feeds in the local "track forward" tangent;
// this compares the car's *motion* direction against it, debounces, and reports
// show/hide transitions. Comparing motion against the local tangent (rather than
// the bearing to the next checkpoint) is consistent everywhere on a closed loop:
// the reference is always the road direction where the car currently is, so it
// never flips no matter how far the car drives backward.

const MIN_SPEED = 2; // m/s; below this, motion direction is too noisy to judge
const ON_DOT = -0.25; // motion >~105° against track flow → counts as wrong way
const OFF_DOT = 0.1; // motion back toward track flow → clear (hysteresis gap)
const SHOW_DELAY = 0.4; // seconds continuously wrong before showing the indicator

export class WrongWayDetector {
  private duration = 0; // seconds continuously facing the wrong way
  private shown = false; // current displayed state

  // Advance one frame. `tangent` is the unit track-forward direction at the car
  // (null when unavailable, e.g. before the track loads). Returns a transition
  // for the caller to act on:
  //   true  → just turned ON  (show the indicator)
  //   false → just turned OFF (hide it)
  //   null  → no change
  update(
    isRacing: boolean,
    velX: number,
    velZ: number,
    tangent: [number, number] | null,
    dt: number,
  ): boolean | null {
    const speed = Math.hypot(velX, velZ);
    if (isRacing && tangent && speed > MIN_SPEED) {
      // Cosine of the angle between motion and the local track-forward tangent.
      const dot = (velX * tangent[0] + velZ * tangent[1]) / speed;
      if (dot < ON_DOT) {
        this.duration += dt;
        if (!this.shown && this.duration >= SHOW_DELAY) {
          this.shown = true;
          return true;
        }
      } else {
        // Not clearly wrong-way: stop accumulating. Only clear the shown
        // indicator once the car is heading clearly the right way again (the
        // ON_DOT…OFF_DOT dead-band holds the current state to avoid flicker).
        this.duration = 0;
        if (this.shown && dot > OFF_DOT) {
          this.shown = false;
          return false;
        }
      }
      return null;
    }
    if (this.shown) {
      this.duration = 0;
      this.shown = false;
      return false;
    }
    return null;
  }

  // Reset on race restart. Returns true if it had been shown (caller should then
  // hide the indicator).
  clear(): boolean {
    this.duration = 0;
    const wasShown = this.shown;
    this.shown = false;
    return wasShown;
  }
}
