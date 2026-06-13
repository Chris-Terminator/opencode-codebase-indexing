import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { resolveWorkspace, uriToPath } from "../src/workspace.js"

async function enroll(dir: string) {
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(path.join(dir, ".opencode", "codebase-indexer.json"), JSON.stringify({ enabled: true }))
}

test("resolves an explicitly enrolled workspace when roots are unavailable", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await enroll(dir)
  assert.equal(await resolveWorkspace(dir), path.resolve(dir))
})

test("rejects linked worktrees", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await enroll(dir)
  await fs.writeFile(path.join(dir, ".git"), "gitdir: elsewhere")
  await assert.rejects(resolveWorkspace(dir), /linked worktrees/)
})

test("rejects unenrolled explicit workspaces", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await assert.rejects(resolveWorkspace(dir), /not enrolled/)
})

test("requires explicit paths to exactly match an active root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  const child = path.join(root, "child")
  await enroll(root)
  await fs.mkdir(child)
  await enroll(child)
  await assert.rejects(resolveWorkspace(child, [root]), /directory must exactly match/)
  assert.equal(await resolveWorkspace(root, [root]), path.resolve(root))
})

test("converts file roots", () => {
  assert.equal(uriToPath("file:///C:/code/example")?.replaceAll("\\", "/"), "C:/code/example")
})
