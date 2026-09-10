import { describe, expect, it } from "vitest";
import { aiCitation, filterArchive, parseArchiveIndex } from "./archive";
import type { ArchiveRecord } from "./archive";
import { readFileSync } from "node:fs";
import { canonicalize, hashText, parseManifest } from "./proof";

const record: ArchiveRecord = {
  id: "gutenberg-1342",
  title: "Pride and Prejudice",
  creator: "Austen, Jane",
  edition: "Project Gutenberg eBook #1342 · EPUB",
  identifier: "Project Gutenberg #1342",
  sourceUrl: "https://www.gutenberg.org/ebooks/1342",
  manifestUrl: "/archive/manifests/gutenberg-1342.opencite.json",
  contentHash: `0x${"1".repeat(64)}`,
  manifestHash: `0x${"2".repeat(64)}`,
  byteLength: 100,
  witnessKind: "DIGITAL-COPY",
  rights: "Public domain in the USA.",
};

describe("archive discovery", () => {
  it("searches metadata and exports an exact AI citation", () => {
    expect(filterArchive([record], "AUSTEN")).toEqual([record]);
    expect(filterArchive([record], "Melville")).toEqual([]);
    const citation = JSON.parse(aiCitation(record, "https://opencite.example"));
    expect(citation.openciteManifest).toBe(
      "https://opencite.example/archive/manifests/gutenberg-1342.opencite.json",
    );
    expect(citation.exactContentSha256).toBe(record.contentHash);
    expect(parseArchiveIndex({ records: [record] })).toEqual([record]);
    expect(() =>
      parseArchiveIndex({ records: [{ ...record, sourceUrl: "javascript:alert(1)" }] }),
    ).toThrow("Archive index is malformed.");
  });

  it("ships 25 internally consistent pilot manifests", async () => {
    const index = parseArchiveIndex(
      JSON.parse(readFileSync("public/archive/index.json", "utf8")),
    );
    expect(index).toHaveLength(25);

    for (const saved of index) {
      const manifest = parseManifest(
        readFileSync(`public${saved.manifestUrl}`, "utf8"),
      );
      expect(manifest.content.sha256).toBe(saved.contentHash);
      expect(await hashText(canonicalize(manifest))).toBe(saved.manifestHash);
      expect(manifest.citation.sourceUrl).toBe(saved.sourceUrl);
      expect(manifest.rights.basis).toBe("PUBLIC-DOMAIN-US");
    }
  });
});
