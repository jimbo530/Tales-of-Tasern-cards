"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useAdventure } from "@/hooks/useAdventure";
import { useNftImage } from "@/hooks/useNftImage";
import { ADVENTURE_CHAPTERS, REGIONS } from "@/lib/adventureData";
import type { NftCharacter } from "@/hooks/useNftStats";
import { makeUnit, resolveRound, generateEnemies, getValidMoves, canAttack, gridRow, gridCol, type CombatUnit, type CombatEvent } from "@/lib/adventureCombat";

const ADMIN_WALLETS: string[] = [
  "0x0780b1456d5e60cf26c8cd6541b85e805c8c05f2",
];
// LP Faucet — owner-funded, players pay only gas
const LP_FAUCET = "0xCDfeE3a76710438afCEfC448E687cC27e464089E" as const;
const FAUCET_ABI = [{ name: "rewardHero", type: "function", stateMutability: "nonpayable", inputs: [{ name: "nftContract", type: "address" }], outputs: [] }, { name: "canReward", type: "function", stateMutability: "view", inputs: [{ name: "nftContract", type: "address" }], outputs: [{ type: "bool" }] }] as const;

type Props = {
  characters: NftCharacter[];
  onExit: () => void;
  onStatsRefresh?: () => Promise<void>;
};

