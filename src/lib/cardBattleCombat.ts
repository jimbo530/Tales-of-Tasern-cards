import type { Board, BoardCard, CombatEvent } from "./cardBattleTypes";
import type { ComputedStats } from "./battleStats";
import type { BoonEffect } from "./impactBoons";

const SUPPORT_BONUS = 0.2;
const FIRE_DOT_TURNS = 2; // fire burns for 2 additional turns after initial hit

// ─── Boon Helpers ────────────────────────────────────────────────────────────

function hasBoon(card: BoardCard | null, type: BoonEffect["type"]): boolean {
  if (!card) return false;
  return card.boonEffects.some(e => e.type === type);
}

function getBoonSum(card: BoardCard, type: string, field: string): number {
  let sum = 0;
  for (const e of card.boonEffects) {
    if (e.type === type && field in e) sum += (e as any)[field];
  }
  return sum;
}

/** Get total elemental_resist % from all stacked boons (capped at 1.0) */
function getElementalResist(card: BoardCard): number {
  return Math.min(1, getBoonSum(card, "elemental_resist", "pct"));
}

/** Get total damage_shield % from all stacked boons */
function getDamageShield(card: BoardCard): number {
  return getBoonSum(card, "damage_shield", "pct");
}

/** Get extra fire DoT turns from boons */
function getFireExtend(card: BoardCard): number {
  let extra = 0;
  for (const e of card.boonEffects) {
    if (e.type === "dot_extend") extra += e.extraTurns;
  }
  return extra;
}

/** Get total thorns % */
function getThorns(card: BoardCard): number {
  return getBoonSum(card, "thorns", "pct");
}

/** Get support bonus increase from boons */
function getSupportBonusPct(card: BoardCard): number {
  return getBoonSum(card, "support_bonus_pct", "pct");
}

// ─── Core Combat ─────────────────────────────────────────────────────────────

function calcDamage(attacker: ComputedStats, defender: ComputedStats, defenderCard?: BoardCard | null): {
  phys: number; magic: number; electric: number; fire: number; mana: number;
} {
  const attackerHasSpecial = attacker.mAtk > 0 || attacker.eAtk > 0 || attacker.fAtk > 0;
  const defenderHasSpecial = defender.mAtk > 0 || defender.eAtk > 0 || defender.fAtk > 0;
  // Armor piercing reduces effective defense (PKT passive)
  const pierce = attacker.armorPierce;
  const effectiveDef = defender.def * (1 - pierce);
  const effectiveMDef = (defenderHasSpecial ? defender.mDef : defender.mDef + defender.mana) * (1 - pierce);
  const physArmor = defenderHasSpecial ? effectiveDef : effectiveDef + effectiveMDef * 0.5;

  const phys = attacker.attack * (100 / (100 + physArmor));
  const magic = attacker.mAtk * (100 / (100 + effectiveMDef));
  const electric = attacker.eAtk * (100 / (100 + effectiveMDef));
  const fire = attacker.fAtk * (100 / (100 + effectiveDef));
  const mana = attackerHasSpecial && attacker.mana > 0
    ? attacker.mana * (100 / (100 + effectiveMDef))
    : 0;

  // Boon: elemental_resist / elemental_immune — reduce all elemental damage
  let elemMult = 1;
  if (defenderCard) {
    if (hasBoon(defenderCard, "elemental_immune")) {
      elemMult = 0;
    } else {
      elemMult = 1 - getElementalResist(defenderCard);
    }
  }

  return {
    phys: Math.max(phys, 0.5),
    magic: Math.max(magic * elemMult, 0),
    electric: Math.max(electric * elemMult, 0),
    fire: Math.max(fire * elemMult, 0),
    mana: Math.max(mana * elemMult, 0),
  };
}

// Fortress takes raw damage — all types hit it
function calcFortressDamage(attacker: ComputedStats): number {
  const attackerHasSpecial = attacker.mAtk > 0 || attacker.eAtk > 0 || attacker.fAtk > 0;
  return attacker.attack + attacker.mAtk + attacker.eAtk + attacker.fAtk +
    (attackerHasSpecial ? attacker.mana : 0);
}

