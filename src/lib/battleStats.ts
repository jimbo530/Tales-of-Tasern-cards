import type { NftCharacter } from "@/hooks/useNftStats";

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

export function computeStats(raw: NftCharacter["stats"]): ComputedStats {
  const multiplier = 1 + raw.charMultiplier;
  const magicMult = 1 + raw.magicMultiplier;
  return {
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
}
