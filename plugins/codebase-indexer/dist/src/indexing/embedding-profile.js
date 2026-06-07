import { getDefaultModelId, getModelDimension } from "./model-registry";
function parseDimension(value) {
    if (value === undefined || value === null)
        return undefined;
    const dim = Number(value);
    if (!Number.isFinite(dim) || dim <= 0)
        return undefined;
    return dim;
}
export function resolveEmbeddingProfile(provider, modelId, modelDimension) {
    const id = modelId ?? getDefaultModelId(provider);
    const dim = parseDimension(modelDimension) ?? getModelDimension(provider, id);
    if (!dim)
        return undefined;
    return {
        provider,
        modelId: id,
        dimension: dim,
    };
}
export function isEmbeddingProfileEqual(a, b) {
    if (!a || !b)
        return false;
    return a.provider === b.provider && a.modelId === b.modelId && a.dimension === b.dimension;
}
//# sourceMappingURL=embedding-profile.js.map