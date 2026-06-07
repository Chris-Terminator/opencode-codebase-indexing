# Security Review

Review date: June 7, 2026  
Scope: Entire public repository, plugin runtime, MCP boundary, indexing lifecycle, credential handling, Qdrant integration, dependencies, and distribution metadata.

## Result

The release-hardening review identified and resolved:

- Workspace authorization bypasses and stale-root watchers.
- Symlink-based reads outside enrolled workspaces.
- Project-level overrides of trusted global providers, endpoints, models, and credentials.
- Malformed MCP messages crashing the transport.
- Duplicate collections caused by non-canonical workspace aliases.
- Broad or prefix-based Qdrant file deletion filters.
- Runtime ignore-rule changes failing to purge newly ignored files.
- Inconsistent hidden-file handling.
- Plaintext remote HTTP endpoints without explicit opt-in.
- Service URLs containing embedded credentials.
- Insufficient logging and public-error sanitization.
- Incomplete plugin capability and privacy disclosures.

No unresolved high- or medium-severity findings remain from this review. The production dependency audit reported zero known vulnerabilities.

## Residual Risks

- Explicitly enrolled paths may be accessed when Codex does not provide active MCP roots. Enrollment is treated as authorization in that compatibility mode.
- Users may explicitly enable insecure remote HTTP for trusted private-network deployments.
- Direct API keys are supported in the global config and are stored as plaintext on the local machine.
- Sensitive information embedded inside otherwise supported source files may be sent to the configured embedding provider and Qdrant instance.
- Security depends on the local machine, configured provider accounts, and Qdrant deployment remaining trustworthy.

## Release Conditions

No unresolved security-review conditions remain.
