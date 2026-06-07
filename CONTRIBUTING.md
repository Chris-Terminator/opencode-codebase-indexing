# Contributing

## Requirements

- Node.js 22 or newer
- npm
- Bun for the current test runner
- Python for Codex plugin validation scripts

## Local Checks

From `plugins/codebase-indexer`:

```powershell
npm ci
npm run check
```

The build command updates the committed `dist/mcp-server.cjs` bundle. Review and commit source and bundle changes together.

Before submitting a change, validate the plugin with Codex's `plugin-creator/scripts/validate_plugin.py` helper and smoke-test the bundled MCP server.

Never commit global Codebase Indexer configuration, API keys, private security-scan artifacts, or indexed source data.

