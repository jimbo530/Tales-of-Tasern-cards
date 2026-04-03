# Tales of Tasern — D20 Hex RPG

This is the **D20 hex-grid RPG** (Tales of Tasern). It is NOT the card-battle game.

- **Branch**: `d20-stats` — all D20 RPG work goes here
- **System**: D&D 3.5e rules + 5e spells, stats adjusted −10 (min 1) from LP-backed NFTs
- **Chains**: Base (primary) + Polygon — NFTs stats derived from LP token holdings
- **Shared data**: `src/lib/contracts.ts` has GAME_NFTS (shared with card game on `main`)
- **NFT stats**: Pulled from Supabase database, computed by `/api/stats` route
- **Spell system**: Dual-edition (3.5 + 5e), 5e concentration for all spells
- **Battle**: Hex-grid tactical combat in `src/lib/hexCombat.ts` + `src/hooks/useHexBattle.ts`
- **World**: Hex world map with multi-party exploration, faction rep, follower system
- **Economy**: Food-based pyramid, coin weight, carry capacity
- **Deploy contracts**: Always use localhost HTML pages in `public/deploy-*.html` with embedded bytecode (never Remix/CLI)

The card-battle game is on the `main` branch of this same repo. Never merge code between branches.

@AGENTS.md

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
