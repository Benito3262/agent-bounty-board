// Mainnet funding: swap USD₮->USA₮ on Uniswap V3 (official SwapRouter02), then fund poster. Gas in USD₮ via fee adapter; ERC-8021 tagged.
import "dotenv/config"; import { parseAbi, formatUnits } from "viem"; import { privateKeyToAccount } from "viem/accounts";
import { publicClient as c, wallet } from "../src/chain"; import fs from "fs";
const USDT="0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", USAT="0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771", ADAPT="0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72";
const ROUTER="0x5615CDAb10dc425a742d643d949a7F474C01abc4", QUOTER="0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8";
const POSTER=privateKeyToAccount(process.env.POSTER_PK as any).address;
const w=wallet(process.env.WORKER_PK!); const me=w.account!.address;
if (me.toLowerCase()!=="0x9c7fad1d4fd43b0f0777aec4d97bbe3b2c2e13a8"||POSTER.toLowerCase()!=="0xbe3aea9a8131219e01cbd1f0419268ec4493b4b8") throw "wrong keys";
const e=parseAbi(["function balanceOf(address) view returns(uint256)","function approve(address,uint256) returns(bool)","function transfer(address,uint256) returns(bool)"]);
const bal=(t:any,a:any)=>c.readContract({address:t,abi:e,functionName:"balanceOf",args:[a]}) as Promise<bigint>;
const log:any[]=fs.existsSync("demo/txs.json")?JSON.parse(fs.readFileSync("demo/txs.json","utf8")):[];
const rec=async(step:string,desc:string,h:`0x${string}`)=>{const r=await c.waitForTransactionReceipt({hash:h}); console.log(step,r.status,h); if(r.status!=="success") throw step+" failed"; log.push({step,desc,hash:h,from:r.from}); fs.writeFileSync("demo/txs.json",JSON.stringify(log,null,1));};
const gas={feeCurrency:ADAPT as `0x${string}`};
const step=process.argv[2];
if (step==="swap") {
  const amt=1_000_000n;
  const q=await c.simulateContract({address:QUOTER,abi:parseAbi(["function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns(uint256,uint160,uint32,uint256)"]),functionName:"quoteExactInputSingle",args:[{tokenIn:USDT,tokenOut:USAT,amountIn:amt,fee:100,sqrtPriceLimitX96:0n}]});
  const out=q.result[0] as bigint; const min=out*995n/1000n; console.log("quote",formatUnits(out,6),"min",formatUnits(min,6));
  if (out<990_000n) throw "bad quote";
  await rec("1a","Approve 1.0 USD₮ to Uniswap V3 SwapRouter02",await w.writeContract({address:USDT,abi:e,functionName:"approve",args:[ROUTER,amt],...gas} as any));
  await rec("1b",`Swap 1.0 USD₮ → USA₮ on Uniswap V3 (0.01% pool), minOut ${formatUnits(min,6)}`,await w.writeContract({address:ROUTER,abi:parseAbi(["function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns(uint256)"]),functionName:"exactInputSingle",args:[{tokenIn:USDT,tokenOut:USAT,fee:100,recipient:me,amountIn:amt,amountOutMinimum:min,sqrtPriceLimitX96:0n}],...gas} as any));
}
if (step==="send") {
  await rec("2a","Send 0.30 USD₮ (gas) agent → poster",await w.writeContract({address:USDT,abi:e,functionName:"transfer",args:[POSTER,300_000n],...gas} as any));
  await rec("2b","Send 0.90 USA₮ (job payment) agent → poster",await w.writeContract({address:USAT,abi:e,functionName:"transfer",args:[POSTER,900_000n],...gas} as any));
}
for (const a of [me,POSTER]) console.log(a,"USD₮",formatUnits(await bal(USDT,a),6),"USA₮",formatUnits(await bal(USAT,a),6));
