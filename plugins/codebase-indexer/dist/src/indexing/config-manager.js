import { DEFAULT_SEARCH_MIN_SCORE, DEFAULT_MAX_SEARCH_RESULTS } from "./constants";
import { getDefaultModelId, getModelDimension, getModelScoreThreshold } from "./model-registry";
import { isEmbeddingProfileEqual, resolveEmbeddingProfile } from "./embedding-profile";
/**
 * Manages configuration state and validation for the code indexing feature.
 *
 * RATIONALE: Replaced the legacy ContextProxy/getGlobalState/getSecret approach
 * with a plain IndexingConfigInput object supplied by the host. The manager
 * owns no storage; it only validates and projects the input into the shapes the
 * rest of the indexing engine expects.
 */
export class CodeIndexConfigManager {
    enabled = false;
    embedderProvider = "openai";
    vectorStoreProvider = "qdrant";
    lancedbVectorStoreDirectory;
    modelId;
    modelDimension;
    kiloOptions;
    openAiOptions;
    ollamaOptions;
    openAiCompatibleOptions;
    geminiOptions;
    mistralOptions;
    vercelAiGatewayOptions;
    bedrockOptions;
    openRouterOptions;
    voyageOptions;
    qdrantUrl = "http://localhost:6333";
    qdrantApiKey;
    searchMinScore;
    searchMaxResults;
    embeddingBatchSize;
    scannerMaxBatchRetries;
    constructor(input) {
        this.applyInput(input);
    }
    /**
     * Applies new configuration input. Returns whether a restart is needed.
     */
    loadConfiguration(input) {
        const snapshot = this.captureSnapshot();
        this.applyInput(input);
        const requiresRestart = this.doesConfigChangeRequireRestart(snapshot);
        return { requiresRestart };
    }
    applyInput(input) {
        this.enabled = input.enabled;
        this.embedderProvider = input.embedderProvider;
        this.vectorStoreProvider = input.vectorStoreProvider ?? "qdrant";
        this.lancedbVectorStoreDirectory = input.lancedbVectorStoreDirectory;
        this.qdrantUrl = input.qdrantUrl ?? "http://localhost:6333";
        this.qdrantApiKey = input.qdrantApiKey;
        this.searchMinScore = input.searchMinScore;
        this.searchMaxResults = input.searchMaxResults;
        this.embeddingBatchSize = input.embeddingBatchSize;
        this.scannerMaxBatchRetries = input.scannerMaxBatchRetries;
        this.modelId = input.modelId;
        // Validate and set model dimension
        if (input.modelDimension !== undefined && input.modelDimension !== null) {
            const dimension = Number(input.modelDimension);
            this.modelDimension = !isNaN(dimension) && dimension > 0 ? dimension : undefined;
        }
        else {
            this.modelDimension = undefined;
        }
        this.kiloOptions = input.kiloApiKey
            ? { apiKey: input.kiloApiKey, baseUrl: input.kiloBaseUrl, organizationId: input.kiloOrganizationId }
            : undefined;
        this.openAiOptions = input.openAiKey ? { apiKey: input.openAiKey } : undefined;
        const url = input.ollamaBaseUrl ?? (input.embedderProvider === "ollama" ? "http://localhost:11434" : undefined);
        this.ollamaOptions = url ? { baseUrl: url, modelId: input.modelId } : undefined;
        this.openAiCompatibleOptions =
            input.openAiCompatibleBaseUrl && input.openAiCompatibleApiKey
                ? { baseUrl: input.openAiCompatibleBaseUrl, apiKey: input.openAiCompatibleApiKey }
                : undefined;
        this.geminiOptions = input.geminiApiKey ? { apiKey: input.geminiApiKey } : undefined;
        this.mistralOptions = input.mistralApiKey ? { apiKey: input.mistralApiKey } : undefined;
        this.vercelAiGatewayOptions = input.vercelAiGatewayApiKey ? { apiKey: input.vercelAiGatewayApiKey } : undefined;
        this.bedrockOptions = input.bedrockRegion
            ? { region: input.bedrockRegion, profile: input.bedrockProfile }
            : undefined;
        this.openRouterOptions = input.openRouterApiKey
            ? { apiKey: input.openRouterApiKey, specificProvider: input.openRouterSpecificProvider }
            : undefined;
        this.voyageOptions = input.voyageApiKey ? { apiKey: input.voyageApiKey } : undefined;
    }
    captureSnapshot() {
        return {
            enabled: this.enabled,
            configured: this.isConfigured(),
            embedderProvider: this.embedderProvider,
            vectorStoreProvider: this.vectorStoreProvider,
            lancedbVectorStoreDirectory: this.lancedbVectorStoreDirectory,
            modelId: this.modelId,
            modelDimension: this.modelDimension,
            kiloApiKey: this.kiloOptions?.apiKey ?? "",
            kiloBaseUrl: this.kiloOptions?.baseUrl ?? "",
            kiloOrganizationId: this.kiloOptions?.organizationId ?? "",
            openAiKey: this.openAiOptions?.apiKey ?? "",
            ollamaBaseUrl: this.ollamaOptions?.baseUrl ?? "",
            openAiCompatibleBaseUrl: this.openAiCompatibleOptions?.baseUrl ?? "",
            openAiCompatibleApiKey: this.openAiCompatibleOptions?.apiKey ?? "",
            geminiApiKey: this.geminiOptions?.apiKey ?? "",
            mistralApiKey: this.mistralOptions?.apiKey ?? "",
            vercelAiGatewayApiKey: this.vercelAiGatewayOptions?.apiKey ?? "",
            bedrockRegion: this.bedrockOptions?.region ?? "",
            bedrockProfile: this.bedrockOptions?.profile ?? "",
            openRouterApiKey: this.openRouterOptions?.apiKey ?? "",
            openRouterSpecificProvider: this.openRouterOptions?.specificProvider ?? "",
            voyageApiKey: this.voyageOptions?.apiKey ?? "",
            qdrantUrl: this.qdrantUrl ?? "",
            qdrantApiKey: this.qdrantApiKey ?? "",
        };
    }
    isConfigured() {
        const provider = this.embedderProvider;
        const qdrant = this.qdrantUrl;
        const isLancedb = this.vectorStoreProvider === "lancedb";
        // LanceDB doesn't need a qdrant URL; qdrant does
        const hasStore = isLancedb || !!qdrant;
        if (provider === "kilo")
            return !!(this.kiloOptions?.apiKey && this.modelId && this.currentModelDimension && hasStore);
        if (provider === "openai")
            return !!(this.openAiOptions?.apiKey && hasStore);
        if (provider === "ollama")
            return !!(this.ollamaOptions?.baseUrl && hasStore);
        if (provider === "openai-compatible")
            return !!(this.openAiCompatibleOptions?.baseUrl && this.openAiCompatibleOptions?.apiKey && hasStore);
        if (provider === "gemini")
            return !!(this.geminiOptions?.apiKey && hasStore);
        if (provider === "mistral")
            return !!(this.mistralOptions?.apiKey && hasStore);
        if (provider === "vercel-ai-gateway")
            return !!(this.vercelAiGatewayOptions?.apiKey && hasStore);
        if (provider === "bedrock")
            return !!(this.bedrockOptions?.region && hasStore);
        if (provider === "openrouter")
            return !!(this.openRouterOptions?.apiKey && hasStore);
        if (provider === "voyage")
            return !!(this.voyageOptions?.apiKey && hasStore);
        return false;
    }
    doesConfigChangeRequireRestart(prev) {
        const nowConfigured = this.isConfigured();
        const prevEnabled = prev.enabled ?? false;
        const prevConfigured = prev.configured ?? false;
        const prevProvider = prev.embedderProvider ?? "openai";
        // Enable/disable transitions
        if ((!prevEnabled || !prevConfigured) && this.enabled && nowConfigured)
            return true;
        if (prevEnabled && !this.enabled)
            return true;
        if ((!prevEnabled || !prevConfigured) && (!this.enabled || !nowConfigured))
            return false;
        if (!this.enabled)
            return false;
        // Provider change
        if (prevProvider !== this.embedderProvider)
            return true;
        // Vector store provider change
        if ((prev.vectorStoreProvider ?? "qdrant") !== this.vectorStoreProvider)
            return true;
        // LanceDB path change
        if (this.vectorStoreProvider === "lancedb" &&
            (prev.lancedbVectorStoreDirectory ?? "") !== (this.lancedbVectorStoreDirectory ?? ""))
            return true;
        // Auth changes
        if ((prev.kiloApiKey ?? "") !== (this.kiloOptions?.apiKey ?? ""))
            return true;
        if ((prev.kiloBaseUrl ?? "") !== (this.kiloOptions?.baseUrl ?? ""))
            return true;
        if ((prev.kiloOrganizationId ?? "") !== (this.kiloOptions?.organizationId ?? ""))
            return true;
        if ((prev.openAiKey ?? "") !== (this.openAiOptions?.apiKey ?? ""))
            return true;
        if ((prev.ollamaBaseUrl ?? "") !== (this.ollamaOptions?.baseUrl ?? ""))
            return true;
        if ((prev.openAiCompatibleBaseUrl ?? "") !== (this.openAiCompatibleOptions?.baseUrl ?? "") ||
            (prev.openAiCompatibleApiKey ?? "") !== (this.openAiCompatibleOptions?.apiKey ?? ""))
            return true;
        if ((prev.geminiApiKey ?? "") !== (this.geminiOptions?.apiKey ?? ""))
            return true;
        if ((prev.mistralApiKey ?? "") !== (this.mistralOptions?.apiKey ?? ""))
            return true;
        if ((prev.vercelAiGatewayApiKey ?? "") !== (this.vercelAiGatewayOptions?.apiKey ?? ""))
            return true;
        if ((prev.bedrockRegion ?? "") !== (this.bedrockOptions?.region ?? "") ||
            (prev.bedrockProfile ?? "") !== (this.bedrockOptions?.profile ?? ""))
            return true;
        if ((prev.openRouterApiKey ?? "") !== (this.openRouterOptions?.apiKey ?? ""))
            return true;
        if ((prev.openRouterSpecificProvider ?? "") !== (this.openRouterOptions?.specificProvider ?? ""))
            return true;
        if ((prev.voyageApiKey ?? "") !== (this.voyageOptions?.apiKey ?? ""))
            return true;
        // Qdrant connection changes
        if ((prev.qdrantUrl ?? "") !== (this.qdrantUrl ?? "") || (prev.qdrantApiKey ?? "") !== (this.qdrantApiKey ?? ""))
            return true;
        if (this.hasEmbeddingProfileChanged(prevProvider, prev.modelId, prev.modelDimension))
            return true;
        return false;
    }
    hasEmbeddingProfileChanged(prevProvider, prevModelId, prevModelDimension) {
        const prev = resolveEmbeddingProfile(prevProvider, prevModelId, prevModelDimension);
        const cur = resolveEmbeddingProfile(this.embedderProvider, this.modelId, this.modelDimension);
        if (prev && cur)
            return !isEmbeddingProfileEqual(prev, cur);
        const prevId = prevModelId ?? getDefaultModelId(prevProvider);
        const curId = this.modelId ?? getDefaultModelId(this.embedderProvider);
        if (prevProvider === this.embedderProvider && prevId === curId)
            return false;
        return true;
    }
    getConfig() {
        return {
            isConfigured: this.isConfigured(),
            embedderProvider: this.embedderProvider,
            vectorStoreProvider: this.vectorStoreProvider ?? "qdrant",
            lancedbVectorStoreDirectoryPlaceholder: this.lancedbVectorStoreDirectory,
            modelId: this.modelId,
            modelDimension: this.modelDimension,
            kiloOptions: this.kiloOptions,
            openAiOptions: this.openAiOptions,
            ollamaOptions: this.ollamaOptions,
            openAiCompatibleOptions: this.openAiCompatibleOptions,
            geminiOptions: this.geminiOptions,
            mistralOptions: this.mistralOptions,
            vercelAiGatewayOptions: this.vercelAiGatewayOptions,
            bedrockOptions: this.bedrockOptions,
            openRouterOptions: this.openRouterOptions,
            voyageOptions: this.voyageOptions,
            qdrantUrl: this.qdrantUrl,
            qdrantApiKey: this.qdrantApiKey,
            searchMinScore: this.currentSearchMinScore,
            searchMaxResults: this.currentSearchMaxResults,
            embeddingBatchSize: this.currentEmbeddingBatchSize,
            scannerMaxBatchRetries: this.currentScannerMaxBatchRetries,
        };
    }
    get isFeatureEnabled() {
        return this.enabled;
    }
    get isFeatureConfigured() {
        return this.isConfigured();
    }
    get currentEmbedderProvider() {
        return this.embedderProvider;
    }
    get qdrantConfig() {
        return { url: this.qdrantUrl, apiKey: this.qdrantApiKey };
    }
    get currentModelId() {
        return this.modelId;
    }
    get currentModelDimension() {
        if (this.modelDimension && this.modelDimension > 0)
            return this.modelDimension;
        const id = this.modelId ?? getDefaultModelId(this.embedderProvider);
        return getModelDimension(this.embedderProvider, id);
    }
    get currentSearchMinScore() {
        if (this.searchMinScore !== undefined)
            return this.searchMinScore;
        const id = this.modelId ?? getDefaultModelId(this.embedderProvider);
        return getModelScoreThreshold(this.embedderProvider, id) ?? DEFAULT_SEARCH_MIN_SCORE;
    }
    get currentSearchMaxResults() {
        return this.searchMaxResults ?? DEFAULT_MAX_SEARCH_RESULTS;
    }
    get currentEmbeddingBatchSize() {
        return this.embeddingBatchSize;
    }
    get currentScannerMaxBatchRetries() {
        return this.scannerMaxBatchRetries;
    }
}
//# sourceMappingURL=config-manager.js.map