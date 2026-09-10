import assert from "node:assert/strict";
import {
  Contract,
  JsonRpcProvider,
  NonceManager,
  type Signer,
  Wallet,
  hexlify,
  randomBytes,
} from "ethers";

const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const registryAddress = process.env.REGISTRY_ADDRESS;

if (!registryAddress) throw new Error("REGISTRY_ADDRESS is required.");

const rpcUrl = process.env.RPC_URL || LOCAL_RPC_URL;
if (rpcUrl !== LOCAL_RPC_URL && !process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error("DEPLOYER_PRIVATE_KEY is required for non-local smoke tests.");
}

const provider = new JsonRpcProvider(rpcUrl);
const baseSigner: Signer = process.env.DEPLOYER_PRIVATE_KEY
  ? new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider)
  : await provider.getSigner(0);
const signer = new NonceManager(baseSigner);
const registry = new Contract(
  registryAddress,
  [
    "function register(bytes32,bytes32,string,string) returns (bytes32)",
    "function computeAttestationId(bytes32,bytes32,address) view returns (bytes32)",
    "function getAttestation(bytes32) view returns ((bytes32 contentHash,bytes32 manifestHash,string sourceURI,string license,address attester,uint64 registeredAt,uint64 revokedAt))",
    "function revoke(bytes32)",
    "function isActive(bytes32) view returns (bool)",
  ],
  signer,
);

const contentHash = hexlify(randomBytes(32));
const manifestHash = hexlify(randomBytes(32));
const id = await registry.computeAttestationId(
  contentHash,
  manifestHash,
  await signer.getAddress(),
);

await (
  await registry.register(
    contentHash,
    manifestHash,
    "https://example.org/source",
    "CC0-1.0",
  )
).wait();
const saved = await registry.getAttestation(id);
assert.equal(saved.contentHash, contentHash);
assert.equal(saved.manifestHash, manifestHash);
assert.equal(await registry.isActive(id), true);

await (await registry.revoke(id)).wait();
assert.equal(await registry.isActive(id), false);
console.log(`Smoke test passed for attestation ${id}`);
