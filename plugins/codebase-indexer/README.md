# Codebase Indexer Plugin

Qdrant-backed semantic code search for Codex, adapted from KiloCode's MIT-licensed standalone indexing engine.

## Trust Boundary

Projects are enrolled with `.codex/codebase-indexer.json`:

```json
{
  "enabled": true
}
```

Project configuration is enrollment-only. Any additional project fields are ignored and reported by `index_doctor`. Trusted provider, model, endpoint, tuning, and credential settings are loaded exclusively from `~/.codex/codebase-indexer/config.json`.

MCP operations are restricted to an exact active Codex workspace root. When Codex roots are unavailable, an explicitly passed path is accepted only if that exact directory is enrolled.

## Global Configuration

Example using OpenRouter and hosted Qdrant:

```json
{
  "provider": "openrouter",
  "model": "openai/text-embedding-3-small",
  "qdrant": {
    "url": "https://qdrant.example.com",
    "apiKeyEnv": "QDRANT_API_KEY"
  },
  "openrouter": {
    "apiKeyEnv": "OPENROUTER_API_KEY"
  }
}
```

Direct plaintext keys are also supported globally:

```json
{
  "qdrant": { "url": "https://qdrant.example.com", "apiKey": "your-qdrant-key" },
  "openrouter": { "apiKey": "your-openrouter-key" }
}
```

Direct keys are stored unencrypted on the local machine. Never place the global config inside a repository or share it in logs, support requests, or backups you do not trust.

Remote service URLs must use HTTPS. Plain HTTP is accepted automatically for loopback services only. A trusted private-network deployment may explicitly opt into remote HTTP globally with `"allowInsecureRemoteHttp": true`, acknowledging that credentials and source code will travel without transport encryption.

## Privacy

Supported source-code chunks are sent to the configured embedding provider and stored in the configured Qdrant instance. API keys authenticate only to their configured service and are not included in Qdrant code payloads. Common secret files, root `.gitignore`, and root `.kilocodeignore` entries are excluded, but source files may still contain sensitive information.

Each project uses a separate deterministic `codex-ws-<project-path-hash>` Qdrant collection. Reopening the same absolute path reuses its collection.
