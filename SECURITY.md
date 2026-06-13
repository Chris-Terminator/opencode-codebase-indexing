# Security Policy

## Reporting A Security Issue

Open a GitHub issue with the affected version, reproduction steps, impact, and any suggested mitigation. Do not include API keys, credentials, private source code, or other sensitive data in the report.

## Security Model

- Projects must be explicitly enrolled.
- Native plugin tools may operate only on the exact active OpenCode worktree.
- Project configuration cannot override trusted global providers, endpoints, models, or credentials.
- Source chunks leave the machine when a remote embedding provider or Qdrant instance is configured.
- Plaintext global API keys are supported as an explicit local-machine tradeoff.
