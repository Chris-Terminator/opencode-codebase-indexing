---
name: codebase-indexing
description: Use Qdrant-backed semantic code search for conceptual codebase exploration and manage the active project's code index.
---

# Codebase Indexing

- Prefer `semantic_search` when the user describes behavior or concepts without exact identifiers.
- Pass the exact enrolled active workspace root as `workspacePath` whenever the tool cannot infer it from MCP roots.
- Follow semantic results with normal file reads or `rg` before editing.
- Use `index_status` before diagnosing missing results.
- Only use `reindex_codebase` after the user explicitly requests a rebuild.
- Projects are enrolled by adding `.codex/codebase-indexer.json` with `{ "enabled": true }`; all trusted settings belong in the global config.
