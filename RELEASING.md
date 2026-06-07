# Manual Release Process

The main branch is the release channel. This project is not published to npm and does not use CI/CD.

1. Replace all public metadata placeholders before the first public release.
2. Run `npm ci` and `npm run check` from `plugins/codebase-indexer`.
3. Validate the plugin and marketplace manifests.
4. Confirm `dist/mcp-server.cjs` matches current source and contains no secrets.
5. Test MCP startup, enrollment authorization, indexing, deletion synchronization, reindexing, and semantic search.
6. Review dependency audit results and the sanitized security-review summary.
7. Review the complete repository diff for secrets, local config, caches, and private scan artifacts.
8. Push the verified source and committed bundle to the main branch.

