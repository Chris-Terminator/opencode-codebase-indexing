import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const globalPath = path.join(os.homedir(), ".codex", "codebase-indexer", "config.json");
export async function loadIndexConfig(workspacePath) {
    const global = await readJson(globalPath);
    const project = await readJson(path.join(workspacePath, ".codex", "codebase-indexer.json"));
    const config = merge(global, project);
    const provider = config.provider ?? "ollama";
    return {
        enabled: config.enabled === true,
        embedderProvider: provider,
        vectorStoreProvider: "qdrant",
        modelId: config.model,
        modelDimension: config.dimension,
        qdrantUrl: config.qdrant?.url ?? "http://localhost:6333",
        qdrantApiKey: env(config.qdrant?.apiKeyEnv),
        openAiKey: env(config.openai?.apiKeyEnv ?? "OPENAI_API_KEY"),
        ollamaBaseUrl: config.ollama?.baseUrl ?? "http://localhost:11434",
        openRouterApiKey: env(config.openrouter?.apiKeyEnv ?? "OPENROUTER_API_KEY"),
        openRouterSpecificProvider: config.openrouter?.specificProvider,
        searchMinScore: config.searchMinScore,
        searchMaxResults: config.searchMaxResults,
        embeddingBatchSize: config.embeddingBatchSize,
        scannerMaxBatchRetries: config.scannerMaxBatchRetries,
    };
}
export async function isProjectEnrolled(workspacePath) {
    return (await readJson(path.join(workspacePath, ".codex", "codebase-indexer.json"))).enabled === true;
}
function env(name) {
    return name ? process.env[name] : undefined;
}
async function readJson(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return {};
        throw new Error(`Failed to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function merge(base, override) {
    return {
        ...base,
        ...override,
        qdrant: { ...base.qdrant, ...override.qdrant },
        openai: { ...base.openai, ...override.openai },
        ollama: { ...base.ollama, ...override.ollama },
        openrouter: { ...base.openrouter, ...override.openrouter },
    };
}
//# sourceMappingURL=config.js.map