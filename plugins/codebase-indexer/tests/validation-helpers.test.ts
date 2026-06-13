import test from "node:test"
import assert from "node:assert/strict"
import { sanitizeErrorMessage } from "../src/indexing/shared/validation-helpers.js"

test("preserves project-relative setup paths while redacting absolute paths", () => {
  const message =
    'Add .opencode/codebase-indexer.json with { "enabled": true }. Failed at C:\\Users\\person\\secret.txt or /home/person/secret.txt.'
  const sanitized = sanitizeErrorMessage(message)

  assert.match(sanitized, /\.opencode\/codebase-indexer\.json/)
  assert.doesNotMatch(sanitized, /C:\\Users|\/home\/person/)
})
