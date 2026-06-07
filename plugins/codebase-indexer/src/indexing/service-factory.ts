import type { Ignore } from "ignore"
import { OpenAiEmbedder } from "./embedders/openai"
import { CodeIndexOllamaEmbedder } from "./embedders/ollama"
import { OpenRouterEmbedder } from "./embedders/openrouter"
import { QdrantVectorStore } from "./vector-store/qdrant-client"
import { codeParser, DirectoryScanner, FileWatcher } from "./processors"
import type { ICodeParser, IEmbedder, IFileWatcher, IVectorStore } from "./interfaces"
import type { CodeIndexConfigManager } from "./config-manager"
import type { CacheManager } from "./cache-manager"
import type { IndexingTelemetryMeta, IndexingTelemetryReporter } from "./interfaces/telemetry"
import { resolveEmbeddingProfile } from "./embedding-profile"
import { getDefaultModelId } from "./model-registry"
import { BATCH_SEGMENT_THRESHOLD, OLLAMA_EMBEDDER_REQUEST_TIMEOUT_MS, REMOTE_EMBEDDER_VALIDATION_TIMEOUT_MS } from "./constants"

function timeout(provider: string): number {
  return provider === "ollama" ? OLLAMA_EMBEDDER_REQUEST_TIMEOUT_MS : REMOTE_EMBEDDER_VALIDATION_TIMEOUT_MS
}

export class CodeIndexServiceFactory {
  constructor(
    private readonly configManager: CodeIndexConfigManager,
    private readonly workspacePath: string,
    private readonly cacheManager: CacheManager,
    private readonly cacheDirectory: string,
    private readonly onTelemetry?: IndexingTelemetryReporter,
  ) {}

  private getTelemetryMeta(): IndexingTelemetryMeta {
    const config = this.configManager.getConfig()
    return { provider: config.embedderProvider, vectorStore: "qdrant", modelId: config.modelId }
  }

  public createEmbedder(): IEmbedder {
    const config = this.configManager.getConfig()
    if (config.embedderProvider === "openai") {
      if (!config.openAiOptions?.apiKey) throw new Error("OpenAI API key is required for embedding.")
      return new OpenAiEmbedder(config.openAiOptions.apiKey, config.modelId)
    }
    if (config.embedderProvider === "ollama") {
      if (!config.ollamaOptions?.baseUrl) throw new Error("Ollama base URL is required for embedding.")
      return new CodeIndexOllamaEmbedder(config.ollamaOptions.baseUrl, config.modelId, config.modelDimension)
    }
    if (config.embedderProvider === "openrouter") {
      if (!config.openRouterOptions?.apiKey) throw new Error("OpenRouter API key is required for embedding.")
      return new OpenRouterEmbedder(
        config.openRouterOptions.apiKey,
        config.modelId,
        undefined,
        config.openRouterOptions.specificProvider,
        config.modelDimension,
      )
    }
    throw new Error(`Unsupported provider in Codex Codebase Indexer: ${config.embedderProvider}`)
  }

  public async validateEmbedder(embedder: IEmbedder): Promise<{ valid: boolean; error?: string }> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const fail = new Promise<{ valid: boolean; error?: string }>((resolve) => {
      timer = setTimeout(() => resolve({ valid: false, error: "Embedding provider connection timed out." }), timeout(embedder.embedderInfo.name))
    })
    try {
      return await Promise.race([embedder.validateConfiguration(), fail])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  public createVectorStore(): IVectorStore {
    const config = this.configManager.getConfig()
    const profile = resolveEmbeddingProfile(config.embedderProvider, config.modelId, config.modelDimension)
    if (!profile?.dimension) {
      throw new Error(`Cannot determine vector dimension for ${config.modelId ?? getDefaultModelId(config.embedderProvider)}.`)
    }
    if (!config.qdrantUrl) throw new Error("Qdrant URL is required.")
    return new QdrantVectorStore(this.workspacePath, config.qdrantUrl, profile.dimension, config.qdrantApiKey, profile)
  }

  public createDirectoryScanner(embedder: IEmbedder, vectorStore: IVectorStore, parser: ICodeParser, ignore: Ignore) {
    const config = this.configManager.getConfig()
    return new DirectoryScanner(
      embedder, vectorStore, parser, this.cacheManager, ignore,
      config.embeddingBatchSize, config.scannerMaxBatchRetries, this.onTelemetry, this.getTelemetryMeta(),
    )
  }

  public createFileWatcher(embedder: IEmbedder, vectorStore: IVectorStore, cache: CacheManager, ignore: Ignore): IFileWatcher {
    const config = this.configManager.getConfig()
    return new FileWatcher(
      this.workspacePath, cache, embedder, vectorStore, ignore,
      config.embeddingBatchSize ?? BATCH_SEGMENT_THRESHOLD, config.scannerMaxBatchRetries, this.onTelemetry, this.getTelemetryMeta(),
    )
  }

  public createServices(cache: CacheManager, ignore: Ignore) {
    if (!this.configManager.isFeatureConfigured) throw new Error("Code indexing is not configured.")
    const embedder = this.createEmbedder()
    const vectorStore = this.createVectorStore()
    const parser = codeParser
    return {
      embedder,
      vectorStore,
      parser,
      scanner: this.createDirectoryScanner(embedder, vectorStore, parser, ignore),
      fileWatcher: this.createFileWatcher(embedder, vectorStore, cache, ignore),
    }
  }
}
