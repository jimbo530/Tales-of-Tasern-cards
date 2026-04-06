// ─── Impact Boon System ──────────────────────────────────────────────────────
// Impact assets unlock tiered boons (passive combat abilities) based on how
// many tokens an NFT holds.  Game tokens keep their own passives — these are
// ADDITIONAL abilities layered on top.
//
// Two boon families:
//   1. Count-based  — thresholds on raw token count (carbon, trees, energy…)
//   2. Dollar-based — thresholds on USD value held (BURGERS, WETH, WBTC…)

// ─── Types ───────────────────────────────────────────────────────────────────

export type BoonEffect =
  | { type: "stat_pct"; stat: string; pct: number }           // +X% to a stat
  | { type: "stat_flat"; stat: string; value: number }        // +flat value
  | { type: "elemental_resist"; pct: number }                  // reduce elemental damage (fire, electric, future) by %
  | { type: "elemental_immune" }                              // immune to elemental damage
  | { type: "dot_extend"; extraTurns: number }                // fire DoT lasts longer
  | { type: "thorns"; pct: number }                           // reflect % of attacker's damage
  | { type: "splash_all" }                                    // lightning splash hits ALL cols
  | { type: "fire_splash" }                                   // fire splashes to adjacent cols
  | { type: "last_stand" }                                    // survive lethal hit at 1 HP once
  | { type: "first_strike" }                                  // attack before opponent in column
  | { type: "row_buff"; stat: string; pct: number }           // buff stat for all allies in row
  | { type: "col_buff"; stat: string; pct: number }           // buff stat for all allies in col
  | { type: "support_bonus_pct"; pct: number }                // increase back-row support bonus
  | { type: "revive"; hpPct: number }                         // revive once at X% HP
  | { type: "damage_shield"; pct: number }                    // absorb first X% of incoming dmg each turn
  | { type: "regen"; hpPct: number }                          // heal X% max HP per turn
  | { type: "burst_heal"; hpPct: number; once: boolean }      // heal X% HP (once per battle or per turn)
  | { type: "magic_boost"; pct: number };                     // +X% to all magic stats (mAtk, eAtk, mana)

export type BoonTier = {
  tier: number;          // 1-4
  name: string;          // e.g. "Blessing of Pure Air"
  description: string;   // shown on card tooltip
  effects: BoonEffect[];
};

export type BoonGroup = {
  id: string;            // unique key: "carbon_guardians", "stormborn", etc.
  name: string;          // display name
  icon: string;          // emoji for card display
  mode: "count" | "usd"; // threshold based on token count or USD value
  tokens: string[];      // lowercase token addresses that contribute
  /** Quality weights for count-based groups (address → multiplier). Default 1. */
  weights?: Record<string, number>;
  tiers: [BoonTier, BoonTier, BoonTier, BoonTier]; // always 4 tiers
  thresholds: [number, number, number, number];     // value needed for each tier
};

export type ActiveBoon = {
  groupId: string;
  groupName: string;
  icon: string;
  tier: number;          // 1-4
  tierName: string;
  description: string;
  effects: BoonEffect[];
  /** All effects from tier 1 up to current tier (boons stack) */
  allEffects: BoonEffect[];
};

// ─── Count-Based Impact Boon Groups ─────────────────────────────────────────

const CARBON_GUARDIANS: BoonGroup = {
  id: "carbon_guardians",
  name: "Carbon Guardians",
  icon: "\u{1F32C}\u{FE0F}",  // wind
  mode: "count",
  tokens: [
    "0x20b048fa035d5763685d695e66adf62c5d9f5055", // CHAR
    "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14", // CRISP-M
    "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7", // CCC
    "0xd838290e877e0188a4a44700463419ed96c16107", // NCT
    "0x2f800db0fdb5223b3c3f354886d907a671414a7f", // BCT
  ],
  // Quality-weighted to effective lbs (1 tonne = 2204 lbs)
  weights: {
    "0x20b048fa035d5763685d695e66adf62c5d9f5055": 2204,    // CHAR: 1 tonne/token
    "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14": 1102,    // CRISP-M: 0.5 tonne
    "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": 1,        // CCC: 1 lb/token
    "0xd838290e877e0188a4a44700463419ed96c16107": 220,      // NCT: 0.1 tonne
    "0x2f800db0fdb5223b3c3f354886d907a671414a7f": 110,      // BCT: 0.05 tonne
  },
  // Thresholds in effective lbs
  thresholds: [220, 1102, 2204, 4408], // ~0.1, 0.5, 1, 2 tonnes
  tiers: [
    {
      tier: 1, name: "Blessing of Pure Air",
      description: "Reduce incoming elemental damage by 25%",
      effects: [{ type: "elemental_resist", pct: 0.25 }],
    },
    {
      tier: 2, name: "Boon of Restoration",
      description: "Regenerate 1% max HP per turn",
      effects: [{ type: "regen", hpPct: 0.01 }],
    },
    {
      tier: 3, name: "Boon of Perfect Health",
      description: "Immune to elemental damage",
      effects: [{ type: "elemental_immune" }],
    },
    {
      tier: 4, name: "Boon of the Purifier",
      description: "Row allies also take 25% less elemental damage",
      effects: [{ type: "row_buff", stat: "elemental_resist", pct: 0.25 }],
    },
  ],
};

