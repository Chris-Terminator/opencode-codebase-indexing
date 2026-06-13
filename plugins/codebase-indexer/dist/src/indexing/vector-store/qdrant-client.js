import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "crypto";
import * as path from "path";
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants";
import { Log } from "../../util/log";
import { sanitizeErrorMessage } from "../shared/validation-helpers";
const log = Log.create({ service: "qdrant-store" });
const KEY = {
    complete: "indexing_complete",
    provider: "embedding_provider",
    model: "embedding_model_id",
    dimension: "embedding_dimension",
};
const METADATA_ID = "f946a536-9af4-4f1f-9f95-7d6efb4647d5";
/**
 * Qdrant implementation of the vector store interface
 */
export class QdrantVectorStore {
    vectorSize;
    DISTANCE_METRIC = "Cosine";
    client;
    collectionName;
    qdrantUrl = "http://localhost:6333";
    workspacePath;
    profile;
    /**
     * Creates a new Qdrant vector store
     * @param workspacePath Path to the workspace
     * @param url Optional URL to the Qdrant server
     */
    constructor(workspacePath, url, vectorSize, apiKey, profile) {
        // Parse the URL to determine the appropriate QdrantClient configuration
        const parsedUrl = this.parseQdrantUrl(url);
        // Store the resolved URL for our property
        this.qdrantUrl = parsedUrl;
        this.workspacePath = workspacePath;
        try {
            const urlObj = new URL(parsedUrl);
            // Always use host-based configuration with explicit ports to avoid QdrantClient defaults
            let port;
            let useHttps;
            if (urlObj.port) {
                // Explicit port specified - use it and determine protocol
                port = Number(urlObj.port);
                useHttps = urlObj.protocol === "https:";
            }
            else {
                // No explicit port - use protocol defaults
                if (urlObj.protocol === "https:") {
                    port = 443;
                    useHttps = true;
                }
                else {
                    // http: or other protocols default to port 80
                    port = 80;
                    useHttps = false;
                }
            }
            this.client = new QdrantClient({
                host: urlObj.hostname,
                https: useHttps,
                port: port,
                prefix: urlObj.pathname === "/" ? undefined : urlObj.pathname.replace(/\/+$/, ""),
                apiKey,
                headers: {
                    "User-Agent": "OpenCode-Codebase-Indexer/0.1.0",
                },
            });
        }
        catch (urlError) {
            // If URL parsing fails, fall back to URL-based config
            // Note: This fallback won't correctly handle prefixes, but it's a last resort for malformed URLs.
            this.client = new QdrantClient({
                url: parsedUrl,
                apiKey,
                headers: {
                    "User-Agent": "OpenCode-Codebase-Indexer/0.1.0",
                },
            });
        }
        // Generate collection name from workspace path
        const hash = createHash("sha256").update(workspacePath).digest("hex");
        this.vectorSize = vectorSize;
        this.profile =
            profile ??
                {
                    provider: "openai",
                    modelId: "",
                    dimension: vectorSize,
                };
        this.collectionName = `opencode-ws-${hash.substring(0, 16)}`;
    }
    /**
     * Parses and normalizes Qdrant server URLs to handle various input formats
     * @param url Raw URL input from user
     * @returns Properly formatted URL for QdrantClient
     */
    parseQdrantUrl(url) {
        // Handle undefined/null/empty cases
        if (!url || url.trim() === "") {
            return "http://localhost:6333";
        }
        const trimmedUrl = url.trim();
        // Check if it starts with a protocol
        if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://") && !trimmedUrl.includes("://")) {
            // No protocol - treat as hostname
            return this.parseHostname(trimmedUrl);
        }
        try {
            // Attempt to parse as complete URL - return as-is, let constructor handle ports
            const parsedUrl = new URL(trimmedUrl);
            return trimmedUrl;
        }
        catch {
            // Failed to parse as URL - treat as hostname
            return this.parseHostname(trimmedUrl);
        }
    }
    /**
     * Handles hostname-only inputs
     * @param hostname Raw hostname input
     * @returns Properly formatted URL with http:// prefix
     */
    parseHostname(hostname) {
        if (hostname.includes(":")) {
            // Has port - add http:// prefix if missing
            return hostname.startsWith("http") ? hostname : `http://${hostname}`;
        }
        else {
            // No port - add http:// prefix without port (let constructor handle port assignment)
            return `http://${hostname}`;
        }
    }
    async getCollectionInfo() {
        try {
            const collectionInfo = await this.client.getCollection(this.collectionName);
            return collectionInfo;
        }
        catch (error) {
            if (error instanceof Error) {
                log.warn(`Warning during getCollectionInfo for "${this.collectionName}". Collection may not exist or another error occurred:`, { error: error.message });
            }
            return null;
        }
    }
    metadataId() {
        return METADATA_ID;
    }
    parseDimension(value) {
        const dim = Number(value);
        if (!Number.isFinite(dim) || dim <= 0)
            return undefined;
        return dim;
    }
    async getMetadataPayload() {
        const metadataPoints = await this.client.retrieve(this.collectionName, {
            ids: [this.metadataId()],
        });
        if (metadataPoints.length === 0)
            return undefined;
        const first = metadataPoints[0];
        if (!first)
            return undefined;
        const payload = first.payload;
        if (!payload || typeof payload !== "object")
            return undefined;
        return payload;
    }
    getStoredProfile(payload) {
        if (!payload)
            return undefined;
        const provider = payload[KEY.provider];
        const modelId = payload[KEY.model];
        const dimension = payload[KEY.dimension];
        if (typeof provider !== "string" || typeof modelId !== "string")
            return undefined;
        const dim = this.parseDimension(dimension);
        if (!dim)
            return undefined;
        return {
            provider: provider,
            modelId,
            dimension: dim,
        };
    }
    isProfileMatch(profile) {
        return (profile.provider === this.profile.provider &&
            profile.modelId === this.profile.modelId &&
            profile.dimension === this.profile.dimension);
    }
    async createCollection() {
        await this.client.createCollection(this.collectionName, {
            vectors: {
                size: this.vectorSize,
                distance: this.DISTANCE_METRIC,
                on_disk: true,
            },
            hnsw_config: {
                m: 64,
                ef_construct: 512,
                on_disk: true,
            },
        });
    }
    async recreateCollectionForProfile(stored) {
        const from = stored
            ? `${stored.provider}:${stored.modelId}:${stored.dimension}`
            : "missing embedding metadata on populated collection";
        const to = `${this.profile.provider}:${this.profile.modelId}:${this.profile.dimension}`;
        log.warn(`Collection ${this.collectionName} embedding profile changed (${from} -> ${to}). Recreating collection.`);
        await this.client.deleteCollection(this.collectionName);
        await new Promise((resolve) => setTimeout(resolve, 100));
        const verificationInfo = await this.getCollectionInfo();
        if (verificationInfo !== null) {
            throw new Error("Embedding identity mismatch: collection still exists after deletion attempt");
        }
        await this.createCollection();
        return true;
    }
    /**
     * Initializes the vector store
     * @returns Promise resolving to boolean indicating if a new collection was created
     */
    async initialize() {
        let created = false;
        try {
            const collectionInfo = await this.getCollectionInfo();
            if (collectionInfo === null) {
                // Collection info not retrieved (assume not found or inaccessible), create it
                await this.createCollection();
                created = true;
            }
            else {
                // Collection exists, check vector size
                const vectorsConfig = collectionInfo.config?.params?.vectors;
                let existingVectorSize;
                if (typeof vectorsConfig === "number") {
                    existingVectorSize = vectorsConfig;
                }
                else if (vectorsConfig &&
                    typeof vectorsConfig === "object" &&
                    "size" in vectorsConfig &&
                    typeof vectorsConfig.size === "number") {
                    existingVectorSize = vectorsConfig.size;
                }
                else {
                    existingVectorSize = 0; // Fallback for unknown configuration
                }
                if (existingVectorSize === this.vectorSize) {
                    const pointCount = collectionInfo.points_count ?? 0;
                    if (pointCount === 0) {
                        created = false;
                    }
                    else {
                        const payload = await this.getMetadataPayload();
                        const profile = this.getStoredProfile(payload);
                        created =
                            !profile || !this.isProfileMatch(profile) ? await this.recreateCollectionForProfile(profile) : false;
                    }
                }
                else {
                    // Exists but wrong vector size, recreate with enhanced error handling
                    created = await this._recreateCollectionWithNewDimension(existingVectorSize);
                }
            }
            // Create payload indexes
            await this._createPayloadIndexes();
            log.info("Qdrant collection ready", {
                collection: this.collectionName,
                created,
                vectorSize: this.vectorSize,
                url: this.qdrantUrl,
            });
            return created;
        }
        catch (error) {
            const errorMessage = error?.message || error;
            log.error(`Failed to initialize Qdrant collection "${this.collectionName}"`, { error: errorMessage });
            // If this is already a vector dimension mismatch error (identified by cause), re-throw it as-is
            if (error instanceof Error && error.cause !== undefined) {
                throw error;
            }
            // Otherwise, provide a more user-friendly error message that includes the original error
            throw new Error(`Failed to connect to Qdrant at ${this.qdrantUrl}: ${errorMessage}`);
        }
    }
    /**
     * Recreates the collection with a new vector dimension, handling failures gracefully.
     * @param existingVectorSize The current vector size of the existing collection
     * @returns Promise resolving to boolean indicating if a new collection was created
     */
    async _recreateCollectionWithNewDimension(existingVectorSize) {
        log.warn(`Collection ${this.collectionName} exists with vector size ${existingVectorSize}, but expected ${this.vectorSize}. Recreating collection.`);
        let deletionSucceeded = false;
        let recreationAttempted = false;
        try {
            // Step 1: Attempt to delete the existing collection
            log.info(`Deleting existing collection ${this.collectionName}...`);
            await this.client.deleteCollection(this.collectionName);
            deletionSucceeded = true;
            log.info(`Successfully deleted collection ${this.collectionName}`);
            // Step 2: Wait a brief moment to ensure deletion is processed
            await new Promise((resolve) => setTimeout(resolve, 100));
            // Step 3: Verify the collection is actually deleted
            const verificationInfo = await this.getCollectionInfo();
            if (verificationInfo !== null) {
                throw new Error("Collection still exists after deletion attempt");
            }
            // Step 4: Create the new collection with correct dimensions
            log.info(`Creating new collection ${this.collectionName} with vector size ${this.vectorSize}...`);
            recreationAttempted = true;
            await this.createCollection();
            log.info(`Successfully created new collection ${this.collectionName}`);
            return true;
        }
        catch (recreationError) {
            const errorMessage = recreationError instanceof Error ? recreationError.message : String(recreationError);
            // Provide detailed error context based on what stage failed
            let contextualErrorMessage;
            if (!deletionSucceeded) {
                contextualErrorMessage = `Failed to delete existing collection with vector size ${existingVectorSize}. ${errorMessage}`;
            }
            else if (!recreationAttempted) {
                contextualErrorMessage = `Deleted existing collection but failed verification step. ${errorMessage}`;
            }
            else {
                contextualErrorMessage = `Deleted existing collection but failed to create new collection with vector size ${this.vectorSize}. ${errorMessage}`;
            }
            log.error(`CRITICAL: Failed to recreate collection ${this.collectionName} for dimension change (${existingVectorSize} -> ${this.vectorSize}). ${contextualErrorMessage}`);
            // Create a comprehensive error message for the user
            throw new Error(`Vector dimension mismatch: ${contextualErrorMessage}`, { cause: recreationError });
        }
    }
    /**
     * Creates payload indexes for the collection, handling errors gracefully.
     */
    async _createPayloadIndexes() {
        // Create index for the 'type' field to enable metadata filtering
        try {
            await this.client.createPayloadIndex(this.collectionName, {
                field_name: "type",
                field_schema: "keyword",
            });
        }
        catch (indexError) {
            const errorMessage = (indexError?.message || "").toLowerCase();
            if (!errorMessage.includes("already exists")) {
                log.warn(`Could not create payload index for type on ${this.collectionName}`, {
                    details: indexError?.message || indexError,
                });
            }
        }
        try {
            await this.client.createPayloadIndex(this.collectionName, {
                field_name: "filePath",
                field_schema: "keyword",
            });
        }
        catch (indexError) {
            const errorMessage = (indexError?.message || "").toLowerCase();
            if (!errorMessage.includes("already exists")) {
                log.warn(`Could not create payload index for filePath on ${this.collectionName}`);
            }
        }
        // Create indexes for pathSegments fields
        for (let i = 0; i <= 4; i++) {
            try {
                await this.client.createPayloadIndex(this.collectionName, {
                    field_name: `pathSegments.${i}`,
                    field_schema: "keyword",
                });
            }
            catch (indexError) {
                const errorMessage = (indexError?.message || "").toLowerCase();
                if (!errorMessage.includes("already exists")) {
                    log.warn(`Could not create payload index for pathSegments.${i} on ${this.collectionName}`, {
                        details: indexError?.message || indexError,
                    });
                }
            }
        }
    }
    /**
     * Upserts points into the vector store
     * @param points Array of points to upsert
     */
    async upsertPoints(points) {
        try {
            const processedPoints = points.map((point) => {
                if (point.payload?.filePath) {
                    const segments = point.payload.filePath.split(path.sep).filter(Boolean);
                    const pathSegments = segments.reduce((acc, segment, index) => {
                        acc[index.toString()] = segment;
                        return acc;
                    }, {});
                    return {
                        ...point,
                        payload: {
                            ...point.payload,
                            pathSegments,
                        },
                    };
                }
                return point;
            });
            await this.client.upsert(this.collectionName, {
                points: processedPoints,
                wait: true,
            });
        }
        catch (error) {
            log.error("Failed to upsert points", { error });
            throw error;
        }
    }
    /**
     * Checks if a payload is valid
     * @param payload Payload to check
     * @returns Boolean indicating if the payload is valid
     */
    isPayloadValid(payload) {
        if (!payload) {
            return false;
        }
        const validKeys = ["filePath", "codeChunk", "startLine", "endLine"];
        const hasValidKeys = validKeys.every((key) => key in payload);
        return hasValidKeys;
    }
    /**
     * Searches for similar vectors
     * @param queryVector Vector to search for
     * @param directoryPrefix Optional directory prefix to filter results
     * @param minScore Optional minimum score threshold
     * @param maxResults Optional maximum number of results to return
     * @returns Promise resolving to search results
     */
    async search(queryVector, directoryPrefix, minScore, maxResults) {
        try {
            let filter = undefined;
            if (directoryPrefix) {
                // Check if the path represents current directory
                const normalizedPrefix = path.posix.normalize(directoryPrefix.replace(/\\/g, "/"));
                // Note: path.posix.normalize("") returns ".", and normalize("./") returns "./"
                if (normalizedPrefix === "." || normalizedPrefix === "./") {
                    // Don't create a filter - search entire workspace
                    filter = undefined;
                }
                else {
                    // Remove leading "./" from paths like "./src" to normalize them
                    const cleanedPrefix = path.posix.normalize(normalizedPrefix.startsWith("./") ? normalizedPrefix.slice(2) : normalizedPrefix);
                    const segments = cleanedPrefix.split("/").filter(Boolean);
                    if (segments.length > 0) {
                        filter = {
                            must: segments.map((segment, index) => ({
                                key: `pathSegments.${index}`,
                                match: { value: segment },
                            })),
                        };
                    }
                }
            }
            // Always exclude metadata points at query-time to avoid wasting top-k
            const metadataExclusion = {
                must_not: [{ key: "type", match: { value: "metadata" } }],
            };
            const mergedFilter = filter
                ? { ...filter, must_not: [...(filter.must_not || []), ...metadataExclusion.must_not] }
                : metadataExclusion;
            const searchRequest = {
                query: queryVector,
                filter: mergedFilter,
                score_threshold: minScore ?? DEFAULT_SEARCH_MIN_SCORE,
                limit: maxResults ?? DEFAULT_MAX_SEARCH_RESULTS,
                params: {
                    hnsw_ef: 128,
                    exact: false,
                },
                with_payload: {
                    include: ["filePath", "codeChunk", "startLine", "endLine", "pathSegments"],
                },
            };
            const operationResult = await this.client.query(this.collectionName, searchRequest);
            const filteredPoints = operationResult.points.filter((p) => this.isPayloadValid(p.payload));
            return filteredPoints;
        }
        catch (error) {
            log.error("Failed to search points", { error });
            throw error;
        }
    }
    /**
     * Deletes points by file path
     * @param filePath Path of the file to delete points for
     */
    async deletePointsByFilePath(filePath) {
        return this.deletePointsByMultipleFilePaths([filePath]);
    }
    async deletePointsByMultipleFilePaths(filePaths) {
        if (filePaths.length === 0) {
            return;
        }
        try {
            // First check if the collection exists
            const collectionExists = await this.collectionExists();
            if (!collectionExists) {
                log.warn(`Skipping deletion - collection "${this.collectionName}" does not exist`);
                return;
            }
            const workspaceRoot = this.workspacePath;
            // Build filters using pathSegments to match the indexed fields
            const filters = filePaths.flatMap((filePath) => {
                // IMPORTANT: Use the relative path to match what's stored in upsertPoints
                // upsertPoints stores the relative filePath, not the absolute path
                const relativePath = path.isAbsolute(filePath) ? path.relative(workspaceRoot, filePath) : filePath;
                // Normalize the relative path
                const normalizedRelativePath = path.normalize(relativePath);
                if (!normalizedRelativePath ||
                    normalizedRelativePath === "." ||
                    path.isAbsolute(normalizedRelativePath) ||
                    normalizedRelativePath === ".." ||
                    normalizedRelativePath.startsWith(`..${path.sep}`)) {
                    return [];
                }
                return [{ must: [{ key: "filePath", match: { value: normalizedRelativePath } }] }];
            });
            if (filters.length === 0)
                return;
            // Use 'should' to match any of the file paths (OR condition)
            const filter = filters.length === 1 ? filters[0] : { should: filters };
            await this.client.delete(this.collectionName, {
                filter,
                wait: true,
            });
        }
        catch (error) {
            // Extract more detailed error information
            const errorMessage = error?.message || String(error);
            const errorStatus = error?.status || error?.response?.status || error?.statusCode;
            log.error("Failed to delete points by file paths", {
                error: sanitizeErrorMessage(errorMessage),
                status: errorStatus,
                collection: this.collectionName,
                fileCount: filePaths.length,
            });
            throw error;
        }
    }
    /**
     * Deletes the entire collection.
     */
    async deleteCollection() {
        try {
            // Check if collection exists before attempting deletion to avoid errors
            if (await this.collectionExists()) {
                await this.client.deleteCollection(this.collectionName);
            }
        }
        catch (error) {
            log.error(`Failed to delete collection ${this.collectionName}`, { error });
            throw error; // Re-throw to allow calling code to handle it
        }
    }
    /**
     * Clears all points from the collection
     */
    async clearCollection() {
        try {
            await this.client.delete(this.collectionName, {
                filter: {
                    must: [],
                },
                wait: true,
            });
        }
        catch (error) {
            log.error("Failed to clear collection", { error });
            throw error;
        }
    }
    /**
     * Checks if the collection exists
     * @returns Promise resolving to boolean indicating if the collection exists
     */
    async collectionExists() {
        const collectionInfo = await this.getCollectionInfo();
        return collectionInfo !== null;
    }
    /**
     * Checks if the collection exists and has indexed points
     * @returns Promise resolving to boolean indicating if the collection exists and has points
     */
    async hasIndexedData() {
        try {
            const collectionInfo = await this.getCollectionInfo();
            if (!collectionInfo) {
                log.info("Qdrant collection has no indexed data", {
                    collection: this.collectionName,
                    reason: "collection_missing",
                });
                return false;
            }
            // Check if the collection has any points indexed
            const pointsCount = collectionInfo.points_count ?? 0;
            if (pointsCount === 0) {
                log.info("Qdrant collection has no indexed data", {
                    collection: this.collectionName,
                    reason: "points_zero",
                });
                return false;
            }
            // Check if the indexing completion marker exists
            const payload = await this.getMetadataPayload();
            // If marker exists, use it to determine completion status
            if (payload) {
                const indexed = payload[KEY.complete] === true;
                log.info("Qdrant indexing metadata evaluated", {
                    collection: this.collectionName,
                    pointsCount,
                    indexed,
                });
                return indexed;
            }
            // Backward compatibility: No marker exists (old index or pre-marker version)
            // Fall back to old logic - assume complete if collection has points
            log.info("No indexing metadata marker found. Using backward compatibility mode (checking points_count > 0).");
            return pointsCount > 0;
        }
        catch (error) {
            log.warn("Failed to check if collection has data", { error });
            return false;
        }
    }
    /**
     * Marks the indexing process as complete by storing metadata
     * Should be called after a successful full workspace scan or incremental scan
     */
    async markIndexingComplete() {
        try {
            await this.client.upsert(this.collectionName, {
                points: [
                    {
                        id: this.metadataId(),
                        vector: new Array(this.vectorSize).fill(0),
                        payload: {
                            type: "metadata",
                            [KEY.complete]: true,
                            [KEY.provider]: this.profile.provider,
                            [KEY.model]: this.profile.modelId,
                            [KEY.dimension]: this.profile.dimension,
                            completed_at: Date.now(),
                        },
                    },
                ],
                wait: true,
            });
            log.info("Marked indexing as complete");
        }
        catch (error) {
            log.error("Failed to mark indexing as complete", { error });
            throw error;
        }
    }
    /**
     * Marks the indexing process as incomplete by storing metadata
     * Should be called at the start of indexing to indicate work in progress
     */
    async markIndexingIncomplete() {
        try {
            await this.client.upsert(this.collectionName, {
                points: [
                    {
                        id: this.metadataId(),
                        vector: new Array(this.vectorSize).fill(0),
                        payload: {
                            type: "metadata",
                            [KEY.complete]: false,
                            [KEY.provider]: this.profile.provider,
                            [KEY.model]: this.profile.modelId,
                            [KEY.dimension]: this.profile.dimension,
                            started_at: Date.now(),
                        },
                    },
                ],
                wait: true,
            });
            log.info("Marked indexing as incomplete (in progress)");
        }
        catch (error) {
            log.error("Failed to mark indexing as incomplete", { error });
            throw error;
        }
    }
}
//# sourceMappingURL=qdrant-client.js.map