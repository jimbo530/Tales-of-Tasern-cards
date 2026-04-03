"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { ADVENTURE_CHAPTERS, REGIONS, type Chapter, type Region } from "@/lib/adventureData";

type Pin = {
  id: string;
  title: string;
  x: number;
  y: number;
  region: string;
  requires: string[];
  color: string;
  isRegion?: boolean; // true = this pin represents a child region, not a chapter
  regionId?: string;  // which region this pin links to when clicked
};

const PIN_COLORS = [
  "#e63946", "#f4a261", "#2a9d8f", "#264653",
  "#e9c46a", "#a855f7", "#06b6d4", "#f97316",
  "#ec4899", "#84cc16", "#ef4444", "#3b82f6",
];

function buildPins(chapters: Chapter[], regions: Region[]): Pin[] {
  const pins: Pin[] = [];

  // Add chapter pins — merge requires + requiresAny so all paths render
  chapters.forEach((ch, i) => {
    const allReqs = [...(ch.requires ?? []), ...(ch.requiresAny ?? [])];
    pins.push({
      id: ch.id,
      title: ch.title,
      x: ch.mapPin?.x ?? 10 + i * 12,
      y: ch.mapPin?.y ?? 50,
      region: ch.mapPin?.region ?? "world",
      requires: allReqs,
      color: PIN_COLORS[i % PIN_COLORS.length],
    });
  });

  // Add region pins — child regions appear as pins on their parent's map
  regions.forEach(r => {
    if (!r.parent) return; // top-level regions don't appear as pins
    // Don't add if a chapter pin already covers this region
    const existingPin = pins.find(p => p.region === r.parent && p.id === r.id);
    if (existingPin) return;
    pins.push({
      id: `region_${r.id}`,
      title: r.name,
      x: 50,
      y: 50,
      region: r.parent,
      requires: [],
      color: "#8b6914",
      isRegion: true,
      regionId: r.id,
    });
  });

  return pins;
}