const WARDENS_OF_THE_GROVE: BoonGroup = {
  id: "wardens_grove",
  name: "Wardens of the Grove",
  icon: "\u{1F333}",  // deciduous tree
  mode: "count",
  tokens: [
    "0xace15da4edcec83c98b1fc196fc1dc44c5c429ca", // JCGWR
    "0x146642d83879257ac9ed35074b1c3714b7e8f452", // AU24T
  ],
  thresholds: [100, 500, 2000, 10000],
  tiers: [
    {
      tier: 1, name: "Blessing of Barkskin",
      description: "+10% DEF",
      effects: [{ type: "stat_pct", stat: "def", pct: 0.10 }],
    },
    {
      tier: 2, name: "Boon of Thorns",
      description: "Attackers take 15% of their own damage back",
      effects: [{ type: "thorns", pct: 0.15 }],
    },
    {
      tier: 3, name: "Boon of Ironwood",
      description: "+20% DEF",
      effects: [{ type: "stat_pct", stat: "def", pct: 0.20 }],
    },
    {
      tier: 4, name: "Boon of the Living Forest",
      description: "Column allies get +15% DEF",
      effects: [{ type: "col_buff", stat: "def", pct: 0.15 }],
    },
  ],
};

const STORMBORN: BoonGroup = {
  id: "stormborn",
  name: "Stormborn",
  icon: "\u{26A1}",  // lightning
  mode: "count",
  tokens: [
    "0xcdb4574adb7c6643153a65ee1a953afd5a189cef", // JLT-F24
    "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e", // JLT-B23
  ],
  thresholds: [1, 5, 10, 20], // MWh
  tiers: [
    {
      tier: 1, name: "Blessing of Static",
      description: "+15% electric attack damage",
      effects: [{ type: "stat_pct", stat: "eAtk", pct: 0.15 }],
    },
    {
      tier: 2, name: "Boon of the Stormborn",
      description: "Take 50% less electric damage",
      effects: [{ type: "elemental_resist", pct: 0.50 }],
    },
    {
      tier: 3, name: "Boon of Chain Lightning",
      description: "Lightning splash hits ALL columns, not just adjacent",
      effects: [{ type: "splash_all" }],
    },
    {
      tier: 4, name: "Boon of the Tempest",
      description: "Attackers take 10% of your eAtk as lightning damage",
      effects: [{ type: "thorns", pct: 0.10 }],
    },
  ],
};

const LIGHTBEARERS: BoonGroup = {
  id: "lightbearers",
  name: "Lightbearers",
  icon: "\u{1F525}",  // fire
  mode: "count",
  tokens: [
    "0x8e87497ec9fd80fc102b33837035f76cf17c3020", // LANTERN
  ],
  thresholds: [0.25, 1.25, 2.5, 6.25], // solar lanterns (fractional because LP-derived)
  tiers: [
    {
      tier: 1, name: "Blessing of the Flame",
      description: "+15% fire attack damage",
      effects: [{ type: "stat_pct", stat: "fAtk", pct: 0.15 }],
    },
    {
      tier: 2, name: "Boon of Fire Soul",
      description: "Take 50% less elemental damage",
      effects: [{ type: "elemental_resist", pct: 0.50 }],
    },
    {
      tier: 3, name: "Boon of Extended Burn",
      description: "Your fire DoT lasts 2 extra turns",
      effects: [{ type: "dot_extend", extraTurns: 2 }],
    },
    {
      tier: 4, name: "Boon of Inferno",
      description: "Fire damage splashes to adjacent columns",
      effects: [{ type: "fire_splash" }],
    },
  ],
};

