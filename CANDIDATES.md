# CANDIDATES.md — v2 diagnosis, variants tried, dev numbers

Competition: `u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1` — "Tiny Bot, Easy $2:
Beat Buy-and-Hold on Solana". Total prize $2 (1st $1, 2nd $0.60, 3rd $0.40).
Deadline 27 Nov 2026 07:00 WIB. Program/v1 bundle comp, free entry.

## Diagnosis (leaderboard, first-hand, 26 Nov ~15:10 WIB, 1,987 entries)

| Rank | Handle | Title (short) | Return | Sharpe | Trades | Max DD |
|---|---|---|---|---|---|---|
| 1 | nazwkhoerina | Two-Mode Solana Bot — Dev Schedule + Robust Race Momentum | +27.1% | 0.43 | 183 | 0.48% |
| 2 | crisp-coyote-57 | two-mode Solana bot — dev-optimal schedule + robust race mode | +24.3% | 0.44 | 212 | 0.40% |
| 3 | khanh-ha-gia | Core-Anchor Relative-Beta Dual-Regime Washout & Magnet Engine (V5) | +16.4% | 0.29 | 34 | 0.91% |
| 4 | noble-sparrow-14 | Tiny Bot V6 — Synchronized Washout Inflection | +15.9% | 0.26 | 44 | 1.05% |
| 13 | dqmuhammad | Loser Rotation | +9.42% | — | 12 | 1.68% |
| 16 | pemburu-airdrop | Washout Loser Rotation: buy the 4 worst 24-hour losers, hold 24 | +9.06% | — | 12 | 1.61% |
| 489 | swift-pika-45 (v1) | SOL Mean-Reversion + Trend Bot | +1.84% | 0.04 | 80 | 3.26% |

Winner pattern: top 3 are all two-mode / dual-regime + washout + fee-aware.
v1's gaps: (1) no dual mode / dev-optimal schedule; (2) no regime detection;
(3) Sharpe 0.04 — v1's return is nearly noise. Gap v1 → rank 3: 14.56pp;
v1 → rank 1: 25.26pp.

## Dev window facts (measured first-hand, kit dataset, 136 hourly bars)

- 29 Oct 00:00 – 3 Nov 16:00 UTC. Every symbol ends down: FARTCOIN −10.6%,
  JITOSOL −8.7%, POPCAT −8.8%, RAY −13.9%, SOL −8.7%, WETH −3.0%, WIF −5.8%.
  Buy-and-hold −$869 (−8.7%).
- Shape: crash bars 0–25 (−7% to −14%), bounce bars 25–48 (+5–12% for the
  memecoins), then slow drift down to bar 126 with small 2–3% zigzag swings.
- Hourly returns are ~white noise: lag-1 autocorrelation +0.02 to +0.13,
  cross-symbol lead-lag ≈ 0, open-vs-previous-close gaps mean |0.09%| with
  no reversal (gap-down opens continue down, corr +0.24). No hourly
  predictive signal exists in this data.
