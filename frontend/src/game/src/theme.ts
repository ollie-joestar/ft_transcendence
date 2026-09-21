import { useSyncExternalStore } from "react";
import { COLOR_SCHEMES } from "./options.ts";
import type { ColorScheme } from "./options.ts";

// ---------------------------------------------------------------------------
// Active theme — single source of truth for the game's colour scheme.
//
// Everything that draws the world (lights, sky, fog, walls, floor, skidmarks,
// minimap) reads the active scheme through here instead of hard-coding
// `COLOR_SCHEMES.default`. Calling `setTheme(name)` swaps the scheme and
// notifies every subscriber, so a future "switch theme" button only has to
// call `setTheme('dark')` and the whole game re-colours.
// ---------------------------------------------------------------------------

export type ThemeName = keyof typeof COLOR_SCHEMES;

const DEFAULT_THEME: ThemeName = "default";

let activeName: ThemeName = DEFAULT_THEME;
const listeners = new Set<() => void>();

// ---------------------------------------------------------------------------
// index.css bridge — the site's `default` / `dark` world colours live in
// index.css as `--game-<scheme>-*` vars (see :root there). We resolve them to
// Three.js colour numbers at runtime so editing index.css recolours the world,
// and so the game world flips with the site's light/dark mode through the same
// single source of truth. `sunset` / `night` stay fully static (console-only
// test themes). If a var is missing or the DOM isn't ready yet, the static
// COLOR_SCHEMES entry is the fallback — so nothing breaks pre-mount / in SSR.
// ---------------------------------------------------------------------------

// Resolve a CSS custom property to a 0xRRGGBB number. Assigning the var to a
// real element's `color` (with the numeric fallback baked into the var())
// forces the browser to fully substitute nested var() chains and return a
// concrete `rgb(...)`, which we parse — robust regardless of how the var is
// defined (literal hex or `var(--color-*)`).
let probe: HTMLSpanElement | null = null;
function cssColor(varName: string, fallback: number): number {
  if (typeof document === "undefined" || !document.body) return fallback;
  if (!probe) {
    probe = document.createElement("span");
    probe.style.display = "none";
    document.body.appendChild(probe);
  }
  probe.style.color = `var(${varName}, ${hex(fallback)})`;
  const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(probe).color);
  if (!m) return fallback;
  return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
}

// Build a scheme from index.css, using the static COLOR_SCHEMES entry both as
// the fallback per field and for the non-themeable bits (lights, fog density).
function schemeFromCss(name: "default" | "dark"): ColorScheme {
  const base = COLOR_SCHEMES[name];
  const v = (suffix: string, fb: number) =>
    cssColor(`--game-${name}-${suffix}`, fb);
  return {
    directionalLight: base.directionalLight,
    ambientLight: base.ambientLight,
    fog: [v("fog", base.fog[0]), base.fog[1]],
    floor: v("floor", base.floor),
    wall: v("wall", base.wall),
    sky: v("sky", base.sky),
    skidmark: v("skidmark", base.skidmark),
    minimap: {
      road: v("mm-road", base.minimap.road),
      roadOutline: v("mm-road-outline", base.minimap.roadOutline),
      player: v("mm-player", base.minimap.player),
      dotOutline: v("mm-dot-outline", base.minimap.dotOutline),
      bot: v("mm-bot", base.minimap.bot),
      remote: v("mm-remote", base.minimap.remote),
      border: v("mm-border", base.minimap.border),
    },
  };
}

function computeScheme(): ColorScheme {
  if (activeName === "default" || activeName === "dark")
    return schemeFromCss(activeName);
  return COLOR_SCHEMES[activeName] ?? COLOR_SCHEMES[DEFAULT_THEME];
}

// Cached so useSyncExternalStore gets a stable reference between theme swaps;
// rebuilt only in setTheme and on the one-shot post-mount refresh below.
let cache: ColorScheme = computeScheme();

export function getThemeName(): ThemeName {
  return activeName;
}

// Returns the active ColorScheme. Stable reference until the theme changes,
// which is what useSyncExternalStore needs to avoid spurious re-renders.
export function getScheme(): ColorScheme {
  return cache;
}

export function listThemes(): ThemeName[] {
  return Object.keys(COLOR_SCHEMES) as ThemeName[];
}

// Switch the active theme. No-op for an unknown name or the current one.
export function setTheme(name: ThemeName): void {
  if (!COLOR_SCHEMES[name] || name === activeName) return;
  activeName = name;
  cache = computeScheme();
  listeners.forEach((l) => l());
}

// At module load `document.body` may not exist yet, so the initial cache uses
// the static fallbacks. Refresh once from index.css after first paint and
// notify subscribers, so live CSS edits / the real resolved values take hold.
if (typeof window !== "undefined") {
  requestAnimationFrame(() => {
    cache = computeScheme();
    listeners.forEach((l) => l());
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// React hook: returns the active scheme and re-renders the component when the
// theme changes. Use in R3F components (lights, sky, fog, walls, floor) and
// anywhere else that should react to a theme swap.
export function useTheme(): ColorScheme {
  return useSyncExternalStore(subscribe, getScheme, getScheme);
}

export function useThemeName(): ThemeName {
  return useSyncExternalStore(subscribe, getThemeName, getThemeName);
}

// Convert a 0xRRGGBB number into a CSS hex string (for canvas / DOM styling).
export function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

// Temporary dev hook: lets you test theme switching from the browser console
// (e.g. `__setTheme('dark')`) until the in-game switch button is wired up.
if (typeof window !== "undefined") {
  (window as unknown as { __setTheme?: typeof setTheme }).__setTheme = setTheme;
}
