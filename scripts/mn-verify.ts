import { createPublicClient, http, parseAbi, formatUnits, toHex } from "viem"; import { celo } from "viem/chains";
const c = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
const tag=Buffer.from("celo_620289f1f610").toString("hex");
for (const h of process.argv.slice(2)) { const t:any=await c.getTransaction({hash:h as any}); const r=await c.getTransactionReceipt({hash:h as any});
 console.log(h, r.status, "from",t.from,"to",t.to,"feeCurrency",t.feeCurrency??"CELO","tagged",t.input.includes(tag),"block",r.blockNumber); }
const e=parseAbi(["function balanceOf(address) view returns(uint256)"]);
for (const w of ["0x9c7fAd1d4fd43B0f0777aeC4d97BBE3b2c2e13A8","0xBe3AeA9A8131219E01CbD1f0419268ec4493b4b8"]) console.log(w,"CELO",formatUnits(await c.getBalance({address:w as any}),18),"USD₮",formatUnits(await c.readContract({address:"0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",abi:e,functionName:"balanceOf",args:[w as any]}),6),"USA₮",formatUnits(await c.readContract({address:"0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771",abi:e,functionName:"balanceOf",args:[w as any]}),6));
