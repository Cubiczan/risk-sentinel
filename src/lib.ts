import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { defineChain } from "viem";
import { readFileSync, existsSync } from "node:fs";
for (const p of [".env","../.env"]) if (existsSync(p)) { for (const l of readFileSync(p,"utf8").split("\n")) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m && process.env[m[1]]===undefined) process.env[m[1]]=m[2].trim(); } break; }
export const RPC="https://api.hideki2.infra.testnet.somnia.network", WS="wss://api.hideki2.infra.testnet.somnia.network/ws";
export const chain = defineChain({ id: 50383, name: "Somnia Hideki Testnet", nativeCurrency:{name:"STT",symbol:"STT",decimals:18}, rpcUrls:{default:{http:[RPC],webSocket:[WS]}}});
export function makeEx(): any { const pk=process.env.PRIVATE_KEY; return new SomniaMarkets({ chain, wsRpcUrl:WS, indexerUrl:"https://hideki-dev.smk.somnia.host/v1/graphql", addresses: SOMNIA_TESTNET_ADDRESSES, ...(pk?{privateKey:(pk.startsWith("0x")?pk:"0x"+pk) as `0x${string}`}:{}) } as any); }
export const j=(x:any)=>JSON.stringify(x,(k,v)=>typeof v==="bigint"?v.toString():v,1);
import { privateKeyToAccount } from "viem/accounts";
export function me(): `0x${string}` { const pk=process.env.PRIVATE_KEY!; return privateKeyToAccount((pk.startsWith("0x")?pk:"0x"+pk) as any).address; }
