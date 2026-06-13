import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isRealPathWithinWorkspace } from "../src/indexing/shared/path-security.js"

test("accepts real files inside the workspace", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-workspace-"))
  const file = path.join(workspace, "inside.ts")
  await fs.writeFile(file, "export const inside = true")
  assert.equal(await isRealPathWithinWorkspace(file, workspace), true)
})

test("rejects symlinks that escape the workspace when symlink creation is available", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-workspace-"))
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-outside-"))
  const target = path.join(outside, "secret.ts")
  const link = path.join(workspace, "linked-secret.ts")
  await fs.writeFile(target, "export const secret = true")
  try {
    await fs.symlink(target, link)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      return
    }
    throw error
  }
  assert.equal(await isRealPathWithinWorkspace(link, workspace), false)
})
