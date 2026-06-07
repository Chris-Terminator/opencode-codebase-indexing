import test from "node:test"
import assert from "node:assert/strict"
import { redactLogValue } from "../src/util/log.js"

test("redacts credentials from structured logs", () => {
  const redacted = redactLogValue({
    apiKey: "super-secret",
    nested: { authorization: "Bearer abc123", message: "request failed for sk-or-v1-abcdefghijklmnop" },
  }) as Record<string, any>

  assert.equal(redacted.apiKey, "[REDACTED]")
  assert.equal(redacted.nested.authorization, "[REDACTED]")
  assert.doesNotMatch(redacted.nested.message, /sk-or-v1/)
})