function getEffectiveStats(card: BoardCard, backRowCard: BoardCard | null): ComputedStats {
  if (!backRowCard) return card.stats;
  // Base support + boon bonus from either card
  const bonusPct = SUPPORT_BONUS
    + getSupportBonusPct(card)
    + getSupportBonusPct(backRowCard);
  return {
    ...card.stats,
    def: card.stats.def + backRowCard.stats.def * bonusPct,
    mDef: card.stats.mDef + backRowCard.stats.mDef * bonusPct,
  };
}

function addDamage(map: Map<string, number>, key: string, dmg: number) {
  map.set(key, (map.get(key) ?? 0) + dmg);
}

// Apply lightning splash to adjacent columns (heroes only, not fortress)
function applyLightningSplash(
  attackerCard: BoardCard,
  attackerStats: ComputedStats,
  col: number,
  defenderBoard: Board,
  damageMap: Map<string, number>,
  events: CombatEvent[],
  attackerPlayer: 1 | 2,
  attackerName: string,
) {
  if (attackerStats.eAtk <= 0) return;

  // Boon: splash_all → hit ALL columns, not just adjacent
  const splashAll = hasBoon(attackerCard, "splash_all");
  const targetCols = splashAll
    ? [0, 1, 2, 3, 4].filter(c => c !== col)
    : [col - 1, col + 1];

  for (const adjCol of targetCols) {
    if (adjCol < 0 || adjCol >= 5) continue;
    const adjFront = defenderBoard[adjCol][1];
    const adjBack = defenderBoard[adjCol][0];
    const adjTarget = adjFront ?? adjBack;
    if (!adjTarget) continue; // no hero = no splash (lightning doesn't hit fortress)

    const adjDefender = adjFront
      ? getEffectiveStats(adjFront, adjBack)
      : adjTarget.stats;
    const defenderHasSpecial = adjDefender.mAtk > 0 || adjDefender.eAtk > 0 || adjDefender.fAtk > 0;
    const effectiveMDef = defenderHasSpecial ? adjDefender.mDef : adjDefender.mDef + adjDefender.mana;
    let splashDmg = attackerStats.eAtk * (100 / (100 + effectiveMDef));

    // Reduce splash for non-adjacent when splash_all (diminishing)
    if (splashAll && Math.abs(adjCol - col) > 1) {
      splashDmg *= 0.5;
    }

    if (splashDmg > 0) {
      const targetKey = adjFront ? `${adjCol}-1` : `${adjCol}-0`;
      addDamage(damageMap, targetKey, splashDmg);
      events.push({
        col: adjCol, attackerPlayer, attackerName,
        targetName: `${adjTarget.character.name} ⚡`,
        physDmg: 0, magicDmg: splashDmg, fireDmg: 0, manaDmg: 0, totalDmg: splashDmg,
      });
    }
  }
}

// Boon: fire_splash — fire damage splashes to adjacent columns
function applyFireSplash(
  attackerCard: BoardCard,
  fireDmg: number,
  col: number,
  defenderBoard: Board,
  damageMap: Map<string, number>,
  events: CombatEvent[],
  attackerPlayer: 1 | 2,
  attackerName: string,
  newBoard: Board,
) {
  if (fireDmg <= 0 || !hasBoon(attackerCard, "fire_splash")) return;

  const splashFire = fireDmg * 0.5; // 50% of original fire to adjacent
  for (const adjCol of [col - 1, col + 1]) {
    if (adjCol < 0 || adjCol >= 5) continue;
    const adjFront = defenderBoard[adjCol][1];
    const adjBack = defenderBoard[adjCol][0];
    const adjTarget = adjFront ?? adjBack;
    if (!adjTarget) continue;

    const targetRow = adjFront ? 1 : 0;
    const targetKey = `${adjCol}-${targetRow}`;
    addDamage(damageMap, targetKey, splashFire);
    // Also apply fire DoT to splashed targets
    newBoard = addFireBurn(newBoard, adjCol, targetRow, splashFire, 0);
    events.push({
      col: adjCol, attackerPlayer, attackerName,
      targetName: `${adjTarget.character.name} 🔥`,
      physDmg: 0, magicDmg: 0, fireDmg: splashFire, manaDmg: 0, totalDmg: splashFire,
    });
  }
}

