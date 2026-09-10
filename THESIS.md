# The OpenCite Thesis

## AI needs public memory

AI systems are becoming an interface to history. If their evidence lives only in private indexes, model weights, or changeable web pages, no reader can reliably inspect which version of the past produced an answer.

No company, state, archive, or majority should get a silent edit button for history.

OpenCite's goal is a public provenance archive for every book: not one canonical library, but an open network of portable witness records that any library, publisher, researcher, reader, or AI system can keep and verify.

## What a witness says

An OpenCite record makes a narrow claim:

> At this time, this witness committed to this exact fingerprint and this bibliographic description of a book copy.

That claim is useful because it is testable. Given a copy, anyone can recompute its fingerprint. Given a manifest, anyone can inspect its edition, source, witness, and rights metadata. Given a public attestation, anyone can check whether the record changed or was revoked.

## How historical confidence grows

One witness can be wrong. One scan can be corrupt. One catalog can contain an error. OpenCite therefore does not nominate a single source of truth.

Confidence grows when independent witnesses converge:

1. Multiple custodians identify the same work and edition.
2. Their independently computed fingerprints agree.
3. Their catalog, publication, and rights evidence can be inspected.
4. Conflicting fingerprints or descriptions remain visible.
5. Later scholarship can add context without erasing earlier records.

This is evidence preservation, not truth by vote. Minority editions, disputed texts, translations, corrections, censorship variants, and historical errors belong in the record too.

## Copyright boundary

OpenCite stores metadata, cryptographic fingerprints, and attestations. It does not require uploading or distributing book contents.

- Copyrighted works stay with lawful custodians.
- Public-domain or openly licensed works may be mirrored by preservation archives.
- A fingerprint does not grant access or establish ownership.
- Contributors must not publish private locations, credentials, or piracy links.

This separates two jobs: preservation systems keep lawful copies; OpenCite makes their identity and provenance independently verifiable.

## Blockchain's narrow role

Blockchain can make a published attestation difficult for one operator to rewrite or remove. It cannot determine whether a book is accurate, whether metadata is correct, whether a witness is reputable, or whether distribution is lawful.

OpenCite uses blockchain as an optional append-only anchor. Manifests and local verification remain useful without it. No token, truth market, or governance vote is required.

## Success

OpenCite succeeds when an AI answer can name the exact book edition behind a claim, a reader can verify that edition independently, and no single platform is required to preserve the evidence.
