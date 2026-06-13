# OpenCode Codebase Indexing

An OpenCode plugin that automatically indexes enrolled codebases, stores semantic code chunks in Qdrant, and gives OpenCode a `semantic_search` tool for fast codebase discovery.

The plugin supports OpenRouter, OpenAI, and Ollama embedding providers. Every project receives its own deterministic Qdrant collection.

## Install

Add the npm plugin to your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-codebase-indexer"]
}
```

OpenCode installs npm plugins and their dependencies automatically with Bun.

## Configure

Trusted settings are stored globally:

```text
~/.config/opencode/codebase-indexer/config.json
```

### OpenRouter And Hosted Qdrant

```json
{
  "provider": "openrouter",
  "model": "qwen/qwen3-embedding-8b",
  "qdrant": {
    "url": "https://qdrant.example.com",
    "apiKeyEnv": "QDRANT_API_KEY"
  },
  "openrouter": {
    "apiKeyEnv": "OPENROUTER_API_KEY"
  }
}
```

Direct `apiKey` values are supported but stored as plaintext. `apiKeyEnv` contains an environment variable name, not the key itself.

### Ollama And Local Qdrant

```json
{
  "provider": "ollama",
  "model": "nomic-embed-text",
  "qdrant": {
    "url": "http://localhost:6333"
  },
  "ollama": {
    "baseUrl": "http://localhost:11434"
  }
}
```

Loopback HTTP addresses work automatically. Remote Qdrant and Ollama services must use HTTPS unless trusted global configuration explicitly sets `"allowInsecureRemoteHttp": true`.

## Enable A Project

Create `.opencode/codebase-indexer.json` in the project root:

```json
{
  "enabled": true
}
```

Project configuration is enrollment-only. Provider settings, endpoints, models, tuning, and API keys must remain in the global configuration.

When an enrolled project opens, the plugin:

1. Connects to its deterministic `opencode-ws-<project-path-hash>` Qdrant collection.
2. Indexes new and changed supported files.
3. Removes stale entries for deleted or newly ignored files.
4. Watches the project for changes while OpenCode is running.
5. Exposes `semantic_search`, `index_status`, `index_codebase`, `reindex_codebase`, `stop_indexing`, and `index_doctor`.

Moving or renaming a project changes its absolute path and creates a different collection. Existing Codex configuration and collections are not read or migrated.

## Privacy And Security

Supported source-code chunks are sent to the configured embedding provider and stored in the configured Qdrant instance.

- API keys are sent only to their configured service for authentication.
- Project configuration cannot override trusted global endpoints or credentials.
- Common secret files, hidden files, `.gitignore`, and `.kilocodeignore` entries are excluded.
- Symlinks cannot be used to index files outside an enrolled project.
- Tool calls are restricted to the active OpenCode worktree.

Sensitive information inside ordinary source files may still be indexed.

## Development

```powershell
cd plugins/codebase-indexer
npm install
npm run check
npm pack --dry-run
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [RELEASING.md](RELEASING.md), [SECURITY.md](SECURITY.md), and [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

## License

MIT licensed. Adapted KiloCode components retain their MIT attribution in `plugins/codebase-indexer/LICENSE.kilocode` and `plugins/codebase-indexer/THIRD_PARTY_NOTICES.md`.
