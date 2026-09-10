export const MANIFEST_SCHEMA =
  "https://github.com/sharziki/opencite/blob/main/schema/source-manifest-v1.schema.json";
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export type HexHash = `0x${string}`;
export type WitnessKind =
  | "DIGITAL-COPY"
  | "PHYSICAL-COPY"
  | "CATALOG-RECORD"
  | "OTHER";

export interface SourceManifest {
  schema: typeof MANIFEST_SCHEMA;
  version: 1;
  content: {
    filename: string;
    mediaType: string;
    byteLength: number;
    sha256: HexHash;
  };
  citation: {
    title: string;
    creator: string;
    sourceUrl: string;
  };
  bibliography?: {
    publicationDate: string | null;
    edition: string | null;
    identifier: string | null;
  };
  witness?: {
    kind: WitnessKind;
    evidence: string | null;
  };
  rights: {
    basis: string;
    evidence: string | null;
  };
  provenance: {
    createdAt: string;
    generator: "OpenCite/0.1.0";
    claim: string;
  };
}

export interface CitationInput {
  title: string;
  creator: string;
  sourceUrl: string;
  license: string;
  rightsEvidence?: string;
  publicationDate?: string;
  edition?: string;
  identifier?: string;
  witnessKind?: WitnessKind;
  witnessEvidence?: string;
}

export async function sha256(data: ArrayBuffer): Promise<HexHash> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `0x${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

export async function hashFile(file: File): Promise<HexHash> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File exceeds 100 MB browser hashing limit.");
  }
  return sha256(await file.arrayBuffer());
}

export async function hashText(value: string): Promise<HexHash> {
  return sha256(new TextEncoder().encode(value).buffer);
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function createManifest(
  file: Pick<File, "name" | "type" | "size">,
  contentHash: HexHash,
  citation: CitationInput,
  createdAt = new Date().toISOString(),
): SourceManifest {
  const title = citation.title.trim();
  const creator = citation.creator.trim();
  const rightsBasis = citation.license.trim();
  if (!title || !creator || !rightsBasis) {
    throw new Error("Title, creator, and rights basis are required.");
  }
  return {
    schema: MANIFEST_SCHEMA,
    version: 1,
    content: {
      filename: file.name,
      mediaType: file.type || "application/octet-stream",
      byteLength: file.size,
      sha256: contentHash,
    },
    citation: {
      title,
      creator,
      sourceUrl: citation.sourceUrl,
    },
    bibliography: {
      publicationDate: citation.publicationDate?.trim() || null,
      edition: citation.edition?.trim() || null,
      identifier: citation.identifier?.trim() || null,
    },
    witness: {
      kind: citation.witnessKind || "DIGITAL-COPY",
      evidence: citation.witnessEvidence || null,
    },
    rights: {
      basis: rightsBasis,
      evidence: citation.rightsEvidence || null,
    },
    provenance: {
      createdAt,
      generator: "OpenCite/0.1.0",
      claim:
        "This record preserves evidence of a witnessed source. It does not establish factual truth.",
    },
  };
}

export function parseManifest(value: string): SourceManifest {
  const parsed: unknown = JSON.parse(value);
  if (!isManifest(parsed)) throw new Error("Not a supported OpenCite manifest.");
  return parsed;
}

export function isManifest(value: unknown): value is SourceManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<SourceManifest>;
  return (
    manifest.schema === MANIFEST_SCHEMA &&
    manifest.version === 1 &&
    typeof manifest.content?.filename === "string" &&
    typeof manifest.content?.mediaType === "string" &&
    typeof manifest.content?.byteLength === "number" &&
    Number.isSafeInteger(manifest.content.byteLength) &&
    manifest.content.byteLength >= 0 &&
    /^0x[a-f0-9]{64}$/.test(manifest.content?.sha256 ?? "") &&
    typeof manifest.citation?.title === "string" &&
    manifest.citation.title.length > 0 &&
    typeof manifest.citation?.creator === "string" &&
    manifest.citation.creator.length > 0 &&
    isHttpsUrl(manifest.citation?.sourceUrl) &&
    isBibliography(manifest.bibliography) &&
    isWitness(manifest.witness) &&
    typeof manifest.rights?.basis === "string" &&
    manifest.rights.basis.length > 0 &&
    (manifest.rights.evidence === null || isHttpsUrl(manifest.rights.evidence)) &&
    typeof manifest.provenance?.createdAt === "string" &&
    !Number.isNaN(Date.parse(manifest.provenance.createdAt)) &&
    manifest.provenance.generator === "OpenCite/0.1.0" &&
    typeof manifest.provenance.claim === "string"
  );
}

function isBibliography(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object") return false;
  const bibliography = value as NonNullable<SourceManifest["bibliography"]>;
  return (
    (bibliography.publicationDate === null ||
      typeof bibliography.publicationDate === "string") &&
    (bibliography.edition === null || typeof bibliography.edition === "string") &&
    (bibliography.identifier === null || typeof bibliography.identifier === "string")
  );
}

function isWitness(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object") return false;
  const witness = value as NonNullable<SourceManifest["witness"]>;
  return (
    ["DIGITAL-COPY", "PHYSICAL-COPY", "CATALOG-RECORD", "OTHER"].includes(witness.kind) &&
    (witness.evidence === null || isHttpsUrl(witness.evidence))
  );
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function verifyFile(
  file: File,
  manifest: SourceManifest,
): Promise<{ valid: boolean; actualHash: HexHash; sizeMatches: boolean }> {
  const actualHash = await hashFile(file);
  const sizeMatches = file.size === manifest.content.byteLength;
  return {
    valid: sizeMatches && actualHash === manifest.content.sha256,
    actualHash,
    sizeMatches,
  };
}
