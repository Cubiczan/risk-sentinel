// Shared dreamDEX perps helpers (Hideki testnet 50383) on @somnia-chain/markets-sdk.
import { ORDER_TYPE } from "@somnia-chain/markets-sdk";
import { makeEx, me, j } from "./lib.ts";
import { appendFileSync } from "node:fs";
export { j, me };
export const ex = makeEx();
export const TXLOG = process.env.TXLOG ?? "txs.jsonl";
export function logTx(kind: string, hash: string|undefined, extra: any = {}) {
  const row = { t: new Date().toISOString(), kind, hash, ...extra };
  appendFileSync(TXLOG, j(row).replace(/\n\s*/g," ") + "\n"); console.log(kind, hash ?? "", j(extra).replace(/\n\s*/g," "));
}
let markets: any;
export async function market(sym: string) { markets ??= await ex.loadMarkets(); const s = sym.includes("/") ? sym : `${sym}/USDso:USDso`; const m = markets[s]; if (!m) throw new Error("no market " + s); return m; }
export const toRaw = (x: number, dec: number) => BigInt(Math.round(x * 10 ** Math.min(dec, 12))) * 10n ** BigInt(Math.max(0, dec - 12));
export const align = (q: bigint, step: bigint) => (q / step) * step;
export function alignPrice(p: bigint, m: any) { const t = BigInt(m.info.tickSize ?? m.info.priceTick ?? 1n); return t > 0n ? (p / t) * t : p; }
export async function mid(sym: string) { const m = await market(sym); const b = await ex.fetchOrderBook(m.symbol, 1); const bid=b.bids[0]?.[0], ask=b.asks[0]?.[0]; const t = await ex.fetchTicker(m.symbol); return { bid, ask, mid: bid && ask ? (bid+ask)/2 : t.last, last: t.last }; }
/** Minimum-size quantity (raw) for a market, optionally times k. */
export async function minQty(sym: string, k = 1n) { const m = await market(sym); return BigInt(m.info.minQuantity) * k; }
export async function marginState() { const m = await market("BTC"); return ex.client.getMarginAccount(m.info.marginBank, me()); }
export async function deposit(amount: number) { const m = await market("BTC"); const r = await ex.trader.depositMargin({ marginBank: m.info.marginBank, amount: toRaw(amount, 18) }); logTx("depositMargin", r.hash, { amount }); return r; }
export const DRY = process.env.DRY_RUN === "true";
export async function place(sym: string, side: "long"|"short", qty: bigint, price: number, type: "limit"|"market" = "limit", tag = "") {
  const m = await market(sym);
  if (DRY) { console.log(`[dry-run] ${type} ${side} ${Number(qty)/10**m.info.baseDecimals} ${m.symbol} @ ${price} (${tag})`); return { hash: undefined, orderId: undefined, filled: type === "market" ? qty : 0n } as any; }
  const p = alignPrice(toRaw(price, 18), m);
  const r = await ex.trader.placePerpOrder({ pool: m.info.poolAddress, isBid: side === "long", price: p, quantity: qty, orderType: type === "market" ? ORDER_TYPE.MARKET : ORDER_TYPE.LIMIT });
  const filled = (r.fills ?? []).reduce((s: bigint, f: any) => s + f.quantityFilled, 0n);
  logTx(`place ${type} ${side}`, r.hash, { tag, symbol: m.symbol, qty: Number(qty)/10**m.info.baseDecimals, price, orderId: r.orderId, filled: Number(filled)/10**m.info.baseDecimals });
  return { ...r, filled };
}
export async function cancel(sym: string, orderId: bigint, tag = "") { const m = await market(sym); if (DRY) { console.log(`[dry-run] cancel ${orderId}`); return; } const r = await ex.trader.cancelOrder({ pool: m.info.poolAddress, orderId }); logTx("cancel", r.hash, { tag, symbol: m.symbol, orderId }); return r; }
export async function position(sym: string) { const m = await market(sym); return ex.client.getPerpPosition({ marginBank: m.info.marginBank, account: me(), pool: m.info.poolAddress }); }
/** Close the whole position in `sym` with a crossing IOC (reduce by opposite side). */
export async function close(sym: string, tag = "", slip = 0.01) {
  const m = await market(sym); const pos: any = await position(sym);
  const size: bigint = BigInt(pos.size ?? pos.quantity ?? 0); if (size === 0n) { console.log("flat", m.symbol); return; }
  const isLong = size > 0n; const q = isLong ? size : -size; const { bid, ask, last } = await mid(sym);
  const px = isLong ? (bid ?? last) * (1 - slip) : (ask ?? last) * (1 + slip);
  return place(sym, isLong ? "short" : "long", q, px, "market", tag || "close");
}
