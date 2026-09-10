import { describe, expect, it } from "vitest";
import {
  canonicalize,
  createManifest,
  hashText,
  parseManifest,
  sha256,
} from "./proof";

describe("OpenCite proof utilities", () => {
  it("computes the known SHA-256 digest for abc", async () => {
    expect(await hashText("abc")).toBe(
      "0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("canonicalizes objects independent of key insertion order", () => {
    expect(canonicalize({ z: 1, a: { y: 2, b: 3 } })).toBe(
      canonicalize({ a: { b: 3, y: 2 }, z: 1 }),
    );
  });

  it("creates and parses a valid manifest", async () => {
    const contentHash = await sha256(new Uint8Array([1, 2, 3]).buffer);
    const manifest = createManifest(
      { name: "source.txt", type: "text/plain", size: 3 },
      contentHash,
      {
        title: "Source",
        creator: "Example Institute",
        sourceUrl: "https://example.org/source",
        license: "CC0-1.0",
      },
      "2026-09-10T12:00:00.000Z",
    );

    expect(parseManifest(JSON.stringify(manifest))).toEqual(manifest);
  });

  it("rejects unrecognized JSON", () => {
    expect(() => parseManifest('{"version":2}')).toThrow(
      "Not a supported OpenCite manifest.",
    );
  });

  it("rejects malformed source and rights URLs", async () => {
    const contentHash = await hashText("source");
    const manifest = createManifest(
      { name: "source.txt", type: "text/plain", size: 6 },
      contentHash,
      {
        title: "Source",
        creator: "Publisher",
        sourceUrl: "http://insecure.example/source",
        license: "CC0-1.0",
      },
    );

    expect(() => parseManifest(JSON.stringify(manifest))).toThrow(
      "Not a supported OpenCite manifest.",
    );
  });
});
