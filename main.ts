// Tiny Bot v2 — two-regime Solana trader: washout rotation plus dip-rebuy.
//
// Why two regimes: v1 ("SOL Mean-Reversion + Trend Bot") finished at rank
// 489/1987 with +1.84% and Sharpe 0.04 (leaderboard 26 Nov 15:01 WIB).
// The top three at that moment — +27.1% (183 trades), +24.3% (212 trades),
// +16.4% (34 trades) — all ran two-mode / dual-regime bots. A single
// strategy was never going to close a 14-25 point gap, so v2 adds a second
// leg. Everything below was measured first-hand on the dev window (136
// hourly bars, 29 Oct - 3 Nov 2026; every symbol ends the window down
// 3-14%, buy-and-hold -$869):
//
//   Mode 1 — WASHOUT ROTATION, the profit engine. On a fixed 24-bar grid
//   (first rotation at bar 24), buy the 4 worst 24-hour losers — but only
//   if the worst loser is down at least 3%. The dev window's single real
//   edge is the bounce after the crash bottoms at bar 25: the 4 worst
//   losers (FARTCOIN, RAY, POPCAT, WIF) rebound +5-12% over the next 24
//   bars. A fixed grid, rather than buying every dip signal, is what
//   keeps the bot out of the falling-knife churn that sank v1: dip-buying
//   on every reversal during the crash stopped out at -4% again and again
//   and, worse, spent the cash the bar-24 rotation needed (measured:
//   early-dip entries cost v1's successor -$980 and crowded 3 of the 4
//   rotation slots at bar 24). No entries before bar 24 at all — there is
//   no 24-hour return to rank losers by before then, and the bars 7-15
//   bounce cannot be caught causally (every uptick rule tried fired on
//   dead-cat bounces through the second leg down to bar 25).
//
//   Mode 2 — DIP-REBUY, the second leg. After any sale, if the symbol
//   dips at least 1% below its sale price within 8 bars while its 24-hour
//   return is still at most +3% (still washout territory), buy it back.
//   That rides the bounce's second leg (bars 32-48) after the 2.5%
//   trailing exit banks the first leg (bars 25-29). Measured: +$75 over
//   the rotation alone.
//
//   Exits (fee-aware): a 2.5% trailing give-back from the peak value/cost
//   ratio, or a 24-bar maximum hold. No take-profit (it caps the bounce),
//   no stop-loss tighter than the trail (it locks in crash-leg losses),
//   no EMA cross exit (fast EMAs whipsawed to -14% in testing; slow EMAs
//   lag the 4-bar first leg entirely). Round-trip cost is ~0.5% of
//   notional (10 bps fee + 5 bps slippage + ~10 bps pool impact at 25%
//   weight), so the 2.5% trail and 1% rebuy dip both clear costs by 2-5x.
//
//   Guardrail insurance: from bar 48 on, if fewer than 12 orders have
//   been sent, the -3% washout threshold is dropped at rotation points, so
//   a quiet final window still clears the 8-trade minimum; insurance
//   entries hold at most 12 bars so their sells materialise before the
//   window ends. On the dev window this never changes a decision (18
//   orders sent).
//
//   Sizing: equity split over 4 slots, each buy capped at 25% of equity
//   (the harness weight cap); sells are sent first, buys after, at most
//   16 orders per bar. A sell's proceeds never fund a buy in the same
//   reply, and a sell never frees a slot in the same reply — both match
//   the harness's decision-time checks.
//
// On the dev window this scores +$942 net PnL (+9.42%, 18 trades, 2.2%
// max drawdown) in the local simulator, which reproduces the house grader
// exactly on v1 (PnL $183.67, 80 trades, Sharpe 0.042, DD 3.26% — all
// byte-identical to the server's dev score). That is +7.6 points over v1
// and would sit around rank 13-16 on the 26 Nov board, but it does NOT
// reach rank 3's +16.4%: the remaining gap is micro-swings of 0.8-2%
// that a perfect-foresight oracle captures (+22% ceiling) but no causal
// rule tested here captures — hourly returns show no usable
// predictability (lag-1 autocorrelation ~0.0-0.13, cross-symbol lead-lag
// ~0, open/close gaps ~0.09% mean absolute with no reversal). See
// CANDIDATES.md for the full experiment log. Nothing here reads the
// clock, the environment or randomness: the same bars give the same
// orders, run after run.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type OrderInput, type SellInput } from './vendor/makefun-bars.ts';

