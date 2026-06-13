import test from "node:test"
import assert from "node:assert/strict"

test("package entry default-exports one OpenCode plugin module", async () => {
  const entry = await import("../dist/plugin.js")
  assert.deepEqual(Object.keys(entry), ["default"])
  assert.equal(entry.default.id, "opencode-codebase-indexer")
  assert.equal(typeof entry.default.server, "function")
  assert.equal("tui" in entry.default, false)
})
