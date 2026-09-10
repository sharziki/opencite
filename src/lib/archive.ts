export interface ArchiveRecord {
  id: string;
  title: string;
  creator: string;
  edition: string;
  identifier: string;
  sourceUrl: string;
  manifestUrl: string;
  contentHash: string;
  manifestHash: string;
  byteLength: number;
  witnessKind: string;
  rights: string;
}

export function parseArchiveIndex(value: unknown): ArchiveRecord[] {
  if (!value || typeof value !== "object") throw new Error("Archive index is malformed.");
  const records = (value as { records?: unknown }).records;
  if (!Array.isArray(records) || !records.every(isArchiveRecord)) {
    throw new Error("Archive index is malformed.");
  }
  return records;
}

function isArchiveRecord(value: unknown): value is ArchiveRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ArchiveRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.creator === "string" &&
    typeof record.edition === "string" &&
    typeof record.identifier === "string" &&
    isHttps(record.sourceUrl) &&
    typeof record.manifestUrl === "string" &&
    record.manifestUrl.startsWith("/archive/manifests/") &&
    /^0x[a-f0-9]{64}$/.test(record.contentHash || "") &&
    /^0x[a-f0-9]{64}$/.test(record.manifestHash || "") &&
    Number.isSafeInteger(record.byteLength) &&
    (record.byteLength ?? -1) >= 0 &&
    typeof record.witnessKind === "string" &&
    typeof record.rights === "string"
  );
}

function isHttps(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function filterArchive(
  records: ArchiveRecord[],
  query: string,
): ArchiveRecord[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return records;
  return records.filter((record) =>
    [record.title, record.creator, record.edition, record.identifier].some((value) =>
      value.toLocaleLowerCase().includes(needle),
    ),
  );
}

export function aiCitation(record: ArchiveRecord, origin: string): string {
  return JSON.stringify(
    {
      title: record.title,
      creator: record.creator,
      edition: record.edition,
      identifier: record.identifier,
      source: record.sourceUrl,
      openciteManifest: new URL(record.manifestUrl, origin).href,
      exactContentSha256: record.contentHash,
      manifestSha256: record.manifestHash,
      instruction:
        "Cite this exact edition. Treat the hashes as integrity evidence, not proof that the book's claims are true.",
    },
    null,
    2,
  );
}
