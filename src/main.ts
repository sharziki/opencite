import "./styles.css";
import {
  canonicalize,
  createManifest,
  hashFile,
  hashText,
  parseManifest,
  verifyFile,
} from "./lib/proof";
import type { SourceManifest } from "./lib/proof";
import {
  connectRegistry,
  lookupSource,
  registerSource,
  registryAddress,
} from "./lib/registry";
import type { RegistryConnection } from "./lib/registry";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing interface element: ${id}`);
  return found as T;
}

function shorten(value: string, start = 10, end = 8): string {
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected operation failure.";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function download(filename: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const createForm = element<HTMLFormElement>("create-form");
const sourceFile = element<HTMLInputElement>("source-file");
const fileLabel = element<HTMLElement>("file-label");
const fileDetail = element<HTMLElement>("file-detail");
const createButton = element<HTMLButtonElement>("create-button");
const createStatus = element<HTMLElement>("create-status");
const emptyProof = element<HTMLElement>("empty-proof");
const proofOutput = element<HTMLElement>("proof-output");
const proofState = element<HTMLElement>("proof-state");
const contentHashElement = element<HTMLElement>("content-hash");
const manifestHashElement = element<HTMLElement>("manifest-hash");
const downloadButton = element<HTMLButtonElement>("download-button");
const registerButton = element<HTMLButtonElement>("register-button");
const chainNote = element<HTMLElement>("chain-note");
const walletButton = element<HTMLButtonElement>("wallet-button");
const walletLabel = element<HTMLElement>("wallet-label");
const verifyForm = element<HTMLFormElement>("verify-form");
const verifyStatus = element<HTMLElement>("verify-status");
const lookupForm = element<HTMLFormElement>("lookup-form");
const lookupStatus = element<HTMLElement>("lookup-status");

let connection: RegistryConnection | null = null;
let lastVerification:
  | { contentHash: string; manifestHash: string }
  | undefined;
let currentProof:
  | {
      manifest: SourceManifest;
      manifestText: string;
      manifestHash: string;
    }
  | undefined;

if (!registryAddress) {
  chainNote.textContent = "Offline mode: configure VITE_REGISTRY_ADDRESS to enable registration.";
  registerButton.disabled = true;
}

sourceFile.addEventListener("change", () => {
  const file = sourceFile.files?.[0];
  if (!file) return;
  fileLabel.textContent = file.name;
  fileDetail.textContent = `${formatBytes(file.size)} · ${file.type || "unknown media type"}`;
});

walletButton.addEventListener("click", async () => {
  walletButton.disabled = true;
  walletLabel.textContent = "Connecting…";
  try {
    connection = await connectRegistry();
    walletLabel.textContent = shorten(connection.address, 6, 4);
    walletButton.classList.add("connected");
  } catch (error) {
    walletLabel.textContent = "Connect wallet";
    createStatus.textContent = errorMessage(error);
    createStatus.dataset.kind = "error";
  } finally {
    walletButton.disabled = false;
  }
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = sourceFile.files?.[0];
  if (!file) return;

  const data = new FormData(createForm);
  createButton.disabled = true;
  createStatus.dataset.kind = "working";
  createStatus.textContent = `Hashing ${file.name} locally…`;

  try {
    const sourceUrl = String(data.get("sourceUrl"));
    const rightsEvidence = String(data.get("rightsEvidence") || "");
    if (new URL(sourceUrl).protocol !== "https:") {
      throw new Error("Canonical source URL must use HTTPS.");
    }
    if (rightsEvidence && new URL(rightsEvidence).protocol !== "https:") {
      throw new Error("Rights evidence URL must use HTTPS.");
    }

    const contentHash = await hashFile(file);
    const manifest = createManifest(file, contentHash, {
      title: String(data.get("title")),
      creator: String(data.get("creator")),
      sourceUrl,
      license: String(data.get("license")),
      rightsEvidence,
    });
    const canonicalManifest = canonicalize(manifest);
    const manifestText = `${canonicalManifest}\n`;
    const manifestHash = await hashText(canonicalManifest);
    currentProof = { manifest, manifestText, manifestHash };

    contentHashElement.textContent = contentHash;
    manifestHashElement.textContent = manifestHash;
    emptyProof.hidden = true;
    proofOutput.hidden = false;
    proofState.textContent = "GENERATED";
    proofState.classList.add("ready");
    createStatus.dataset.kind = "success";
    createStatus.textContent = "Proof generated. Source bytes remained on this device.";
    if (registryAddress) {
      registerButton.disabled = false;
      chainNote.textContent = "Optional: anchor both hashes through your configured registry.";
    }
  } catch (error) {
    createStatus.dataset.kind = "error";
    createStatus.textContent = errorMessage(error);
  } finally {
    createButton.disabled = false;
  }
});

downloadButton.addEventListener("click", () => {
  if (!currentProof) return;
  const base = currentProof.manifest.content.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  download(`${base}.opencite.json`, currentProof.manifestText);
});

registerButton.addEventListener("click", async () => {
  if (!currentProof) return;
  registerButton.disabled = true;
  chainNote.textContent = "Waiting for wallet confirmation…";

  try {
    connection ??= await connectRegistry();
    walletLabel.textContent = shorten(connection.address, 6, 4);
    walletButton.classList.add("connected");
    const result = await registerSource(
      connection,
      currentProof.manifest.content.sha256,
      currentProof.manifestHash,
      currentProof.manifest.citation.sourceUrl,
      currentProof.manifest.rights.basis,
    );
    chainNote.textContent = `Registered ${shorten(result.id)} · tx ${shorten(result.transactionHash)}`;
    proofState.textContent = "ON-CHAIN";
  } catch (error) {
    chainNote.textContent = errorMessage(error);
  } finally {
    registerButton.disabled = false;
  }
});

verifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(verifyForm);
  const file = data.get("verifySource");
  const manifestFile = data.get("verifyManifest");
  verifyStatus.dataset.kind = "working";
  verifyStatus.textContent = "Computing independent digest…";

  try {
    if (!(file instanceof File) || !(manifestFile instanceof File)) {
      throw new Error("Choose both source and manifest files.");
    }
    const manifestText = await manifestFile.text();
    const manifest = parseManifest(manifestText);
    const result = await verifyFile(file, manifest);
    if (!result.valid) {
      verifyStatus.dataset.kind = "error";
      verifyStatus.textContent = `Mismatch. Actual ${shorten(result.actualHash)}${
        result.sizeMatches ? "" : " · file size changed"
      }`;
      return;
    }
    const manifestHash = await hashText(canonicalize(manifest));
    lastVerification = {
      contentHash: result.actualHash,
      manifestHash,
    };
    verifyStatus.dataset.kind = "success";
    verifyStatus.textContent = `Verified. Source ${shorten(result.actualHash)} · manifest ${shorten(
      manifestHash,
    )}`;
  } catch (error) {
    verifyStatus.dataset.kind = "error";
    verifyStatus.textContent = errorMessage(error);
  }
});

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(lookupForm);
  lookupStatus.dataset.kind = "working";
  lookupStatus.textContent = "Reading registry…";

  try {
    connection ??= await connectRegistry();
    const saved = await lookupSource(connection, String(data.get("attestationId")));
    const status = saved.revokedAt === 0n ? "active" : "revoked";
    const date = new Date(Number(saved.registeredAt) * 1000).toISOString().slice(0, 10);
    const matchesLoadedProof =
      !lastVerification ||
      (saved.contentHash === lastVerification.contentHash &&
        saved.manifestHash === lastVerification.manifestHash);
    lookupStatus.dataset.kind =
      saved.revokedAt === 0n && matchesLoadedProof ? "success" : "error";
    lookupStatus.textContent = `${
      lastVerification ? (matchesLoadedProof ? "PROOF MATCH · " : "PROOF MISMATCH · ") : ""
    }${status.toUpperCase()} · ${date} · ${saved.license} · ${shorten(
      saved.attester,
      6,
      4,
    )} · source ${shorten(saved.contentHash)} · manifest ${shorten(saved.manifestHash)}`;
  } catch (error) {
    lookupStatus.dataset.kind = "error";
    lookupStatus.textContent = errorMessage(error);
  }
});
