# Risk Sentinel — dreamDEX perps bot

A guard bot for a dreamDEX perps account. It reads the account's margin health, position notional, leverage, liquidation distance and unrealized PnL from the chain. When any rule is breached it cancels resting orders and reduces or closes the position with a crossing IOC, so the account de-risks before the venue's margin call.

Built for the Somnia **dreamDEX Perps Builder Bounty** with [`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk) 0.32.1. It runs on the **Hideki testnet** (chain 50383), where app.testnet.dreamdex.io lives. Order sizes are the market minimum.

## Setup
```bash
git clone https://github.com/icohangar-ops/risk-sentinel && cd risk-sentinel
npm install
cp .env.example .env        # PRIVATE_KEY of a throwaway Hideki testnet wallet
```
The wallet needs:
- a little STT for gas, from the Somnia faucet.
- USDso in its dreamDEX MarginBank: deposit in the app, or call `trader.depositMargin`.

```bash
npm run dry                 # DRY_RUN=true: logs intended orders, sends nothing
DRY_RUN=false DEMO_OPEN=true MAX_NOTIONAL_USD=5 CYCLES=2 INTERVAL_SEC=5 npm start   # live
```
Each live order is appended to `txs.jsonl` (kind, tag, symbol, size, tx hash).

### Config (env)
`MAX_NOTIONAL_USD` (50), `MAX_LEVERAGE` (3), `MIN_LIQ_DISTANCE_PCT` (15), `MAX_LOSS_USD` (2), `SYMBOL` (ETH), `INTERVAL_SEC` (10), `CYCLES` (3), `DEMO_OPEN` (opens a minimum-size probe position so the rules have something to guard)

## How it works
- `src/lib.ts` connects `SomniaMarkets` to Hideki (RPC `https://api.hideki2.infra.testnet.somnia.network`, indexer `https://hideki-dev.smk.somnia.host/v1/graphql`).
- `src/perp.ts` holds thin helpers: place (limit or IOC), cancel, close, position and margin reads, all tick- and lot-aligned.
- `src/bot.ts` holds the strategy.

## Real testnet run (Hideki, 2026-10-21 UTC)
The demo opened a 0.004 ETH long (≈$9.8). Its notional was over the $5 cap, so the sentinel closed it on the first cycle.

Account `0xdFAFacBA862d1a9d6fb94eCE7842E95e7091DCbD`

| action | tag | market | size | tx hash |
|---|---|---|---|---|
| place market long | sentinel-demo-open | ETH/USDso:USDso | 0.004 | `0x2c607881faf842bf3f483366d1680194aa5f0cd77ff855a4d27396b99321af33` |
| place market short | sentinel-derisk | ETH/USDso:USDso | 0.004 | `0x85c3acfb49c50ad00c5e19c108812eb3a67e103ba1947f4b8a80044bd0cf8883` |

Verify any of these with `eth_getTransactionReceipt` against `https://api.hideki2.infra.testnet.somnia.network`.

## Disclaimer
This is testnet software, not financial advice. Never put a mainnet key in `.env`.
