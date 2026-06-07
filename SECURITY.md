# Security Policy

## Reporting A Security Issue

Open a GitHub issue in `Chris-Terminator/codex-codebase-indexing` with the affected version, reproduction steps, impact, and any suggested mitigation. Do not include API keys, credentials, private source code, or other sensitive data in the report.

## Security Model

- Projects must be explicitly enrolled.
- MCP tools may operate only on exact active Codex roots or exact explicitly enrolled roots when Codex roots are unavailable.
- Project configuration cannot override trusted global providers, endpoints, models, or credentials.
- Source chunks leave the machine when a remote embedding provider or Qdrant instance is configured.
- Plaintext global API keys are supported as an explicit local-machine tradeoff.
