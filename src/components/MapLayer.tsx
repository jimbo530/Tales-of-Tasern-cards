"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MapLayer — the shared pan/zoom map viewport.
//
// The world map and every drill-down region map used to re-implement the exact
// same shell: an overflow-hidden viewport that captures wheel + pointer drag,
// a transform wrapper (translate + scale) holding the background, the SVG road
// lines between nodes, and the party marker. Only the *contents* differed
// (which background, which nodes/edges, and how each node button looks +
// behaves). This component owns that identical shell so there is one copy of it.
//
// It is intentionally PRESENTATIONAL/controlled: the parent still owns the
// zoom/pos/dragging state and the pointer handlers (it sets them from many
// places — auto-centering on drill-in, reset buttons, etc.), and passes the
// per-node buttons in as `children`. That keeps behaviour byte-for-byte
// identical to the three inlined copies it replaces.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from "react";

/** Minimal shape MapLayer needs to anchor lines + the party marker: an id and a
 *  percent position. Both world nodes and region MapNodes satisfy this. */
type PositionedNode = { id: string; x: number; y: number };

export type MapLayerProps = {
  /** Pan offset in px, applied as translate(calc(-50% + x), calc(-50% + y)). */
  pos: { x: number; y: number };
  /** Zoom multiplier applied as scale(zoom). */
  zoom: number;
  /** Whether a drag is in progress (drives the cursor + disables the transition). */
  dragging: boolean;
  onWheel: (e: ReactWheelEvent) => void;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  /** Background of the transform wrapper (image or gradient). Always 90vmin / 1:1. */
  backgroundStyle: CSSProperties;
  /** Nodes whose x/y (percent) anchor the SVG road lines. */
  nodes: PositionedNode[];
  /** Edges to draw as road lines, as [fromId, toId] node-id pairs. */
  edges: [string, string][];
  /** Stroke colour for the road lines (the only visual that differed by map). */
  lineColor: string;
  /** Node id the party marker sits on, or null to hide it. */
  partyNodeId: string | null;
  /** Renders the party marker at a node's percent position (parent owns its look). */
  renderPartyToken: (leftPct: number, topPct: number) => ReactNode;
  /** Per-node buttons/labels — kept in the caller so each map's nodes look + behave exactly as before. */
  children: ReactNode;
  /** Optional className/zIndex hooks so callers can match their original wrapper. */
  className?: string;
  style?: CSSProperties;
};

export function MapLayer({
  pos,
  zoom,
  dragging,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  backgroundStyle,
  nodes,
  edges,
  lineColor,
  partyNodeId,
  renderPartyToken,
  children,
  className,
  style,
}: MapLayerProps) {
  const partyNode = partyNodeId !== null ? nodes.find((n) => n.id === partyNodeId) : undefined;

  return (
    <div
      className={`absolute inset-0 overflow-hidden touch-none${className ? ` ${className}` : ""}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ cursor: dragging ? "grabbing" : "grab", ...style }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${zoom})`,
          transition: dragging ? "none" : "transform 0.1s ease-out",
          width: "90vmin",
          aspectRatio: "1 / 1",
          ...backgroundStyle,
        }}
      >
        {/* Road paths connecting nodes */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ pointerEvents: "none" }}
        >
          {edges.map(([aId, bId], i) => {
            const a = nodes.find((n) => n.id === aId);
            const b = nodes.find((n) => n.id === bId);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={lineColor}
                strokeWidth="0.5"
                strokeDasharray="1 0.5"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Per-node buttons + labels (caller-provided) */}
        {children}

        {/* Party marker */}
        {partyNode ? renderPartyToken(partyNode.x, partyNode.y - 4) : null}
      </div>
    </div>
  );
}
