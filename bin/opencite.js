#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const SCHEMA =
  "https://github.com/sharziki/opencite/blob/main/schema/source-manifest-v1.schema.json";

function usage() {
  return `OpenCite — public memory for books

Create a rights-aware fingerprint (book bytes never leave this machine):
  opencite create BOOK --title TITLE --creator CREATOR --source-url HTTPS_URL --rights BASIS [options]

Verify a book copy against a manifest:
  opencite verify BOOK MANIFEST

Options:
  --publication-date TEXT   Original or edition publication date
  --edition TEXT            Edition or printing statement
  --identifier TEXT         ISBN, OCLC, DOI, or catalog identifier
  --witness-kind KIND       DIGITAL-COPY, PHYSICAL-COPY, CATALOG-RECORD, OTHER
  --witness-evidence URL    Public catalog or evidence URL
  --rights-evidence URL     Public rights evidence URL
  --output PATH             Manifest destination (default: BOOK.opencite.json)`;
}

function options(values) {
  const parsed = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      parsed._.push(value);
      continue;
    }
    const next = values[index + 1];
    if (!next || next.startsWith("--")) fail(`${value} needs a value.`);
    parsed[value.slice(2)] = next;
    index += 1;
  }
  return parsed;
}

function required(flags, name) {
  const value = flags[name]?.trim();
  if (!value) fail(`Missing --${name}.`);
  return value;
}

function https(value, label) {
  if (!value) return null;
  try {
    if (new URL(value).protocol === "https:") return value;
  } catch {
    // Error below gives one stable message for malformed and insecure URLs.
  }
  fail(`${label} must use HTTPS.`);
}

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

function hashFile(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(`0x${hash.digest("hex")}`));
  });
}

function hashText(text) {
  return `0x${createHash("sha256").update(text).digest("hex")}`;
}

function fail(message) {
  throw new Error(message);
}

async function create(bookPath, flags) {
  const absoluteBook = resolve(bookPath);
  const sourceUrl = https(required(flags, "source-url"), "Source URL");
  const witnessKind = flags["witness-kind"] || "DIGITAL-COPY";
  if (!["DIGITAL-COPY", "PHYSICAL-COPY", "CATALOG-RECORD", "OTHER"].includes(witnessKind)) {
    fail("Unsupported --witness-kind.");
  }

  const stat = statSync(absoluteBook);
  if (!stat.isFile()) fail("Book path is not a file.");
  const contentHash = await hashFile(absoluteBook);
  const manifest = {
    schema: SCHEMA,
    version: 1,
    content: {
      filename: basename(absoluteBook),
      mediaType: "application/octet-stream",
      byteLength: stat.size,
      sha256: contentHash,
    },
    citation: {
      title: required(flags, "title"),
      creator: required(flags, "creator"),
      sourceUrl,
    },
    bibliography: {
      publicationDate: flags["publication-date"]?.trim() || null,
      edition: flags.edition?.trim() || null,
      identifier: flags.identifier?.trim() || null,
    },
    witness: {
      kind: witnessKind,
      evidence: https(flags["witness-evidence"], "Witness evidence URL"),
    },
    rights: {
      basis: required(flags, "rights"),
      evidence: https(flags["rights-evidence"], "Rights evidence URL"),
    },
    provenance: {
      createdAt: new Date().toISOString(),
      generator: "OpenCite/0.1.0",
      claim:
        "This record preserves evidence of a witnessed source. It does not establish factual truth.",
    },
  };
  const canonical = canonicalize(manifest);
  const destination = resolve(flags.output || `${bookPath}.opencite.json`);
  writeFileSync(destination, `${canonical}\n`, { flag: "wx" });
  console.log(`Created: ${destination}`);
  console.log(`Content SHA-256:  ${contentHash}`);
  console.log(`Manifest SHA-256: ${hashText(canonical)}`);
}

async function verify(bookPath, manifestPath) {
  const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
  if (
    manifest.schema !== SCHEMA ||
    manifest.version !== 1 ||
    !/^0x[a-f0-9]{64}$/.test(manifest.content?.sha256 || "")
  ) {
    fail("Not a supported OpenCite manifest.");
  }
  const absoluteBook = resolve(bookPath);
  const actualHash = await hashFile(absoluteBook);
  const sizeMatches = statSync(absoluteBook).size === manifest.content.byteLength;
  if (!sizeMatches || actualHash !== manifest.content.sha256) {
    fail(`MISMATCH: expected ${manifest.content.sha256}, received ${actualHash}.`);
  }
  console.log(`VERIFIED: ${manifest.citation.title}`);
  console.log(`Content SHA-256:  ${actualHash}`);
  console.log(`Manifest SHA-256: ${hashText(canonicalize(manifest))}`);
}

async function main(argv) {
  const [command, ...values] = argv;
  if (!command || command === "help" || command === "--help") {
    console.log(usage());
    return;
  }
  const flags = options(values);
  if (command === "create" && flags._.length === 1) return create(flags._[0], flags);
  if (command === "verify" && flags._.length === 2) return verify(flags._[0], flags._[1]);
  fail(`Invalid command.\n\n${usage()}`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`OpenCite: ${error.message}`);
  process.exitCode = 1;
});
