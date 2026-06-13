# Manual Release Process

1. Update the version and public metadata.
2. Run `npm ci` and `npm run check` from `plugins/codebase-indexer`.
3. Run `npm pack --dry-run` and verify the plugin entrypoint and Tree-sitter WASM assets are included.
4. Smoke-test installation through OpenCode's npm plugin configuration.
5. Test enrollment authorization, automatic indexing, deletion synchronization, reindexing, stopping, diagnostics, and semantic search.
6. Review dependency audit results and the sanitized security-review summary.
7. Review the complete repository diff for secrets, local config, caches, and private scan artifacts.
8. Publish `plugins/codebase-indexer` to npm and push the verified source.
