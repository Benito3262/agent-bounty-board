import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { N, publicClient } from "../src/chain";
import { erc20Abi } from "../src/abi";
for (const k of ["OPERATOR_PK", "POSTER_PK", "WORKER_PK"]) {
  const a = privateKeyToAccount(process.env[k] as `0x${string}`).address;
  const celo = await publicClient.getBalance({ address: a });
  const t = await publicClient.readContract({ address: N.token.address, abi: erc20Abi, functionName: "balanceOf", args: [a] });
  console.log(k.replace("_PK", ""), a, "CELO", Number(celo) / 1e18, N.token.symbol, Number(t) / 1e6);
}