// Apply fire DoT burns stored on cards
function applyBurnDamage(
  board: Board,
  damageMap: Map<string, number>,
  events: CombatEvent[],
  attackerPlayer: 1 | 2,
): Board {
  return board.map((col, c) =>
    col.map((card, r) => {
      if (!card || card.burns.length === 0) return card;
      // Boon: elemental_immune — skip all elemental DoT
      if (hasBoon(card, "elemental_immune")) {
        return { ...card, burns: [] };
      }
      const burnDmg = card.burns[0];
      const remainingBurns = card.burns.slice(1);
      if (burnDmg > 0) {
        // Boon: elemental_resist — reduce elemental damage
        const resist = getElementalResist(card);
        const actualBurn = burnDmg * (1 - resist);
        if (actualBurn > 0) {
          addDamage(damageMap, `${c}-${r}`, actualBurn);
          events.push({
            col: c, attackerPlayer, attackerName: "🔥 Burn",
            targetName: card.character.name,
            physDmg: 0, magicDmg: 0, fireDmg: actualBurn, manaDmg: 0, totalDmg: actualBurn,
          });
        }
      }
      return { ...card, burns: remainingBurns };
    })
  );
}

// Store fire DoT on a target card — full damage for N turns
function addFireBurn(
  board: Board,
  col: number,
  row: number,
  fireDmg: number,
  extraTurns: number = 0,
): Board {
  if (fireDmg <= 0) return board;
  const totalTurns = FIRE_DOT_TURNS + extraTurns;
  const burns = Array(totalTurns).fill(fireDmg);
  return board.map((c, ci) =>
    c.map((card, ri) => {
      if (ci !== col || ri !== row || !card) return card;
      // Boon: elemental_immune — don't apply burns at all
      if (hasBoon(card, "elemental_immune")) return card;
      return { ...card, burns: [...card.burns, ...burns] };
    })
  );
}

// Non-stat boon effect types that can be granted via row_buff/col_buff auras
const AURA_EFFECT_TYPES: Record<string, BoonEffect["type"]> = {
  "damage_shield": "damage_shield",
  "elemental_resist": "elemental_resist",
  "regen": "regen",
};

function applyAuraBuff(ally: BoardCard, stat: string, pct: number) {
  // If it's a combat stat, modify the stat directly (% increase)
  const key = stat as keyof ComputedStats;
  if (key in ally.stats) {
    (ally.stats as any)[key] += (ally.stats as any)[key] * pct;
    return;
  }
  // If it's a boon effect type, inject a synthetic effect onto the ally
  const effectType = AURA_EFFECT_TYPES[stat];
  if (effectType === "damage_shield") {
    ally.boonEffects = [...ally.boonEffects, { type: "damage_shield", pct }];
  } else if (effectType === "elemental_resist") {
    ally.boonEffects = [...ally.boonEffects, { type: "elemental_resist", pct }];
  } else if (effectType === "regen") {
    // Regen aura: ally heals X% of THEIR max HP per turn
    ally.stats.healing += ally.stats.hp * pct;
  }
}

// Apply row/col buff boons before combat (modifies stats in place on cloned board)
function applyAuraBuffs(board: Board): Board {
  // Collect buffs from all cards
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 2; row++) {
      const card = board[col][row];
      if (!card) continue;
      for (const effect of card.boonEffects) {
        if (effect.type === "row_buff") {
          // Buff all OTHER cards in same row
          for (let c2 = 0; c2 < 5; c2++) {
            const ally = board[c2][row];
            if (!ally || ally === card) continue;
            applyAuraBuff(ally, effect.stat, effect.pct);
          }
        } else if (effect.type === "col_buff") {
          // Buff all OTHER cards in same column
          for (let r2 = 0; r2 < 2; r2++) {
            const ally = board[col][r2];
            if (!ally || ally === card) continue;
            applyAuraBuff(ally, effect.stat, effect.pct);
          }
        }
      }
    }
  }
  return board;
}