// Recursive folder tree for the side panel
function RegionTree({ regions, pins, activeRegion, selectedPin, onNavigate, onSelectPin, parentId, depth = 0 }: {
  regions: Region[];
  pins: Pin[];
  activeRegion: string;
  selectedPin: string | null;
  onNavigate: (id: string) => void;
  onSelectPin: (id: string) => void;
  parentId?: string;
  depth?: number;
}) {
  const children = regions.filter(r => (parentId ? r.parent === parentId : !r.parent));
  if (children.length === 0 && !parentId) return null;

  return (
    <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
      {children.map(region => {
        const isActive = activeRegion === region.id;
        const subRegions = regions.filter(r => r.parent === region.id);
        const regionPins = pins.filter(p => p.region === region.id && !p.isRegion);
        const hasChildren = subRegions.length > 0 || regionPins.length > 0;

        return (
          <div key={region.id}>
            {/* Folder row */}
            <button
              onClick={() => onNavigate(region.id)}
              className="flex items-center gap-1.5 w-full text-left rounded px-2 py-1.5 mb-0.5"
              style={{
                background: isActive ? "rgba(139,105,20,0.25)" : "transparent",
                border: isActive ? "1px solid rgba(139,105,20,0.4)" : "1px solid transparent",
              }}>
              {/* Folder icon */}
              <span style={{ fontSize: "0.7rem", color: isActive ? "#f0d070" : "rgba(240,208,112,0.5)" }}>
                {hasChildren ? (isActive ? "\u{1F4C2}" : "\u{1F4C1}") : "\u{1F4C4}"}
              </span>
              <span className="text-xs font-bold truncate" style={{
                color: isActive ? "#f0d070" : "rgba(240,208,112,0.6)",
              }}>
                {region.name}
              </span>
              {regionPins.length > 0 && (
                <span className="text-xs ml-auto" style={{ color: "rgba(240,208,112,0.25)" }}>
                  {regionPins.length}
                </span>
              )}
            </button>

            {/* Pins inside this folder (only if active or parent of active) */}
            {isActive && regionPins.length > 0 && (
              <div style={{ paddingLeft: 16 }}>
                {regionPins.map(pin => {
                  const isSel = selectedPin === pin.id;
                  return (
                    <div key={pin.id}
                      className="flex items-center gap-1.5 rounded px-2 py-1 mb-0.5 cursor-pointer"
                      onClick={() => onSelectPin(pin.id)}
                      style={{
                        background: isSel ? "rgba(139,105,20,0.3)" : "transparent",
                        border: `1px solid ${isSel ? "rgba(240,208,112,0.4)" : "transparent"}`,
                      }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                        background: pin.color,
                      }} />
                      <span className="text-xs truncate" style={{
                        color: isSel ? "#f0d070" : "rgba(240,208,112,0.5)",
                      }}>
                        {pin.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recurse into child regions */}
            <RegionTree
              regions={regions}
              pins={pins}
              activeRegion={activeRegion}
              selectedPin={selectedPin}
              onNavigate={onNavigate}
              onSelectPin={onSelectPin}
              parentId={region.id}
              depth={depth + 1}
            />
          </div>
        );
      })}
    </div>
  );
}

let nextPinId = 100;

export function MapPinEditor() {
  const STORAGE_KEY = "map-pin-editor-pins";

  const [pins, setPins] = useState<Pin[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Pin[];
          // Check if saved pins match current chapters
          const currentIds = new Set(ADVENTURE_CHAPTERS.map(ch => ch.id));
          const savedIds = new Set(parsed.filter(p => !p.isRegion).map(p => p.id));
          if ([...currentIds].every(id => savedIds.has(id))) return parsed;
          // Chapters changed — rebuild but carry over positions + any user-added pins
          const fresh = buildPins(ADVENTURE_CHAPTERS, REGIONS);
          const oldById: Record<string, Pin> = {};
          for (const p of parsed) {
            oldById[p.id] = p;
            if (p.id.startsWith('region_')) oldById[p.id.replace('region_', '')] = p;
          }
          // Carry over positions from old pins that match
          for (const pin of fresh) {
            const old = oldById[pin.id];
            if (old && old.region === pin.region) { pin.x = old.x; pin.y = old.y; }
          }
          // Preserve user-added pins (not from chapters/regions)
          const freshIds = new Set(fresh.map(p => p.id));
          for (const p of parsed) {
            if (!freshIds.has(p.id) && !p.id.startsWith('region_')) {
              fresh.push(p);
            }
          }
          return fresh;
        }
      } catch { /* ignore */ }
    }
    return buildPins(ADVENTURE_CHAPTERS, REGIONS);
  });
  const [regionStack, setRegionStack] = useState<string[]>(["world"]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [addingPin, setAddingPin] = useState(false);
  const [addingRegionPin, setAddingRegionPin] = useState(false);
  const [addingPath, setAddingPath] = useState<string | null>(null);
  const addingPathRef = useRef<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync so board-level handler always sees latest value
  useEffect(() => { addingPathRef.current = addingPath; }, [addingPath]);

  // Auto-save pins to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pins)); } catch { /* ignore */ }
  }, [pins]);

  // Track mouse position on board for path preview
  const handleBoardMouseMove = useCallback((e: React.MouseEvent) => {
    if (!addingPath) return;
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setMousePos({ x, y });
  }, [addingPath]);

  const activeRegion = regionStack[regionStack.length - 1];
  const regionDef = REGIONS.find(r => r.id === activeRegion);
  const childRegions = REGIONS.filter(r => r.parent === activeRegion);
  const visiblePins = pins.filter(p => p.region === activeRegion);
  const allRegionIds = REGIONS.map(r => r.id);

  // Navigate into a child region
  const drillDown = (regionId: string) => {
    setRegionStack(prev => [...prev, regionId]);
    setSelectedPin(null);
    setBgImage(null);
  };

  // Navigate up
  const drillUp = (targetIdx?: number) => {
    if (targetIdx !== undefined) {
      setRegionStack(prev => prev.slice(0, targetIdx + 1));
    } else {
      setRegionStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
    }
    setSelectedPin(null);
    setBgImage(null);
  };

  const mapImage = bgImage || regionDef?.mapImage || "";

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBgImage(URL.createObjectURL(file));
  };

  const getPos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const pos = getPos(e);
    if (!pos) return;
    setPins(prev => prev.map(p => p.id === dragging ? { ...p, x: pos.x, y: pos.y } : p));
  }, [dragging, getPos]);

  const onMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
    }
  }, [dragging, onMouseMove, onMouseUp]);

  const handleBoardClick = (e: React.MouseEvent) => {
    const pos = getPos(e);
    if (!pos) return;

    if (addingPin) {
      const title = prompt("Pin name:");
      if (!title) { setAddingPin(false); return; }
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `pin_${nextPinId++}`;
      setPins(prev => [...prev, {
        id, title, x: pos.x, y: pos.y,
        region: activeRegion, requires: [],
        color: PIN_COLORS[pins.length % PIN_COLORS.length],
      }]);
      setAddingPin(false);
      setSelectedPin(id);
    }
    if (addingRegionPin) {
      const title = prompt("Region name:");
      if (!title) { setAddingRegionPin(false); return; }
      const regionId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `region_${nextPinId++}`;
      setPins(prev => [...prev, {
        id: `region_${regionId}`, title, x: pos.x, y: pos.y,
        region: activeRegion, requires: [],
        color: "#8b6914", isRegion: true, regionId,
      }]);
      setAddingRegionPin(false);
    }
  };

  const handlePinClick = (pinId: string) => {
    const pin = pins.find(p => p.id === pinId);
    if (addingPath) {
      if (addingPath !== pinId) {
        setPins(prev => prev.map(p =>
          p.id === pinId && !p.requires.includes(addingPath!)
            ? { ...p, requires: [...p.requires, addingPath!] } : p
        ));
      }
      setAddingPath(null);
    } else if (pin?.isRegion && pin.regionId) {
      // Double-click behavior: select on first click, drill on second
      if (selectedPin === pinId) {
        drillDown(pin.regionId);
      } else {
        setSelectedPin(pinId);
      }
    } else {
      setSelectedPin(selectedPin === pinId ? null : pinId);
    }
  };

  const deletePin = (id: string) => {
    setPins(prev => prev.filter(p => p.id !== id).map(p => ({ ...p, requires: p.requires.filter(r => r !== id) })));
    setSelectedPin(null);
  };

  const removePath = (fromId: string, toId: string) => {
    setPins(prev => prev.map(p => p.id === fromId ? { ...p, requires: p.requires.filter(r => r !== toId) } : p));
  };

  const updatePin = (id: string, updates: Partial<Pin>) => {
    setPins(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updatePinId = (oldId: string, newId: string) => {
    if (pins.some(p => p.id === newId)) return;
    setPins(prev => prev.map(p => {
      if (p.id === oldId) return { ...p, id: newId };
      return { ...p, requires: p.requires.map(r => r === oldId ? newId : r) };
    }));
    if (selectedPin === oldId) setSelectedPin(newId);
  };

  const generateCode = () => {
    return pins.filter(p => !p.isRegion).map(p => {
      const requires = p.requires.length > 0
        ? `    requires: [${p.requires.map(r => `"${r}"`).join(", ")}],\n` : "";
      return `  // ${p.title}\n  "${p.id}": {\n${requires}    mapPin: { x: ${p.x}, y: ${p.y}, region: "${p.region}" },\n  }`;
    }).join(",\n\n");
  };

  const selPin = pins.find(p => p.id === selectedPin);
  const isAdding = addingPin || addingRegionPin || addingPath;

  const btn = (active: boolean) => ({
    background: active ? "#f0d070" : "rgba(139,105,20,0.2)",
    color: active ? "#0a0608" : "#f0d070",
    border: "1px solid #8b6914",
  });

  return (
    <div className="min-h-screen" style={{ background: "#2b1810", fontFamily: "'Cinzel', serif" }}>
      {/* Header */}
      <div className="px-6 py-3" style={{ background: "rgba(43,24,16,0.95)", borderBottom: "2px solid #8b6914" }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-black" style={{ color: "#f0d070" }}>Map Pin Editor</h1>
          <div className="flex gap-2 items-center flex-wrap">
            <button onClick={() => { setAddingPin(!addingPin); setAddingRegionPin(false); setAddingPath(null); }}
              className="px-3 py-1 rounded text-sm font-bold" style={btn(addingPin)}>
              + Pin
            </button>
            <button onClick={() => { setAddingRegionPin(!addingRegionPin); setAddingPin(false); setAddingPath(null); }}
              className="px-3 py-1 rounded text-sm font-bold" style={btn(addingRegionPin)}>
              + Region
            </button>
            <button onClick={() => {
                if (addingPath) setAddingPath(null);
                else if (selectedPin) { setAddingPath(selectedPin); setAddingPin(false); setAddingRegionPin(false); }
              }}
              className="px-3 py-1 rounded text-sm font-bold" style={btn(!!addingPath)}
              title={selectedPin ? "Select a pin first, then click target" : "Select a pin first"}>
              + Path
            </button>
            <span className="text-xs" style={{ color: "rgba(240,208,112,0.3)" }}>|</span>
            <label className="px-3 py-1 rounded text-sm font-bold cursor-pointer"
              style={{ background: "rgba(139,105,20,0.2)", color: "#f0d070", border: "1px solid #8b6914" }}>
              Upload BG
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <button onClick={() => setShowJson(!showJson)}
              className="px-3 py-1 rounded text-sm font-bold" style={btn(showJson)}>
              {showJson ? "Hide Code" : "Code"}
            </button>
            <button onClick={() => {
                if (confirm("Reset all pins to defaults from adventureData.ts?")) {
                  const fresh = buildPins(ADVENTURE_CHAPTERS, REGIONS);
                  setPins(fresh);
                  localStorage.removeItem(STORAGE_KEY);
                }
              }}
              className="px-3 py-1 rounded text-sm font-bold"
              style={{ background: "rgba(220,38,38,0.2)", color: "#f87171", border: "1px solid rgba(220,38,38,0.3)" }}>
              Reset
            </button>
            <span className="text-xs" style={{ color: "rgba(74,222,128,0.5)" }}>auto-saved</span>
          </div>
        </div>

        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-1 text-sm">
          {regionStack.map((rId, i) => {
            const r = REGIONS.find(reg => reg.id === rId);
            const isLast = i === regionStack.length - 1;
            return (
              <span key={rId} className="flex items-center gap-1">
                {i > 0 && <span style={{ color: "rgba(240,208,112,0.3)" }}>/</span>}
                <button
                  onClick={() => !isLast && drillUp(i)}
                  className="font-bold"
                  style={{
                    color: isLast ? "#f0d070" : "rgba(240,208,112,0.5)",
                    textDecoration: isLast ? "none" : "underline",
                    cursor: isLast ? "default" : "pointer",
                    background: "none", border: "none", padding: 0,
                  }}>
                  {r?.name ?? rId}
                </button>
              </span>
            );
          })}
          {childRegions.length > 0 && (
            <span className="text-xs ml-2" style={{ color: "rgba(240,208,112,0.3)" }}>
              ({childRegions.length} sub-region{childRegions.length > 1 ? "s" : ""})
            </span>
          )}
        </div>
      </div>

      {/* Mode indicator */}
      {isAdding && (
        <div className="text-center py-1 text-sm font-bold" style={{
          background: addingPath ? "#2a9d8f" : addingRegionPin ? "#264653" : "#e63946",
          color: "#fff",
        }}>
          {addingPin && "Click on the map to place a new chapter pin"}
          {addingRegionPin && "Click on the map to place a new region pin (drill-down point)"}
          {addingPath && `Drawing path from "${pins.find(p => p.id === addingPath)?.title}" — click another pin`}
          <button onClick={() => { setAddingPin(false); setAddingRegionPin(false); setAddingPath(null); }}
            className="ml-4 px-2 py-0.5 rounded text-xs" style={{ background: "rgba(0,0,0,0.3)" }}>
            Cancel
          </button>
        </div>
      )}

      <div className="flex" style={{ height: isAdding ? "calc(100vh - 110px)" : "calc(100vh - 80px)" }}>
        {/* Cork Board — forced 1:1 aspect ratio to match game map rendering */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center" style={{
          background: `linear-gradient(135deg, #c4956a 0%, #b8865c 30%, #c9a06e 60%, #b8865c 100%)`,
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.3)",
        }}>
          <div ref={boardRef} className="relative rounded-lg overflow-hidden"
            onClick={handleBoardClick}
            onMouseDown={(e) => {
              // Path connections: detect pin clicks at board level via data attribute
              if (addingPathRef.current) {
                const pinEl = (e.target as HTMLElement).closest("[data-pin-id]");
                if (pinEl) {
                  const targetId = pinEl.getAttribute("data-pin-id")!;
                  const src = addingPathRef.current;
                  if (src !== targetId) {
                    setPins(prev => prev.map(p =>
                      p.id === targetId && !p.requires.includes(src)
                        ? { ...p, requires: [...p.requires, src] } : p
                    ));
                  }
                  setAddingPath(null);
                  e.preventDefault();
                  e.stopPropagation();
                }
              }
            }}
            onMouseMove={handleBoardMouseMove}
            onMouseLeave={() => setMousePos(null)}
            style={{
              width: 'min(calc(100% - 32px), calc(100vh - 120px))',
              aspectRatio: '1 / 1',
              border: "3px solid #5c3a1e",
              boxShadow: "inset 0 0 20px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.5)",
              cursor: addingPin || addingRegionPin ? "crosshair" : addingPath ? "pointer" : "default",
            }}>
            {/* Background image */}
            <div className="absolute inset-0" style={{
              backgroundImage: mapImage ? `url(${mapImage})` : "none",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              filter: "brightness(0.7) sepia(0.2)",
            }} />
            {/* Grid */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.12 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <g key={i}>
                  <line x1={`${(i + 1) * 10}%`} y1="0" x2={`${(i + 1) * 10}%`} y2="100%" stroke="#000" strokeWidth="0.5" />
                  <line x1="0" y1={`${(i + 1) * 10}%`} x2="100%" y2={`${(i + 1) * 10}%`} stroke="#000" strokeWidth="0.5" />
                </g>
              ))}
            </svg>
            {/* Coord labels */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {Array.from({ length: 10 }, (_, i) => (
                <g key={i}>
                  <text x={`${(i + 1) * 10}%`} y="12" textAnchor="middle" fill="rgba(240,208,112,0.35)" fontSize="8">{(i + 1) * 10}</text>
                  <text x="6" y={`${(i + 1) * 10}%`} textAnchor="start" fill="rgba(240,208,112,0.35)" fontSize="8">{(i + 1) * 10}</text>
                </g>
              ))}
            </svg>

            {/* Strings */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
              {/* Existing paths */}
              {visiblePins.map(pin => pin.requires.map(reqId => {
                const target = visiblePins.find(p => p.id === reqId);
                if (!target) return null;
                const midX = (pin.x + target.x) / 2;
                const midY = (pin.y + target.y) / 2 - 3;
                const isSel = selectedPin === pin.id || selectedPin === reqId;
                return (
                  <g key={`${pin.id}-${reqId}`}>
                    <path d={`M ${target.x}% ${target.y}% Q ${midX}% ${midY}% ${pin.x}% ${pin.y}%`}
                      fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="3" />
                    <path d={`M ${target.x}% ${target.y}% Q ${midX}% ${midY}% ${pin.x}% ${pin.y}%`}
                      fill="none" stroke={isSel ? "#f0d070" : "#c0392b"} strokeWidth={isSel ? 2 : 1.5}
                      strokeDasharray="6 3" opacity={isSel ? 1 : 0.8} />
                  </g>
                );
              }))}
              {/* Live path preview while drawing */}
              {addingPath && mousePos && (() => {
                const src = visiblePins.find(p => p.id === addingPath);
                if (!src) return null;
                return (
                  <g>
                    <line x1={`${src.x}%`} y1={`${src.y}%`} x2={`${mousePos.x}%`} y2={`${mousePos.y}%`}
                      stroke="rgba(0,0,0,0.2)" strokeWidth="3" />
                    <line x1={`${src.x}%`} y1={`${src.y}%`} x2={`${mousePos.x}%`} y2={`${mousePos.y}%`}
                      stroke="#2a9d8f" strokeWidth="2"
                      strokeDasharray="4 4" opacity="0.9" />
                    <circle cx={`${mousePos.x}%`} cy={`${mousePos.y}%`} r="4"
                      fill="none" stroke="#2a9d8f" strokeWidth="1.5" opacity="0.7" />
                  </g>
                );
              })()}
            </svg>

            {/* Pins */}
            {visiblePins.map(pin => {
              const isSel = selectedPin === pin.id;
              const isPathSrc = addingPath === pin.id;
              const isReg = pin.isRegion;
              const pinSize = isSel ? 28 : isReg ? 26 : 22;
              return (
                <div key={pin.id} className="absolute" data-pin-id={pin.id} style={{
                  left: `${pin.x}%`, top: `${pin.y}%`,
                  transform: "translate(-50%, -100%)",
                  zIndex: dragging === pin.id ? 20 : isSel ? 15 : 10,
                  cursor: addingPath ? "pointer" : dragging === pin.id ? "grabbing" : "grab",
                  userSelect: "none",
                }}
                  onMouseDown={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (addingPath || addingPin || addingRegionPin) return;
                    setDragging(pin.id);
                  }}
                  onClick={(e) => { e.stopPropagation(); if (!addingPath) handlePinClick(pin.id); }}>
                  {/* Shadow */}
                  <div className="absolute" style={{
                    width: 6, height: 6, borderRadius: "50%", background: "rgba(0,0,0,0.3)",
                    bottom: -4, left: "50%", transform: "translateX(-50%)", filter: "blur(2px)",
                  }} />
                  {/* Pin head */}
                  <div style={{
                    width: pinSize, height: pinSize, borderRadius: isReg ? "4px" : "50%",
                    background: isReg
                      ? `linear-gradient(135deg, #8b6914, #c9a84c)`
                      : `radial-gradient(circle at 35% 35%, ${pin.color}ee, ${pin.color}88)`,
                    border: isSel ? "3px solid #f0d070" : isPathSrc ? "3px solid #2a9d8f" : "2px solid rgba(0,0,0,0.3)",
                    boxShadow: isSel ? `0 0 16px ${pin.color}88, 0 0 30px rgba(240,208,112,0.4)`
                      : `0 2px 6px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.2)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", transition: "width 0.15s, height 0.15s",
                    fontSize: isReg ? "0.55rem" : "0.4rem", fontWeight: 900,
                    color: isReg ? "#0a0608" : "transparent",
                  }}>
                    {isReg && ">>"}
                    {/* Spike */}
                    <div style={{
                      position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
                      width: 0, height: 0,
                      borderLeft: "3px solid transparent", borderRight: "3px solid transparent",
                      borderTop: `8px solid ${isReg ? "#8b6914" : pin.color + "cc"}`,
                    }} />
                    {/* Shine */}
                    {!isReg && <div style={{
                      width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.5)",
                      position: "absolute", top: 3, left: 4,
                    }} />}
                  </div>
                  {/* Label */}
                  <div style={{
                    position: "absolute", top: -40, left: "50%",
                    transform: `translateX(-50%) rotate(${(pin.id.charCodeAt(2) % 7) - 3}deg)`,
                    background: isReg ? "rgba(139,105,20,0.95)" : isSel ? "rgba(240,208,112,0.95)" : "rgba(255,248,220,0.95)",
                    border: `1px solid ${isSel ? "#8b6914" : "rgba(139,105,20,0.3)"}`,
                    borderRadius: 3, padding: "2px 8px", whiteSpace: "nowrap",
                    boxShadow: "1px 2px 4px rgba(0,0,0,0.3)",
                    fontSize: "0.6rem", fontWeight: 700,
                    color: isReg ? "#fff" : "#2b1810",
                    fontFamily: "'Courier New', monospace",
                  }}>
                    {pin.title} {isReg && ">>"}
                    <span style={{ display: "block", fontSize: "0.45rem", color: isReg ? "rgba(255,255,255,0.6)" : "#8b6914", textAlign: "center" }}>
                      ({pin.x}, {pin.y})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-80 overflow-y-auto" style={{ background: "rgba(10,6,8,0.95)", borderLeft: "2px solid #8b6914" }}>
          {showJson ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold" style={{ color: "#f0d070" }}>Pin Data</h2>
                <button onClick={() => navigator.clipboard.writeText(generateCode())}
                  className="px-2 py-1 rounded text-xs font-bold" style={{ background: "#8b6914", color: "#0a0608" }}>
                  Copy
                </button>
              </div>
              <pre className="text-xs rounded p-3 overflow-x-auto" style={{
                background: "rgba(0,0,0,0.5)", color: "#4ade80",
                fontFamily: "'Courier New', monospace", whiteSpace: "pre-wrap", wordBreak: "break-all",
              }}>{generateCode()}</pre>
            </div>
          ) : (
            <div className="p-4">
              {/* Selected pin editor */}
              {selPin && (
                <div className="mb-4 rounded p-3" style={{ background: "rgba(139,105,20,0.2)", border: "1px solid #8b6914" }}>
                  <h2 className="text-xs font-bold mb-2" style={{ color: "#f0d070" }}>
                    {selPin.isRegion ? "Region Pin" : "Chapter Pin"}
                  </h2>
                  <label className="block mb-2">
                    <span className="text-xs" style={{ color: "rgba(240,208,112,0.5)" }}>Title</span>
                    <input value={selPin.title} onChange={e => updatePin(selPin.id, { title: e.target.value })}
                      className="block w-full text-xs rounded px-2 py-1 mt-0.5"
                      style={{ background: "rgba(0,0,0,0.5)", color: "#f0d070", border: "1px solid rgba(139,105,20,0.3)" }} />
                  </label>
                  <label className="block mb-2">
                    <span className="text-xs" style={{ color: "rgba(240,208,112,0.5)" }}>ID</span>
                    <input value={selPin.id} onChange={e => updatePinId(selPin.id, e.target.value)}
                      className="block w-full text-xs rounded px-2 py-1 mt-0.5"
                      style={{ background: "rgba(0,0,0,0.5)", color: "#f0d070", border: "1px solid rgba(139,105,20,0.3)" }} />
                  </label>
                  {selPin.isRegion && (
                    <label className="block mb-2">
                      <span className="text-xs" style={{ color: "rgba(240,208,112,0.5)" }}>Links to region</span>
                      <input value={selPin.regionId ?? ""} onChange={e => updatePin(selPin.id, { regionId: e.target.value })}
                        className="block w-full text-xs rounded px-2 py-1 mt-0.5"
                        style={{ background: "rgba(0,0,0,0.5)", color: "#f0d070", border: "1px solid rgba(139,105,20,0.3)" }} />
                    </label>
                  )}
                  <div className="text-xs mb-2" style={{ color: "rgba(240,208,112,0.5)" }}>
                    Region: {selPin.region} | Pos: ({selPin.x}, {selPin.y})
                  </div>
                  {selPin.isRegion && selPin.regionId && (
                    <button onClick={() => drillDown(selPin.regionId!)}
                      className="w-full mb-2 px-2 py-1 rounded text-xs font-bold"
                      style={{ background: "rgba(139,105,20,0.4)", color: "#f0d070", border: "1px solid #8b6914" }}>
                      Enter Region {'>>'}
                    </button>
                  )}
                  {/* Paths */}
                  {selPin.requires.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs" style={{ color: "rgba(240,208,112,0.5)" }}>Paths from:</span>
                      {selPin.requires.map(reqId => (
                        <div key={reqId} className="flex items-center justify-between mt-1">
                          <span className="text-xs" style={{ color: "#f0d070" }}>{pins.find(p => p.id === reqId)?.title ?? reqId}</span>
                          <button onClick={() => removePath(selPin.id, reqId)}
                            className="text-xs px-1 rounded" style={{ background: "rgba(220,38,38,0.3)", color: "#f87171" }}>x</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pins.filter(p => p.requires.includes(selPin.id)).length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs" style={{ color: "rgba(240,208,112,0.5)" }}>Paths to:</span>
                      {pins.filter(p => p.requires.includes(selPin.id)).map(p => (
                        <div key={p.id} className="flex items-center justify-between mt-1">
                          <span className="text-xs" style={{ color: "#f0d070" }}>{p.title}</span>
                          <button onClick={() => removePath(p.id, selPin.id)}
                            className="text-xs px-1 rounded" style={{ background: "rgba(220,38,38,0.3)", color: "#f87171" }}>x</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => deletePin(selPin.id)}
                    className="w-full mt-2 px-2 py-1 rounded text-xs font-bold"
                    style={{ background: "rgba(220,38,38,0.3)", color: "#f87171", border: "1px solid rgba(220,38,38,0.3)" }}>
                    Delete Pin
                  </button>
                </div>
              )}

              {/* Folder tree */}
              <RegionTree
                regions={REGIONS}
                pins={pins}
                activeRegion={activeRegion}
                selectedPin={selectedPin}
                onNavigate={drillDown}
                onSelectPin={(id) => setSelectedPin(selectedPin === id ? null : id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
