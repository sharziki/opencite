export const MANIFEST_SCHEMA =
  "https://github.com/sharziki/opencite/blob/main/schema/source-manifest-v1.schema.json";
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export type HexHash = `0x${string}`;

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
      title: citation.title.trim(),
      creator: citation.creator.trim(),
      sourceUrl: citation.sourceUrl,
    },
    rights: {
      basis: citation.license,
      evidence: citation.rightsEvidence || null,
    },
    provenance: {
      createdAt,
      generator: "OpenCite/0.1.0",
      claim:
        "This record attests to source integrity and provenance. It does not establish factual truth.",
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
    typeof manifest.rights?.basis === "string" &&
    manifest.rights.basis.length > 0 &&
    (manifest.rights.evidence === null || isHttpsUrl(manifest.rights.evidence)) &&
    typeof manifest.provenance?.createdAt === "string" &&
    !Number.isNaN(Date.parse(manifest.provenance.createdAt)) &&
    manifest.provenance.generator === "OpenCite/0.1.0" &&
    typeof manifest.provenance.claim === "string"
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
