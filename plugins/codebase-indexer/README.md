# OpenCode Codebase Indexer Plugin

Qdrant-backed semantic code search for OpenCode, adapted from KiloCode's MIT-licensed standalone indexing engine.

Install it from npm by adding `"opencode-codebase-indexer"` to the `plugin` array in OpenCode configuration.

Projects are enrolled with `.opencode/codebase-indexer.json`:

```json
{
  "enabled": true
}
```

Trusted provider, model, endpoint, tuning, and credential settings are loaded exclusively from:

```text
~/.config/opencode/codebase-indexer/config.json
```

Project configuration is enrollment-only. Any additional project fields are ignored and reported by `index_doctor`.

The plugin automatically indexes and watches an enrolled active worktree. It exposes the native OpenCode tools `semantic_search`, `index_status`, `index_codebase`, `reindex_codebase`, `stop_indexing`, and `index_doctor`.

Remote services must use HTTPS. Plain HTTP is accepted automatically for loopback services only. A trusted private-network deployment may explicitly opt into remote HTTP globally with `"allowInsecureRemoteHttp": true`.

Each project uses a separate deterministic `opencode-ws-<project-path-hash>` Qdrant collection. Existing Codex configuration and collections are intentionally not reused.