/** Rotation grid: every 24 bars, first rotation at bar 24 (24h data exists). */
const ROTATION_PERIOD = 24;
const ROTATION_FIRST_BAR = 24;
/** Worst 24h loser must be down at least this much for a rotation buy. */
const WASHOUT_THRESHOLD = 0.03;
/** Rotation buys the 4 worst 24h losers. */
const ROTATION_PICKS = 4;
/** Trailing give-back from the peak value/cost ratio that exits a position. */
const TRAIL = 0.025;
/** Maximum hold: 24 bars (12 for guardrail-insurance entries). */
const MAX_HOLD_BARS = 24;
const INSURANCE_HOLD_BARS = 12;
/** Dip-rebuy: within this many bars of a sale, ... */
const REBUY_WINDOW_BARS = 8;
/** ... if the close is at least this far under the sale price, ... */
const REBUY_DIP = 0.01;
/** ... while the 24h return is at most this (still washout territory). */
const REBUY_MAX_R24 = 0.03;
/** Slots: one per rotation symbol (4), each buy capped by the weight cap. */
const SLOTS = 4;
const MAX_SLIPPAGE_BPS = 100;
/** Guardrail insurance: from this bar on, with few orders sent, drop the washout threshold. */
const INSURANCE_BAR = 48;
const INSURANCE_ORDERS = 12;
/** Close history kept per symbol (enough for the 24-bar lookbacks). */
const CLOSES_KEPT = 40;

/** Last closes, oldest first, per symbol. */
const closes = new Map<string, number[]>();
/** Bar the position was entered on, and its peak value / cost ratio since. */
const heldSince = new Map<string, number>();
const peak = new Map<string, number>();
/** Maximum hold for the current position (24, or 12 for insurance entries). */
const holdBars = new Map<string, number>();
/** Last sale per symbol: bar and close it sold at (drives the dip-rebuy). */
const lastSaleBar = new Map<string, number>();
const lastSalePrice = new Map<string, number>();
/** Orders this run has sent (buys + sells): the guardrail insurance reads it. */
let sentOrders = 0;

function pushClose(symbol: string, close: number): number[] {
  let list = closes.get(symbol);
  if (list === undefined) {
    list = [];
    closes.set(symbol, list);
  }
  list.push(close);
  if (list.length > CLOSES_KEPT) list.shift();
  return list;
}

/** 24-hour return of the symbol as of this bar's close, or null without 25 closes. */
function return24h(symbol: string): number | null {
  const list = closes.get(symbol);
  if (list === undefined || list.length < 25) return null;
  return list[list.length - 1]! / list[list.length - 25]! - 1;
}

/** Fresh symbols ranked worst-first by 24-hour return (losers first). */
function rankLosers(symbols: readonly { symbol: string }[], fresh: ReadonlySet<string>): { symbol: string; r24: number }[] {
  const ranked: { symbol: string; r24: number }[] = [];
  for (const { symbol } of symbols) {
    if (!fresh.has(symbol)) continue;
    const r24 = return24h(symbol);
    if (r24 !== null) ranked.push({ symbol, r24 });
  }
  ranked.sort((a, b) => a.r24 - b.r24);
  return ranked;
}

/** Dip-rebuy eligibility: sold within the window, dipped far enough under
 *  the sale price, and still in washout territory on the 24h return. */
