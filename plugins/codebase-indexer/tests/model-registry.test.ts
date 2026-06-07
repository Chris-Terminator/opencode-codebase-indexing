import test from "node:test"
import assert from "node:assert/strict"
import { getModelDimension } from "../src/indexing/model-registry.js"

test("knows the Qwen3 8B OpenRouter embedding dimension", () => {
  assert.equal(getModelDimension("openrouter", "qwen/qwen3-embedding-8b"), 4096)
})