const TIDEKEEPERS: BoonGroup = {
  id: "tidekeepers",
  name: "Tidekeepers",
  icon: "\u{1F30A}",  // wave
  mode: "count",
  tokens: [
    "0x861f57e96678c6cb586f07dd8d3b0c34ce19dd82", // LTK
    "0xcb2a97776c87433050e0ddf9de0f53ead661dab4", // TB01
  ],
  thresholds: [10, 100, 500, 2000],
  tiers: [
    {
      tier: 1, name: "Blessing of the Shield",
      description: "+10% max HP",
      effects: [{ type: "stat_pct", stat: "hp", pct: 0.10 }],
    },
    {
      tier: 2, name: "Boon of Resilience",
      description: "Absorb first 10% of incoming damage each turn",
      effects: [{ type: "damage_shield", pct: 0.10 }],
    },
    {
      tier: 3, name: "Boon of the Unfettered",
      description: "Survive lethal hit at 1 HP (once per battle)",
      effects: [{ type: "last_stand" }],
    },
    {
      tier: 4, name: "Boon of Invincibility",
      description: "Column allies absorb 10% of incoming damage",
      effects: [{ type: "col_buff", stat: "damage_shield", pct: 0.10 }],
    },
  ],
};

const HERALDS_OF_HOPE: BoonGroup = {
  id: "heralds_hope",
  name: "Heralds of Hope",
  icon: "\u{1F31F}",  // star
  mode: "count",
  tokens: [
    "0xd84415c956f44b2300a2e56c5b898401913e9a29", // PR24
    "0x72e4327f592e9cb09d5730a55d1d68de144af53c", // PR25
  ],
  thresholds: [1, 5, 10, 25],
  tiers: [
    {
      tier: 1, name: "Blessing of Swiftness",
      description: "Strike first in column combat",
      effects: [{ type: "first_strike" }],
    },
    {
      tier: 2, name: "Boon of the Guardian",
      description: "Back-row support bonus increased by 20%",
      effects: [{ type: "support_bonus_pct", pct: 0.20 }],
    },
    {
      tier: 3, name: "Boon of Valor",
      description: "+10% ATK and mATK for all row allies",
      effects: [
        { type: "row_buff", stat: "attack", pct: 0.10 },
        { type: "row_buff", stat: "mAtk", pct: 0.10 },
      ],
    },
    {
      tier: 4, name: "Boon of the Protector",
      description: "Revive once at 30% HP when killed",
      effects: [{ type: "revive", hpPct: 0.30 }],
    },
  ],
};

// ─── Dollar-Value Impact Boon Groups ────────────────────────────────────────
// These use USD value of holdings as thresholds.

const BURGERS_BOONS: BoonGroup = {
  id: "feast",
  name: "Feast of the Burger",
  icon: "\u{1F354}",  // hamburger
  mode: "usd",
  tokens: ["0x06a05043eb2c1691b19c2c13219db9212269ddc5"], // BURGERS
  thresholds: [10, 50, 100, 200],
  tiers: [
    {
      tier: 1, name: "Blessing of Sustenance",
      description: "Regenerate 2% max HP per turn",
      effects: [{ type: "regen", hpPct: 0.02 }],
    },
    {
      tier: 2, name: "Boon of Wound Closure",
      description: "Heal 15% HP once when dropping below 50%",
      effects: [{ type: "burst_heal", hpPct: 0.15, once: true }],
    },
    {
      tier: 3, name: "Boon of Health",
      description: "+15% max HP",
      effects: [{ type: "stat_pct", stat: "hp", pct: 0.15 }],
    },
    {
      tier: 4, name: "Boon of the Feast",
      description: "Row allies regenerate 1% max HP per turn",
      effects: [{ type: "row_buff", stat: "regen", pct: 0.01 }],
    },
  ],
};

