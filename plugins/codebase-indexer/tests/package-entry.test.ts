import test from "node:test"
import assert from "node:assert/strict"

test("package entry exports the OpenCode server plugin", async () => {
  const entry = await import("../dist/plugin.js")
  assert.deepEqual(Object.keys(entry).sort(), ["CodebaseIndexerPlugin", "server"])
  assert.equal(typeof entry.CodebaseIndexerPlugin, "function")
  assert.equal(entry.server, entry.CodebaseIndexerPlugin)
})
