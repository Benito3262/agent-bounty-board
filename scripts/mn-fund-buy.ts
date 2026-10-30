// Fund the agent's dedicated buy account (created with `buy setup --name agent`) with USA₮ from the agent wallet. Gas paid in USD₮ via fee adapter.
import "dotenv/config"; import { parseAbi, formatUnits } from "viem";
import { publicClient as c, wallet } from "../src/chain"; import fs from "fs";
const USDT="0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", USAT="0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771", ADAPT="0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72";
const BUY="0x94B3A2e9F43Cd1A2a24b3945F456d5Ff21669e91";
if (process.argv[2]!=="--send") { console.log("usage: tsx scripts/mn-fund-buy.ts --send   (moves 0.10 USA₮ to the buy account)"); process.exit(0); }
const w=wallet(process.env.WORKER_PK!);
const e=parseAbi(["function balanceOf(address) view returns(uint256)","function transfer(address,uint256) returns(bool)"]);
const h=await w.writeContract({address:USAT,abi:e,functionName:"transfer",args:[BUY,100_000n],feeCurrency:ADAPT} as any);
const r=await c.waitForTransactionReceipt({hash:h}); console.log("fund",r.status,h);
const log=JSON.parse(fs.readFileSync("demo/txs.json","utf8")); log.push({step:"3a",desc:"Send 0.10 USA₮ agent → agent's buy account "+BUY,hash:h,from:r.from}); fs.writeFileSync("demo/txs.json",JSON.stringify(log,null,1));
for (const a of [w.account!.address,BUY]) console.log(a,"USD₮",formatUnits(await c.readContract({address:USDT,abi:e,functionName:"balanceOf",args:[a]}) as bigint,6),"USA₮",formatUnits(await c.readContract({address:USAT,abi:e,functionName:"balanceOf",args:[a]}) as bigint,6));
