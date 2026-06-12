// ─────────────────────────────────────────────────────────────────────────────
// Pure map-graph helpers (no React, no DOM, no I/O).
//
// These describe the shape of a region map and the side-effect-free graph math
// used to build one. Keeping them here lets buildRegionMap() in AdventureMode
// focus on assembling nodes from data, and makes the graph logic unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

/** A single placeable point on a region map. */
export type MapNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  type: "chapter" | "encounter" | "region" | "travel" | "destination" | "placeholder" | "exit";
  chapterIdx?: number;
  encounterIdx?: number;
  regionId?: string; // for region-type nodes: which region to drill into
};

/** A fully-built map for one region: nodes, the edges between them, and a
 *  bidirectional adjacency list keyed by node id (for movement/path queries). */
export type RegionMapData = {
  nodes: MapNode[];
  edges: [string, string][];
  adj: Record<string, string[]>;
};

/**
 * Build a bidirectional adjacency list from a list of edges.
 * Pure: same input always yields the same output, no dedupe surprises.
 */
export function buildAdjacency(edges: [string, string][]): Record<string, string[]> {
  const adj: Record<string, string[]> = {};
  for (const [a, b] of edges) {
    if (!adj[a]) adj[a] = [];
    if (!adj[b]) adj[b] = [];
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }
  return adj;
}
