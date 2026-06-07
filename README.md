# Codex Codebase Indexing

A Codex plugin that automatically indexes enrolled codebases, stores semantic code chunks in Qdrant, and gives Codex a `semantic_search` tool for fast codebase discovery.

The plugin supports OpenRouter, OpenAI, and Ollama embedding providers. Every project receives its own deterministic Qdrant collection.

## Install From Codex

You do not need to clone the entire repository or install npm dependencies.

1. Open the Codex plugin marketplace.
2. Select **Add marketplace**.
3. Enter:

   - **Source:** `Chris-Terminator/codex-codebase-indexing`
   - **Git ref:** `main`
   - **Sparse paths:**

     ```text
     .agents/plugins/marketplace.json
     plugins/codebase-indexer
     ```

4. Select **Add marketplace**.
5. Find and install **Codebase Indexer**.
6. Restart Codex.

Sparse paths make Codex download only the marketplace manifest and runnable plugin files. The plugin includes a prebuilt MCP server, so users do not need npm, Bun, TypeScript, or build tools.

### CLI Installation

You can also clone the repository and install it manually:

```powershell
codex plugin marketplace add "C:\path\to\codex-codebase-indexing"
codex plugin add codebase-indexer@codex-codebase-indexing
```

Restart Codex after installation or updates.

## Configure The Plugin

Trusted settings are stored globally:

```text
~/.codex/codebase-indexer/config.json
```

On Windows, this is normally:

```text
C:\Users\YOUR_USERNAME\.codex\codebase-indexer\config.json
```

### OpenRouter And Hosted Qdrant

```json
{
  "provider": "openrouter",
  "model": "qwen/qwen3-embedding-8b",
  "qdrant": {
    "url": "https://qdrant.example.com",
    "apiKey": "your-qdrant-api-key"
  },
  "openrouter": {
    "apiKey": "your-openrouter-api-key"
  }
}
```

Direct API keys are supported and stored as plaintext on the local machine. Keep this global config outside repositories and do not share it.

You may reference environment variables instead:

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

`apiKeyEnv` contains the environment variable's **name**, not the key itself.

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

## HTTPS And Insecure HTTP

The plugin protects source code and credentials in transit:

- Local loopback HTTP addresses such as `http://localhost`, `http://127.0.0.1`, and `http://[::1]` work automatically.
- Remote Qdrant and Ollama services must use HTTPS by default.
- Service URLs containing embedded credentials such as `https://user:password@example.com` are rejected.

If you intentionally use remote HTTP on a trusted private network, explicitly enable it in the global config:

```json
{
  "allowInsecureRemoteHttp": true,
  "qdrant": {
    "url": "http://192.168.1.50:6333"
  }
}
```

This opt-in means API keys, source-code chunks, embeddings, and search queries may travel across the network without transport encryption. Prefer HTTPS whenever possible.

## Enable A Project

Inside the project's root directory, create:

```text
.codex/codebase-indexer.json
```

With:

```json
{
  "enabled": true
}
```

That file only enrolls the project. Provider settings, endpoints, models, tuning, and API keys must remain in the global config.

You can also ask Codex:

> Enable codebase indexing for this project.

When an enrolled project opens, the plugin:

1. Connects to its deterministic `codex-ws-<project-path-hash>` Qdrant collection.
2. Indexes new and changed supported files.
3. Removes stale entries for deleted or newly ignored files.
4. Watches the project for changes while Codex is running.
5. Makes the project searchable through `semantic_search`.

Moving or renaming a project changes its absolute path and therefore creates a different collection.

## Privacy And Security

Supported source-code chunks are sent to the configured embedding provider and stored in the configured Qdrant instance.

- API keys are sent only to their configured service for authentication.
- API keys are not stored in Qdrant code payloads.
- Project configuration cannot override trusted global endpoints or credentials.
- Common secret files, hidden files, `.gitignore`, and `.kilocodeignore` entries are excluded.
- Symlinks cannot be used to index files outside an enrolled project.

Sensitive information embedded inside ordinary source files may still be indexed. Protect the local machine, provider accounts, and Qdrant instance appropriately.

## Useful Requests

You can ask Codex:

- `Enable codebase indexing for this project.`
- `Check the codebase index status.`
- `Search the codebase index for authentication handling.`
- `Reindex this project.`
- `Stop indexing this project.`

## Development And Security

See [CONTRIBUTING.md](CONTRIBUTING.md), [RELEASING.md](RELEASING.md), [SECURITY.md](SECURITY.md), and [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

## License

This project is MIT licensed. Adapted KiloCode components retain their MIT attribution in `plugins/codebase-indexer/LICENSE.kilocode` and `plugins/codebase-indexer/THIRD_PARTY_NOTICES.md`.
