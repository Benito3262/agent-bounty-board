export const identityAbi = [
  { type: "function", name: "register", stateMutability: "nonpayable", inputs: [{ name: "agentURI", type: "string" }], outputs: [{ name: "agentId", type: "uint256" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "event", name: "Transfer", inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: true }] },
] as const;
export const reputationAbi = [
  { type: "function", name: "giveFeedback", stateMutability: "nonpayable", inputs: [
    { name: "agentId", type: "uint256" }, { name: "value", type: "int128" }, { name: "valueDecimals", type: "uint8" },
    { name: "tag1", type: "string" }, { name: "tag2", type: "string" }, { name: "endpoint", type: "string" },
    { name: "feedbackURI", type: "string" }, { name: "feedbackHash", type: "bytes32" } ], outputs: [] },
  { type: "function", name: "getClients", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ type: "address[]" }] },
  { type: "function", name: "getSummary", stateMutability: "view", inputs: [
    { name: "agentId", type: "uint256" }, { name: "clientAddresses", type: "address[]" }, { name: "tag1", type: "string" }, { name: "tag2", type: "string" } ],
    outputs: [{ name: "count", type: "uint64" }, { name: "summaryValue", type: "int128" }, { name: "summaryValueDecimals", type: "uint8" }] },
] as const;
export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "event", name: "Transfer", inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "value", type: "uint256", indexed: false }] },
] as const;
