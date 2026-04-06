import { computeStats, type ComputedStats } from "./battleStats";
import type { NftCharacter } from "@/hooks/useNftStats";
import type { BoonEffect } from "./impactBoons";

export type CombatUnit = {
  character: NftCharacter;
  stats: ComputedStats;
  currentHp: number;
  maxHp: number;
  isPlayer: boolean;
  index: number;
  burns: number[]; // fire DoT
  gridPos: number; // 0-8 position on 3x3 grid (0=front-left, 2=front-right, 6=back-left, 8=back-right)
  // Boon combat state
  boonEffects: BoonEffect[];
  lastStandUsed: boolean;
  reviveUsed: boolean;
  burstHealUsed: boolean;
  damageShieldRemaining: number;
};

export type CombatEvent = {
  attackerName: string;
  targetName: string;
  damage: number;
  damageType: "physical" | "electric" | "fire" | "mana" | "burn";
  targetHpAfter: number;
  killed: boolean;
};

export function makeUnit(char: NftCharacter, isPlayer: boolean, index: number): CombatUnit {
  const allBoonEffects: BoonEffect[] = (char.boons ?? []).flatMap(b => b.allEffects);
  const stats = computeStats(char.stats, allBoonEffects);
  return {
    character: char, stats, currentHp: stats.hp, maxHp: stats.hp,
    isPlayer, index, burns: [], gridPos: -1,
    boonEffects: allBoonEffects,
    lastStandUsed: false, reviveUsed: false, burstHealUsed: false,
    damageShieldRemaining: 0,
  };
}

// ─── Boon Helpers ─────────────────────────────────────────────────────────────

function hasBoon(unit: CombatUnit, type: string): boolean {
  return unit.boonEffects.some(e => e.type === type);
}

function getBoonSum(unit: CombatUnit, type: string, field: string): number {
  return unit.boonEffects
    .filter(e => e.type === type)
    .reduce((sum, e) => sum + ((e as Record<string, unknown>)[field] as number ?? 0), 0);
}

function getElementalResist(unit: CombatUnit): number {
  if (hasBoon(unit, "elemental_immune")) return 1;
  return Math.min(1, getBoonSum(unit, "elemental_resist", "pct"));
}

/** Reduce incoming damage through elemental resist and damage shield */
function reduceDamage(target: CombatUnit, dmg: number, isElemental: boolean): number {
  if (isElemental) {
    const resist = getElementalResist(target);
    if (resist >= 1) return 0;
    if (resist > 0) dmg *= (1 - resist);
  }
  if (target.damageShieldRemaining > 0) {
    const absorbed = Math.min(dmg, target.damageShieldRemaining);
    target.damageShieldRemaining -= absorbed;
    dmg -= absorbed;
  }
  return dmg;
}

/** Check survival boons after taking damage */
function checkSurvival(target: CombatUnit, events: CombatEvent[]): void {
  // Burst heal: once per battle when dropping below 50% HP
  if (!target.burstHealUsed && target.currentHp > 0 && target.currentHp < target.maxHp * 0.5) {
    const healPct = getBoonSum(target, "burst_heal", "hpPct");
    if (healPct > 0) {
      const heal = target.maxHp * healPct;
      target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
      target.burstHealUsed = true;
      events.push({ attackerName: "\u{1F49A} Burst Heal", targetName: target.character.name, damage: heal, damageType: "physical", targetHpAfter: target.currentHp, killed: false });
    }
  }
  // Last stand: survive lethal hit at 1 HP once
  if (target.currentHp <= 0 && !target.lastStandUsed && hasBoon(target, "last_stand")) {
    target.currentHp = 1;
    target.lastStandUsed = true;
    events.push({ attackerName: "\u26A1 Last Stand", targetName: target.character.name, damage: 0, damageType: "physical", targetHpAfter: 1, killed: false });
  }
  // Revive: come back at X% HP once
  if (target.currentHp <= 0 && !target.reviveUsed) {
    const reviveHpPct = getBoonSum(target, "revive", "hpPct");
    if (reviveHpPct > 0) {
      target.currentHp = Math.floor(target.maxHp * reviveHpPct);
      target.reviveUsed = true;
      events.push({ attackerName: "\u2728 Revive", targetName: target.character.name, damage: 0, damageType: "physical", targetHpAfter: target.currentHp, killed: false });
    }
  }
}

