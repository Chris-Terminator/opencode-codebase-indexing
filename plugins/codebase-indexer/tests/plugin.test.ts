import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { CodebaseIndexerPlugin } from "../src/plugin.js"

async function enrolledProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-plugin-"))
  await fs.mkdir(path.join(root, ".opencode"))
  await fs.writeFile(path.join(root, ".opencode", "codebase-indexer.json"), JSON.stringify({ enabled: true }))

  const globalConfig = path.join(root, "global-config.json")
  await fs.writeFile(globalConfig, JSON.stringify({ provider: "openai" }))
  process.env.OPENCODE_CODEBASE_INDEXER_GLOBAL_CONFIG = globalConfig
  return root
}

function pluginInput(root: string) {
  return {
    worktree: root,
    directory: root,
    project: {},
    client: {},
    serverUrl: new URL("http://localhost"),
    $: {},
    experimental_workspace: { register() {} },
  } as any
}

function toolContext(root: string) {
  return {
    worktree: root,
    directory: root,
    sessionID: "session",
    messageID: "message",
    agent: "build",
    abort: new AbortController().signal,
    metadata() {},
    async ask() {},
  } as any
}

test("registers all native OpenCode tools and semantic-search guidance", async () => {
  const root = await enrolledProject()
  const hooks = await CodebaseIndexerPlugin(pluginInput(root))
  const names = Object.keys(hooks.tool ?? {}).sort()

  assert.deepEqual(names, [
    "index_codebase",
    "index_doctor",
    "index_status",
    "reindex_codebase",
    "semantic_search",
    "stop_indexing",
  ])

  const output = { system: [] as string[] }
  await hooks["experimental.chat.system.transform"]?.({ model: {} as any }, output)
  assert.match(output.system.join(" "), /Prefer semantic_search/)
  await hooks.dispose?.()
})

test("executes status, doctor, start, and stop tools for the active worktree", async () => {
  const root = await enrolledProject()
  const hooks = await CodebaseIndexerPlugin(pluginInput(root))
  const tools = hooks.tool!
  const context = toolContext(root)

  for (const name of ["index_status", "index_doctor", "index_codebase", "stop_indexing"] as const) {
    const result = await tools[name]!.execute({}, context)
    assert.match(result as string, /"workspacePath"/)
  }

  await assert.rejects(tools.semantic_search!.execute({ query: "authentication" }, context), /not initialized/)
  await assert.rejects(tools.reindex_codebase!.execute({ confirm: false }, context), /requires confirm=true/)
  await hooks.dispose?.()
})

test("rejects tool calls from a different or linked worktree", async () => {
  const root = await enrolledProject()
  const other = await enrolledProject()
  const hooks = await CodebaseIndexerPlugin(pluginInput(root))

  await assert.rejects(hooks.tool!.index_status!.execute({}, toolContext(other)), /exactly match/)

  await fs.writeFile(path.join(root, ".git"), "gitdir: elsewhere")
  await assert.rejects(hooks.tool!.index_status!.execute({}, toolContext(root)), /linked worktrees/)
  await hooks.dispose?.()
})
