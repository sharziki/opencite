import { BrowserProvider, Contract, isAddress } from "ethers";
import type { Eip1193Provider, Signer } from "ethers";

export const REGISTRY_ABI = [
  "function register(bytes32 contentHash, bytes32 manifestHash, string sourceURI, string license) returns (bytes32 id)",
  "function getAttestation(bytes32 id) view returns ((bytes32 contentHash, bytes32 manifestHash, string sourceURI, string license, address attester, uint64 registeredAt, uint64 revokedAt))",
  "event SourceRegistered(bytes32 indexed id, bytes32 indexed contentHash, bytes32 indexed manifestHash, address attester, string sourceURI, string license)",
] as const;

interface WalletWindow extends Window {
  ethereum?: Eip1193Provider;
}

export interface RegistryConnection {
  provider: BrowserProvider;
  signer: Signer;
  address: string;
  contract: Contract;
}

export interface ChainAttestation {
  contentHash: string;
  manifestHash: string;
  sourceURI: string;
  license: string;
  attester: string;
  registeredAt: bigint;
  revokedAt: bigint;
}

export const registryAddress = import.meta.env.VITE_REGISTRY_ADDRESS?.trim() ?? "";

export async function connectRegistry(): Promise<RegistryConnection> {
  const ethereum = (window as WalletWindow).ethereum;
  if (!ethereum) throw new Error("Install an EVM wallet to register proofs.");
  if (!registryAddress || !isAddress(registryAddress)) {
    throw new Error("Registry address is not configured for this deployment.");
  }

  const provider = new BrowserProvider(ethereum);
  await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();
  const expectedChain = import.meta.env.VITE_CHAIN_ID?.trim();
  if (expectedChain && network.chainId !== BigInt(expectedChain)) {
    throw new Error(`Switch wallet to chain ${expectedChain}.`);
  }

  const signer = await provider.getSigner();
  return {
    provider,
    signer,
    address: await signer.getAddress(),
    contract: new Contract(registryAddress, REGISTRY_ABI, signer),
  };
}

export async function registerSource(
  connection: RegistryConnection,
  contentHash: string,
  manifestHash: string,
  sourceURI: string,
  license: string,
): Promise<{ id: string; transactionHash: string }> {
  const transaction = await connection.contract.register(
    contentHash,
    manifestHash,
    sourceURI,
    license,
  );
  const receipt = await transaction.wait();
  if (!receipt) throw new Error("Transaction was not confirmed.");

  for (const log of receipt.logs) {
    try {
      const parsed = connection.contract.interface.parseLog(log);
      if (parsed?.name === "SourceRegistered") {
        return { id: parsed.args.id as string, transactionHash: receipt.hash };
      }
    } catch {
      // Ignore logs emitted by other contracts in the transaction.
    }
  }
  throw new Error("Registry confirmation event was not found.");
}

export async function lookupSource(
  connection: RegistryConnection,
  id: string,
): Promise<ChainAttestation> {
  const saved = await connection.contract.getAttestation(id);
  return {
    contentHash: saved.contentHash,
    manifestHash: saved.manifestHash,
    sourceURI: saved.sourceURI,
    license: saved.license,
    attester: saved.attester,
    registeredAt: saved.registeredAt,
    revokedAt: saved.revokedAt,
  };
}
