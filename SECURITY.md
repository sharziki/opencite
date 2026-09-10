# Security policy

## Supported versions

OpenCite is pre-1.0 software. Security fixes target the latest `main` branch.

## Reporting a vulnerability

Do not open a public issue for an exploitable vulnerability. Use GitHub's private vulnerability reporting for this repository. Include affected code, reproduction steps, impact, and any proposed mitigation.

## Scope

High-priority reports include:

- source or manifest hash mismatches accepted as valid;
- files leaving the browser without explicit user action;
- wallet transactions differing from displayed intent;
- unauthorized attestation revocation;
- cross-site scripting through citation metadata;
- compromised build or release provenance.

Never include real private keys or confidential source documents in a report.
