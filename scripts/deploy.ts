import { readFile } from "node:fs/promises";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";
import type { InterfaceAbi, Signer } from "ethers";

const LOCAL_RPC_URL = "http://127.0.0.1:8545";

const rpcUrl = process.env.RPC_URL || LOCAL_RPC_URL;
if (rpcUrl !== LOCAL_RPC_URL && !process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error("DEPLOYER_PRIVATE_KEY is required for non-local deployments.");
}

const artifact = JSON.parse(
  await readFile(
    new URL(
      "../artifacts/contracts/OpenCiteRegistry.sol/OpenCiteRegistry.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { abi: InterfaceAbi; bytecode: string };

const provider = new JsonRpcProvider(rpcUrl);
const signer: Signer = process.env.DEPLOYER_PRIVATE_KEY
  ? new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider)
  : await provider.getSigner(0);
const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
const contract = await factory.deploy();
await contract.waitForDeployment();

console.log(`OpenCiteRegistry deployed to ${await contract.getAddress()}`);