function UnitPortrait({ unit, small }: { unit: CombatUnit; small?: boolean }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(unit.character.metadataUri, unit.character.contractAddress);
  const hpPct = unit.maxHp > 0 ? Math.max(0, (unit.currentHp / unit.maxHp) * 100) : 0;
  const dead = unit.currentHp <= 0;
  const size = small ? 50 : 70;

  return (
    <div className="flex flex-col items-center gap-1" style={{ opacity: dead ? 0.3 : 1 }}>
      <div className="rounded-lg overflow-hidden" style={{ width: size, height: size, background: '#0a0810' }}>
        {imgFailed || !imageUrl ? (
          <div className="w-full h-full flex items-center justify-center opacity-30">
            <span style={{ fontSize: size * 0.4 }}>🛡️</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt={unit.character.name} className="w-full h-full object-contain"
            onError={() => setImgFailed(true)} />
        )}
      </div>
      <p className="text-xs font-bold truncate text-center" style={{ color: dead ? 'rgba(220,38,38,0.5)' : 'rgba(232,213,176,0.8)', fontSize: '0.5rem', maxWidth: size + 20 }}>
        {dead ? "💀 " : ""}{unit.character.name}
      </p>
      {!dead && (
        <>
          <div className="rounded-full overflow-hidden" style={{ width: size, height: 4, background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${hpPct}%`, background: hpPct < 30 ? '#dc2626' : '#16a34a' }} />
          </div>
          <span className="font-mono" style={{ fontSize: '0.45rem', color: 'rgba(232,213,176,0.5)' }}>
            {unit.currentHp.toFixed(0)}/{unit.maxHp.toFixed(0)}
            {unit.burns.length > 0 ? ` 🔥×${unit.burns.length}` : ""}
          </span>
        </>
      )}
    </div>
  );
}

function GridCellPortrait({ unit }: { unit: CombatUnit }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(unit.character.metadataUri, unit.character.contractAddress);
  if (imgFailed || !imageUrl) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={imageUrl} alt={unit.character.name} className="w-full h-full object-cover rounded"
      style={{ position: 'absolute', inset: 0, opacity: 0.4 }}
      onError={() => setImgFailed(true)} />
  );
}

function SlotPortrait({ character }: { character: NftCharacter }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(character.metadataUri, character.contractAddress);
  if (imgFailed || !imageUrl) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={imageUrl} alt={character.name} className="w-full h-full object-cover rounded"
      style={{ position: 'absolute', inset: 0, opacity: 0.5 }}
      onError={() => setImgFailed(true)} />
  );
}

function GridView({ units, label, color, onCellClick, selectedUnit, validMoves, facingRight }: {
  units: CombatUnit[];
  label: string;
  color: string;
  onCellClick?: (pos: number, unit: CombatUnit | null) => void;
  selectedUnit?: number | null;
  validMoves?: Set<number>;
  facingRight?: boolean;
}) {
  const grid: (CombatUnit | null)[] = Array(9).fill(null);
  units.forEach(u => { if (u.gridPos >= 0 && u.gridPos < 9) grid[u.gridPos] = u; });

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs tracking-widest uppercase" style={{ color, fontSize: '0.5rem' }}>{label}</p>
      <div className="grid grid-rows-3 grid-flow-col gap-1" style={{ width: 226, direction: facingRight ? 'rtl' : 'ltr' }}>
        {grid.map((unit, pos) => {
          const isSelected = selectedUnit !== null && unit?.index === selectedUnit;
          const isValidMove = validMoves?.has(pos) ?? false;
          const dead = unit && unit.currentHp <= 0;
          return (
            <div key={pos}
              onClick={() => onCellClick?.(pos, unit)}
              className="rounded-lg flex flex-col items-center justify-center transition-all relative overflow-hidden"
              style={{
                direction: 'ltr',
                width: 72, height: 72,
                background: isSelected ? 'rgba(96,165,250,0.2)' : isValidMove ? 'rgba(74,222,128,0.1)' : unit ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                border: `2px solid ${isSelected ? 'rgba(96,165,250,0.7)' : isValidMove ? 'rgba(74,222,128,0.5)' : unit ? `${color}33` : 'rgba(255,255,255,0.05)'}`,
                cursor: onCellClick ? 'pointer' : 'default',
                opacity: dead ? 0.3 : 1,
              }}>
              {unit ? (
                <>
                  <GridCellPortrait unit={unit} />
                  <p className="font-bold truncate text-center px-0.5 relative z-10" style={{ color: dead ? 'rgba(220,38,38,0.5)' : '#fff', fontSize: '0.45rem', maxWidth: 68, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    {dead ? "💀 " : ""}{unit.character.name}
                  </p>
                  {!dead && (
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="rounded-full overflow-hidden" style={{ width: 54, height: 3, background: 'rgba(255,255,255,0.2)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(0, (unit.currentHp / unit.maxHp) * 100)}%`, background: (unit.currentHp / unit.maxHp) < 0.3 ? '#dc2626' : '#16a34a' }} />
                      </div>
                      <span className="font-mono" style={{ fontSize: '0.4rem', color: '#ccc', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                        {unit.currentHp.toFixed(0)}/{unit.maxHp.toFixed(0)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                isValidMove ? <span style={{ fontSize: '0.6rem', color: 'rgba(74,222,128,0.6)' }}>↵</span>
                : <span style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.08)' }}>·</span>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.15)' }}>{facingRight ? 'Back ← → Front' : 'Front ← → Back'}</p>
      {(() => {
        const reserves = units.filter(u => u.gridPos === -1 && u.currentHp > 0);
        return reserves.length > 0 ? (
          <p className="font-bold" style={{ fontSize: '0.5rem', color: 'rgba(220,38,38,0.6)' }}>
            +{reserves.length} in reserve
          </p>
        ) : null;
      })()}
    </div>
  );
}

function PartyCombat({ players: initPlayers, enemies: initEnemies, onWin, onLose }: {
  players: CombatUnit[];
  enemies: CombatUnit[];
  onWin: () => void;
  onLose: () => void;
}) {
  const [players, setPlayers] = useState(initPlayers);
  const [enemies, setEnemies] = useState(initEnemies);
  const [log, setLog] = useState<CombatEvent[]>([]);
  const [round, setRound] = useState(0);
  const [fighting, setFighting] = useState(false);
  const [done, setDone] = useState<"win" | "lose" | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"move" | "attack">("move");
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [moved, setMoved] = useState<Set<number>>(new Set()); // indices that moved this turn

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length]);

  const occupied = new Set(players.filter(p => p.currentHp > 0).map(p => p.gridPos));
  const validMoves = selectedUnit !== null
    ? new Set(getValidMoves(players[selectedUnit]?.gridPos ?? -1, occupied))
    : new Set<number>();

  function handlePlayerGridClick(pos: number, unit: CombatUnit | null) {
    if (done || fighting) return;
    if (phase === "move") {
      if (unit && unit.currentHp > 0 && !moved.has(unit.index)) {
        setSelectedUnit(unit.index);
      } else if (selectedUnit !== null && validMoves.has(pos)) {
        // Move the selected unit
        setPlayers(prev => prev.map(p =>
          p.index === selectedUnit ? { ...p, gridPos: pos } : p
        ));
        setMoved(prev => new Set(prev).add(selectedUnit));
        setSelectedUnit(null);
      }
    }
  }

  function endMovePhase() {
    setPhase("attack");
    setSelectedUnit(null);
  }

  const doRound = useCallback(() => {
    if (done) return;
    const result = resolveRound(players, enemies);
    setPlayers(result.players);
    setEnemies(result.enemies);
    setLog(prev => [...prev, ...result.events]);
    setRound(r => r + 1);
    setPhase("move");
    setMoved(new Set());
    setSelectedUnit(null);

    // AI moves enemies forward if possible
    const enemyOccupied = new Set(result.enemies.filter(e => e.currentHp > 0).map(e => e.gridPos));
    const movedEnemies = result.enemies.map(e => {
      if (e.currentHp <= 0 || e.gridPos < 0) return e;
      const row = gridRow(e.gridPos);
      if (row === 0) return e; // already front
      const forwardPos = (row - 1) * 3 + gridCol(e.gridPos);
      if (!enemyOccupied.has(forwardPos)) {
        enemyOccupied.delete(e.gridPos);
        enemyOccupied.add(forwardPos);
        return { ...e, gridPos: forwardPos };
      }
      return e;
    });
    setEnemies(movedEnemies);

    const playersAlive = result.players.some(p => p.currentHp > 0);
    const enemiesAlive = result.enemies.some(e => e.currentHp > 0);
    if (!enemiesAlive) setDone("win");
    else if (!playersAlive) setDone("lose");
  }, [players, enemies, done]);

  // Auto-fight mode
  useEffect(() => {
    if (!fighting || done) return;
    const t = setInterval(doRound, 1500);
    return () => clearInterval(t);
  }, [fighting, done, doRound]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-3xl mx-auto">
      <div className="text-xs tracking-widest uppercase font-bold" style={{ color: 'rgba(201,168,76,0.6)' }}>
        Round {round} — {phase === "move" && !fighting && !done ? "Move Phase (tap hero, tap square)" : "Combat"}
      </div>

      {/* Two grids side by side */}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <GridView units={players} label="Your Formation" color="rgba(201,168,76,0.6)"
          onCellClick={phase === "move" && !fighting && !done ? handlePlayerGridClick : undefined}
          selectedUnit={selectedUnit}
          validMoves={phase === "move" ? validMoves : undefined}
          facingRight
        />
        <div className="text-2xl" style={{ color: 'rgba(201,168,76,0.3)' }}>⚔️</div>
        <GridView units={enemies} label="Enemies" color="rgba(220,38,38,0.5)" />
      </div>

      {/* Controls */}
      {!done && (
        <div className="flex gap-3 flex-wrap justify-center">
          {!fighting ? (
            phase === "move" ? (
              <>
                <button onClick={endMovePhase}
                  className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(220,38,38,0.3)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)' }}>
                  ⚔️ {moved.size > 0 ? "Done Moving — Attack!" : "Skip Move — Attack!"}
                </button>
                <button onClick={() => setFighting(true)}
                  className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
                  ⚡ Auto-Fight
                </button>
              </>
            ) : (
              <>
                <button onClick={doRound}
                  className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(220,38,38,0.3)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)' }}>
                  ⚔️ Attack!
                </button>
                <button onClick={() => { setPhase("move"); setMoved(new Set()); }}
                  className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  ← Back to Move
                </button>
                <button onClick={() => setFighting(true)}
                  className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
                  ⚡ Auto-Fight
                </button>
              </>
            )
          ) : (
            <button onClick={() => setFighting(false)}
              className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.6)', border: '1px solid rgba(201,168,76,0.2)' }}>
              ⏸ Pause
            </button>
          )}
        </div>
      )}

      {/* Win/Lose */}
      {done && (
        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="text-4xl">{done === "win" ? "🏆" : "💀"}</div>
          <h2 className="text-xl font-black tracking-widest uppercase text-gold-shimmer"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            {done === "win" ? "Victory!" : "Defeated..."}
          </h2>
          {done === "lose" && (
            <p className="text-sm text-center px-4" style={{ color: 'rgba(232,213,176,0.6)', maxWidth: 400 }}>
              Keep training before you leave the village. Every win makes your heroes stronger — power them up and try again.
            </p>
          )}
          <button onClick={done === "win" ? onWin : onLose}
            className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
            style={{ background: 'rgba(201,168,76,0.3)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }}>
            {done === "win" ? "Claim Reward →" : "Try Again"}
          </button>
        </div>
      )}

      {/* Combat log */}
      {log.length > 0 && (
        <div ref={logRef} className="w-full battle-log p-2 max-h-32 overflow-y-auto">
          {log.slice(-30).map((e, i) => (
            <div key={i} className="text-xs py-0.5 font-mono" style={{
              color: e.killed ? '#f87171' : 'rgba(232,213,176,0.5)',
            }}>
              <span style={{ color: e.damageType === "burn" ? 'rgba(251,146,60,0.7)' : e.damageType === "electric" ? 'rgba(192,132,252,0.7)' : e.damageType === "fire" ? 'rgba(251,146,60,0.7)' : 'rgba(251,191,36,0.7)' }}>
                {e.attackerName}
              </span>
              {" → "}
              <span style={{ color: '#f87171' }}>{e.damage.toFixed(1)}</span>
              {e.damageType === "electric" ? " ⚡" : e.damageType === "fire" ? " 🔥" : e.damageType === "burn" ? " 🔥" : e.damageType === "mana" ? " 💧" : ""}
              {" → "}{e.targetName}
              {e.killed ? " 💀" : ` (${e.targetHpAfter.toFixed(0)} HP)`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FORMATION_LABELS = ["Front-L", "Front-C", "Front-R", "Mid-L", "Mid-C", "Mid-R", "Back-L", "Back-C", "Back-R"];

function PartyPicker({ characters, onStart, onBack, isAdmin, unlockedNpcs, maxParty = 9 }: {
  characters: NftCharacter[];
  onStart: (party: NftCharacter[], gridMap: Map<string, number>) => void;
  onBack: () => void;
  isAdmin?: boolean;
  unlockedNpcs?: string[];
  maxParty?: number;
}) {
  // 9 formation slots (3x3 grid)
  const [slots, setSlots] = useState<(NftCharacter | null)[]>(Array(9).fill(null));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const owned = characters.filter(c => c.owned);
  const unlocked = (unlockedNpcs ?? []).map(a => a.toLowerCase());
  const npcChars = characters.filter(c => unlocked.includes(c.contractAddress.toLowerCase()) && !c.owned);
  const available = [...owned, ...npcChars];
  const pool = isAdmin ? (available.length > 0 ? available : characters) : available;
  const partyAddrs = new Set(slots.filter(Boolean).map(c => c!.contractAddress));

  const [heroSearch, setHeroSearch] = useState("");
  const filteredPool = heroSearch.trim()
    ? pool.filter(c => c.name.toLowerCase().includes(heroSearch.toLowerCase()) || c.contractAddress.toLowerCase().includes(heroSearch.toLowerCase()))
    : pool;

  const party = slots.filter(Boolean) as NftCharacter[];

  function assignHero(card: NftCharacter) {
    if (selectedSlot === null) return;
    setSlots(prev => {
      const next = [...prev];
      // Remove from any existing slot
      for (let i = 0; i < next.length; i++) {
        if (next[i]?.contractAddress === card.contractAddress) next[i] = null;
      }
      // Check if already at max and this is a new hero
      const currentCount = next.filter(Boolean).length;
      if (currentCount >= maxParty && !prev.some(s => s?.contractAddress === card.contractAddress)) return prev;
      next[selectedSlot] = card;
      return next;
    });
    setSelectedSlot(null);
  }

  function clearSlot(i: number) {
    setSlots(prev => { const next = [...prev]; next[i] = null; return next; });
  }

  return (
    <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto">
      <h3 className="text-lg font-black tracking-widest text-gold-shimmer uppercase">Formation</h3>
      <p className="text-sm" style={{ color: 'rgba(201,168,76,0.5)' }}>
        Place up to {maxParty} hero{maxParty !== 1 ? "es" : ""} in a 3×3 grid. Tap a slot, then pick a hero. Front row takes hits first.
      </p>
      {owned.length === 0 && !isAdmin && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm font-bold" style={{ color: 'rgba(220,38,38,0.8)' }}>
            You need to own at least one NFT to play Adventure mode.
          </p>
          <p className="text-xs" style={{ color: 'rgba(201,168,76,0.4)' }}>
            Connect your wallet and make sure you hold a Tales of Tasern hero.
          </p>
          <button onClick={onBack}
            className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
            ← Back
          </button>
        </div>
      )}

      {/* 3x3 Formation Grid */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.3)', fontSize: '0.5rem' }}>
          BACK (safe) ← &nbsp;&nbsp;&nbsp;&nbsp; → FRONT (enemies)
        </p>
        <div className="grid grid-rows-3 grid-flow-col gap-2" style={{ width: 240, direction: 'rtl' }}>
          {slots.map((hero, i) => {
            const isSelected = selectedSlot === i;
            const row = Math.floor(i / 3);
            const rowLabel = row === 0 ? "Front" : row === 1 ? "Mid" : "Back";
            return (
              <div key={i}
                onClick={() => hero ? clearSlot(i) : setSelectedSlot(isSelected ? null : i)}
                className="rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden"
                style={{
                  direction: 'ltr',
                  width: 74, height: 74,
                  background: hero ? 'rgba(201,168,76,0.15)' : isSelected ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${hero ? 'rgba(201,168,76,0.6)' : isSelected ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: isSelected ? '0 0 12px rgba(96,165,250,0.3)' : 'none',
                }}>
                {hero ? (
                  <>
                    <SlotPortrait character={hero} />
                    <p className="text-xs font-bold truncate text-center px-1 relative z-10" style={{ color: '#fff', fontSize: '0.5rem', maxWidth: 70, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                      {hero.name}
                    </p>
                    <span className="relative z-10" style={{ fontSize: '0.4rem', color: 'rgba(220,38,38,0.7)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>tap to remove</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.6rem', color: isSelected ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.2)' }}>
                      {isSelected ? '⬇ Pick' : '+'}
                    </span>
                    <span style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.15)' }}>{rowLabel}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {party.length > 0 && (
        <button onClick={() => {
          const gridMap = new Map<string, number>();
          slots.forEach((s, i) => { if (s) gridMap.set(s.contractAddress, i); });
          onStart(party, gridMap);
        }}
          className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(220,38,38,0.3)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.5)' }}>
          ⚔️ Begin with {party.length} hero{party.length > 1 ? "es" : ""}!
        </button>
      )}

      {/* Hero selection panel (shows when a slot is selected) */}
      {selectedSlot !== null && pool.length > 0 && (
        <div className="w-full flex flex-col items-center gap-2">
          <p className="text-xs font-bold" style={{ color: 'rgba(96,165,250,0.7)' }}>
            Pick a hero for {FORMATION_LABELS[selectedSlot]}:
          </p>
          <input
            value={heroSearch}
            onChange={(e) => setHeroSearch(e.target.value)}
            placeholder="Search your heroes..."
            className="w-full max-w-md px-4 py-2 rounded-lg text-sm text-center"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)', outline: 'none' }}
          />
          <div className="w-full max-h-[35vh] overflow-y-auto rounded-lg p-3"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {filteredPool.map((card) => {
                const placed = partyAddrs.has(card.contractAddress);
                return (
                  <div key={card.contractAddress} onClick={() => assignHero(card)}
                    className="rounded-lg p-1.5 cursor-pointer transition-all text-center"
                    style={{
                      background: placed ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${placed ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      opacity: placed ? 0.5 : 1,
                    }}>
                    <p className="text-xs font-bold truncate" style={{
                      color: placed ? 'rgba(201,168,76,0.5)' : 'rgba(232,213,176,0.6)', fontSize: '0.5rem',
                    }}>{card.name}</p>
                    {placed && <span style={{ fontSize: '0.4rem', color: 'rgba(201,168,76,0.4)' }}>placed</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <button onClick={onBack}
        className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
        ← Back
      </button>
    </div>
  );
}

// World map — walkable path of region nodes
const WORLD_NODES = [
  { id: 'frostpeak', x: 22, y: 25, label: 'Frostpeak', active: false },
  { id: 'ashara', x: 35, y: 38, label: 'Ashara Desert', active: false },
  { id: 'starwatch', x: 50, y: 48, label: 'The Starwatch', active: false },
  { id: 'londa', x: 65, y: 65, label: 'Londa', active: true },
  { id: 'duskhollow', x: 78, y: 52, label: 'Duskhollow', active: false },
  { id: 'ember', x: 85, y: 35, label: 'Ember Coast', active: false },
];
const WORLD_PATH = WORLD_NODES.map(n => n.id);
const WORLD_LONDA_IDX = WORLD_NODES.findIndex(n => n.id === 'londa');

// Generic map node + region map types (replaces old LondaNode/LondaMapData)
type MapNode = {
  id: string; x: number; y: number; label: string;
  type: 'chapter' | 'encounter' | 'region' | 'travel' | 'destination' | 'placeholder' | 'exit';
  chapterIdx?: number; encounterIdx?: number;
  regionId?: string; // for region-type nodes: which region to drill into
};
type RegionMapData = {
  nodes: MapNode[];
  edges: [string, string][];
  adj: Record<string, string[]>;
};

// Set of region IDs for quick lookup
const REGION_IDS = new Set(REGIONS.map(r => r.id));

// Build a map for ANY region — reads editor pins from localStorage, falls back to adventureData
function buildRegionMap(regionId: string): RegionMapData {
  type EditorPin = { id: string; title: string; x: number; y: number; region: string; requires: string[]; isRegion?: boolean; regionId?: string; color: string };
  let editorPins: EditorPin[] = [];
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem("map-pin-editor-pins");
      if (saved) {
        editorPins = (JSON.parse(saved) as EditorPin[]).filter(p => p.region === regionId);
      }
    } catch { /* ignore */ }
  }

  // Chapter lookup by id
  const chapterById = new Map<string, { ch: typeof ADVENTURE_CHAPTERS[0]; idx: number }>();
  ADVENTURE_CHAPTERS.forEach((ch, idx) => chapterById.set(ch.id, { ch, idx }));

  // Check if this regionId is itself a chapter-region (e.g. "leaving-home")
  const chapterRegionData = chapterById.get(regionId);
  const isChapterRegion = chapterRegionData && REGION_IDS.has(regionId);

  const nodes: MapNode[] = [];
  const edges: [string, string][] = [];

  if (editorPins.length > 0) {
    // Editor pins are the source of truth for positions and paths
    for (const pin of editorPins) {
      if (pin.isRegion) {
        // Region drill-down pin
        nodes.push({
          id: pin.id, x: pin.x, y: pin.y,
          label: pin.title || pin.id,
          type: 'region',
          regionId: pin.regionId ?? pin.id,
        });
      } else {
        const data = chapterById.get(pin.id);
        if (data) {
          const multi = data.ch.encounters.length > 1;
          // If chapter id is also a REGION id → it's a chapter-region (drill-down)
          if (multi && REGION_IDS.has(data.ch.id)) {
            nodes.push({
              id: pin.id, x: pin.x, y: pin.y,
              label: data.ch.title,
              type: 'region',
              chapterIdx: data.idx,
              regionId: data.ch.id,
            });
          } else if (multi) {
            nodes.push({
              id: pin.id, x: pin.x, y: pin.y,
              label: data.ch.title,
              type: 'chapter',
              chapterIdx: data.idx,
            });
          } else {
            nodes.push({
              id: pin.id, x: pin.x, y: pin.y,
              label: '',
              type: 'encounter',
              chapterIdx: data.idx,
              encounterIdx: 0,
            });
          }
        } else {
          // Editor-only pin — placeholder for a future level
          nodes.push({
            id: pin.id, x: pin.x, y: pin.y,
            label: pin.title || pin.id,
            type: 'placeholder',
          });
        }
      }
      for (const reqId of (pin.requires ?? [])) edges.push([reqId, pin.id]);
    }

    // Add any chapters not yet placed in editor (so they still show up)
    const pinIds = new Set(editorPins.map(p => p.id));
    ADVENTURE_CHAPTERS.forEach((ch, idx) => {
      if (ch.mapPin?.region !== regionId || pinIds.has(ch.id)) return;
      const multi = ch.encounters.length > 1;
      if (multi && REGION_IDS.has(ch.id)) {
        nodes.push({
          id: ch.id, x: ch.mapPin.x, y: ch.mapPin.y,
          label: ch.title,
          type: 'region',
          chapterIdx: idx,
          regionId: ch.id,
        });
      } else if (multi) {
        nodes.push({
          id: ch.id, x: ch.mapPin.x, y: ch.mapPin.y,
          label: ch.title,
          type: 'chapter',
          chapterIdx: idx,
        });
      } else {
        nodes.push({
          id: ch.id, x: ch.mapPin.x, y: ch.mapPin.y,
          label: '',
          type: 'encounter',
          chapterIdx: idx,
          encounterIdx: 0,
        });
      }
      for (const r of (ch.requires ?? [])) edges.push([r, ch.id]);
      for (const r of (ch.requiresAny ?? [])) edges.push([r, ch.id]);
    });

    // Also ensure chapter-regions that are in REGIONS but have no editor pin get added
    REGIONS.forEach(r => {
      if (r.parent !== regionId) return;
      const pinIds2 = new Set(nodes.map(n => n.id));
      if (pinIds2.has(r.id)) return;
      const data = chapterById.get(r.id);
      if (data && data.ch.mapPin) {
        nodes.push({
          id: r.id, x: data.ch.mapPin.x, y: data.ch.mapPin.y,
          label: data.ch.title,
          type: 'region',
          chapterIdx: data.idx,
          regionId: r.id,
        });
        for (const req of (data.ch.requires ?? [])) edges.push([req, r.id]);
        for (const req of (data.ch.requiresAny ?? [])) edges.push([req, r.id]);
      }
    });
  } else if (isChapterRegion && chapterRegionData) {
    // No editor pins for a chapter-region → generate encounter nodes from chapter data
    const ch = chapterRegionData.ch;
    const chIdx = chapterRegionData.idx;
    const positions = CHAPTER_NODE_MAP[chIdx] ?? [];
    ch.encounters.forEach((_, i) => {
      const pos = positions[i] ?? { x: 20 + (i % 5) * 15, y: 20 + Math.floor(i / 5) * 20, label: String(i + 1) };
      nodes.push({
        id: `${regionId}-enc-${i}`,
        x: pos.x, y: pos.y,
        label: pos.label,
        type: 'encounter',
        chapterIdx: chIdx,
        encounterIdx: i,
      });
      if (i > 0) edges.push([`${regionId}-enc-${i - 1}`, `${regionId}-enc-${i}`]);
    });
  } else {
    // No editor pins — fallback to adventureData.ts positions
    ADVENTURE_CHAPTERS.forEach((ch, idx) => {
      if (ch.mapPin?.region !== regionId) return;
      const multi = ch.encounters.length > 1;
      if (multi && REGION_IDS.has(ch.id)) {
        nodes.push({
          id: ch.id, x: ch.mapPin.x, y: ch.mapPin.y,
          label: ch.title,
          type: 'region',
          chapterIdx: idx,
          regionId: ch.id,
        });
      } else if (multi) {
        nodes.push({
          id: ch.id, x: ch.mapPin.x, y: ch.mapPin.y,
          label: ch.title,
          type: 'chapter',
          chapterIdx: idx,
        });
      } else {
        nodes.push({
          id: ch.id, x: ch.mapPin.x, y: ch.mapPin.y,
          label: '',
          type: 'encounter',
          chapterIdx: idx,
          encounterIdx: 0,
        });
      }
      for (const r of (ch.requires ?? [])) edges.push([r, ch.id]);
      for (const r of (ch.requiresAny ?? [])) edges.push([r, ch.id]);
    });

    // Also add child regions that are in REGIONS hierarchy
    REGIONS.forEach(r => {
      if (r.parent !== regionId) return;
      const nodeIds = new Set(nodes.map(n => n.id));
      if (nodeIds.has(r.id)) return;
      const data = chapterById.get(r.id);
      if (data && data.ch.mapPin) {
        nodes.push({
          id: r.id, x: data.ch.mapPin.x, y: data.ch.mapPin.y,
          label: data.ch.title,
          type: 'region',
          chapterIdx: data.idx,
          regionId: r.id,
        });
        for (const req of (data.ch.requires ?? [])) edges.push([req, r.id]);
        for (const req of (data.ch.requiresAny ?? [])) edges.push([req, r.id]);
      }
    });
  }

  // Inject exit node for any region with a parent (takes player back up one level)
  const thisRegion = REGIONS.find(r => r.id === regionId);
  if (thisRegion?.parent) {
    const parentName = REGIONS.find(r => r.id === thisRegion.parent)?.name ?? 'Map';
    const exitPos = EXIT_NODE_POS[regionId] ?? { x: 50, y: 95 };
    nodes.push({
      id: `${regionId}-exit`,
      x: exitPos.x, y: exitPos.y,
      label: `To ${parentName}`,
      type: 'exit',
      regionId: thisRegion.parent,
    });
    // Connect exit to the last encounter node so player can walk to it
    if (nodes.length > 1) {
      const lastNonExit = nodes[nodes.length - 2];
      edges.push([lastNonExit.id, `${regionId}-exit`]);
    }
  }

  // Build bidirectional adjacency from edges
  const adj: Record<string, string[]> = {};
  for (const [a, b] of edges) {
    if (!adj[a]) adj[a] = [];
    if (!adj[b]) adj[b] = [];
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }

  return { nodes, edges, adj };
}

// Per-chapter encounter positions on local maps
const CHAPTER_NODE_MAP: Record<number, { x: number; y: number; label: string }[]> = {
  0: [ // Leaving Home — 7 encounters on village map
    { x: 20, y: 10, label: "Pippin" },
    { x: 68, y: 8,  label: "Dag" },
    { x: 85, y: 48, label: "Maren" },
    { x: 70, y: 82, label: "Guards" },
    { x: 18, y: 82, label: "Scout" },
    { x: 5,  y: 45, label: "Elder" },
    { x: 50, y: 50, label: "Farewell" },
  ],
  1: [{ x: 50, y: 50, label: "Wolf Pack" }],      // path-1
  2: [{ x: 50, y: 50, label: "Goblin Ambush" }],   // path-2
  3: [{ x: 50, y: 50, label: "Weeds" }],            // path-3
  4: [ // Newbsberd — 6 encounters on city map (5 + Closed Gates)
    { x: 12, y: 85, label: "Road Tax" },
    { x: 28, y: 68, label: "Alleys" },
    { x: 45, y: 50, label: "Crowded Gates" },
    { x: 60, y: 35, label: "Supplies" },
    { x: 78, y: 22, label: "Highway Men" },
    { x: 90, y: 10, label: "\u26E9 Closed Gates" },
  ],
  5: [{ x: 50, y: 50, label: "Ork Scouts" }],      // or
  6: [{ x: 50, y: 50, label: "Bandits" }],          // nr — Wickleberry Lane
  7: [{ x: 50, y: 50, label: "WL 2" }],             // wb2
  8: [{ x: 50, y: 50, label: "WL 3" }],             // wbl3
  9: [{ x: 50, y: 50, label: "OR 2" }],             // or-2
  10: [{ x: 50, y: 50, label: "OR 3" }],            // or3
  11: [ // Orkville — 2 encounters
    { x: 35, y: 60, label: "Outer Pits" },
    { x: 65, y: 30, label: "War Chief" },
  ],
  12: [ // Wickleberry Estate — 2 encounters
    { x: 35, y: 60, label: "Grounds" },
    { x: 65, y: 30, label: "Lady Wickleberry" },
  ],
  13: [ // Goblin Cave — 2 encounters
    { x: 35, y: 65, label: "Cave Mouth" },
    { x: 65, y: 30, label: "Goblin King" },
  ],
};

// Exit node positions for chapter-regions (pin that takes you back up to parent map)
const EXIT_NODE_POS: Record<string, { x: number; y: number }> = {
  "leaving-home":       { x: 92, y: 50 },  // east edge — road to Londa
  "newbsberd":          { x: 8,  y: 92 },  // south-west — gate out of city
  "orkville":           { x: 8,  y: 90 },  // south exit
  "wickleberry-estate": { x: 8,  y: 90 },  // south exit
  "goblin-cave":        { x: 50, y: 95 },  // cave entrance at bottom
};

const INTRO_TEXT = "At the heart of a quiet crossroads village, where warm lanternlight spills across worn cobblestones and every path seems to lead somewhere important, your journey begins. Six humble homes ring the central well\u2014each belonging to a friend who has walked a different road, learned a different truth, and now waits to share what they know. Here, among creaking wood, soft laughter, and the scent of earth and fire, you will gather the pieces of what you need\u2014not just tools or directions, but perspective. For beyond this circle, the world grows wider, stranger, and far less forgiving\u2014and only by listening to those who know you best will you be ready to take your first real step into it.";

export function AdventureMode({ characters, onExit, onStatsRefresh }: Props) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { state, loaded, introSeen, chapter, encounter, chapters, markIntroSeen, startChapter, startEncounter, startBattle, winBattle, loseBattle, nextEncounter, backToMap, resetAdventure, skipLevel, skipEncounter, isOnCooldown, cooldownRemaining, encounterOnCooldown, encounterCooldownRemaining, setMapPosition, addItem, removeItem, hasItem, currentWeight } = useAdventure(address);

  // Region stack: navigation hierarchy (world > londa > leaving-home > ...)
  const [regionStack, setRegionStack] = useState<string[]>(["world"]);
  const regionStackRef = useRef(regionStack);
  regionStackRef.current = regionStack;
  const currentRegion = regionStack[regionStack.length - 1];

  // Cached region maps — built lazily from editor pins / adventureData
  const regionMapCache = useRef<Record<string, RegionMapData>>({});
  function getRegionMap(rId: string): RegionMapData {
    if (!regionMapCache.current[rId]) {
      regionMapCache.current[rId] = buildRegionMap(rId);
    }
    return regionMapCache.current[rId];
  }

  const [, forceUpdate] = useState(0);
  // Tick timer every second for live countdown
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const isAdmin = ADMIN_WALLETS.includes(address?.toLowerCase() ?? "");
  const [party, setParty] = useState<NftCharacter[]>([]);
  const [partyGrid, setPartyGrid] = useState<Map<string, number>>(new Map());
  const [pickingParty, setPickingParty] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [lpStatus, setLpStatus] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPos, setMapPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, mx: 0, my: 0 });
  const [regionZoom, setRegionZoom] = useState(1);
  const [regionPos, setRegionPos] = useState({ x: 0, y: 0 });
  const [regionDragging, setRegionDragging] = useState(false);
  const regionDragStart = useRef({ x: 0, y: 0, mx: 0, my: 0 });

  // Center world map on hero's starting node (Londa) on initial load
  const worldCentered = useRef(false);
  useEffect(() => {
    if (worldCentered.current || typeof window === 'undefined') return;
    worldCentered.current = true;
    const node = WORLD_NODES[WORLD_LONDA_IDX];
    if (node) {
      const vmin = Math.min(window.innerWidth, window.innerHeight);
      const mapSize = vmin * 0.9;
      setMapPos({ x: -(node.x - 50) * mapSize / 100, y: -(node.y - 50) * mapSize / 100 });
    }
  }, []);

  function handleMapWheel(e: React.WheelEvent) {
    e.preventDefault();
    setMapZoom(z => Math.min(5, Math.max(0.5, z - e.deltaY * 0.002)));
  }
  function handleMapPointerDown(e: React.PointerEvent) {
    setDragging(true);
    dragStart.current = { x: mapPos.x, y: mapPos.y, mx: e.clientX, my: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handleMapPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setMapPos({
      x: dragStart.current.x + (e.clientX - dragStart.current.mx),
      y: dragStart.current.y + (e.clientY - dragStart.current.my),
    });
  }
  function handleMapPointerUp() { setDragging(false); }

  function handleRegionWheel(e: React.WheelEvent) {
    e.preventDefault();
    setRegionZoom(z => Math.min(5, Math.max(0.5, z - e.deltaY * 0.002)));
  }
  function handleRegionPointerDown(e: React.PointerEvent) {
    setRegionDragging(true);
    regionDragStart.current = { x: regionPos.x, y: regionPos.y, mx: e.clientX, my: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handleRegionPointerMove(e: React.PointerEvent) {
    if (!regionDragging) return;
    setRegionPos({
      x: regionDragStart.current.x + (e.clientX - regionDragStart.current.mx),
      y: regionDragStart.current.y + (e.clientY - regionDragStart.current.my),
    });
  }
  function handleRegionPointerUp() { setRegionDragging(false); }

  // Center map on a node (for auto-panning when opening a region)
  const mapContainerRef = useRef<HTMLDivElement>(null);
  function centerOnNode(nodes: { x: number; y: number }[], nodeId: string | number, setter: (pos: { x: number; y: number }) => void) {
    const node = typeof nodeId === 'number' ? nodes[nodeId] : nodes.find((n: any) => n.id === nodeId);
    if (!node) return;
    // Map is 90vmin. Node at x% means offset from center = (x - 50)% * mapWidth.
    const vmin = Math.min(window.innerWidth, window.innerHeight);
    const mapSize = vmin * 0.9;
    setter({ x: -(node.x - 50) * mapSize / 100, y: -(node.y - 50) * mapSize / 100 });
  }

  // Drill into a region — push onto stack, center on first/party node
  function drillInto(rId: string) {
    setRegionStack(prev => [...prev, rId]);
    setRegionZoom(1);
    const map = getRegionMap(rId);
    const partyNode = map.nodes.find(n => n.id === partyPosRef.current);
    const targetNode = partyNode ?? map.nodes[0];
    if (targetNode) {
      setMapPosition(targetNode.id);
      const vmin = Math.min(window.innerWidth, window.innerHeight);
      const mapSize = vmin * 0.9;
      setRegionPos({ x: -(targetNode.x - 50) * mapSize / 100, y: -(targetNode.y - 50) * mapSize / 100 });
    } else {
      setRegionPos({ x: 0, y: 0 });
    }
  }

  // Drill out — pop the region stack
  function drillOut() {
    setRegionStack(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
    setRegionZoom(1);
    setRegionPos({ x: 0, y: 0 });
  }

  // Legacy convenience — opens Londa centered on party position
  function openLondaCentered() {
    drillInto("londa");
  }

  // World map node tracking
  const [worldNodeIdx, setWorldNodeIdx] = useState(WORLD_LONDA_IDX);
  const worldNodeIdxRef = useRef(worldNodeIdx);
  worldNodeIdxRef.current = worldNodeIdx;

  // Ref to state for reading inside key handler
  const stateRef = useRef(state);
  stateRef.current = state;

  // Party position — node ID in whichever region the player is currently in
  const currentRegionMap = currentRegion !== "world" ? getRegionMap(currentRegion) : null;
  const partyPos = state.mapPosition ?? (currentRegionMap?.nodes[0]?.id ?? "leaving-home");
  const partyPosRef = useRef(partyPos);
  partyPosRef.current = partyPos;

  // Reusable party token element
  const partyToken = (leftPct: number, topPct: number) => (
    <div className="absolute pointer-events-none" style={{
      left: `${leftPct}%`, top: `${topPct}%`,
      transform: 'translate(-50%, -50%)',
      transition: 'left 0.4s ease-out, top 0.4s ease-out',
      zIndex: 10,
    }}>
      <div className="flex flex-col items-center">
        <span style={{ fontSize: '1rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>⚔️</span>
        <span className="font-black uppercase" style={{
          fontSize: '0.35rem', color: '#f0d070',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          background: 'rgba(10,6,8,0.8)', padding: '1px 4px', borderRadius: 4,
          border: '1px solid rgba(201,168,76,0.4)',
        }}>
          Your Party
        </span>
      </div>
    </div>
  );

  function getAdjacentNodes(nodeId: string): string[] {
    const curReg = regionStackRef.current[regionStackRef.current.length - 1];
    if (curReg === "world") return [];
    const map = getRegionMap(curReg);
    return map.adj[nodeId] ?? [];
  }

  function moveToNode(targetId: string) {
    const adj = getAdjacentNodes(partyPosRef.current);
    if (!adj.includes(targetId)) return;
    setMapPosition(targetId);
    const curReg = regionStackRef.current[regionStackRef.current.length - 1];
    if (curReg === "world") return;
    const map = getRegionMap(curReg);
    const node = map.nodes.find(n => n.id === targetId);
    if (!node) return;
    // Landing on uncleared encounter → start fight
    if (node.type === 'encounter' && node.chapterIdx !== undefined && node.encounterIdx !== undefined) {
      const ch = chapters[node.chapterIdx];
      if (ch && !encounterOnCooldown(ch.id, node.encounterIdx)) {
        startEncounter(node.chapterIdx, node.encounterIdx);
        setRegionStack(["world"]); // collapse back to world on fight
        setPickingParty(true);
      }
    }
  }

  // Arrow keys follow paths, transitioning between map layers when at an edge
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isRight = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D';
      const isLeft = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A';
      const isEnter = e.key === 'Enter' || e.key === ' ';
      const isEscape = e.key === 'Escape';
      if (!isRight && !isLeft && !isEnter && !isEscape) return;
      e.preventDefault();

      const stack = regionStackRef.current;
      const curReg = stack[stack.length - 1];

      // === LAYER 1: Non-world region — edge-based movement ===
      if (stack.length > 1 && curReg !== "world") {
        const map = getRegionMap(curReg);
        const mapNodes = map.nodes;
        const mapAdj = map.adj;
        const curNode = mapNodes.find(n => n.id === partyPosRef.current);

        if (isEscape) {
          drillOut();
          return;
        }

        if (!curNode) return;
        const curIdx = mapNodes.indexOf(curNode);

        if (isEnter) {
          if (curNode.type === 'region' && curNode.regionId) {
            // Drill into sub-region
            drillInto(curNode.regionId);
          } else if (curNode.type === 'chapter' && curNode.chapterIdx !== undefined) {
            const ch = chapters[curNode.chapterIdx];
            if (ch && isChapterUnlocked(ch)) {
              // If the chapter is also a region, drill into it
              if (REGION_IDS.has(ch.id)) {
                drillInto(ch.id);
              } else {
                // Open encounter select — drill into chapter as sub-region
                drillInto(ch.id);
              }
            }
          } else if (curNode.type === 'encounter' && curNode.chapterIdx !== undefined && curNode.encounterIdx !== undefined) {
            const ch = chapters[curNode.chapterIdx];
            if (ch && !encounterOnCooldown(ch.id, curNode.encounterIdx)) {
              startEncounter(curNode.chapterIdx, curNode.encounterIdx);
              setPickingParty(true);
            }
          }
          return;
        }

        // Move along adjacent nodes — right=forward (higher index), left=backward
        const adj = mapAdj[partyPosRef.current] ?? [];
        const forward = adj.filter(id => { const i = mapNodes.findIndex(n => n.id === id); return i > curIdx; });
        const backward = adj.filter(id => { const i = mapNodes.findIndex(n => n.id === id); return i >= 0 && i < curIdx; });
        if (isRight && forward.length > 0) moveToNode(forward[0]);
        else if (isLeft && backward.length > 0) moveToNode(backward[0]);
        else if (isLeft && backward.length === 0) drillOut();
        return;
      }

      // === LAYER 2: World map — follow WORLD_PATH ===
      if (state.phase === "map") {
        if (isRight && worldNodeIdxRef.current < WORLD_PATH.length - 1) {
          setWorldNodeIdx(worldNodeIdxRef.current + 1);
        } else if (isLeft && worldNodeIdxRef.current > 0) {
          setWorldNodeIdx(worldNodeIdxRef.current - 1);
        }
        if (isEnter) {
          const node = WORLD_NODES[worldNodeIdxRef.current];
          if (node?.active && node.id === 'londa') {
            drillInto("londa");
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, regionStack]);

  // Send LP reward to each party member's NFT via faucet (player pays gas only)
  async function sendLpRewards() {
    if (!walletClient || party.length === 0) return;
    // Only reward heroes the player owns, not unlocked story NPCs
    const ownedParty = party.filter(h => h.owned);
    if (ownedParty.length === 0) { setLpStatus("No owned heroes to reward"); setTimeout(() => setLpStatus(null), 3000); return; }
    setLpStatus("Powering up your heroes...");
    let sent = 0;
    for (const hero of ownedParty) {
      try {
        await walletClient.writeContract({
          address: LP_FAUCET,
          abi: FAUCET_ABI,
          functionName: "rewardHero",
          args: [hero.contractAddress as `0x${string}`],
        });
        sent++;
        setLpStatus(`${hero.name} powered up! (${sent}/${party.length})`);
      } catch (e: any) {
        console.warn("Reward failed for", hero.name, e.message);
      }
    }
    if (sent > 0) {
      setLpStatus(`${sent} hero${sent > 1 ? "es" : ""} leveled up! Refreshing...`);
      if (onStatsRefresh) {
        await onStatsRefresh();
        setLpStatus(`${sent} hero${sent > 1 ? "es" : ""} leveled up!`);
      } else {
        setLpStatus(`${sent} hero${sent > 1 ? "es" : ""} leveled up!`);
      }
    } else {
      setLpStatus("Heroes on cooldown or faucet empty");
    }
    setTimeout(() => setLpStatus(null), 5000);
  }

  // Check if a chapter is unlocked
  const isChapterUnlocked = (ch: typeof chapters[number]) => {
    const andOk = !ch.requires || ch.requires.length === 0 || ch.requires.every(reqId => state.completedChapters.includes(reqId));
    const anyOk = !ch.requiresAny || ch.requiresAny.length === 0 || ch.requiresAny.some(reqId => state.completedChapters.includes(reqId));
    return andOk && anyOk;
  };

  // Find current player position (first incomplete unlocked level)
  const playerLevel = chapters.findIndex(ch => isChapterUnlocked(ch) && !state.completedChapters.includes(ch.id));
  const playerPos = playerLevel === -1 ? chapters.length : playerLevel;

  const floatingBack = (
    <button onClick={onExit}
      className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
      style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
      ⚜ ← Back ⚜
    </button>
  );

  const inventory = state.inventory ?? [];
  const weight = currentWeight();
  const capacity = state.carryCapacity ?? 50;

  const inventoryButton = (
    <button onClick={() => setInventoryOpen(o => !o)}
      className="fixed top-20 right-4 z-50 px-3 py-2 rounded-lg text-sm font-black"
      style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)' }}>
      <span style={{ fontSize: '1rem' }}>🎒</span>
      {inventory.length > 0 && (
        <span className="absolute -top-1 -right-1 rounded-full text-xs font-black px-1"
          style={{ background: '#f0d070', color: '#0a0608', fontSize: '0.5rem', minWidth: 14, textAlign: 'center' }}>
          {inventory.reduce((s, i) => s + i.quantity, 0)}
        </span>
      )}
    </button>
  );

  const inventoryPanel = inventoryOpen && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={() => setInventoryOpen(false)}>
      <div className="rounded-xl p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(10,6,8,0.98)', border: '1px solid rgba(201,168,76,0.4)', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black uppercase tracking-widest" style={{ color: '#f0d070', fontFamily: "'Cinzel Decorative', 'Cinzel', serif", fontSize: '0.85rem' }}>
            Party Inventory
          </h3>
          <button onClick={() => setInventoryOpen(false)} className="text-sm font-bold" style={{ color: 'rgba(201,168,76,0.5)' }}>✕</button>
        </div>

        {/* Weight bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1" style={{ color: 'rgba(232,213,176,0.6)' }}>
            <span>Weight</span>
            <span style={{ color: weight > capacity * 0.8 ? '#f87171' : 'rgba(232,213,176,0.6)' }}>
              {weight.toFixed(0)} / {capacity}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (weight / capacity) * 100)}%`, background: weight > capacity * 0.8 ? '#dc2626' : '#c9a84c' }} />
          </div>
        </div>

        {/* Items */}
        {inventory.length === 0 ? (
          <p className="text-center py-6 text-xs" style={{ color: 'rgba(150,150,150,0.5)' }}>
            Your pack is empty. Visit vendors or complete encounters to find items.
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {inventory.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)' }}>
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs truncate" style={{ color: 'rgba(232,213,176,0.9)' }}>{item.name}</p>
                  <p className="text-xs" style={{ color: 'rgba(150,150,150,0.5)' }}>
                    {item.category} · {item.weight}/ea
                  </p>
                </div>
                <span className="font-black text-sm" style={{ color: '#f0d070' }}>×{item.quantity}</span>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div className="mt-4 pt-3 flex justify-between text-xs" style={{ borderTop: '1px solid rgba(201,168,76,0.15)', color: 'rgba(232,213,176,0.5)' }}>
          <span>{inventory.reduce((s, i) => s + i.quantity, 0)} items</span>
          <span>Capacity: {capacity - weight > 0 ? (capacity - weight).toFixed(0) : 0} remaining</span>
        </div>
      </div>
    </div>
  );

  // Loading cloud save
  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-4 mt-20">
        <p className="text-sm animate-pulse" style={{ color: 'rgba(201,168,76,0.6)' }}>Loading adventure...</p>
      </div>
    );
  }

  // First-time intro screen
  if (!introSeen) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-lg mx-auto mt-10 px-4">
        {floatingBack}
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase text-center"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ Tales of Tasern ⚜
        </h2>
        <div className="rounded-xl p-6" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
          <p className="text-sm leading-relaxed text-center" style={{ color: 'rgba(232,213,176,0.7)', lineHeight: '1.8' }}>
            {INTRO_TEXT}
          </p>
        </div>
        <button onClick={markIntroSeen}
          className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 20px rgba(201,168,76,0.15)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ Begin Your Journey ⚜
        </button>
      </div>
    );
  }

  // Map screen — world map with location markers
  if (state.phase === "map") {
    return (
      <div className="fixed inset-0" style={{ background: '#0a0608' }}>
        {floatingBack}{inventoryButton}{inventoryPanel}

        {/* Zoomable world map */}
        <div className="absolute inset-0 overflow-hidden touch-none"
          onWheel={handleMapWheel}
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onPointerUp={handleMapPointerUp}
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: `translate(calc(-50% + ${mapPos.x}px), calc(-50% + ${mapPos.y}px)) scale(${mapZoom})`,
            transition: dragging ? 'none' : 'transform 0.1s ease-out',
            width: '90vmin',
            aspectRatio: '1 / 1',
            backgroundImage: 'url(/world-map.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}>

            {/* Road path connecting world nodes */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
              {WORLD_NODES.map((node, i) => {
                if (i >= WORLD_NODES.length - 1) return null;
                const next = WORLD_NODES[i + 1];
                return <line key={i} x1={node.x} y1={node.y} x2={next.x} y2={next.y}
                  stroke="rgba(139,119,79,0.3)" strokeWidth="0.5" strokeDasharray="1 0.5" strokeLinecap="round" />;
              })}
            </svg>

            {/* All world nodes */}
            {WORLD_NODES.map((node, i) => {
              const isHere = worldNodeIdx === i;
              const isAdj = Math.abs(worldNodeIdx - i) === 1;
              const bg = node.active ? 'rgba(201,168,76,0.9)' : 'rgba(80,80,80,0.6)';
              const border = node.active ? '#f0d070' : 'rgba(120,120,120,0.5)';
              const textColor = node.active ? '#f0d070' : 'rgba(150,150,150,0.4)';
              const adjGlow = isAdj ? '0 0 14px rgba(201,168,76,0.5)' : '';

              return (
                <div key={node.id}>
                  <button onClick={(e) => {
                      e.stopPropagation();
                      if (isHere && node.active && node.id === 'londa') {
                        openLondaCentered();
                      } else if (isAdj) {
                        setWorldNodeIdx(i);
                      }
                    }}
                    className={`absolute ${node.active && !isHere ? 'animate-pulse' : ''}`}
                    style={{
                      left: `${node.x}%`, top: `${node.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: node.active ? 24 : 20, height: node.active ? 24 : 20,
                      borderRadius: '50%',
                      background: bg,
                      border: `${isAdj ? '3px' : '2px'} solid ${isAdj ? '#f0d070' : border}`,
                      boxShadow: node.active ? '0 0 15px rgba(201,168,76,0.6), 0 0 30px rgba(201,168,76,0.3)' : adjGlow,
                      cursor: isAdj || (isHere && node.active) ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.35rem', fontWeight: 900,
                      color: node.active ? '#0a0608' : 'rgba(150,150,150,0.5)',
                      transition: 'box-shadow 0.3s, border 0.3s',
                    }}>
                    {node.active ? '1' : '?'}
                  </button>
                  <span className="absolute font-bold pointer-events-none"
                    style={{
                      left: `${node.x}%`, top: `${node.y + 4}%`,
                      transform: 'translateX(-50%)',
                      fontSize: node.active ? '0.5rem' : '0.4rem',
                      fontWeight: node.active ? 900 : 700,
                      color: textColor,
                      textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                      whiteSpace: 'nowrap',
                    }}>
                    {node.label}
                  </span>
                  {!node.active && (
                    <span className="absolute pointer-events-none"
                      style={{
                        left: `${node.x}%`, top: `${node.y + 7}%`,
                        transform: 'translateX(-50%)',
                        fontSize: '0.3rem', color: 'rgba(100,100,100,0.4)',
                        whiteSpace: 'nowrap',
                      }}>
                      Coming Soon
                    </span>
                  )}
                </div>
              );
            })}

            {/* Party token — follows worldNodeIdx */}
            {(() => {
              const node = WORLD_NODES[worldNodeIdx];
              return node ? partyToken(node.x, node.y - 4) : null;
            })()}
          </div>
        </div>

        {/* Top bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4" style={{ zIndex: 10 }}>
          <h2 className="text-lg font-black tracking-widest text-gold-shimmer uppercase"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
            ⚜ Tasern ⚜
          </h2>
          <span className="text-xs font-bold px-2 py-1 rounded"
            style={{ color: 'rgba(201,168,76,0.8)', background: 'rgba(10,6,8,0.8)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
            Battles won: {state.mftEarned > 0 ? Math.floor(state.mftEarned / 300) : 0}
          </span>
        </div>

        {/* Zoom controls */}
        <div className="absolute top-4 right-4 flex gap-2" style={{ zIndex: 10 }}>
          <button onClick={() => setMapZoom(z => Math.min(5, z + 0.5))}
            className="px-3 py-2 rounded-lg font-black text-lg"
            style={{ background: 'rgba(10,6,8,0.9)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }}>+</button>
          <button onClick={() => setMapZoom(z => Math.max(0.5, z - 0.5))}
            className="px-3 py-2 rounded-lg font-black text-lg"
            style={{ background: 'rgba(10,6,8,0.9)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }}>−</button>
          <button onClick={() => { setMapZoom(1); setMapPos({ x: 0, y: 0 }); }}
            className="px-3 py-2 rounded-lg font-bold text-xs"
            style={{ background: 'rgba(10,6,8,0.9)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }}>Reset</button>
        </div>

        {/* Bottom hint */}
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs" style={{ zIndex: 10, color: 'rgba(201,168,76,0.4)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
          Pinch or scroll to zoom · Drag to pan · Tap a location to begin
        </p>

        {state.mftEarned > 0 && (
          <button onClick={resetAdventure} className="absolute bottom-4 right-4 px-3 py-1 rounded text-xs font-bold"
            style={{ background: 'rgba(220,38,38,0.2)', color: 'rgba(220,38,38,0.5)', border: '1px solid rgba(220,38,38,0.2)', zIndex: 10 }}>
            Reset
          </button>
        )}

        {/* Generic region map overlay — any level of the hierarchy */}
        {regionStack.length > 1 && (() => {
          const curRegId = regionStack[regionStack.length - 1];
          const regionDef = REGIONS.find(r => r.id === curRegId);
          const regionMapData = getRegionMap(curRegId);
          const regionNodes = regionMapData.nodes;
          const regionEdges = regionMapData.edges;
          // Determine background image: use regionDef mapImage, or chapter image for chapter-regions
          const chapterForRegion = ADVENTURE_CHAPTERS.find(ch => ch.id === curRegId);
          const bgImage = regionDef?.mapImage ?? chapterForRegion?.image ?? null;
          const regionName = regionDef?.name ?? chapterForRegion?.title ?? curRegId;
          // Breadcrumb from stack
          const breadcrumb = regionStack.map(id => {
            const rd = REGIONS.find(r => r.id === id);
            return rd?.name ?? id;
          }).join(' > ');

          return (
          <div className="fixed inset-0" style={{ zIndex: 50, background: '#0a0608' }}>
            <div className="absolute inset-0 overflow-hidden touch-none"
              onWheel={handleRegionWheel}
              onPointerDown={handleRegionPointerDown}
              onPointerMove={handleRegionPointerMove}
              onPointerUp={handleRegionPointerUp}
              style={{ cursor: regionDragging ? 'grabbing' : 'grab' }}>
              <div style={{
                position: 'absolute',
                left: '50%', top: '50%',
                transform: `translate(calc(-50% + ${regionPos.x}px), calc(-50% + ${regionPos.y}px)) scale(${regionZoom})`,
                transition: regionDragging ? 'none' : 'transform 0.1s ease-out',
                width: '90vmin',
                ...(bgImage ? {
                  aspectRatio: '1 / 1',
                  backgroundImage: `url(${bgImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                } : {
                  aspectRatio: '1 / 1',
                  background: 'linear-gradient(135deg, #1a1520 0%, #12101a 40%, #0d0a10 100%)',
                }),
              }}>

                {/* Road paths connecting adjacent nodes */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
                  {regionEdges.map(([aId, bId], i) => {
                    const a = regionNodes.find(n => n.id === aId);
                    const b = regionNodes.find(n => n.id === bId);
                    if (!a || !b) return null;
                    return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke="rgba(139,119,79,0.4)" strokeWidth="0.5" strokeDasharray="1 0.5" strokeLinecap="round" />;
                  })}
                </svg>

                {/* All map nodes */}
                {regionNodes.map((node) => {
                  const isHere = partyPos === node.id;
                  const adjacent = getAdjacentNodes(partyPos);
                  const isAdj = adjacent.includes(node.id);

                  // Node appearance by type
                  let bg = 'rgba(100,100,100,0.6)';
                  let border = 'rgba(150,150,150,0.5)';
                  let textColor = 'rgba(150,150,150,0.4)';
                  let icon = '';
                  let subtitle = '';
                  let pulse = false;
                  let size = 20;

                  if (node.type === 'region') {
                    bg = 'rgba(139,105,20,0.8)'; border = '#f0d070'; textColor = '#f0d070';
                    icon = '\uD83D\uDCC2'; size = 24;
                    // Check if the underlying chapter is unlocked
                    if (node.chapterIdx !== undefined) {
                      const ch = chapters[node.chapterIdx];
                      const unlocked = ch ? isChapterUnlocked(ch) : false;
                      const completed = ch ? state.completedChapters.includes(ch.id) : false;
                      if (completed) {
                        bg = 'rgba(34,197,94,0.8)'; border = '#4ade80'; textColor = '#4ade80';
                        icon = '\u2713'; size = 24;
                      } else if (!unlocked) {
                        bg = 'rgba(60,60,60,0.7)'; border = 'rgba(100,100,100,0.5)'; textColor = 'rgba(100,100,100,0.5)';
                        icon = '\uD83D\uDD12'; size = 24;
                      } else {
                        pulse = !isHere;
                      }
                    }
                  } else if (node.type === 'chapter') {
                    const ch = node.chapterIdx !== undefined ? chapters[node.chapterIdx] : undefined;
                    const unlocked = ch ? isChapterUnlocked(ch) : false;
                    const completed = ch ? state.completedChapters.includes(ch.id) : false;
                    if (completed) {
                      bg = 'rgba(34,197,94,0.8)'; border = '#4ade80'; textColor = '#4ade80';
                      icon = '\u2713'; size = 22;
                    } else if (unlocked) {
                      bg = 'rgba(201,168,76,0.9)'; border = '#f0d070'; textColor = '#f0d070';
                      icon = '\u2694'; size = 22; pulse = !isHere;
                    } else {
                      bg = 'rgba(60,60,60,0.7)'; border = 'rgba(100,100,100,0.5)'; textColor = 'rgba(100,100,100,0.5)';
                      icon = '\uD83D\uDD12'; size = 22;
                    }
                  } else if (node.type === 'encounter' && node.chapterIdx !== undefined) {
                    const encCh = chapters[node.chapterIdx];
                    if (encCh) {
                      const cleared = encounterOnCooldown(encCh.id, node.encounterIdx!);
                      const cdMs = encounterCooldownRemaining(encCh.id, node.encounterIdx!);
                      const cdD = Math.floor(cdMs / 86400000);
                      const cdH = Math.floor((cdMs % 86400000) / 3600000);
                      if (cleared) {
                        bg = 'rgba(34,197,94,0.8)'; border = '#4ade80'; textColor = 'rgba(74,222,128,0.7)';
                        icon = '\u2713'; subtitle = `Resets ${cdD}d ${cdH}h`;
                      } else {
                        bg = 'rgba(220,38,38,0.8)'; border = '#f87171'; textColor = 'rgba(248,113,113,0.8)';
                        icon = '\u2694'; pulse = !isHere;
                      }
                    }
                    size = 12;
                  } else if (node.type === 'travel') {
                    bg = 'rgba(80,80,80,0.5)'; border = 'rgba(120,120,120,0.4)'; textColor = 'rgba(120,120,120,0.4)';
                    icon = '\u00B7'; size = 10;
                  } else if (node.type === 'exit') {
                    bg = 'rgba(56,130,180,0.85)'; border = '#7dd3fc'; textColor = '#7dd3fc';
                    icon = '\uD83D\uDEAA'; size = 22; pulse = !isHere;
                  } else if (node.type === 'placeholder') {
                    bg = 'rgba(50,50,50,0.5)'; border = 'rgba(90,90,90,0.4)'; textColor = 'rgba(90,90,90,0.5)';
                    icon = '?'; size = 18;
                  } else {
                    bg = 'rgba(100,100,100,0.6)'; border = 'rgba(150,150,150,0.5)'; textColor = 'rgba(150,150,150,0.4)';
                    icon = '?'; size = 20;
                  }

                  const adjGlow = isAdj ? '0 0 14px rgba(201,168,76,0.7)' : '';

                  return (
                    <div key={node.id}>
                      <button onClick={(e) => {
                          e.stopPropagation();
                          if (isHere) {
                            if (node.type === 'exit' && node.regionId) {
                              // Drill out to parent region, land on this region's pin
                              drillOut();
                              return;
                            } else if (node.type === 'region' && node.regionId) {
                              // Drill into sub-region
                              drillInto(node.regionId);
                            } else if (node.type === 'chapter' && node.chapterIdx !== undefined) {
                              const ch = chapters[node.chapterIdx];
                              if (ch && isChapterUnlocked(ch)) {
                                if (REGION_IDS.has(ch.id)) {
                                  drillInto(ch.id);
                                } else {
                                  drillInto(ch.id);
                                }
                              }
                            } else if (node.type === 'encounter' && node.chapterIdx !== undefined && node.encounterIdx !== undefined) {
                              const ch = chapters[node.chapterIdx];
                              if (ch && !encounterOnCooldown(ch.id, node.encounterIdx)) {
                                startEncounter(node.chapterIdx, node.encounterIdx);
                                setRegionStack(["world"]);
                                setPickingParty(true);
                              }
                            }
                            return;
                          }
                          if (isAdj) moveToNode(node.id);
                        }}
                        className={`absolute ${pulse ? 'animate-pulse' : ''}`}
                        style={{
                          left: `${node.x}%`, top: `${node.y}%`,
                          transform: 'translate(-50%, -50%)',
                          width: size, height: size,
                          borderRadius: '50%',
                          background: bg,
                          border: `${isAdj ? '3px' : '2px'} solid ${isAdj ? '#f0d070' : border}`,
                          boxShadow: adjGlow,
                          cursor: isAdj || (isHere && (node.type === 'chapter' || node.type === 'encounter' || node.type === 'region' || node.type === 'exit')) ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: node.type === 'exit' ? '0.55rem' : '0.35rem', fontWeight: 900,
                          color: (node.type === 'chapter' || node.type === 'region') ? '#0a0608' : '#fff',
                          transition: 'box-shadow 0.3s, border 0.3s',
                        }}>
                        {icon}
                      </button>
                      {node.label && (
                        <span className="absolute font-bold pointer-events-none"
                          style={{
                            left: `${node.x}%`, top: `${node.y + (node.type === 'chapter' || node.type === 'destination' || node.type === 'region' || node.type === 'exit' ? 4 : 3)}%`,
                            transform: 'translateX(-50%)',
                            fontSize: (node.type === 'chapter' || node.type === 'destination' || node.type === 'region' || node.type === 'exit') ? '0.45rem' : '0.35rem',
                            fontWeight: (node.type === 'chapter' || node.type === 'destination' || node.type === 'region' || node.type === 'exit') ? 900 : 700,
                            color: textColor,
                            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                            whiteSpace: 'nowrap',
                          }}>
                          {node.label}
                        </span>
                      )}
                      {subtitle && (
                        <span className="absolute pointer-events-none"
                          style={{
                            left: `${node.x}%`, top: `${node.y + 5}%`,
                            transform: 'translateX(-50%)',
                            fontSize: '0.3rem', color: 'rgba(150,150,150,0.5)',
                            whiteSpace: 'nowrap',
                          }}>
                          {subtitle}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Party token — shows current position */}
                {(() => {
                  const partyNode = regionNodes.find(n => n.id === partyPos);
                  if (!partyNode) return null;
                  return partyToken(partyNode.x, partyNode.y - 4);
                })()}
              </div>
            </div>

            {/* Top bar with breadcrumb */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1" style={{ zIndex: 51 }}>
              <h2 className="text-lg font-black tracking-widest text-gold-shimmer uppercase"
                style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                {'\u269C'} {regionName} {'\u269C'}
              </h2>
              <p className="text-xs" style={{ color: 'rgba(201,168,76,0.4)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                {breadcrumb}
              </p>
            </div>

            {/* Controls */}
            <div className="absolute top-4 right-4 flex gap-2" style={{ zIndex: 51 }}>
              <button onClick={() => setRegionZoom(z => Math.min(5, z + 0.5))}
                className="px-3 py-2 rounded-lg font-black text-lg"
                style={{ background: 'rgba(10,6,8,0.9)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }}>+</button>
              <button onClick={() => setRegionZoom(z => Math.max(0.5, z - 0.5))}
                className="px-3 py-2 rounded-lg font-black text-lg"
                style={{ background: 'rgba(10,6,8,0.9)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }}>{'\u2212'}</button>
              <button onClick={() => { setRegionZoom(1); setRegionPos({ x: 0, y: 0 }); }}
                className="px-3 py-2 rounded-lg font-bold text-xs"
                style={{ background: 'rgba(10,6,8,0.9)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }}>Reset</button>
              <button onClick={drillOut}
                className="px-3 py-2 rounded-lg font-black text-lg"
                style={{ background: 'rgba(220,38,38,0.8)', color: '#fff', border: '1px solid rgba(220,38,38,0.9)' }}>{'\u2715'}</button>
            </div>

            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs" style={{ zIndex: 51, color: 'rgba(201,168,76,0.4)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
              Tap a location to begin {'\u00B7'} Pinch to zoom {'\u00B7'} Drag to pan
            </p>
          </div>
          );
        })()}
      </div>
    );
  }

  // Party picker
  if (pickingParty) {
    return (
      <PartyPicker characters={characters} isAdmin={isAdmin} unlockedNpcs={state.unlockedNpcs}
        maxParty={chapter?.maxParty ?? 9}
        onStart={(p, gridMap) => { setParty(p); setPartyGrid(gridMap); setPickingParty(false); }}
        onBack={() => { setPickingParty(false); backToMap(); }}
      />
    );
  }

  // Story
  // Level 1 encounter positions on the village image (clockwise from top-left, % based)
  const level1Positions = [
    { x: 20, y: 10, label: "1" },  // Merchant's Hut — top-left teal roof
    { x: 68, y: 8,  label: "2" },  // Woodcutter's Cabin — top-right
    { x: 85, y: 48, label: "3" },  // Herbalist's Tent — right side
    { x: 70, y: 82, label: "4" },  // Blacksmith's Forge — bottom-right
    { x: 18, y: 82, label: "5" },  // Elder's Lodge — bottom-left
    { x: 5,  y: 45, label: "6" },  // Village Square — left side
  ];

  if (state.phase === "story" && chapter && encounter) {
    const isLevel1 = state.currentChapter === 0;
    return (
      <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto mt-8">
        {floatingBack}
        <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.4)' }}>
          Level {state.currentChapter + 1}: {chapter.title} — Encounter {state.currentEncounter + 1}/{chapter.encounters.length}
        </p>

        {/* Level 1: Village map with encounter markers */}
        {isLevel1 && chapter.image && (
          <div className="w-full relative rounded-xl overflow-hidden" style={{ maxWidth: 400 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chapter.image} alt={chapter.title} className="w-full" style={{ filter: 'brightness(0.6)' }} />
            {/* Path connecting encounters */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {level1Positions.map((pos, i) => {
                const next = level1Positions[(i + 1) % level1Positions.length];
                return (
                  <line key={i} x1={pos.x + 4} y1={pos.y + 4} x2={next.x + 4} y2={next.y + 4}
                    stroke={i < state.currentEncounter ? 'rgba(74,222,128,0.5)' : 'rgba(201,168,76,0.2)'}
                    strokeWidth="0.5" strokeDasharray={i < state.currentEncounter ? "none" : "2 1"} />
                );
              })}
            </svg>
            {/* Encounter markers */}
            {level1Positions.map((pos, i) => {
              const done = i < state.currentEncounter;
              const current = i === state.currentEncounter;
              const future = i > state.currentEncounter;
              return (
                <div key={i} className="absolute flex items-center justify-center"
                  style={{
                    left: `${pos.x}%`, top: `${pos.y}%`, width: 28, height: 28,
                    transform: 'translate(-50%, -50%)',
                  }}>
                  <div className={`rounded-full flex items-center justify-center font-black text-xs ${current ? 'animate-pulse' : ''}`}
                    style={{
                      width: current ? 28 : 22, height: current ? 28 : 22,
                      background: done ? 'rgba(34,197,94,0.8)' : current ? 'rgba(201,168,76,0.9)' : 'rgba(0,0,0,0.6)',
                      border: `2px solid ${done ? 'rgba(74,222,128,0.9)' : current ? '#f0d070' : 'rgba(255,255,255,0.2)'}`,
                      color: done ? '#0a0608' : current ? '#0a0608' : 'rgba(255,255,255,0.4)',
                      boxShadow: current ? '0 0 12px rgba(201,168,76,0.6)' : 'none',
                    }}>
                    {done ? '✓' : pos.label}
                  </div>
                  {current && <span className="absolute -top-3 text-sm animate-bounce">⚔️</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="w-full rounded-xl p-6 battle-arena medieval-corners">
          <h3 className="text-xl font-black tracking-widest text-gold-shimmer uppercase text-center mb-4"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            {encounter.name}
          </h3>
          {state.currentEncounter === 0 && (
            <p className="text-sm mb-4 leading-relaxed" style={{ color: 'rgba(232,213,176,0.6)' }}>{chapter.intro}</p>
          )}
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,213,176,0.8)' }}>{encounter.description}</p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <span className="text-xs" style={{ color: 'rgba(201,168,76,0.5)' }}>⚔️+1 🛡️+1 ❤️+1 per hero</span>
            <span className="text-xs" style={{ color: 'rgba(220,38,38,0.5)' }}>{"⚔️".repeat(Math.ceil(encounter.aiStrength * 3))}</span>
            <span className="text-xs" style={{ color: 'rgba(96,165,250,0.5)' }}>Party: {party.length} heroes</span>
          </div>
        </div>
        {(() => {
          const encCd = chapter ? encounterOnCooldown(chapter.id, state.currentEncounter) : false;
          const encCdMs = chapter ? encounterCooldownRemaining(chapter.id, state.currentEncounter) : 0;
          const cdHrs = Math.floor(encCdMs / 3600000);
          const cdMins = Math.floor((encCdMs % 3600000) / 60000);
          const cdSecs = Math.floor((encCdMs % 60000) / 1000);
          return (
            <div className="flex flex-col items-center gap-3">
              {encCd && (
                <p className="text-sm font-bold" style={{ color: 'rgba(150,150,150,0.8)' }}>
                  ⏳ {cdHrs}h {cdMins}m {cdSecs}s
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={startBattle} disabled={encCd}
                  className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
                  style={{ background: encCd ? 'rgba(100,100,100,0.2)' : 'rgba(220,38,38,0.3)', color: encCd ? 'rgba(150,150,150,0.5)' : '#fca5a5', border: `1px solid ${encCd ? 'rgba(100,100,100,0.3)' : 'rgba(220,38,38,0.6)'}`, boxShadow: encCd ? 'none' : '0 0 20px rgba(220,38,38,0.15)', cursor: encCd ? 'not-allowed' : 'pointer' }}>
                  {encCd ? `⏳ ${cdHrs}h ${cdMins}m ${cdSecs}s` : '⚔️ Fight!'}
                </button>
                <button onClick={backToMap}
                  className="px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  ← Retreat
                </button>
                {isAdmin && (
                  <button onClick={skipEncounter}
                    className="px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest"
                    style={{ background: 'rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.8)', border: '1px solid rgba(139,92,246,0.4)' }}>
                    ⏭ Skip
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // Battle
  if (state.phase === "battle" && encounter) {
    const playerUnits = party.map((c, i) => {
      const unit = makeUnit(c, true, i);
      unit.gridPos = partyGrid.get(c.contractAddress) ?? i;
      return unit;
    });
    const enemyUnits = generateEnemies(characters, party.length, encounter.aiStrength, encounter.aiDeckBias, encounter.npcAddress, encounter.npcAddresses);

    return (
      <>{floatingBack}
      <PartyCombat
        players={playerUnits}
        enemies={enemyUnits}
        onWin={() => {
          // Check if NPC joins party
          if (encounter.joinsParty && party.length < (chapter?.maxParty ?? 9)) {
            const npc = characters.find(c => c.contractAddress.toLowerCase() === encounter.joinsParty!.toLowerCase());
            if (npc && !party.some(p => p.contractAddress.toLowerCase() === npc.contractAddress.toLowerCase())) {
              setParty(prev => [...prev, npc]);
              const usedPositions = new Set(partyGrid.values());
              const emptySlot = [4, 3, 5, 7, 6, 8, 1, 0, 2].find(s => !usedPositions.has(s)) ?? 4;
              setPartyGrid(prev => new Map(prev).set(npc.contractAddress, emptySlot));
            }
          }
          // LP drip to all heroes — player pays gas, gets LP
          sendLpRewards();
          winBattle();
        }}
        onLose={loseBattle}
      />
      </>
    );
  }

  // Reward
  if (state.phase === "reward" && encounter) {
    // Check if an NPC just joined from the previous encounter
    const prevEncounterIdx = state.currentEncounter - 1;
    const prevEncounter = prevEncounterIdx >= 0 ? chapter?.encounters[prevEncounterIdx] : null;
    const npcJoined = prevEncounter?.joinsParty
      ? characters.find(c => c.contractAddress.toLowerCase() === prevEncounter.joinsParty!.toLowerCase())
      : null;
    // Also check current encounter for joinsParty (reward shows after win)
    const currentNpcJoined = encounter.joinsParty
      ? characters.find(c => c.contractAddress.toLowerCase() === encounter.joinsParty!.toLowerCase())
      : null;
    const joinedNpc = currentNpcJoined || npcJoined;
    const didJoin = joinedNpc && party.some(p => p.contractAddress.toLowerCase() === joinedNpc.contractAddress.toLowerCase());

    return (
      <div className="flex flex-col items-center gap-6 mt-16">
        {floatingBack}
        <div className="text-5xl">🏆</div>
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>Victory!</h2>
        <div className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <p className="text-lg font-black" style={{ color: '#f0d070' }}>⚔️+1 🛡️+1 ❤️+1</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(201,168,76,0.5)' }}>Your heroes grow stronger!</p>
        </div>
        {didJoin && joinedNpc && (
          <div className="rounded-xl p-5 text-center"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)' }}>
            <p className="text-lg font-black" style={{ color: 'rgba(74,222,128,0.9)' }}>
              {joinedNpc.name} joined your party!
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(74,222,128,0.5)' }}>
              They&apos;ll fight alongside you for the rest of this adventure.
            </p>
          </div>
        )}
        {lpStatus && (
          <div className="rounded-xl p-4 text-center"
            style={{ background: lpStatus.includes("received") ? 'rgba(74,222,128,0.08)' : 'rgba(201,168,76,0.06)', border: `1px solid ${lpStatus.includes("received") ? 'rgba(74,222,128,0.3)' : 'rgba(201,168,76,0.2)'}` }}>
            <p className="text-xs font-bold" style={{ color: lpStatus.includes("received") ? 'rgba(74,222,128,0.9)' : 'rgba(201,168,76,0.7)' }}>
              {lpStatus}
            </p>
            {lpStatus.includes("leveled") && (
              <p className="text-xs mt-1" style={{ color: 'rgba(74,222,128,0.5)' }}>
                Stats permanently increased!
              </p>
            )}
          </div>
        )}
        <button onClick={nextEncounter}
          className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(201,168,76,0.3)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }}>
          Continue →
        </button>
      </div>
    );
  }

  // Chapter complete
  if (state.phase === "chapterComplete" && chapter) {

    return (
      <div className="flex flex-col items-center gap-6 mt-16">
        {floatingBack}
        <div className="text-5xl">👑</div>
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>Level Complete!</h2>
        <h3 className="text-lg font-bold" style={{ color: 'rgba(201,168,76,0.7)' }}>{chapter.title}</h3>
        <div className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <p className="text-lg font-black" style={{ color: '#f0d070' }}>Level Complete!</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(201,168,76,0.5)' }}>Your heroes grow stronger with every battle</p>
        </div>
        {lpStatus && (
          <div className="rounded-xl p-4 text-center"
            style={{ background: lpStatus.includes("received") ? 'rgba(74,222,128,0.08)' : 'rgba(201,168,76,0.06)', border: `1px solid ${lpStatus.includes("received") ? 'rgba(74,222,128,0.3)' : 'rgba(201,168,76,0.2)'}` }}>
            <p className="text-xs font-bold" style={{ color: lpStatus.includes("received") ? 'rgba(74,222,128,0.9)' : 'rgba(201,168,76,0.7)' }}>
              {lpStatus}
            </p>
            {lpStatus.includes("received") && (
              <p className="text-xs mt-1" style={{ color: 'rgba(74,222,128,0.5)' }}>
                AZOS/MfT LP permanently locked. Heroes rest at midnight UTC — stats update while they sleep.
              </p>
            )}
          </div>
        )}
        <button onClick={backToMap}
          className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(201,168,76,0.3)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }}>
          Continue Adventure →
        </button>
      </div>
    );
  }

  return null;
}
