import test from "node:test"
import assert from "node:assert/strict"
import { FileIgnore } from "../src/file/ignore.js"

test("ignores common secret files anywhere in a project", () => {
  for (const file of [
    ".env",
    ".env.local",
    "apps/web/.env.production",
    "certs/server.pem",
    "certs/server.key",
    "certs/server.p12",
    "certs/server.pfx",
    "config/credentials.json",
    "config/secrets.yaml",
  ]) {
    assert.equal(FileIgnore.match(file), true, `${file} should be ignored`)
  }
})

test("does not ignore ordinary source files", () => {
  assert.equal(FileIgnore.match("src/config.ts"), false)
})

test("ignores hidden files and directories consistently", () => {
  assert.equal(FileIgnore.match(".credentials.ts"), true)
  assert.equal(FileIgnore.match(".github/workflows/release.ts"), true)
})