// ─── D20 & Grid Helpers ──────────────────────────────────────────────────────

/** Roll 1-20: 1=miss, 20=crit (2x), else normal */
function rollD20(): { roll: number; mult: number; label: string } {
  const roll = Math.floor(Math.random() * 20) + 1;
  if (roll === 1) return { roll, mult: 0, label: "MISS" };
  if (roll === 20) return { roll, mult: 2, label: "CRIT" };
  return { roll, mult: 1, label: "" };
}

/** Check if attacker is flanking: no enemy directly ahead in same column */
function isFlanking(attacker: CombatUnit, opponents: CombatUnit[]): boolean {
  if (attacker.gridPos < 0) return false;
  const col = gridCol(attacker.gridPos);
  const blocking = opponents.filter(o =>
    o.currentHp > 0 && o.gridPos >= 0 &&
    gridCol(o.gridPos) === col && gridRow(o.gridPos) === 0
  );
  return blocking.length === 0;
}

function calcDamage(attacker: ComputedStats, defender: ComputedStats): {
  phys: number; magic: number; electric: number; fire: number; mana: number;
} {
  const attackerHasSpecial = attacker.mAtk > 0 || attacker.eAtk > 0 || attacker.fAtk > 0;
  const defenderHasSpecial = defender.mAtk > 0 || defender.eAtk > 0 || defender.fAtk > 0;
  const pierce = attacker.armorPierce;
  const effectiveDef = defender.def * (1 - pierce);
  const effectiveMDef = (defenderHasSpecial ? defender.mDef : defender.mDef + defender.mana) * (1 - pierce);
  const physArmor = defenderHasSpecial ? effectiveDef : effectiveDef + effectiveMDef * 0.5;

  return {
    phys: Math.max(attacker.attack * (100 / (100 + physArmor)), 0.5),
    magic: Math.max(attacker.mAtk * (100 / (100 + effectiveMDef)), 0),
    electric: Math.max(attacker.eAtk * (100 / (100 + effectiveMDef)), 0),
    fire: Math.max(attacker.fAtk * (100 / (100 + effectiveDef)), 0),
    mana: attackerHasSpecial && attacker.mana > 0 ? Math.max(attacker.mana * (100 / (100 + effectiveMDef)), 0) : 0,
  };
}

// Grid helpers: 3x3 grid, rows 0=front, 1=mid, 2=back
export function gridRow(pos: number): number { return Math.floor(pos / 3); }
export function gridCol(pos: number): number { return pos % 3; }

/** Get valid moves from a grid position (1 square: up/down/left/right) */
export function getValidMoves(pos: number, occupied: Set<number>): number[] {
  const row = gridRow(pos);
  const col = gridCol(pos);
  const moves: number[] = [];
  if (row > 0) moves.push((row - 1) * 3 + col); // forward
  if (row < 2) moves.push((row + 1) * 3 + col); // backward
  if (col > 0) moves.push(row * 3 + (col - 1)); // left
  if (col < 2) moves.push(row * 3 + (col + 1)); // right
  return moves.filter(m => !occupied.has(m));
}

/** Find forward attack target: front row (row 0) attacks matching column, then adjacent columns */
function pickForwardTarget(attacker: CombatUnit, enemies: CombatUnit[]): CombatUnit | null {
  if (attacker.gridPos < 0) return pickTargetByHp(enemies);
  const col = gridCol(attacker.gridPos);
  const alive = enemies.filter(e => e.currentHp > 0 && e.gridPos >= 0);
  if (alive.length === 0) return pickTargetByHp(enemies);

  const sameColFront = alive.filter(e => gridCol(e.gridPos) === col && gridRow(e.gridPos) === 0);
  if (sameColFront.length > 0) return sameColFront.reduce((a, b) => a.currentHp < b.currentHp ? a : b);

  const sameCol = alive.filter(e => gridCol(e.gridPos) === col);
  if (sameCol.length > 0) return sameCol.reduce((a, b) => gridRow(a.gridPos) < gridRow(b.gridPos) ? a : b);

  const adjCol = alive.filter(e => Math.abs(gridCol(e.gridPos) - col) === 1);
  if (adjCol.length > 0) return adjCol.reduce((a, b) => a.currentHp < b.currentHp ? a : b);

  return alive.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
}

