import { useState, useCallback } from "react";

export function useFadeUp() {
  const [done, setDone] = useState(false);
  return {
    className: done ? undefined : "animate-fade-up",
    onAnimationEnd: useCallback(() => setDone(true), []),
  } as const;
}
