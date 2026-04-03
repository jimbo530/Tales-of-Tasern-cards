// NFTs reserved as story characters — excluded from marketplace
export const STORY_NPCS: Set<string> = new Set(
  [
    "0xae195DF237739D6d43d4B796553f594C5ba516a7", // Pippin Thistledown
    "0x2685Bb66e8e45e386D3E816726De64d5001317fd", // Dag
    "0x6AD5621f5719A6b32d0Ea9dd4493ca6Ac0639D4B", // Rainbow Lily
    "0x212626D66E64C9C293A845687dB700c16466586e", // Glowing Geranium
    "0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165", // Electric Bird
    "0x716AdcbEd9Ef58CCf11434Aa7962b0f200A030af", // Captain Blackfeather
  ].map(a => a.toLowerCase())
);

export type Encounter = {
  name: string;
  description: string;
  aiDeckBias: "balanced" | "aggressive" | "defensive" | "magic";
  aiStrength: number; // 0.5 = weak, 1 = normal, 1.5 = strong
  mftReward: number;
  npcAddress?: string; // NFT contract address for a single named NPC opponent
  npcAddresses?: string[]; // Multiple NPC opponents
  joinsParty?: string; // NPC address that joins your party on win (if party < 4)
};

// Hierarchical region tree — world → regions → sub-areas
export type Region = {
  id: string;
  name: string;
  parent?: string;       // parent region id (undefined = top level)
  mapImage?: string;     // background map image for this region
};

export const REGIONS: Region[] = [
  { id: "world",      name: "World",                   mapImage: "/world-map.jpg" },
  { id: "londa",      name: "Londa",      parent: "world",  mapImage: "/londa-map.jpg" },
  { id: "leaving-home", name: "Leaving Home", parent: "londa", mapImage: "/adventure-level1.webp" },
  { id: "newbsberd",  name: "Newbsberd",  parent: "londa",  mapImage: "/newbsberd-city.png" },
];

export type Chapter = {
  id: string;
  title: string;
  intro: string;
  image?: string; // background image path
  encounters: Encounter[];
  completionBonus: number; // MfT bonus for finishing the chapter
  cooldownMs?: number; // per-encounter cooldown override (default 20 min)
  maxParty?: number; // max heroes allowed (default 9)
  requires?: string[]; // chapter IDs that must ALL be completed to unlock (AND)
  requiresAny?: string[]; // chapter IDs where ANY one unlocks this (OR)
  mapPin?: { x: number; y: number; region: string }; // % position on world/region map
};

