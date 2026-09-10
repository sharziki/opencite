# Contributing to OpenCite

OpenCite welcomes focused contributions that improve source integrity, provenance, accessibility, privacy, or interoperability.

## Before opening code

1. Search existing issues and discussions.
2. Open an issue for behavior changes or protocol changes.
3. Keep pull requests small and explain the trust-boundary impact.
4. Never include copyrighted source files, credentials, private RPC URLs, or wallet keys.

Typo fixes, documentation corrections, tests, and accessibility improvements can go directly to a pull request.

## Development

Requirements: Node.js 22 or newer.

```bash
git clone https://github.com/sharziki/opencite.git
cd opencite
npm install
npm test
npm run dev
```

Before submitting:

```bash
npm run typecheck
npm test
npm run build:web
```

## Pull-request standard

- Describe user-visible behavior.
- Add the smallest test that proves non-trivial logic.
- State privacy, copyright, and smart-contract implications.
- Keep generated artifacts and deployment secrets out of Git.
- Use clear commits written in the imperative mood.

By contributing, you agree that your contribution is licensed under the MIT License.
