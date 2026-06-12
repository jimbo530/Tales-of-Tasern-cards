// ─────────────────────────────────────────────────────────────────────────────
// Durable map-pin store
//
// Map pins describe WHERE each level/region/encounter sits on a map and which
// paths connect them. Authors place them in the Map Pin Editor (/map-editor).
//
// Persistence layers, in priority order when the game reads pins:
//   1. Supabase `map_pins` table  — durable + SHARED across every player/device.
//   2. localStorage                — instant local cache for the author's browser.
//   3. adventureData.ts `mapPin`   — the committed baseline baked into the code.
//
// `buildRegionMap()` in AdventureMode renders synchronously, so it reads from an
// in-memory cache (`getCachedPins`). That cache is hydrated asynchronously from
// the cloud on mount via `hydrateMapPins()`. Until hydration finishes the game
// simply falls back to localStorage + adventureData, exactly as before — so the
// cloud layer can never block or break rendering.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

export type MapPin = {
  id: string;
  title: string;
  x: number;
  y: number;
  region: string;
  requires: string[];
  color: string;
  isRegion?: boolean; // true = pin drills into a child region instead of a level
  regionId?: string;  // which region this pin links to when clicked
};

// localStorage key — kept identical to the original so existing local edits load.
export const PINS_STORAGE_KEY = "map-pin-editor-pins";

// Single-row blob in Supabase. One collection of pins, one row.
const PINS_ROW_ID = "default";
const PINS_TABLE = "map_pins";

// ── In-memory cache (the synchronous source for buildRegionMap) ───────────────
let cachedPins: MapPin[] | null = null;

/** Synchronous read used by the render path. null = not hydrated yet. */
export function getCachedPins(): MapPin[] | null {
  return cachedPins;
}

/** Overwrite the in-memory cache (e.g. right after the editor saves). */
export function setCachedPins(pins: MapPin[]): void {
  cachedPins = pins;
}

// ── localStorage ──────────────────────────────────────────────────────────────
export function loadPinsFromLocal(): MapPin[] | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(PINS_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as MapPin[]) : null;
  } catch (e) {
    console.warn("[mapPins] failed to read localStorage pins:", e);
    return null;
  }
}

export function savePinsToLocal(pins: MapPin[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
  } catch (e) {
    console.warn("[mapPins] failed to write localStorage pins:", e);
  }
}

// ── Supabase (durable, shared) ────────────────────────────────────────────────

/**
 * Load the shared pin set from Supabase.
 * Returns null (with a visible warning) if the table is missing or empty —
 * callers fall back to localStorage / adventureData. Never throws.
 */
export async function loadPinsFromCloud(): Promise<MapPin[] | null> {
  try {
    const { data, error } = await supabase
      .from(PINS_TABLE)
      .select("pins")
      .eq("id", PINS_ROW_ID)
      .maybeSingle();
    if (error) {
      // Most common cause: table not created yet. Surface it, don't swallow it.
      console.warn(
        `[mapPins] cloud load skipped (${error.message}). ` +
        `Run supabase-map-pins.sql to enable shared pins. Falling back to local/baseline.`
      );
      return null;
    }
    const pins = data?.pins;
    if (!Array.isArray(pins) || pins.length === 0) return null;
    return pins as MapPin[];
  } catch (e) {
    console.warn("[mapPins] cloud load error, falling back to local/baseline:", e);
    return null;
  }
}

/**
 * Persist the shared pin set to Supabase so every player sees it.
 * Returns true on success. Logs (never swallows) the failure reason.
 */
export async function savePinsToCloud(pins: MapPin[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(PINS_TABLE)
      .upsert(
        { id: PINS_ROW_ID, pins, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
    if (error) {
      console.error("[mapPins] cloud save failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[mapPins] cloud save error:", e);
    return false;
  }
}

/**
 * Hydrate the in-memory cache once on mount.
 * Order: cloud (shared) → localStorage (this browser) → leave null (baseline).
 * Returns which source won, so callers can decide whether to re-render.
 */
export async function hydrateMapPins(): Promise<"cloud" | "local" | "none"> {
  const cloud = await loadPinsFromCloud();
  if (cloud) {
    cachedPins = cloud;
    // Mirror the shared set into localStorage so the editor opens in sync.
    savePinsToLocal(cloud);
    return "cloud";
  }
  const local = loadPinsFromLocal();
  if (local) {
    cachedPins = local;
    return "local";
  }
  return "none";
}

/**
 * Save pins everywhere durably: cloud + localStorage + in-memory cache.
 * Used by the editor. Returns whether the cloud write succeeded (local always does).
 */
export async function savePinsEverywhere(pins: MapPin[]): Promise<boolean> {
  setCachedPins(pins);
  savePinsToLocal(pins);
  return savePinsToCloud(pins);
}