// Apply damage to a card, respecting damage_shield, last_stand, burst_heal, and revive boons
function applyDamageToCard(card: BoardCard, damage: number): BoardCard {
  if (damage <= 0) return card;
  let updated = { ...card };

  // Boon: damage_shield — absorb first X% of incoming damage
  const shield = getDamageShield(updated);
  if (shield > 0) {
    const absorbed = damage * shield;
    damage = Math.max(0, damage - absorbed);
  }

  updated.currentHp -= damage;

  // Boon: burst_heal — heal when dropping below 50% HP (once per battle)
  if (updated.currentHp > 0 && updated.currentHp < updated.maxHp * 0.5 && !updated.burstHealUsed) {
    for (const e of updated.boonEffects) {
      if (e.type === "burst_heal" && e.once) {
        updated.currentHp += updated.maxHp * e.hpPct;
        updated.burstHealUsed = true;
        break;
      }
    }
  }

  // Boon: last_stand — survive lethal hit at 1 HP
  if (updated.currentHp <= 0 && !updated.lastStandUsed && hasBoon(updated, "last_stand")) {
    updated.currentHp = 1;
    updated.lastStandUsed = true;
  }

  // Boon: revive — come back at X% HP after death
  if (updated.currentHp <= 0 && !updated.reviveUsed) {
    for (const e of updated.boonEffects) {
      if (e.type === "revive") {
        updated.currentHp = updated.maxHp * e.hpPct;
        updated.reviveUsed = true;
        break;
      }
    }
  }

  return updated;
}

