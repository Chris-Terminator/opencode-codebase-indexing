# Security Review Summary

Review date: June 13, 2026
Scope: Native OpenCode plugin adapter, indexing lifecycle, credential handling, Qdrant integration, dependencies, and npm distribution.

## Trust Boundaries

- Only an exact active OpenCode worktree enrolled through `.opencode/codebase-indexer.json` is authorized.
- Project configuration is enrollment-only and cannot override trusted global providers, endpoints, models, or credentials.
- Symlinks resolving outside the enrolled worktree are excluded.
- Remote non-loopback services require HTTPS unless trusted global configuration explicitly opts into insecure HTTP.
- Structured logs and surfaced errors sanitize common credential formats.

## Expected Residual Risks

- Ordinary source files may contain sensitive information and are sent to the configured embedding provider and Qdrant service.
- Direct API keys in global configuration are stored as plaintext on the local machine.
- A user can explicitly opt into insecure remote HTTP for a trusted private network.
- A compromised embedding provider, Qdrant service, OpenCode installation, or local machine can access indexed source data.

## Verification

- Configuration, path authorization, secret-file ignores, symlink containment, error sanitization, Qdrant filters, native tool registration, plugin lifecycle, and Tree-sitter packaging are covered by automated tests.
- Release verification includes a clean production build, full test suite, npm tarball inspection, and built-entrypoint import smoke test.
