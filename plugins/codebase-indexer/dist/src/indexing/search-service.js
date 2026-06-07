import path from "path";
import { Log } from "../util/log";
const log = Log.create({ service: "indexing-search" });
export class CodeIndexSearchService {
    configManager;
    stateManager;
    embedder;
    vectorStore;
    constructor(configManager, stateManager, embedder, vectorStore) {
        this.configManager = configManager;
        this.stateManager = stateManager;
        this.embedder = embedder;
        this.vectorStore = vectorStore;
    }
    async searchIndex(query, directoryPrefix) {
        if (!this.configManager.isFeatureEnabled || !this.configManager.isFeatureConfigured) {
            throw new Error("Code index feature is disabled or not configured.");
        }
        const minScore = this.configManager.currentSearchMinScore;
        const maxResults = this.configManager.currentSearchMaxResults;
        const currentState = this.stateManager.getCurrentStatus().systemStatus;
        if (currentState !== "Indexed" && currentState !== "Indexing") {
            throw new Error(`Code index is not ready for search. Current state: ${currentState}`);
        }
        try {
            const embeddingResponse = await this.embedder.createEmbeddings([query]);
            const vector = embeddingResponse?.embeddings[0];
            if (!vector) {
                throw new Error("Failed to generate embedding for query.");
            }
            const normalizedPrefix = directoryPrefix ? path.normalize(directoryPrefix) : undefined;
            return await this.vectorStore.search(vector, normalizedPrefix, minScore, maxResults);
        }
        catch (err) {
            log.error("search failed", { err });
            throw err;
        }
    }
}
//# sourceMappingURL=search-service.js.map