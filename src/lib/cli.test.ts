import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("OpenCite CLI", () => {
  it("creates and verifies a historical book witness", () => {
    const directory = mkdtempSync(join(tmpdir(), "opencite-"));
    const book = join(directory, "book.txt");
    const manifest = join(directory, "book.opencite.json");
    writeFileSync(book, "Call me Ishmael.\n");

    execFileSync(
      process.execPath,
      [
        "bin/opencite.js",
        "create",
        book,
        "--title",
        "Moby-Dick",
        "--creator",
        "Herman Melville",
        "--source-url",
        "https://example.org/moby-dick",
        "--rights",
        "PUBLIC-DOMAIN",
        "--publication-date",
        "1851",
        "--edition",
        "First edition",
        "--identifier",
        "OCLC 123",
        "--output",
        manifest,
      ],
      { cwd: process.cwd() },
    );

    const saved = JSON.parse(readFileSync(manifest, "utf8"));
    expect(saved.bibliography.publicationDate).toBe("1851");
    expect(saved.witness.kind).toBe("DIGITAL-COPY");
    expect(
      execFileSync(process.execPath, ["bin/opencite.js", "verify", book, manifest], {
        cwd: process.cwd(),
        encoding: "utf8",
      }),
    ).toContain("VERIFIED: Moby-Dick");

    writeFileSync(book, "changed edition\n");
    expect(() =>
      execFileSync(process.execPath, ["bin/opencite.js", "verify", book, manifest], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).toThrow();
  });
});
