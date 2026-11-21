# Security Policy

Tales of Tasern Cards uses on-chain LP positions as the source of card stats and ships ~20 token-specific PowerUp contracts plus an LP faucet and reward pool. Bugs can affect real LP positions, card-stat integrity, or matchmaking auth.

## Reporting a Vulnerability

**Preferred:** [GitHub Private Vulnerability Reporting](https://github.com/jimbo530/Tales-of-Tasern-cards/security/advisories/new) — opens a private advisory thread.

**Fallback:** _Add a contact email here (e.g. `security@carbon-counting-club.com` or DM `@memefortrees.base.eth`)._

### Please include

- Affected file/function and line numbers
- Impact (severity, affected funds/users, attack precondition)
- Reproduction steps or proof-of-concept
- Suggested fix if you have one

### What to expect

- Acknowledgement within 72 hours
- Severity triage within 7 days
- Coordinated disclosure once a fix is deployed or determined infeasible

## Scope

**In scope:** `contracts/` (PowerUp\*.sol, LPFaucet.sol, RewardPoolBase.sol), `src/app/api/stats` (card-stat computation), Supabase-touching routes.

**Out of scope:** Game balance / card design, upstream framework bugs, content typos.

## Out-of-Scope Reports

Please do not file public issues for:

- Theoretical attacks without a working PoC
- Best-practice / style critiques (those are fine as regular issues)
- Issues in upstream npm dependencies (file with the upstream)

Thank you for helping keep this project safe.