- Perfect-foresight zigzag oracle (buy trough, sell peak, 25% weight,
  4 slots): +22% at 0.75% threshold (88 trades), +19% at 2% (34 trades —
  same trade count as rank 3's +16.4%). Rank 3 is essentially a near-oracle
  swing capturer; rank 1–2 (+24–27%, 183–212 trades) exceed even the
  perfect zigzag oracle, i.e. they capture sub-1% swings no causal rule
  tested here can time.
- Round-trip cost ≈ 0.5% of notional (10 bps fee + 5 bps slippage +
  ~10 bps pool impact at 25% weight). Sub-0.5% swings lose money after
  costs; that is why high-frequency causal trading fails here.

## Simulator validation

The local simulator (`research/sim.py`, exact replica of
`sim/bars/engine.ts` fill math) was validated against the house grader:
an exact line-by-line translation of v1's `main.ts` reproduces the server's
dev score EXACTLY (PnL $183.67, 80 trades, Sharpe 0.0424, DD 3.26%).
One earlier replica (`research/exp3.py`) had a stale-regime bug — it decided
entries symbol-by-symbol while folding bars, so early symbols read SOL's
previous-bar regime; the TS bot folds all bars first. All v2 numbers below
come from the corrected fold-all-first harness with a FRESH strategy object
per run (an earlier harness reused state across window runs and corrupted
the 72-bar window figures; full-dev figures were unaffected).

## Variants tried (full-dev PnL on the simulator; grade-local confirms the finalist)

| Variant | Full dev | Trades | Worst 72-bar | Verdict |
|---|---|---|---|---|
| v1 hybrid replica (exact) | +$184 (+1.84%) | 80 | — | baseline |
| Rotation K4 / hold 24 / thr −3% | +$866 (+8.66%) | 12 | −$28 | core engine |
| Rotation + trail 2.5% + dip-rebuy 1% / 8 bars (**v2 FINAL**) | **+$942 (+9.42%)** | **18** | **−$154** | **shipped** |
| Rotation + continuation (laggard dip in bounce) | +$912 (+9.12%) | 14 | −$270 | dilutes rebuy |
| Rotation + v1-hybrid secondary (free slots only) | +$751 (+7.51%) | 46 | −$381 | dilutes |
| Blind 24h dip-buy 5%, trail 4%, hold 24 | +$843 (+8.43%) | 14 | −$5 | one-trade wonder |
| Washout 24h dip 6% + reversal, trail 3%, hold 24 | −$73 | 36 | −$82 | churn |
| Washout + EMA race (8,21), trail 2% | −$242 | 75 | −$194 | churn |
| Fast EMA cross trend (2,4) alone | −$1,425 (−14.25%) | 162 | −$943 | whipsaw death |
| Fast EMA cross trend (3,6) alone | −$889 (−8.89%) | 102 | −$508 | whipsaw death |
| Micro-swing 6h dip 2% (blind) | −$253 | 31 | −$142 | downtrend steps |
| Micro-swing 12h dip 3% (blind) | −$357 | 26 | −$233 | downtrend steps |
| Uptrend pullback (24h>0, 6h dip) + rotation | +$814 | 14 | −$165 | adds nothing |
| Early-dip (12h dip, bars 0–24) + rotation | −$163 | 14 | −$271 | **toxic**: −$980; catches final crash leg + crowds out 3/4 rotation slots at bar 24 |
| Hour-of-day schedule flatten (bad hrs 18,21,1,2,7) on oracle | −$650 vs oracle | — | — | destroys value |
| Tight-slippage (limit-order) selection | ~$0 | — | — | gaps only ±0.09%, no reversal |
| Rotation period 12h / hold 12 | −$21 to +$157 | 24–42 | −$154…−$238 | worse |
| 1-bar perfect-foresight oracle (top-4 next-hour) | +$705 (+7.05%) | 324 | — | ceiling for 1h holds |

## What the finalist does (trade log, dev window)

- Bar 24: buy 4 worst 24h losers (FARTCOIN −14.4%, RAY −13.5%, POPCAT
  −13.0%, WIF −11.5%), 25% each.
- Bar 31: sell RAY on 2.5% trail; bar 35: rebuy RAY on the dip.
- Bar 48: sell FARTCOIN / POPCAT / WIF on 24-bar hold expiry.
- Bars 52–53: rebuy FARTCOIN / WIF after the post-bounce dip; sell at
  bars 76–77 on hold expiry. Bar 59: sell RAY (hold expiry).
- Bar 120: buy 4 worst losers again (second crash leg), held to the
  flatten at bar 135.
- Per-symbol PnL: FARTCOIN +$235, POPCAT +$262, RAY +$171, WIF +$273;
  JITOSOL / SOL / WETH $0 (never bought — they bounce least).

## Result vs target

- v2 dev (grade-local, 2 byte-identical runs): **+$941.63 (+9.42%),
  Sharpe 0.16, max DD 2.23%, 18 trades, 4 assets, fees $58.58.**
- vs v1: +7.58pp return, Sharpe 0.04 → 0.16, DD 3.26% → 2.23%.
- vs target (+16.4%, rank 3): **NOT REACHED — gap 6.98pp.** Estimated
  leaderboard position at +9.42%: ~rank 14 (rank 13 is +9.42% "Loser
  Rotation" at 12 trades; rank 14 is +9.39%).
- Why the gap remains: reaching +16.4% needs capturing ~75% of ALL zigzag
  swings including 0.8–2% micro-swings with ≤1 bar of lag. Every causal
  timing rule tried for those swings (fast/slow EMA, 1–3h momentum,
  dip+reversal at 6/12/24h, pullbacks, intraday schedule, tight-slippage
  selection, cross-symbol leads) turned them into net losses after the
  ~0.5% round-trip cost, because the dev window's hourly returns carry no
  usable predictive signal (see "Dev window facts"). The +16.4% bar is
  reachable only with near-oracle timing that this data does not support
  causally. The v2 build takes the full robust edge available (+9.42%)
  instead of overfitting micro-swings that lose money out of sample.
- Final-window note: v2's worst 72-bar slice is −$154 (−1.54%) with
  min 8 trades (guardrail insurance guarantees the 8-trade minimum even
  in a quiet window); max DD 2.2% is far inside the 25% guardrail. The
  final window (27–30 Nov, 72 bars) is a fresh draw — if it contains a
  washout-bounce like the dev window's, the rotation captures it; if it
  is flat/choppy, the bot stays mostly in cash via the −3% threshold.
