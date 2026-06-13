import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { getConfigWarnings, loadIndexConfig } from "../src/config.js"

const globalConfig = path.join(os.tmpdir(), `opencode-indexer-global-${process.pid}.json`)
process.env.OPENCODE_CODEBASE_INDEXER_GLOBAL_CONFIG = globalConfig

async function writeGlobal(config: Record<string, unknown> = {}) {
  await fs.writeFile(globalConfig, JSON.stringify(config))
}

test("loads project enrollment and Ollama defaults", async () => {
  await writeGlobal()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(path.join(dir, ".opencode", "codebase-indexer.json"), JSON.stringify({ enabled: true }))
  const config = await loadIndexConfig(dir)
  assert.equal(config.enabled, true)
  assert.equal(config.embedderProvider, "ollama")
  assert.equal(config.vectorStoreProvider, "qdrant")
})

test("loads directly configured API keys", async () => {
  await writeGlobal({
    provider: "openrouter",
    qdrant: { apiKey: "qdrant-direct" },
    openrouter: { apiKey: "openrouter-direct" },
  })
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(
    path.join(dir, ".opencode", "codebase-indexer.json"),
    JSON.stringify({
      enabled: true,
    }),
  )
  const config = await loadIndexConfig(dir)
  assert.equal(config.qdrantApiKey, "qdrant-direct")
  assert.equal(config.openRouterApiKey, "openrouter-direct")
})

test("accepts an empty project config file", async () => {
  await writeGlobal()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(path.join(dir, ".opencode", "codebase-indexer.json"), "")
  const config = await loadIndexConfig(dir)
  assert.equal(config.enabled, false)
})

test("accepts a UTF-8 BOM in project config", async () => {
  await writeGlobal()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(path.join(dir, ".opencode", "codebase-indexer.json"), `\uFEFF${JSON.stringify({ enabled: true })}`)
  const config = await loadIndexConfig(dir)
  assert.equal(config.enabled, true)
})

test("warns when a literal key is placed in apiKeyEnv", async () => {
  await writeGlobal({ openrouter: { apiKeyEnv: "sk-or-v1-example-key" } })
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(
    path.join(dir, ".opencode", "codebase-indexer.json"),
    JSON.stringify({ enabled: true }),
  )
  assert.match((await getConfigWarnings(dir))[0] ?? "", /use apiKey instead/)
})

test("ignores project attempts to override trusted global settings", async () => {
  await writeGlobal({
    provider: "openrouter",
    model: "trusted/model",
    qdrant: { url: "https://trusted-qdrant.example", apiKey: "trusted-qdrant-key" },
    openrouter: { apiKey: "trusted-openrouter-key" },
  })
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(
    path.join(dir, ".opencode", "codebase-indexer.json"),
    JSON.stringify({
      enabled: true,
      provider: "ollama",
      model: "attacker/model",
      qdrant: { url: "https://attacker.example", apiKey: "attacker-key" },
    }),
  )
  const config = await loadIndexConfig(dir)
  assert.equal(config.embedderProvider, "openrouter")
  assert.equal(config.modelId, "trusted/model")
  assert.equal(config.qdrantUrl, "https://trusted-qdrant.example")
  assert.equal(config.qdrantApiKey, "trusted-qdrant-key")
  assert.match((await getConfigWarnings(dir))[0] ?? "", /enrollment-only/)
})

test("does not expose ignored project values in diagnostics", async () => {
  await writeGlobal()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(
    path.join(dir, ".opencode", "codebase-indexer.json"),
    JSON.stringify({ enabled: true, openrouter: { apiKey: "project-secret" } }),
  )
  assert.doesNotMatch(JSON.stringify(await getConfigWarnings(dir)), /project-secret/)
})

test("rejects insecure remote service URLs by default", async () => {
  await writeGlobal({ qdrant: { url: "http://qdrant.example:6333" } })
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(path.join(dir, ".opencode", "codebase-indexer.json"), JSON.stringify({ enabled: true }))
  await assert.rejects(loadIndexConfig(dir), /must use HTTPS/)
})

test("allows an explicit global insecure remote HTTP opt-in", async () => {
  await writeGlobal({ allowInsecureRemoteHttp: true, qdrant: { url: "http://qdrant.example:6333" } })
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(path.join(dir, ".opencode", "codebase-indexer.json"), JSON.stringify({ enabled: true }))
  assert.equal((await loadIndexConfig(dir)).qdrantUrl, "http://qdrant.example:6333")
})

test("rejects credentials embedded in service URLs", async () => {
  await writeGlobal({ qdrant: { url: "https://user:password@qdrant.example" } })
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-indexer-"))
  await fs.mkdir(path.join(dir, ".opencode"))
  await fs.writeFile(path.join(dir, ".opencode", "codebase-indexer.json"), JSON.stringify({ enabled: true }))
  await assert.rejects(loadIndexConfig(dir), /embedded credentials/)
})
