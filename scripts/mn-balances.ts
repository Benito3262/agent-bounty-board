// Mainnet USD₮ / USA₮ balances for the agent, poster and the agent's buy account.
import { parseAbi, formatUnits } from "viem"; import { publicClient as c } from "../src/chain";
const T={"USD₮":"0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e","USA₮":"0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771"} as const;
const A={agent:"0x9c7fAd1d4fd43B0f0777aeC4d97BBE3b2c2e13A8",poster:"0xBe3AeA9A8131219E01CbD1f0419268ec4493b4b8",buy:"0x94B3A2e9F43Cd1A2a24b3945F456d5Ff21669e91"} as const;
const e=parseAbi(["function balanceOf(address) view returns(uint256)"]);
for (const [n,a] of Object.entries(A)) console.log(n,a,...(await Promise.all(Object.entries(T).map(async([s,t])=>`${s} ${formatUnits(await c.readContract({address:t,abi:e,functionName:"balanceOf",args:[a as any]}) as bigint,6)}`))));