const TGN_BOONS: BoonGroup = {
  id: "canopy",
  name: "Canopy Council",
  icon: "\u{1F343}",  // leaves
  mode: "usd",
  tokens: ["0xd75dfa972c6136f1c594fec1945302f885e1ab29"], // TGN
  thresholds: [10, 50, 100, 200],
  tiers: [
    {
      tier: 1, name: "Blessing of the Canopy",
      description: "+10% DEF",
      effects: [{ type: "stat_pct", stat: "def", pct: 0.10 }],
    },
    {
      tier: 2, name: "Boon of Entanglement",
      description: "Attackers take 10% of their own damage back",
      effects: [{ type: "thorns", pct: 0.10 }],
    },
    {
      tier: 3, name: "Boon of the Dryad",
      description: "+15% DEF and +15% mDEF",
      effects: [
        { type: "stat_pct", stat: "def", pct: 0.15 },
        { type: "stat_pct", stat: "mDef", pct: 0.15 },
      ],
    },
    {
      tier: 4, name: "Boon of the World Tree",
      description: "Column allies get +10% DEF and mDEF",
      effects: [
        { type: "col_buff", stat: "def", pct: 0.10 },
        { type: "col_buff", stat: "mDef", pct: 0.10 },
      ],
    },
  ],
};

const REGEN_BOONS: BoonGroup = {
  id: "rebuilder",
  name: "Rebuilder's Resolve",
  icon: "\u{1F49A}",  // green heart
  mode: "usd",
  tokens: ["0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b"], // REGEN
  thresholds: [10, 50, 100, 200],
  tiers: [
    {
      tier: 1, name: "Blessing of Regeneration",
      description: "Regenerate 1% max HP per turn",
      effects: [{ type: "regen", hpPct: 0.01 }],
    },
    {
      tier: 2, name: "Boon of Mending",
      description: "Heal 20% HP once when dropping below 25%",
      effects: [{ type: "burst_heal", hpPct: 0.20, once: true }],
    },
    {
      tier: 3, name: "Boon of Renewal",
      description: "Immune to elemental damage",
      effects: [{ type: "elemental_immune" }],
    },
    {
      tier: 4, name: "Boon of the Phoenix",
      description: "Revive once at 50% HP when killed",
      effects: [{ type: "revive", hpPct: 0.50 }],
    },
  ],
};

const GRANTS_BOONS: BoonGroup = {
  id: "grantmaker",
  name: "The Grantmaker",
  icon: "\u{1F9D9}",  // mage
  mode: "usd",
  tokens: ["0xdb7a2607b71134d0b09c27ca2d77b495e4dbeedb"], // Grant Wizard
  thresholds: [10, 50, 100, 200],
  tiers: [
    {
      tier: 1, name: "Blessing of Insight",
      description: "+10% mana",
      effects: [{ type: "stat_pct", stat: "mana", pct: 0.10 }],
    },
    {
      tier: 2, name: "Boon of Luck",
      description: "Absorb first 10% of incoming damage",
      effects: [{ type: "damage_shield", pct: 0.10 }],
    },
    {
      tier: 3, name: "Boon of Fate",
      description: "+20% to all magic stats",
      effects: [{ type: "magic_boost", pct: 0.20 }],
    },
    {
      tier: 4, name: "Boon of Spell Mastery",
      description: "+30% to all magic stats",
      effects: [{ type: "magic_boost", pct: 0.30 }],
    },
  ],
};

// ─── Traditional Crypto Boon Groups (boons only, no base stats in D20) ──────

const WETH_BOONS: BoonGroup = {
  id: "vaults_ether",
  name: "Vaults of Ether",
  icon: "\u{1F48E}",  // gem
  mode: "usd",
  tokens: [
    "0x4200000000000000000000000000000000000006", // WETH Base
    "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH Polygon
  ],
  thresholds: [10, 50, 100, 200],
  tiers: [
    {
      tier: 1, name: "Blessing of Arcana",
      description: "+10% mATK",
      effects: [{ type: "stat_pct", stat: "mAtk", pct: 0.10 }],
    },
    {
      tier: 2, name: "Boon of Spell Recall",
      description: "+15% mana",
      effects: [{ type: "stat_pct", stat: "mana", pct: 0.15 }],
    },
    {
      tier: 3, name: "Boon of Counterspell",
      description: "Absorb 15% of incoming magic damage",
      effects: [{ type: "damage_shield", pct: 0.15 }],
    },
    {
      tier: 4, name: "Boon of High Magic",
      description: "+25% to all magic stats",
      effects: [{ type: "magic_boost", pct: 0.25 }],
    },
  ],
};

