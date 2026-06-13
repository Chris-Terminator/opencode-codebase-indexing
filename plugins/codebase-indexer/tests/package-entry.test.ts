import test from "node:test"
import assert from "node:assert/strict"

test("package entry exports only the OpenCode plugin function", async () => {
  const entry = await import("../dist/src/plugin.js")
  assert.deepEqual(Object.keys(entry), ["CodebaseIndexerPlugin"])
  assert.equal(typeof entry.CodebaseIndexerPlugin, "function")
})