/** Pick target: alive enemy with lowest HP (fallback) */
function pickTargetByHp(enemies: CombatUnit[]): CombatUnit | null {
  const alive = enemies.filter(e => e.currentHp > 0);
  if (alive.length === 0) return null;
  return alive.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
}

/** Can this unit attack? Must be in front row (row 0) or no one in front of them */
export function canAttack(unit: CombatUnit, allies: CombatUnit[]): boolean {
  if (unit.gridPos < 0) return true;
  const row = gridRow(unit.gridPos);
  if (row === 0) return true;
  const col = gridCol(unit.gridPos);
  const aliveAhead = allies.filter(a =>
    a.currentHp > 0 && a.gridPos >= 0 && a.index !== unit.index &&
    gridCol(a.gridPos) === col && gridRow(a.gridPos) < row
  );
  return aliveAhead.length === 0;
}

// ─── Combat Resolution ───────────────────────────────────────────────────────

/** Resolve one full round of combat
 * @param targetMap — maps player index to enemy index they want to attack. If not provided, auto-targets lowest HP.
 */
export function resolveRound(
  players: CombatUnit[],
  enemies: CombatUnit[],
  targetMap?: Map<number, number>,
): { events: CombatEvent[]; players: CombatUnit[]; enemies: CombatUnit[] } {
  const events: CombatEvent[] = [];
  const p = players.map(u => ({ ...u, burns: [...u.burns], boonEffects: [...u.boonEffects] }));
  const e = enemies.map(u => ({ ...u, burns: [...u.burns], boonEffects: [...u.boonEffects] }));

  // ── Rally (DDD) — shares % of all 4 stats to every ally on the grid, divided by 4 ──
  for (const units of [p, e]) {
    for (const u of units) {
      if (u.currentHp <= 0 || u.gridPos < 0 || !u.stats.rally || u.stats.rally <= 0) continue;
      const r = u.stats.rally / 4;
      const atkBonus = u.stats.attack * r;
      const defBonus = u.stats.def * r;
      const mAtkBonus = u.stats.mAtk * r;
      const mDefBonus = u.stats.mDef * r;
      for (const ally of units) {
        if (ally === u || ally.currentHp <= 0 || ally.gridPos < 0) continue;
        ally.stats = {
          ...ally.stats,
          attack: ally.stats.attack + atkBonus,
          def: ally.stats.def + defBonus,
          mAtk: ally.stats.mAtk + mAtkBonus,
          mDef: ally.stats.mDef + mDefBonus,
        };
      }
    }
  }

  // ── Shield Wall (LGP) — shares DEF to allies in the same column ──
  for (const units of [p, e]) {
    for (const u of units) {
      if (u.currentHp <= 0 || u.gridPos < 0 || !u.stats.shieldWall || u.stats.shieldWall <= 0) continue;
      const bonus = u.stats.def * u.stats.shieldWall;
      const col = gridCol(u.gridPos);
      for (const ally of units) {
        if (ally === u || ally.currentHp <= 0 || ally.gridPos < 0) continue;
        if (gridCol(ally.gridPos) === col) {
          ally.stats = { ...ally.stats, def: ally.stats.def + bonus };
        }
      }
    }
  }

  // ── Magic Shield (IGS) — shares MDEF to allies in the same row ──
  for (const units of [p, e]) {
    for (const u of units) {
      if (u.currentHp <= 0 || u.gridPos < 0 || !u.stats.magicShield || u.stats.magicShield <= 0) continue;
      const bonus = u.stats.mDef * u.stats.magicShield;
      const row = gridRow(u.gridPos);
      for (const ally of units) {
        if (ally === u || ally.currentHp <= 0 || ally.gridPos < 0) continue;
        if (gridRow(ally.gridPos) === row) {
          ally.stats = { ...ally.stats, mDef: ally.stats.mDef + bonus };
        }
      }
    }
  }

  // ── Row/Col Buff Auras (impact boons) ──
  const NON_STAT_AURAS: Record<string, (pct: number) => BoonEffect> = {
    damage_shield: (pct) => ({ type: "damage_shield", pct }),
    elemental_resist: (pct) => ({ type: "elemental_resist", pct }),
    regen: (pct) => ({ type: "regen", hpPct: pct }),
  };
  for (const units of [p, e]) {
    for (const u of units) {
      if (u.currentHp <= 0 || u.gridPos < 0) continue;
      for (const eff of u.boonEffects) {
        if (eff.type !== "row_buff" && eff.type !== "col_buff") continue;
        const matchFn = eff.type === "row_buff"
          ? (a: CombatUnit) => gridRow(a.gridPos) === gridRow(u.gridPos)
          : (a: CombatUnit) => gridCol(a.gridPos) === gridCol(u.gridPos);
        for (const ally of units) {
          if (ally === u || ally.currentHp <= 0 || ally.gridPos < 0 || !matchFn(ally)) continue;
          const factory = NON_STAT_AURAS[eff.stat];
          if (factory) {
            ally.boonEffects.push(factory(eff.pct));
          } else {
            const current = (ally.stats as Record<string, unknown>)[eff.stat];
            if (typeof current === "number") {
              ally.stats = { ...ally.stats, [eff.stat]: current * (1 + eff.pct) };
            }
          }
        }
      }
    }
  }

  // ── Damage Shield Setup (reset each round) ──
  for (const units of [p, e]) {
    for (const u of units) {
      if (u.currentHp <= 0) continue;
      const shieldPct = getBoonSum(u, "damage_shield", "pct");
      u.damageShieldRemaining = shieldPct > 0 ? u.maxHp * shieldPct : 0;
    }
  }

  // ── Healing — heal self, overflow to adjacent allies ──
  for (const units of [p, e]) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.currentHp <= 0 || !u.stats.healing || u.stats.healing <= 0) continue;
      let healAmt = u.stats.healing;
      const missing = u.maxHp - u.currentHp;
      if (missing > 0) {
        const selfHeal = Math.min(healAmt, missing);
        u.currentHp += selfHeal;
        healAmt -= selfHeal;
        if (selfHeal > 0) events.push({ attackerName: "\u{1F49A} Heal", targetName: u.character.name, damage: selfHeal, damageType: "physical", targetHpAfter: u.currentHp, killed: false });
      }
      if (healAmt > 0) {
        for (const adj of [i - 1, i + 1]) {
          if (adj < 0 || adj >= units.length || healAmt <= 0) continue;
          const ally = units[adj];
          if (ally.currentHp <= 0) continue;
          const allyMissing = ally.maxHp - ally.currentHp;
          if (allyMissing > 0) {
            const adjHeal = Math.min(healAmt, allyMissing);
            ally.currentHp += adjHeal;
            healAmt -= adjHeal;
            if (adjHeal > 0) events.push({ attackerName: "\u{1F49A} Heal", targetName: ally.character.name, damage: adjHeal, damageType: "physical", targetHpAfter: ally.currentHp, killed: false });
          }
        }
      }
    }
  }

  // ── AOE Damage (DHG) — hits every enemy on the grid ──
  const aoePairs: [CombatUnit[], CombatUnit[]][] = [[p, e], [e, p]];
  for (const [attackers, defenders] of aoePairs) {
    for (const u of attackers) {
      if (u.currentHp <= 0 || u.gridPos < 0 || !u.stats.aoeDamage || u.stats.aoeDamage <= 0) continue;
      const dmg = u.stats.aoeDamage;
      for (const target of defenders) {
        if (target.currentHp <= 0 || target.gridPos < 0) continue;
        target.currentHp = Math.max(0, target.currentHp - dmg);
        events.push({ attackerName: `\u{1F4A5} ${u.character.name}`, targetName: target.character.name, damage: dmg, damageType: "mana", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
      }
    }
  }

  // ── Burn Resolution — respects elemental resist/immune ──
  for (const units of [p, e]) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.currentHp <= 0 || u.burns.length === 0) continue;
      // Immune: clear all burns, skip damage
      if (hasBoon(u, "elemental_immune")) {
        u.burns = [];
        continue;
      }
      const stacks = new Map<number, number>();
      for (const b of u.burns) stacks.set(b, (stacks.get(b) || 0) + 1);
      let stackDmg = 0;
      const remaining: number[] = [];
      for (const [dmg, count] of stacks) {
        stackDmg += dmg;
        for (let t = 0; t < count - 1; t++) remaining.push(dmg);
      }
      u.burns = remaining;
      // Elemental resist reduces burn damage
      const resist = Math.min(1, getBoonSum(u, "elemental_resist", "pct"));
      if (resist > 0) stackDmg *= (1 - resist);
      // Damage shield absorbs burn damage too
      if (u.damageShieldRemaining > 0) {
        const absorbed = Math.min(stackDmg, u.damageShieldRemaining);
        u.damageShieldRemaining -= absorbed;
        stackDmg -= absorbed;
      }
      u.currentHp = Math.max(0, u.currentHp - stackDmg);
      events.push({
        attackerName: `\u{1F525} Burn (\u00D7${stacks.size})`, targetName: u.character.name,
        damage: stackDmg, damageType: "burn", targetHpAfter: u.currentHp, killed: u.currentHp <= 0,
      });
      checkSurvival(u, events);
    }
  }

  // ── Attack Phase ──
  // Shared attack logic for both sides — handles all damage types, boon effects, and splash
  function executeAttack(
    attacker: CombatUnit,
    opponents: CombatUnit[],
    chooseTarget: () => CombatUnit | null,
  ) {
    if (attacker.currentHp <= 0) return;
    const target = chooseTarget();
    if (!target) return;

    const { roll, mult, label } = rollD20();
    if (mult === 0) {
      events.push({ attackerName: `\u{1F3B2}${roll} ${attacker.character.name}`, targetName: target.character.name, damage: 0, damageType: "physical", targetHpAfter: target.currentHp, killed: false });
      return;
    }

    const flanking = isFlanking(attacker, opponents);
    const flankMult = flanking ? 1.5 : 1;
    const totalMult = mult * flankMult;
    const rollPrefix = `\u{1F3B2}${roll}${label ? ` ${label}` : ""}${flanking ? " FLANK" : ""} `;

    const dmg = calcDamage(attacker.stats, target.stats);
    let totalDealt = 0;

    // Physical — not elemental, only reduced by damage shield
    if (dmg.phys > 0) {
      let d = reduceDamage(target, dmg.phys * totalMult, false);
      target.currentHp = Math.max(0, target.currentHp - d);
      totalDealt += d;
      events.push({ attackerName: rollPrefix + attacker.character.name, targetName: target.character.name, damage: d, damageType: "physical", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
    }

    // Magic (force) — elemental, reduced by resist + shield
    if (dmg.magic > 0) {
      let d = reduceDamage(target, dmg.magic * totalMult, true);
      target.currentHp = Math.max(0, target.currentHp - d);
      totalDealt += d;
      events.push({ attackerName: rollPrefix + attacker.character.name, targetName: target.character.name, damage: d, damageType: "mana", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
    }

    // Electric — elemental, splashes to adjacent (or ALL with splash_all boon)
    if (dmg.electric > 0) {
      const rawElec = dmg.electric * totalMult;
      let d = reduceDamage(target, rawElec, true);
      target.currentHp = Math.max(0, target.currentHp - d);
      totalDealt += d;
      events.push({ attackerName: rollPrefix + attacker.character.name, targetName: target.character.name, damage: d, damageType: "electric", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
      // Splash — 50% of raw damage, each splash target applies own resist
      const targetCol = target.gridPos >= 0 ? gridCol(target.gridPos) : -1;
      const splashAll = hasBoon(attacker, "splash_all");
      const splashTargets = opponents.filter(x =>
        x.currentHp > 0 && x.index !== target.index &&
        (x.gridPos < 0 || targetCol < 0 || splashAll || Math.abs(gridCol(x.gridPos) - targetCol) === 1)
      );
      for (const splash of splashTargets) {
        let splashDmg = reduceDamage(splash, rawElec * 0.5, true);
        splash.currentHp = Math.max(0, splash.currentHp - splashDmg);
        events.push({ attackerName: attacker.character.name, targetName: `${splash.character.name} \u26A1`, damage: splashDmg, damageType: "electric", targetHpAfter: splash.currentHp, killed: splash.currentHp <= 0 });
        checkSurvival(splash, events);
      }
    }

    // Fire — elemental, burn DoT, optional fire_splash and dot_extend boons
    if (dmg.fire > 0) {
      const rawFire = dmg.fire * totalMult;
      let d = reduceDamage(target, rawFire, true);
      target.currentHp = Math.max(0, target.currentHp - d);
      totalDealt += d;
      // Burn ticks use raw damage — resist is applied during tick resolution
      const extraTicks = getBoonSum(attacker, "dot_extend", "extraTurns");
      const burnTicks = 3 + extraTicks;
      if (!hasBoon(target, "elemental_immune")) {
        for (let t = 0; t < burnTicks; t++) target.burns.push(rawFire);
      }
      events.push({ attackerName: rollPrefix + attacker.character.name, targetName: target.character.name, damage: d, damageType: "fire", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
      // Fire splash boon — splash to adjacent column enemies
      if (hasBoon(attacker, "fire_splash")) {
        const targetCol = target.gridPos >= 0 ? gridCol(target.gridPos) : -1;
        const fireSplashTargets = opponents.filter(x =>
          x.currentHp > 0 && x.index !== target.index && x.gridPos >= 0 &&
          targetCol >= 0 && Math.abs(gridCol(x.gridPos) - targetCol) === 1
        );
        for (const splash of fireSplashTargets) {
          const rawSplash = rawFire * 0.5;
          let splashDmg = reduceDamage(splash, rawSplash, true);
          splash.currentHp = Math.max(0, splash.currentHp - splashDmg);
          if (!hasBoon(splash, "elemental_immune")) {
            for (let t = 0; t < burnTicks; t++) splash.burns.push(rawSplash);
          }
          events.push({ attackerName: attacker.character.name, targetName: `${splash.character.name} \u{1F525}`, damage: splashDmg, damageType: "fire", targetHpAfter: splash.currentHp, killed: splash.currentHp <= 0 });
          checkSurvival(splash, events);
        }
      }
    }

    // Mana — elemental
    if (dmg.mana > 0) {
      let d = reduceDamage(target, dmg.mana * totalMult, true);
      target.currentHp = Math.max(0, target.currentHp - d);
      totalDealt += d;
      events.push({ attackerName: rollPrefix + attacker.character.name, targetName: target.character.name, damage: d, damageType: "mana", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
    }

    // Thorns — reflect % of damage dealt back to attacker
    const thornsPct = getBoonSum(target, "thorns", "pct");
    if (thornsPct > 0 && totalDealt > 0 && target.currentHp > 0) {
      const thornsDmg = totalDealt * thornsPct;
      attacker.currentHp = Math.max(0, attacker.currentHp - thornsDmg);
      events.push({ attackerName: "\u{1F33F} Thorns", targetName: attacker.character.name, damage: thornsDmg, damageType: "physical", targetHpAfter: attacker.currentHp, killed: attacker.currentHp <= 0 });
      checkSurvival(attacker, events);
    }

    // Lifesteal (OGC passive) — heal attacker for % of total damage dealt
    if (attacker.stats.lifesteal > 0 && totalDealt > 0) {
      const stolen = Math.min(totalDealt * attacker.stats.lifesteal, attacker.maxHp - attacker.currentHp);
      if (stolen > 0) {
        attacker.currentHp += stolen;
        events.push({ attackerName: "\u{1FA78} Drain", targetName: attacker.character.name, damage: stolen, damageType: "physical", targetHpAfter: attacker.currentHp, killed: false });
      }
    }

    // Check survival boons for main target after all damage
    checkSurvival(target, events);
  }

  // Sort units so first_strike boon holders attack first
  const sortByFirstStrike = (units: CombatUnit[]) =>
    [...units].sort((a, b) => {
      const aFS = hasBoon(a, "first_strike") ? 1 : 0;
      const bFS = hasBoon(b, "first_strike") ? 1 : 0;
      return bFS - aFS;
    });

  // Players attack enemies
  for (const player of sortByFirstStrike(p)) {
    executeAttack(player, e, () => {
      if (targetMap && targetMap.has(player.index)) {
        const chosenIdx = targetMap.get(player.index)!;
        const chosen = e[chosenIdx];
        return chosen && chosen.currentHp > 0 ? chosen : pickForwardTarget(player, e);
      }
      return pickForwardTarget(player, e);
    });
  }

  // Enemies attack players
  for (const enemy of sortByFirstStrike(e)) {
    if (enemy.gridPos === -1) continue;
    executeAttack(enemy, p, () => pickForwardTarget(enemy, p));
  }

  // ── Bring reserves onto the grid to fill empty spots ──
  const occupiedEnemyPos = new Set(e.filter(u => u.currentHp > 0 && u.gridPos >= 0).map(u => u.gridPos));
  const backfillPositions = [1, 0, 2, 4, 3, 5, 7, 6, 8].filter(pos => !occupiedEnemyPos.has(pos));
  for (const reserve of e) {
    if (reserve.gridPos !== -1 || reserve.currentHp <= 0 || backfillPositions.length === 0) continue;
    reserve.gridPos = backfillPositions.shift()!;
    events.push({
      attackerName: "\u{1F4E2} Reinforcement", targetName: reserve.character.name,
      damage: 0, damageType: "physical", targetHpAfter: reserve.currentHp, killed: false,
    });
  }

  return { events, players: p, enemies: e };
}

/** Generate enemy party based on encounter settings */
export function generateEnemies(
  allCharacters: NftCharacter[],
  playerCount: number,
  _aiStrength: number,
  aiDeckBias: string,
  npcAddress?: string,
  npcAddresses?: string[],
): CombatUnit[] {
  // Multiple named NPCs — first 9 on grid, rest are reserves (gridPos = -1)
  if (npcAddresses && npcAddresses.length > 0) {
    const positions = [1, 0, 2, 4, 3, 5, 7, 6, 8];
    const units: CombatUnit[] = [];
    npcAddresses.forEach((addr, i) => {
      const npc = allCharacters.find(c => c.contractAddress.toLowerCase() === addr.toLowerCase());
      if (npc) {
        const unit = makeUnit(npc, false, i);
        unit.gridPos = i < 9 ? positions[i] : -1;
        units.push(unit);
      }
    });
    if (units.length > 0) return units;
  }

  // Single named NPC
  if (npcAddress) {
    const npc = allCharacters.find(c => c.contractAddress.toLowerCase() === npcAddress.toLowerCase());
    if (npc) {
      const unit = makeUnit(npc, false, 0);
      unit.gridPos = 1;
      return [unit];
    }
  }

  // Fixed enemy count — not scaled by player count (encourages owning more/stronger NFTs)
  const enemyCount = Math.max(1, Math.min(5, Math.ceil(allCharacters.length * 0.03)));

  // Limit pool to 20 weakest NFTs (sorted by total stats ascending)
  const totalStats = (c: typeof allCharacters[0]) =>
    c.stats.hp + c.stats.attack + c.stats.def + c.stats.mAtk + c.stats.mDef + c.stats.fAtk + c.stats.mana;
  let pool = [...allCharacters].sort((a, b) => totalStats(a) - totalStats(b)).slice(0, 20);

  // Shuffle and pick enemyCount from the weak pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Place enemies on grid: fill front row first, then mid
  const enemyPositions = [1, 0, 2, 4, 3, 5, 7, 6, 8];
  return pool.slice(0, enemyCount).map((char, i) => {
    const unit = makeUnit(char, false, i);
    unit.gridPos = enemyPositions[i] ?? i;
    return unit;
  });
}