const WBTC_BOONS: BoonGroup = {
  id: "bitcoin_bastion",
  name: "The Bitcoin Bastion",
  icon: "\u{1F6E1}\u{FE0F}",  // shield
  mode: "usd",
  tokens: ["0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6"], // WBTC
  thresholds: [10, 50, 100, 200],
  tiers: [
    {
      tier: 1, name: "Blessing of Fortitude",
      description: "+10% max HP",
      effects: [{ type: "stat_pct", stat: "hp", pct: 0.10 }],
    },
    {
      tier: 2, name: "Boon of Iron Skin",
      description: "+10% DEF",
      effects: [{ type: "stat_pct", stat: "def", pct: 0.10 }],
    },
    {
      tier: 3, name: "Boon of Fortitude",
      description: "+20% max HP",
      effects: [{ type: "stat_pct", stat: "hp", pct: 0.20 }],
    },
    {
      tier: 4, name: "Boon of the Unbreakable",
      description: "Survive lethal hit at 1 HP (once per battle)",
      effects: [{ type: "last_stand" }],
    },
  ],
};

const WPOL_BOONS: BoonGroup = {
  id: "threads_polygon",
  name: "Threads of Polygon",
  icon: "\u{1F300}",  // cyclone
  mode: "usd",
  tokens: ["0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"], // WPOL
  thresholds: [10, 50, 100, 200],
  tiers: [
    {
      tier: 1, name: "Blessing of Haste",
      description: "Strike first in column combat",
      effects: [{ type: "first_strike" }],
    },
    {
      tier: 2, name: "Boon of Initiative",
      description: "+10% ATK",
      effects: [{ type: "stat_pct", stat: "attack", pct: 0.10 }],
    },
    {
      tier: 3, name: "Boon of Evasion",
      description: "Absorb first 15% of incoming physical damage",
      effects: [{ type: "damage_shield", pct: 0.15 }],
    },
    {
      tier: 4, name: "Boon of Action Surge",
      description: "+25% ATK (all types)",
      effects: [
        { type: "stat_pct", stat: "attack", pct: 0.25 },
        { type: "stat_pct", stat: "mAtk", pct: 0.25 },
        { type: "stat_pct", stat: "eAtk", pct: 0.25 },
        { type: "stat_pct", stat: "fAtk", pct: 0.25 },
      ],
    },
  ],
};

// ─── All Groups ─────────────────────────────────────────────────────────────

export const BOON_GROUPS: BoonGroup[] = [
  // Count-based
  CARBON_GUARDIANS,
  WARDENS_OF_THE_GROVE,
  STORMBORN,
  LIGHTBEARERS,
  TIDEKEEPERS,
  HERALDS_OF_HOPE,
  // Dollar-based (impact stat tokens)
  BURGERS_BOONS,
  TGN_BOONS,
  REGEN_BOONS,
  GRANTS_BOONS,
  // Dollar-based (traditional crypto)
  WETH_BOONS,
  WBTC_BOONS,
  WPOL_BOONS,
];

// ─── Boon Resolution ────────────────────────────────────────────────────────

/**
 * Given a map of token address → raw amount held (NOT USD, raw token count),
 * and a map of token address → USD price, resolve which boons are active.
 *
 * Boons stack: if you hit tier 3, you get tier 1 + 2 + 3 effects.
 */
export function resolveImpactBoons(
  tokenHoldings: Map<string, number>,  // addr → raw token amount
  tokenUsdPrices: Record<string, number>,
): ActiveBoon[] {
  const active: ActiveBoon[] = [];

  for (const group of BOON_GROUPS) {
    // Sum up the effective value for this group
    let value = 0;
    for (const addr of group.tokens) {
      const amount = tokenHoldings.get(addr) ?? 0;
      if (amount <= 0) continue;

      if (group.mode === "count") {
        const weight = group.weights?.[addr] ?? 1;
        value += amount * weight;
      } else {
        // USD mode
        const price = tokenUsdPrices[addr] ?? 0;
        value += amount * price;
      }
    }

    if (value <= 0) continue;

    // Find highest tier reached
    let highestTier = 0;
    for (let i = 0; i < 4; i++) {
      if (value >= group.thresholds[i]) highestTier = i + 1;
    }

    if (highestTier === 0) continue;

    // Collect ALL effects from tier 1 up to current tier (boons stack)
    const allEffects: BoonEffect[] = [];
    for (let i = 0; i < highestTier; i++) {
      allEffects.push(...group.tiers[i].effects);
    }

    const currentTier = group.tiers[highestTier - 1];
    active.push({
      groupId: group.id,
      groupName: group.name,
      icon: group.icon,
      tier: highestTier,
      tierName: currentTier.name,
      description: currentTier.description,
      effects: currentTier.effects,
      allEffects,
    });
  }

  return active;
}
