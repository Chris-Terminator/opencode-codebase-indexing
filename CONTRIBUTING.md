# Contributing

## Requirements

- Node.js 22 or newer
- npm
- Bun for the test runner

## Local Checks

From `plugins/codebase-indexer`:

```powershell
npm ci
npm run check
npm pack --dry-run
```

The build emits the bundled native OpenCode plugin into `dist/plugin.js` and packages Tree-sitter WASM assets under `dist/tree-sitter`.

Never commit global Codebase Indexer configuration, API keys, private security-scan artifacts, or indexed source data.