export const ADVENTURE_CHAPTERS: Chapter[] = [
  // ═══════════════════════════════════════════════════════════════
  // Chapter 1: Leaving Home — 7 encounters in the starting village
  // ═══════════════════════════════════════════════════════════════
  {
    id: "leaving-home",
    title: "Leaving Home",
    maxParty: 4,
    mapPin: { x: 15, y: 65, region: "londa" },
    intro: "At the heart of a quiet crossroads village, where warm lanternlight spills across worn cobblestones and every path seems to lead somewhere important, your journey begins. Six humble homes ring the central well\u2014each belonging to a friend who has walked a different road, learned a different truth, and now waits to share what they know.",
    image: "/adventure-level1.webp",
    encounters: [
      {
        name: "A Friendly Face",
        description: "Pippin leans against the well, arms crossed, watching you with a knowing grin. \"The world out there doesn't care if you're brave,\" he says. \"It cares if you can fight.\"\n\nHe draws a wooden training sword and explains: \"Place your heroes on the 3\u00d73 grid. Each round you can move one square, then everyone attacks forward. Every strike rolls a D20 \u2014 roll a 1 and you miss completely, roll a 20 and you hit for double damage. Simple as that.\"\n\nHe takes a stance. \"Now let me see what you've got \u2014 don't hold back, I can take it.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.2,
        mftReward: 300,
        npcAddress: "0xae195DF237739D6d43d4B796553f594C5ba516a7",
      },
      {
        name: "The Lost Explorer",
        description: "A stocky figure sits on a stump near the village edge, sharpening an axe with practiced hands. \"Name's Dag,\" he grunts without looking up. \"I've been stuck in this village for weeks. Helped Pippin fix the well, cleared brush, ate too much of Maren's soup \u2014 I'm done. I need to get back on the road.\"\n\nHe finally looks you over, unimpressed. \"Problem is, last thing I need is some wimp slowing me down out there. The road eats people who can't handle themselves.\" He stands, hefting his axe. \"So here's the deal \u2014 you beat me, I'll believe you're not dead weight and we travel together. You lose? Stay in the village where it's safe. I'm not babysitting.\"\n\nPippin leans over and whispers: \"Win this and Dag joins your party. Check your hero cards before the fight \u2014 each one has different stats. Pick the ones whose strengths match the fight ahead. The stronger your team, the farther you'll go.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.25,
        mftReward: 400,
        npcAddress: "0x2685Bb66e8e45e386D3E816726De64d5001317fd",
        joinsParty: "0x2685Bb66e8e45e386D3E816726De64d5001317fd",
      },
      {
        name: "Maren's Warning",
        description: "Old Maren steps out of her cottage, wiping soil from her hands, her expression grave. \"You've done well so far, but listen to me carefully. The wilds beyond this village are nothing like what you've faced here. The plants themselves have turned \u2014 twisted by something dark seeping up from the earth. Even the flowers bite back.\"\n\nShe gestures toward the treeline where strange lights pulse between the branches. \"Two of them have crept close to the village edge. A Rainbow Lily and a Glowing Geranium \u2014 beautiful, deadly. Clear them out before they spread.\"\n\nShe lowers her voice. \"One thing \u2014 not all damage is the same. Your heroes deal physical damage or magic force. Physical attack hits hard but armor blocks it. Magic force punches through differently \u2014 it's resisted by magic defense instead. Pay attention to what your heroes are good at and what the enemy is weak to.\"",
        aiDeckBias: "defensive",
        aiStrength: 0.3,
        mftReward: 500,
        npcAddresses: ["0x6AD5621f5719A6b32d0Ea9dd4493ca6Ac0639D4B", "0x212626D66E64C9C293A845687dB700c16466586e"],
      },
      {
        name: "Guards of Newbsberd",
        description: "Nine guards from the Newbsberd garrison are passing through the village on patrol. Their captain nods at Torven. \"Heard you've got fresh recruits. Mind if we help?\" Torven grins. \"Show them what flanking looks like.\"\n\nThe captain turns to you. \"Lesson time. When your column is open \u2014 no one standing between you and the enemy \u2014 they'll come at you from the side for extra damage. That's flanking. We're going to surround you, and when one of us drops, another steps in from reserve. Out on the real road, nobody fights fair. Better you learn that here.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.3,
        mftReward: 600,
        npcAddresses: [
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
        ],
      },
      {
        name: "The Scout's Challenge",
        description: "Kael drops from a low branch, pointing toward two crackling shapes perched in the canopy. \"Electric Birds. They're not like the plants or the guards \u2014 their lightning splashes to anyone standing in the next column over.\"\n\nShe crosses her arms. \"And that's not even the worst of it. Some creatures breathe fire. Fire doesn't just hit once \u2014 it burns, dealing damage over multiple rounds after the initial strike. Lightning splashes sideways, fire lingers. Two more damage types to worry about on top of physical and magic force. Spread out and hit hard before they stack up on you.\"",
        aiDeckBias: "aggressive",
        aiStrength: 0.4,
        mftReward: 600,
        npcAddresses: ["0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165", "0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165"],
      },
      {
        name: "The Elder's Wisdom",
        description: "Elder Brynn sits by the fire, a heavy tome across her knees. \"You've faced each challenge alone. Now face them all at once.\" She stands and gestures across the village clearing. Every opponent you've fought steps forward \u2014 Pippin, Dag, the twisted plants, the guards, the Electric Birds \u2014 all of them, together.\n\n\"Before you charge in, listen. Your heroes aren't just stat blocks \u2014 some have passive abilities that trigger every round automatically. Healers mend wounds. Some project shields to protect allies. Others pierce through armor, drain life from enemies, rally the whole team, or blast the entire field. Check your cards \u2014 those icons mean something. Build your team around them.\"\n\nShe steps back. \"Now show me you can handle a real fight.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.45,
        mftReward: 700,
        npcAddresses: [
          "0xae195DF237739D6d43d4B796553f594C5ba516a7",
          "0x2685Bb66e8e45e386D3E816726De64d5001317fd",
          "0x6AD5621f5719A6b32d0Ea9dd4493ca6Ac0639D4B",
          "0x212626D66E64C9C293A845687dB700c16466586e",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165",
          "0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1",
        ],
      },
      {
        name: "The Village Farewell",
        description: "All six villagers gather at the crossroads. Pippin claps your shoulder. \"You're ready \u2014 or as ready as anyone can be.\" Maren hands you a pouch of herbs. Torven nods silently. Kael is already gone, vanished into the trees ahead.\n\nElder Brynn raises her hand. \"One last thing \u2014 where you place your heroes matters more than you think. Shield Wall protects allies in the same column. Magic Shield covers allies in the same row. Rally reaches everyone on the field. Think about who stands next to who.\"\n\nShe smiles. \"The road to Newbsberd lies east. You'll be allowed to bring more heroes as you prove yourself. Go well.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.55,
        mftReward: 1000,
        npcAddresses: [
          "0x9de88faa0dbcfc75534d1b4fd277dadffcc4fd30",
          "0xfaf9a6b6409b3e69f7d3b38099b41c45bbc29ba5",
          "0xea39112525f9169038435cF22f82e5436e0BCC4F",
          "0x691e4bEF9A83C00f8A35ed601090E42A8b953c77",
        ],
      },
    ],
    completionBonus: 1500,
  },

  // ═══════════════════════════════════════════════════════════════
  // The Road — 3 standalone encounters between villages
  // ═══════════════════════════════════════════════════════════════
  {
    id: "path-1",
    title: "Goblin Ambush",
    requires: ["leaving-home"],
    maxParty: 6,
    mapPin: { x: 28, y: 55, region: "londa" },
    intro: "The village gate closes behind you. The east road stretches through dense forest. You haven't been walking an hour when trouble finds you.",
    image: "/adventure-level1.webp",
    encounters: [{
      name: "Goblin Ambush",
      description: "You haven't been walking an hour when a shrill whistle cuts through the trees. Green-skinned figures drop from the branches and scramble up from ditches on both sides of the road. Goblins \u2014 a raiding party, armed with crude spears and stolen daggers. Their leader, barely taller than the others, jabs a crooked finger at you and shrieks a command. They fan out to surround you, quick and vicious. There's no negotiating with hunger like theirs.",
      aiDeckBias: "aggressive",
      aiStrength: 0.6,
      mftReward: 800,
      npcAddresses: [
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
      ],
    }],
    completionBonus: 600,
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "path-2",
    title: "The Wolf Pack",
    requires: ["path-1"],
    maxParty: 6,
    mapPin: { x: 40, y: 48, region: "londa" },
    intro: "Dusk falls fast under the canopy. You smell them before you see them \u2014 wet fur and old blood.",
    image: "/adventure-level1.webp",
    encounters: [{
      name: "The Wolf Pack",
      description: "Dusk falls fast under the canopy. You smell them before you see them \u2014 wet fur and old blood. The first wolf appears on the road ahead, head low, yellow eyes fixed on you. Then another emerges from the brush to your left. And another to your right. The pack has been tracking you for miles, waiting for the light to fade. The alpha lets out a low growl that vibrates in your chest. They don't charge \u2014 not yet. They circle, testing, probing for weakness. When they come, they'll come all at once.",
      aiDeckBias: "aggressive",
      aiStrength: 0.8,
      mftReward: 1000,
      npcAddresses: [
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
      ],
    }],
    completionBonus: 800,
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "path-3",
    title: "Lost in the Weeds",
    requires: ["path-2"],
    maxParty: 6,
    mapPin: { x: 52, y: 42, region: "londa" },
    intro: "The road narrows and vanishes, swallowed by undergrowth. Everything in this tangle wants to kill you.",
    image: "/adventure-level1.webp",
    encounters: [{
      name: "Lost in the Weeds",
      description: "The road narrows and then vanishes entirely, swallowed by thick undergrowth. Twisted vines and thorny bushes press in from every side. You push forward \u2014 and the weeds push back. Geraniums with razor petals unfurl between the roots, wolves slink through the tall grass, and goblins cackle from somewhere in the tangle. You've stumbled into their territory, and they've been waiting.",
      aiDeckBias: "balanced",
      aiStrength: 0.8,
      mftReward: 1200,
      npcAddresses: [
        "0x212626D66E64C9C293A845687dB700c16466586e",
        "0x212626D66E64C9C293A845687dB700c16466586e",
        "0x42CE5e89D0D5f841E668E63310b96ABE159f5761",
        "0x42CE5e89D0D5f841E668E63310b96ABE159f5761",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",
      ],
    }],
    completionBonus: 2000,
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
  },

  // ═══════════════════════════════════════════════════════════════
  // Chapter 2: Newbsberd — 5 encounters in and around the city
  // Road Tax → Back Alleys → Crowded Gates → Gathering Supplies → Highway Men
  // ═══════════════════════════════════════════════════════════════
  {
    id: "newbsberd",
    title: "Newbsberd",
    requires: ["path-3"],
    maxParty: 6,
    mapPin: { x: 65, y: 35, region: "londa" },
    intro: "The road from the wilds feeds into a wider trade route, and beyond it the walls of Newbsberd rise like a grey cliff face above the sprawl of shanties and market stalls that cling to its base. Somewhere behind those walls lies passage deeper into the world \u2014 but first you have to get through.",
    image: "/newbsberd-city.png",
    encounters: [
      {
        name: "Road Tax",
        description: "A chain stretches across the road between two carts. Behind it, five men in mismatched armor lounge on stools, a strongbox at their feet already heavy with coin. The biggest one stands as you approach, resting a notched blade on his shoulder.\n\n\"Road tax. Two silver per head, one per beast. Non-negotiable.\" He nods at the treeline behind you. \"The ones who argued are buried back there.\"\n\nA merchant ahead of you in line hands over a pouch without a word, eyes down. The toll collector weighs it, grunts, and waves him through. Now he turns to you. \"You look like trouble. Trouble pays double.\"",
        aiDeckBias: "aggressive",
        aiStrength: 0.6,
        mftReward: 900,
        npcAddresses: [
          "0xEE67c60d0E9687BB6D4cA2D90357FC8155F3c2c8",
          "0xE2E9C314E1AD0764b6ef22B6408674a33F84FD41",
          "0x67052bFEB30203A7bEEEAD76b58f51B931Ff4d1C",
          "0xE93889FC55B4c95227A0499d175890d001410D17",
          "0x5B5A2bcfd8b19814bCB6BE9091a892FF0ceB23c6",
        ],
      },
      {
        name: "Back Alleys",
        description: "A boy tugs your sleeve and points down a narrow gap between two leaning buildings. \"Shortcut to the gates, two copper.\" You pay. The alley twists and narrows, the walls closing in until you're squeezing sideways through gaps barely wide enough for your shoulders.\n\nThen the boy vanishes. A whistle from above. Three figures drop from the rooftops \u2014 two behind, one ahead. The one in front draws a jagged knife and grins. \"Wrong alley, traveler. Leave everything and crawl back the way you came.\"\n\nThe walls are too tight to swing a proper weapon. They've done this before.",
        aiDeckBias: "aggressive",
        aiStrength: 0.65,
        mftReward: 1000,
        npcAddresses: [
          "0x11Bc51A6726A588D65ED7087E5F4eD853EC0F390",
          "0xB22bf25A33a539e769CEb48cad5E2C0951bEfb21",
          "0x4717ef81F44Ff2cd3fd7C51299595f1daD682631",
        ],
      },
      {
        name: "Crowded Gates",
        description: "The queue to enter Newbsberd stretches back two hundred yards. Merchants, refugees, mercenaries, and travelers all crush together in the mud, shoving for position. The city guard on the walls look down with indifference.\n\nA fight breaks out near the front \u2014 a merchant accuses a group of sellswords of cutting the line. Blades come out. The crowd surges backward in panic, trampling the weak. In the chaos, a gang of pickpockets moves through the crush, cutting purses and snatching packs.\n\nOne of them grabs at your gear. When you catch his wrist, his friends materialize from the crowd \u2014 six of them, armed with short blades and brass knuckles. \"Let go,\" the leader hisses. \"Or we gut you right here and nobody sees a thing in this mess.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.65,
        mftReward: 1100,
        npcAddresses: [
          "0x78cD29b5095D74d1AB90AC74023F5ecC9e41Cc87",
          "0x153Ec2E5DA59370c05Db0826a6489ebd348fe471",
          "0x9a1e5D7D2D68B6BA35958Dbb9d8db1090c1C6401",
          "0x46faf62987F9C270f93f1918Bf1c6de02De7010f",
          "0xA4A12DEA67D09ec7FF89e8E9B0d71857D796180B",
          "0x546C259e374640FA6A1bf39a845c7F829a46b5Fa",
        ],
      },
      {
        name: "Gathering Supplies",
        description: "The outer market is a riot of noise and color \u2014 stalls selling everything from dried meat to dubious potions. You're haggling for rations when an old courier stumbles into you, bleeding from a gash on his arm. He shoves a heavy leather sack into your hands.\n\n\"Take it. The mail. It needs to reach the inner gate post \u2014 I can't make it.\" He coughs blood. \"Ork raiders hit us on the north road. Killed my partner. I barely made it here.\" He grips your arm. \"The gate captain needs that sack. Show it to him and he'll grant you passage to the inner ring. Please.\"\n\nBefore you can answer, three thugs who saw the exchange step forward. They want the sack \u2014 and whatever's in it worth dying over.\n\nYou receive the Sack of Mail.",
        aiDeckBias: "balanced",
        aiStrength: 0.7,
        mftReward: 1200,
        npcAddresses: [
          "0xA68F8d50edDCD01BDA6849D499Db50090c3695a7",
          "0xEF5ABF519703Ee8830666448DE49cd35953a5a0C",
          "0x9de88faa0dbcfc75534d1b4fd277dadffcc4fd30",
        ],
      },
      {
        name: "Highway Men",
        description: "The stretch of road between the outer market and the inner gate is called the Gutter Run \u2014 a quarter mile of narrow street hemmed in by the city wall on one side and crumbling tenements on the other. City guard don't patrol here. The highway men do.\n\nThey step out of doorways on both sides, eight of them, well-armed and organized. Their leader \u2014 a woman in boiled leather with a crossbow aimed at your chest \u2014 tilts her head. \"We know you've got the courier's sack. Hand it over. That mail is worth more than your life to the right buyer.\"\n\nBehind her, two more appear on the rooftops with bows drawn. They've boxed you in perfectly.",
        aiDeckBias: "aggressive",
        aiStrength: 0.75,
        mftReward: 1500,
        npcAddresses: [
          "0xfaf9a6b6409b3e69f7d3b38099b41c45bbc29ba5",
          "0xea39112525f9169038435cF22f82e5436e0BCC4F",
          "0x691e4bEF9A83C00f8A35ed601090E42A8b953c77",
          "0xEE67c60d0E9687BB6D4cA2D90357FC8155F3c2c8",
          "0xE2E9C314E1AD0764b6ef22B6408674a33F84FD41",
          "0x67052bFEB30203A7bEEEAD76b58f51B931Ff4d1C",
          "0xE93889FC55B4c95227A0499d175890d001410D17",
          "0x5B5A2bcfd8b19814bCB6BE9091a892FF0ceB23c6",
          "0x11Bc51A6726A588D65ED7087E5F4eD853EC0F390",
          "0xB22bf25A33a539e769CEb48cad5E2C0951bEfb21",
        ],
      },
    ],
    completionBonus: 2500,
  },

  // ═══════════════════════════════════════════════════════════════
  // The Closed Gates — unlocks after completing Orkville OR the mail quest
  // ═══════════════════════════════════════════════════════════════
  {
    id: "closed-gates",
    title: "The Closed Gates",
    requiresAny: ["or", "nr"],
    maxParty: 6,
    mapPin: { x: 72, y: 30, region: "londa" },
    intro: "The inner gates of Newbsberd are shut and barred. A sergeant with a garrison squad blocks passage.",
    image: "/newbsberd-city.png",
    encounters: [{
      name: "The Closed Gates",
      description: "The inner gates are twenty feet of banded iron, shut tight. A sergeant stands before them with a squad of guards and a scowl that could curdle milk. \"Gates are closed. Ork war-band spotted on the north road \u2014 we're on lockdown until the threat is dealt with.\"\n\nYou hold up the courier's sack of mail. The sergeant's eyes widen. \"That's the garrison post \u2014 we've been waiting for that dispatch for three days.\" He reaches for it, then hesitates, looking past you at the road. \"But we've got a bigger problem. A pack of ork scouts made it past the outer patrols. They're in the ruins just north of here, and if they signal the main band, this whole district burns.\"\n\nHe meets your eyes. \"Deliver the mail and I'll open the gate. Or better yet \u2014 help us clear those orks AND deliver the mail, and I'll see you get more than just passage. What do you say?\"",
      aiDeckBias: "balanced",
      aiStrength: 0.8,
      mftReward: 2000,
      npcAddresses: [
        "0x4717ef81F44Ff2cd3fd7C51299595f1daD682631",
        "0x78cD29b5095D74d1AB90AC74023F5ecC9e41Cc87",
        "0x153Ec2E5DA59370c05Db0826a6489ebd348fe471",
        "0x9a1e5D7D2D68B6BA35958Dbb9d8db1090c1C6401",
        "0x46faf62987F9C270f93f1918Bf1c6de02De7010f",
        "0xA4A12DEA67D09ec7FF89e8E9B0d71857D796180B",
      ],
    }],
    completionBonus: 2500,
  },

  // ═══════════════════════════════════════════════════════════════
  // OR — Ork Road to Orkville (branches from Closed Gates)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "or",
    title: "Ork Road",
    requires: ["newbsberd"],
    maxParty: 9,
    mapPin: { x: 78, y: 20, region: "londa" },
    intro: "The north road out of Newbsberd climbs into the hills. Smoke rises on the horizon \u2014 Orkville, the war-band's stronghold.",
    image: "/adventure-level1.webp",
    encounters: [{
      name: "Ork Road Scouts",
      description: "The road north is littered with overturned carts and broken spears. Ork scouts patrol in packs of four, their war-paint fresh and their blades still bloody from the last caravan they hit. They spot you before you spot them.",
      aiDeckBias: "aggressive",
      aiStrength: 0.85,
      mftReward: 2000,
      npcAddresses: [
        "0x9de88faa0dbcfc75534d1b4fd277dadffcc4fd30",
        "0xfaf9a6b6409b3e69f7d3b38099b41c45bbc29ba5",
        "0xea39112525f9169038435cF22f82e5436e0BCC4F",
        "0x691e4bEF9A83C00f8A35ed601090E42A8b953c77",
        "0xEE67c60d0E9687BB6D4cA2D90357FC8155F3c2c8",
        "0xE2E9C314E1AD0764b6ef22B6408674a33F84FD41",
      ],
    }],
    completionBonus: 2000,
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
  },

  // ═══════════════════════════════════════════════════════════════
  // NR — Nobel Road / Wickleberry Lane
  // ═══════════════════════════════════════════════════════════════
  {
    id: "nr",
    title: "Wickleberry Lane",
    requires: ["newbsberd"],
    maxParty: 9,
    mapPin: { x: 80, y: 40, region: "londa" },
    intro: "The cobbled lane winds through manicured hedgerows toward the Wickleberry Estate. The courier's mail sack weighs heavy on your shoulder.",
    image: "/adventure-level1.webp",
    encounters: [{
      name: "Wickleberry Lane Bandits",
      description: "Wickleberry Lane cuts through rolling farmland \u2014 low stone walls, trimmed hedges, and not a tree for cover. That's what makes it dangerous. A group of bandits has set up in a ruined farmstead along the route, using the stone walls as a fortified position. They've been intercepting mail couriers for weeks. When they see the sack on your back, they know exactly what you're carrying.",
      aiDeckBias: "balanced",
      aiStrength: 0.85,
      mftReward: 2000,
      npcAddresses: [
        "0x67052bFEB30203A7bEEEAD76b58f51B931Ff4d1C",
        "0xE93889FC55B4c95227A0499d175890d001410D17",
        "0x5B5A2bcfd8b19814bCB6BE9091a892FF0ceB23c6",
        "0x11Bc51A6726A588D65ED7087E5F4eD853EC0F390",
        "0xB22bf25A33a539e769CEb48cad5E2C0951bEfb21",
        "0x4717ef81F44Ff2cd3fd7C51299595f1daD682631",
      ],
    }],
    completionBonus: 2000,
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
  },
];
