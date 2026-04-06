import type { NftCharacter } from "@/hooks/useNftStats";
import type { BoonEffect } from "@/lib/impactBoons";

export type ComputedStats = {
  attack: number;
  mAtk: number;
  eAtk: number;
  fAtk: number;
  def: number;
  mDef: number;
  hp: number;
  healing: number;
  armorPierce: number;
  shieldWall: number;
  magicShield: number;
  lifesteal: number;
  aoeDamage: number;
  rally: number;
  mana: number;
};

/**
 * Compute final stats from raw NFT stats, then layer on boon stat modifiers.
 * Boon effects of type stat_pct / stat_flat / magic_boost are applied here.
 * Combat-only effects (thorns, last_stand, etc.) are handled in cardBattleCombat.
 */
export function computeStats(
  raw: NftCharacter["stats"],
  boonEffects: BoonEffect[] = [],
): ComputedStats {
  const multiplier = 1 + raw.charMultiplier;
  const magicMult = 1 + raw.magicMultiplier;

  const base: ComputedStats = {
    attack: raw.attack * multiplier,
    mAtk:   raw.mAtk * multiplier * magicMult,
    eAtk:   (raw.eAtk ?? 0) * multiplier * magicMult,
    fAtk:   raw.fAtk * multiplier,
    def:    raw.def * multiplier,
    mDef:   raw.mDef * multiplier * magicMult,
    hp:     raw.hp * multiplier,
    healing: (raw.healing ?? 0) * multiplier * 0.1,
    armorPierce: (raw.armorPierce ?? 0) * multiplier * 0.1,
    shieldWall: (raw.shieldWall ?? 0) * multiplier * 0.1,
    magicShield: (raw.magicShield ?? 0) * multiplier * 0.1,
    lifesteal: (raw.lifesteal ?? 0) * multiplier * 0.05,
    aoeDamage: (raw.aoeDamage ?? 0) * multiplier * 0.1 / 8,
    rally: (raw.rally ?? 0) * multiplier * 0.05,
    mana:   raw.mana * multiplier,
  };

  // Apply boon stat modifiers on top of base
  for (const effect of boonEffects) {
    if (effect.type === "stat_pct") {
      const key = effect.stat as keyof ComputedStats;
      if (key in base) {
        (base as any)[key] += (base as any)[key] * effect.pct;
      }
    } else if (effect.type === "stat_flat") {
      const key = effect.stat as keyof ComputedStats;
      if (key in base) {
        (base as any)[key] += effect.value;
      }
    } else if (effect.type === "magic_boost") {
      // Boost all magic stats
      base.mAtk += base.mAtk * effect.pct;
      base.eAtk += base.eAtk * effect.pct;
      base.mana += base.mana * effect.pct;
    } else if (effect.type === "regen") {
      // Add boon regen to existing healing stat
      base.healing += base.hp * effect.hpPct;
    }
  }

  return base;
}
