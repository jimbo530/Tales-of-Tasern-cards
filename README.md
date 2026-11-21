# Tales of Tasern — Cards

**NFT card-battle game with adventure mode.** Hero stats derive from on-chain LP token holdings — the more LP backing your card, the stronger it plays.

> Sibling project to **[Tales-of-Tasern](https://github.com/jimbo530/Tales-of-Tasern)** (the D20 hex RPG). Same universe, different game.

| | **Tales-of-Tasern** | **Tales-of-Tasern-cards** |
|---|---|---|
| Genre | D20 hex tactical RPG | NFT card battler with adventure mode |
| Core loop | 3x3 grid combat, named NPCs, story quests | Card duels (Supabase matchmaking) + map-based adventure encounters |
| Hero source | NFT characters with LP-backed stats | Same NFT system, played as cards |
| Chains | Base + Polygon | Base + Polygon |

## Stack

- Next.js 16 + React 19 + Tailwind 4
- wagmi + viem + OnchainKit (Base + Polygon)
- Supabase (lobbies, saves, marketplace)
- Solidity PowerUp contracts (Base + Polygon variants for every token)

## How a card gets its stats

Each NFT hero contract holds locked Uniswap LP positions across multiple tokens (MfT, AZOS, BURGERS, CHAR, EGP, TGN, ...). The `/api/stats` route reads those positions on-chain and computes the card's ATK / HP / abilities. More LP = stronger card. **Forever.**

## Repository layout

```
src/
  app/                — Next.js app routes (incl. /api/stats).
  components/
    CardBattleBoard.tsx  — Card duel board.
    BattleView.tsx       — Battle renderer.
    AdventureMode.tsx    — Map-based encounter system.
    Matchmaking.tsx      — Supabase lobby UI.
  lib/contracts.ts    — Synced from ../nft-lp-database via `npm run sync-contracts`.

contracts/
  PowerUpBase.sol     — Generic PowerUp (Base).
  PowerUpPolygon.sol  — Generic PowerUp (Polygon).
  PowerUp{ATK,AZOS,BURGERS,CHAR,EGP,TGN,WETHEGP}.sol  — Token-specific powerups.
  LPFaucet.sol        — LP reward faucet.
  RewardPoolBase.sol  — Reward pool primitive.

scripts/
  refresh-stats.js    — Recompute card stats.
  sync-contracts.js   — Pull latest from nft-lp-database.
```

## Getting started

```bash
npm install
npm run dev          # next dev — http://localhost:3000
npm run sync-contracts
npm run refresh-stats
```

## Contract deploys

Deploys use the in-repo HTML deployer pages (`public/deploy-*.html`) with embedded bytecode rather than Remix or Hardhat CLI — see [CLAUDE.md](./CLAUDE.md).

## License

MIT
