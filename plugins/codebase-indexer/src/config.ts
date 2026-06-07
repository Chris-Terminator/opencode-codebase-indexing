import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { IndexingConfigInput } from "./indexing/config-manager.js"
import type { EmbedderProvider } from "./indexing/interfaces/manager.js"

type Provider = Extract<EmbedderProvider, "openai" | "ollama" | "openrouter">

type FileConfig = {
  enabled?: boolean
  provider?: Provider
  model?: string
  dimension?: number
  qdrant?: { url?: string; apiKey?: string; apiKeyEnv?: string }
  openai?: { apiKey?: string; apiKeyEnv?: string }
  ollama?: { baseUrl?: string }
  openrouter?: { apiKey?: string; apiKeyEnv?: string; specificProvider?: string }
  searchMinScore?: number
  searchMaxResults?: number
  embeddingBatchSize?: number
  scannerMaxBatchRetries?: number
  allowInsecureRemoteHttp?: boolean
}

function globalConfigPath(): string {
  return process.env.CODEBASE_INDEXER_GLOBAL_CONFIG ?? path.join(os.homedir(), ".codex", "codebase-indexer", "config.json")
}

export async function loadIndexConfig(workspacePath: string): Promise<IndexingConfigInput> {
  const global = await readJson(globalConfigPath())
  const project = await readJson(path.join(workspacePath, ".codex", "codebase-indexer.json"))
  const config = { ...global, enabled: project.enabled === true }
  const provider = config.provider ?? "ollama"
  const qdrantUrl = validateServiceUrl(config.qdrant?.url ?? "http://localhost:6333", config.allowInsecureRemoteHttp)
  const ollamaBaseUrl = validateServiceUrl(
    config.ollama?.baseUrl ?? "http://localhost:11434",
    config.allowInsecureRemoteHttp,
  )

  return {
    enabled: config.enabled === true,
    embedderProvider: provider,
    vectorStoreProvider: "qdrant",
    modelId: config.model,
    modelDimension: config.dimension,
    qdrantUrl,
    qdrantApiKey: secret(config.qdrant?.apiKey, config.qdrant?.apiKeyEnv),
    openAiKey: secret(config.openai?.apiKey, config.openai?.apiKeyEnv ?? "OPENAI_API_KEY"),
    ollamaBaseUrl,
    openRouterApiKey: secret(config.openrouter?.apiKey, config.openrouter?.apiKeyEnv ?? "OPENROUTER_API_KEY"),
    openRouterSpecificProvider: config.openrouter?.specificProvider,
    searchMinScore: config.searchMinScore,
    searchMaxResults: config.searchMaxResults,
    embeddingBatchSize: config.embeddingBatchSize,
    scannerMaxBatchRetries: config.scannerMaxBatchRetries,
  }
}

export async function isProjectEnrolled(workspacePath: string): Promise<boolean> {
  return (await readJson(path.join(workspacePath, ".codex", "codebase-indexer.json"))).enabled === true
}

export async function getConfigWarnings(workspacePath: string): Promise<string[]> {
  const global = await readJson(globalConfigPath())
  const project = await readJson(path.join(workspacePath, ".codex", "codebase-indexer.json"))
  const warnings: string[] = []
  const unsupportedProjectKeys = Object.keys(project).filter((key) => key !== "enabled")
  if (unsupportedProjectKeys.length > 0) {
    warnings.push(
      `Project config is enrollment-only. Ignored fields: ${unsupportedProjectKeys.sort().join(", ")}. Move them to the global config.`,
    )
  }

  for (const [label, value] of [
    ["qdrant.apiKeyEnv", global.qdrant?.apiKeyEnv],
    ["openai.apiKeyEnv", global.openai?.apiKeyEnv],
    ["openrouter.apiKeyEnv", global.openrouter?.apiKeyEnv],
  ] as const) {
    if (value && !isEnvironmentVariableName(value)) {
      warnings.push(`${label} must contain an environment variable name. To hard-code a key, use apiKey instead.`)
    }
  }
  return warnings
}

function env(name?: string): string | undefined {
  return name ? process.env[name] : undefined
}

function secret(direct?: string, envName?: string): string | undefined {
  return direct || env(envName)
}

function isEnvironmentVariableName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
}

function validateServiceUrl(value: string, allowInsecureRemoteHttp = false): string {
  const normalized = value.includes("://") ? value : `http://${value}`
  const parsed = new URL(normalized)
  if (parsed.username || parsed.password) {
    throw new Error("Service URLs must not contain embedded credentials.")
  }
  const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname.toLowerCase())
  if (parsed.protocol === "http:" && !loopback && !allowInsecureRemoteHttp) {
    throw new Error("Remote service URLs must use HTTPS unless allowInsecureRemoteHttp is explicitly enabled globally.")
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Service URLs must use HTTP or HTTPS.")
  }
  return normalized
}

async function readJson(filePath: string): Promise<FileConfig> {
  try {
    const contents = (await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, "")
    return contents.trim() ? (JSON.parse(contents) as FileConfig) : {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw new Error(`Failed to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
