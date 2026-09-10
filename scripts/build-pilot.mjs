import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SCHEMA =
  "https://github.com/sharziki/opencite/blob/main/schema/source-manifest-v1.schema.json";
const USER_AGENT = "OpenCite/0.1 (+https://github.com/sharziki/opencite)";
const BOOK_IDS = [
  11, 35, 46, 55, 74, 76, 84, 98, 120, 345, 768, 844, 1080, 1232, 1260,
  1342, 1400, 1661, 2554, 2591, 2600, 2701, 4300, 514, 174,
];

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

function sha256(value) {
  return `0x${createHash("sha256").update(value).digest("hex")}`;
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`));
  if (!match) throw new Error(`Missing OPDS ${name}.`);
  return decodeXml(match[1].trim());
}

function attributes(element) {
  return Object.fromEntries(
    [...element.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [
      match[1],
      decodeXml(match[2]),
    ]),
  );
}

async function get(url, binary = false) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return binary ? Buffer.from(await response.arrayBuffer()) : response.text();
}

async function witnessBook(id, createdAt) {
  const landingUrl = `https://www.gutenberg.org/ebooks/${id}`;
  const opdsUrl = `${landingUrl}.opds`;
  const xml = await get(opdsUrl);
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
  if (!entry) throw new Error(`No OPDS entry for #${id}.`);

  const rights = tag(entry, "rights");
  if (!rights.toLowerCase().includes("public domain in the usa")) {
    throw new Error(`#${id} is not marked public domain in the USA: ${rights}`);
  }
  const links = [...entry.matchAll(/<link\b[^>]*\/>/g)].map((match) =>
    attributes(match[0]),
  );
  const editions = links.filter(
    (link) =>
      link.type === "application/epub+zip" &&
      link.rel === "http://opds-spec.org/acquisition",
  );
  const edition = editions.find((link) => /no images/i.test(link.title || "")) || editions[0];
  if (!edition?.href) throw new Error(`No EPUB acquisition link for #${id}.`);

  const bytes = await get(new URL(edition.href, opdsUrl), true);
  const contentHash = sha256(bytes);
  const title = tag(entry, "title");
  const creator = tag(entry.match(/<author>([\s\S]*?)<\/author>/)?.[1] || "", "name");
  const manifest = {
    schema: SCHEMA,
    version: 1,
    content: {
      filename: `gutenberg-${id}.epub`,
      mediaType: "application/epub+zip",
      byteLength: bytes.length,
      sha256: contentHash,
    },
    citation: { title, creator, sourceUrl: landingUrl },
    bibliography: {
      publicationDate: null,
      edition: `Project Gutenberg eBook #${id} · ${edition.title || "EPUB"}`,
      identifier: `Project Gutenberg #${id}`,
    },
    witness: { kind: "DIGITAL-COPY", evidence: opdsUrl },
    rights: {
      basis: "PUBLIC-DOMAIN-US",
      evidence: "https://www.gutenberg.org/policy/permission",
    },
    provenance: {
      createdAt,
      generator: "OpenCite/0.1.0",
      claim:
        "This record preserves evidence of a witnessed source. It does not establish factual truth.",
    },
  };
  const manifestText = `${canonicalize(manifest)}\n`;
  return {
    manifest,
    manifestText,
    indexRecord: {
      id: `gutenberg-${id}`,
      title,
      creator,
      edition: manifest.bibliography.edition,
      identifier: manifest.bibliography.identifier,
      sourceUrl: landingUrl,
      manifestUrl: `/archive/manifests/gutenberg-${id}.opencite.json`,
      contentHash,
      manifestHash: sha256(canonicalize(manifest)),
      byteLength: bytes.length,
      witnessKind: "DIGITAL-COPY",
      rights: "Public domain in the USA; verify local law elsewhere.",
    },
  };
}

const output = resolve("public/archive");
await mkdir(resolve(output, "manifests"), { recursive: true });
const createdAt = new Date().toISOString();
const records = [];

for (const id of BOOK_IDS) {
  process.stdout.write(`Witnessing Project Gutenberg #${id}… `);
  const result = await witnessBook(id, createdAt);
  await writeFile(
    resolve(output, "manifests", `gutenberg-${id}.opencite.json`),
    result.manifestText,
  );
  records.push(result.indexRecord);
  console.log(result.indexRecord.title);
}

records.sort((left, right) => left.title.localeCompare(right.title));
await writeFile(
  resolve(output, "index.json"),
  `${JSON.stringify(
    {
      version: 1,
      generatedAt: createdAt,
      collection: "OpenCite public-domain pilot",
      source: "Project Gutenberg OPDS",
      rightsScope: "Project Gutenberg marks these editions public domain in the USA. Verify local law elsewhere.",
      records,
    },
    null,
    2,
  )}\n`,
);
console.log(`\nWrote ${records.length} witness manifests to ${output}.`);
