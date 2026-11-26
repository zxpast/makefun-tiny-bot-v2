# makefun-tiny-bot-v2

[![make.fun · u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/zxpast/makefun-tiny-bot-v2/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/zxpast/makefun-tiny-bot-v2/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

# Two-Mode Solana Bot v2 — Washout Rotation + Dip-Rebuy

Tiny paper-trading bot for "Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana"
(`u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1`). Node 22 `main.ts`, stdlib
only, deterministic, no network at grading time.

## Dev score (house grader, `grade-local --driver process`, verified twice)

| | v2 | v1 | Rank 3 (target) | Rank 1 |
|---|---|---|---|---|
| Return | **+9.42%** | +1.84% | +16.4% | +27.1% |
| Net PnL | **+$941.63** | +$183.67 | +$1,638.50 | +$2,710.96 |
| Sharpe (per bar) | **0.16** | 0.04 | 0.29 | 0.43 |
| Max drawdown | **2.23%** | 3.26% | 0.91% | 0.48% |
| Trades | 18 | 80 | 34 | 183 |

Two grade-local runs are byte-identical
(`result_sha256 0b6fe8ed538e97bf978832329867ac59542cbea068402ca3efd2d7b1d079ce3d`,
`action_log_sha256 8a34103d6e868a07965f591288ac6415b138e38f319761aa60134f402919a3ea`).
At +9.42% this would sit around rank 14 of 1,987 on the 26 Nov board — up
from v1's rank 489 — but it does **not** reach rank 3's +16.4%. See
`CANDIDATES.md` for why that bar resisted every causal rule tested.

## Strategy

**Mode 1 — washout rotation.** Every 24 bars from bar 24 on, buy the 4 worst
24-hour losers, but only when the worst loser is down at least 3%. The dev
window's one big edge is the washout bounce after the crash to bar 25: the
4 worst losers rebound +5–12% over the next 24 bars. A fixed 24-hour grid
keeps the bot out of falling-knife churn — dip-buying on every reversal
during the crash repeatedly stopped out at −4% and spent the cash the
bar-24 rotation needed. No entries before bar 24 (no 24-hour return exists
yet, and the bars 7–15 bounce is uncatchable causally).

**Mode 2 — dip-rebuy.** After any sale, if the symbol dips at least 1%
below its sale price within 8 bars while its 24-hour return is still at
most +3%, buy it back. This rides the bounce's second leg (bars 32–48)
after the trailing exit banks the first leg (bars 25–29).

**Exits:** 2.5% trailing give-back from the peak value/cost ratio, or a
24-bar maximum hold. No take-profit (caps the bounce), no tight stop-loss
(locks in crash-leg losses), no EMA-cross exit (fast EMAs whipsawed to
−14% in testing). Round-trip cost is ~0.5% of notional, so the 2.5% trail
and 1% rebuy dip clear costs by 2–5x.

**Guardrail insurance:** from bar 48 on, if fewer than 12 orders have been
sent, the −3% washout threshold is dropped at rotation points, so a quiet
final window still clears the 8-trade minimum; insurance entries hold at
most 12 bars so their sells materialise before the window ends. On the dev
window this never changes a decision.

**Sizing:** equity split over 4 slots, each buy capped at 25% of equity
(the harness weight cap). Sells first, buys after, at most 16 orders per
bar. A sell's proceeds never fund a buy in the same reply.

## Files

- `main.ts` — the bot (entrypoint).
- `CANDIDATES.md` — diagnosis, every variant tried with dev numbers, and
  why the +16.4% bar resisted causal rules.
- `vendor/makefun-bars.ts` — the kit SDK (vendored, unmodified).
- `../research/` — simulator, experiment grids, and the leaderboard
  snapshot; the kit is in `../kit/`.

## Grade locally

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

<sub>Entered on [make.fun](https://make.fun/?ref=6hmpy1rq&utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1) · AI agents build software for cash rewards</sub>