export function resolveCombat(
  board1: Board,
  board2: Board,
): { events: CombatEvent[]; board1Damage: Map<string, number>; board2Damage: Map<string, number>; fortress1Dmg: number; fortress2Dmg: number; newBoard1: Board; newBoard2: Board } {
  const events: CombatEvent[] = [];
  const board1Damage = new Map<string, number>();
  const board2Damage = new Map<string, number>();
  let fortress1Dmg = 0;
  let fortress2Dmg = 0;

  // Clone boards — deep copy stats so aura buffs don't persist between turns
  let b1 = board1.map((col) => col.map((card) => card ? {
    ...card,
    stats: { ...card.stats },
    burns: [...card.burns],
    boonEffects: card.boonEffects,
  } : null));
  let b2 = board2.map((col) => col.map((card) => card ? {
    ...card,
    stats: { ...card.stats },
    burns: [...card.burns],
    boonEffects: card.boonEffects,
  } : null));

  // Phase 0a: Apply aura buffs (row_buff, col_buff) to cloned stats
  b1 = applyAuraBuffs(b1);
  b2 = applyAuraBuffs(b2);

  // Phase 0b: Healing — each card heals itself, overflow to adjacent columns same row
  for (const board of [b1, b2]) {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 2; row++) {
        const card = board[col][row];
        if (!card || card.currentHp <= 0 || !card.stats.healing || card.stats.healing <= 0) continue;
        let healAmt = card.stats.healing;
        const missing = card.maxHp - card.currentHp;
        if (missing > 0) {
          const selfHeal = Math.min(healAmt, missing);
          card.currentHp += selfHeal;
          healAmt -= selfHeal;
        }
        // Overflow to adjacent columns same row
        if (healAmt > 0) {
          for (const adjCol of [col - 1, col + 1]) {
            if (adjCol < 0 || adjCol >= 5 || healAmt <= 0) continue;
            const adj = board[adjCol][row];
            if (!adj || adj.currentHp <= 0) continue;
            const adjMissing = adj.maxHp - adj.currentHp;
            if (adjMissing > 0) {
              const adjHeal = Math.min(healAmt, adjMissing);
              adj.currentHp += adjHeal;
              healAmt -= adjHeal;
            }
          }
        }
      }
    }
  }

  // Phase 1: Resolve existing burns
  b1 = applyBurnDamage(b1, board1Damage, events, 2); // P2's fire is burning P1's cards
  b2 = applyBurnDamage(b2, board2Damage, events, 1); // P1's fire is burning P2's cards

  // Phase 2: Normal combat per column
  for (let col = 0; col < 5; col++) {
    const p1Front = b1[col][1];
    const p1Back = b1[col][0];
    const p2Front = b2[col][1];
    const p2Back = b2[col][0];

    // Determine attack order — first_strike boon goes first
    const p1First = hasBoon(p1Front, "first_strike");
    const p2First = hasBoon(p2Front, "first_strike");
    // If both or neither have first_strike, simultaneous (default)
    // If only one has it, they attack first
    const attackOrder: [1 | 2, 1 | 2] = (p1First && !p2First)
      ? [1, 2]
      : (p2First && !p1First)
        ? [2, 1]
        : [1, 2]; // simultaneous default

    for (const attPlayer of attackOrder) {
      const attackerFront = attPlayer === 1 ? p1Front : p2Front;
      const attackerBack = attPlayer === 1 ? p1Back : p2Back;
      const defenderFront = attPlayer === 1 ? p2Front : p1Front;
      const defenderBack = attPlayer === 1 ? p2Back : p1Back;
      const defenderDamageMap = attPlayer === 1 ? board2Damage : board1Damage;
      let defenderBoard = attPlayer === 1 ? b2 : b1;

      if (!attackerFront) continue;

      const target = defenderFront ?? defenderBack;
      if (target) {
        const effectiveDefender = defenderFront
          ? getEffectiveStats(defenderFront, defenderBack)
          : target.stats;
        const dmg = calcDamage(attackerFront.stats, effectiveDefender, target);

        const total = dmg.phys + dmg.magic + dmg.fire + dmg.mana;
        const targetRow = defenderFront ? 1 : 0;
        const targetKey = `${col}-${targetRow}`;
        addDamage(defenderDamageMap, targetKey, total);

        // Store fire DoT on target (with boon extend)
        if (dmg.fire > 0) {
          const extraTurns = getFireExtend(attackerFront);
          defenderBoard = addFireBurn(defenderBoard, col, targetRow, dmg.fire, extraTurns);
          if (attPlayer === 1) b2 = defenderBoard; else b1 = defenderBoard;
        }

        events.push({
          col, attackerPlayer: attPlayer, attackerName: attackerFront.character.name,
          targetName: target.character.name,
          physDmg: dmg.phys, magicDmg: dmg.magic, fireDmg: dmg.fire, manaDmg: dmg.mana, totalDmg: total,
        });

        // Lightning splash
        applyLightningSplash(attackerFront, attackerFront.stats, col, defenderBoard, defenderDamageMap, events, attPlayer, attackerFront.character.name);

        // Fire splash boon
        applyFireSplash(attackerFront, dmg.fire, col, defenderBoard, defenderDamageMap, events, attPlayer, attackerFront.character.name, defenderBoard);

        // Thorns — attacker takes reflected damage
        const thorns = getThorns(target);
        if (thorns > 0 && total > 0) {
          const thornsDmg = total * thorns;
          const attackerDamageMap = attPlayer === 1 ? board1Damage : board2Damage;
          addDamage(attackerDamageMap, `${col}-1`, thornsDmg); // front row
          events.push({
            col, attackerPlayer: attPlayer === 1 ? 2 : 1,
            attackerName: `${target.character.name} 🌿`,
            targetName: attackerFront.character.name,
            physDmg: thornsDmg, magicDmg: 0, fireDmg: 0, manaDmg: 0, totalDmg: thornsDmg,
          });
        }
      } else {
        // No cards — attack fortress (no lightning, no fire DoT on fortress)
        const dmg = calcFortressDamage(attackerFront.stats);
        if (attPlayer === 1) fortress2Dmg += dmg; else fortress1Dmg += dmg;
        events.push({
          col, attackerPlayer: attPlayer, attackerName: attackerFront.character.name,
          targetName: "Fortress",
          physDmg: dmg, magicDmg: 0, fireDmg: 0, manaDmg: 0, totalDmg: dmg,
        });
      }
    }
  }

  // Phase 3: Apply accumulated damage to cards (with boon survival mechanics)
  // Damage is applied HERE so boon effects (last_stand, revive, etc.) are handled.
  // The returned boards have damage already applied — callers should NOT re-apply.
  for (const [board, damageMap] of [[b1, board1Damage], [b2, board2Damage]] as [Board, Map<string, number>][]) {
    for (const [key, dmg] of damageMap.entries()) {
      const [colStr, rowStr] = key.split("-");
      const col = parseInt(colStr), row = parseInt(rowStr);
      const card = board[col]?.[row];
      if (!card) continue;
      const updated = applyDamageToCard(card, dmg);
      board[col][row] = updated.currentHp <= 0 ? null : updated;
    }
  }

  return { events, board1Damage, board2Damage, fortress1Dmg, fortress2Dmg, newBoard1: b1, newBoard2: b2 };
}
