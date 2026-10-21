// risk-sentinel: watches a dreamDEX perps account and de-risks it before the venue has to.
// Rules (all env-configurable): max position notional, max account leverage, min distance to
// liquidation, max unrealized loss, and margin status. A breach cancels resting orders and
// reduces or closes the position with a crossing IOC.
import { ex, market, place, close, position, marginState, mid, minQty, me, j, DRY } from "./perp.ts";
const env = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);
const SYMBOL = process.env.SYMBOL ?? "ETH";
const MAX_NOTIONAL = env("MAX_NOTIONAL_USD", 50);
const MAX_LEV = env("MAX_LEVERAGE", 3);
const MIN_LIQ_DIST = env("MIN_LIQ_DISTANCE_PCT", 15);
const MAX_LOSS = env("MAX_LOSS_USD", 2);
const INTERVAL = env("INTERVAL_SEC", 10);
const CYCLES = env("CYCLES", 3);
const DEMO_OPEN = process.env.DEMO_OPEN === "true"; // open a min-size probe so the rules have something to guard

const m = await market(SYMBOL);
const dec = m.info.baseDecimals;
if (DEMO_OPEN) {
  const p: any = await position(SYMBOL);
  if (BigInt(p.size) === 0n) { const { ask, mid: md } = await mid(SYMBOL); await place(SYMBOL, "long", await minQty(SYMBOL), (ask ?? md) * 1.01, "market", "sentinel-demo-open"); }
}
for (let i = 0; i < CYCLES; i++) {
  const acct: any = await marginState();
  const p: any = await position(SYMBOL);
  const size = BigInt(p.size);
  const { mid: mk } = await mid(SYMBOL);
  const equity = Number(acct.equity) / 1e18 + Number(acct.lockedCollateral) / 1e18;
  const qty = Math.abs(Number(size)) / 10 ** dec;
  const notional = qty * mk;
  const entry = Number(p.avgEntryPrice) / 1e18;
  const upnl = size === 0n ? 0 : (mk - entry) * qty * (size > 0n ? 1 : -1);
  let liq: number | null = null;
  try { const l: any = await ex.client.getLiquidationPrice({ marginBank: m.info.marginBank, pool: m.info.poolAddress, account: me() }); liq = l == null ? null : Number(l.liquidationPrice ?? l) / 1e18; } catch {}
  const liqDist = liq && liq > 0 ? (Math.abs(mk - liq) / mk) * 100 : Infinity;
  const lev = equity > 0 ? notional / equity : 0;
  const breaches = [
    notional > MAX_NOTIONAL && `notional $${notional.toFixed(2)} > $${MAX_NOTIONAL}`,
    lev > MAX_LEV && `leverage ${lev.toFixed(2)}x > ${MAX_LEV}x`,
    liqDist < MIN_LIQ_DIST && `liq distance ${liqDist.toFixed(1)}% < ${MIN_LIQ_DIST}%`,
    -upnl > MAX_LOSS && `uPnL ${upnl.toFixed(3)} < -$${MAX_LOSS}`,
    acct.marginStatus !== "Healthy" && `margin status ${acct.marginStatus}`,
  ].filter(Boolean) as string[];
  console.log(`[cycle ${i + 1}] ${m.symbol} size=${qty} notional=$${notional.toFixed(2)} equity=$${equity.toFixed(2)} lev=${lev.toFixed(3)}x liq=${liq ?? "-"} uPnL=${upnl.toFixed(4)} status=${acct.marginStatus}`);
  if (size !== 0n && breaches.length) {
    console.log("BREACH:", breaches.join("; "), "-> cancel resting orders + close");
    try { const oo = await ex.fetchOpenOrders(m.symbol); for (const o of oo) await ex.cancelOrder(o.id, m.symbol); } catch (e) { console.log("cancel-all skipped", String(e).slice(0, 100)); }
    await close(SYMBOL, "sentinel-derisk");
  } else console.log(breaches.length ? "flat; nothing to de-risk" : "within limits");
  if (i < CYCLES - 1) await new Promise((r) => setTimeout(r, INTERVAL * 1000));
}
process.exit(0);