function canRebuy(symbol: string, seq: number): boolean {
  const at = lastSaleBar.get(symbol);
  const price = lastSalePrice.get(symbol);
  if (at === undefined || price === undefined) return false;
  const age = seq - at;
  if (age < 1 || age > REBUY_WINDOW_BARS) return false;
  const r24 = return24h(symbol);
  const list = closes.get(symbol);
  if (r24 === null || list === undefined) return false;
  const dipFromSale = list[list.length - 1]! / price - 1;
  return dipFromSale <= -REBUY_DIP && r24 <= REBUY_MAX_R24;
}

await runBars({
  onBatch(state, batch) {
    const fresh = new Set<string>();
    for (const bar of batch.bars) fresh.add(bar.symbol);
    // Fold this bar in first: every entry below reads every symbol's
    // indicators as of THIS bar's close, including SOL's.
    for (const bar of batch.bars) pushClose(bar.symbol, Number(bar.c));
    if (state.warmingUp) return [];

    // Exits: trailing give-back from the peak value/cost ratio, or max hold.
    const sells: SellInput[] = [];
    for (const { symbol } of state.hello.symbols) {
      if (!fresh.has(symbol)) continue;
      const held = state.positions.get(symbol);
      if (held === undefined) continue;
      const value = state.value(symbol, held.qty);
      const ratio = held.cost === 0n ? 1 : Number(value) / Number(held.cost);
      const p = peak.get(symbol) ?? 1;
      if (ratio > p) peak.set(symbol, ratio);
      const giveBack = (peak.get(symbol) ?? 1) - ratio;
      const heldFor = state.seq - (heldSince.get(symbol) ?? state.seq);
      if (giveBack >= TRAIL || heldFor >= (holdBars.get(symbol) ?? MAX_HOLD_BARS)) {
        sells.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        peak.delete(symbol);
        heldSince.delete(symbol);
        holdBars.delete(symbol);
        lastSaleBar.set(symbol, state.seq);
        const close = closes.get(symbol);
        if (close !== undefined) lastSalePrice.set(symbol, close[close.length - 1]!);
      }
    }

    // Entries: rotation buys the washout losers; rebuys catch the bounce's
    // second leg on symbols sold earlier. Rotation first, rebuys after.
    const isRotationBar = state.seq >= ROTATION_FIRST_BAR && (state.seq - ROTATION_FIRST_BAR) % ROTATION_PERIOD === 0;
    const insurance = state.seq >= INSURANCE_BAR && sentOrders < INSURANCE_ORDERS;
    const rotation: string[] = [];
    if (isRotationBar) {
      const ranked = rankLosers(state.hello.symbols, fresh);
      if (ranked.length > 0 && (insurance || ranked[0]!.r24 <= -WASHOUT_THRESHOLD)) {
        for (const entry of ranked.slice(0, ROTATION_PICKS)) rotation.push(entry.symbol);
      }
    }
    const rebuy: string[] = [];
    for (const { symbol } of state.hello.symbols) {
      if (!fresh.has(symbol) || state.positions.has(symbol)) continue;
      if (canRebuy(symbol, state.seq)) rebuy.push(symbol);
    }

    const { caps, fees } = state.hello;
    const orders: OrderInput[] = sells.slice(0, caps.max_orders_per_bar);
    const slots = Math.min(SLOTS, state.hello.symbols.length, caps.max_open_positions);
    const stake = state.equity / BigInt(slots);
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    let room = slots - state.positions.size;
    let cash = state.cash;
    for (const symbol of [...rotation, ...rebuy.filter((s) => !rotation.includes(s))]) {
      if (room <= 0 || orders.length >= caps.max_orders_per_bar) break;
      if (state.positions.has(symbol)) continue;
      let slice = stake < byWeight ? stake : byWeight;
      if (cash < slice) slice = cash;
      if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) break;
      orders.push({ side: 'buy', symbol, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput);
      heldSince.set(symbol, state.seq);
      peak.set(symbol, 1);
      holdBars.set(symbol, insurance && rotation.includes(symbol) ? INSURANCE_HOLD_BARS : MAX_HOLD_BARS);
      cash -= slice;
      room--;
    }
    sentOrders += orders.length;
    return orders;
  },
});
