import test from "node:test"
import assert from "node:assert/strict"
import { QdrantVectorStore } from "../src/indexing/vector-store/qdrant-client.js"

test("prefixes project collections with opencode-ws", () => {
  const store = new QdrantVectorStore("C:\\code\\example", "http://localhost:6333", 1536)
  assert.match((store as unknown as { collectionName: string }).collectionName, /^opencode-ws-[a-f0-9]{16}$/)
})

test("deletes file points using an exact filePath filter", async () => {
  const store = new QdrantVectorStore("C:\\code\\example", "http://localhost:6333", 1536) as any
  let request: any
  store.client = {
    getCollection: async () => ({ points_count: 1 }),
    delete: async (_collection: string, value: any) => {
      request = value
    },
  }

  await store.deletePointsByFilePath("C:\\code\\example\\src\\file.ts")
  assert.deepEqual(request.filter, { must: [{ key: "filePath", match: { value: "src\\file.ts" } }] })
})

test("does not issue deletion filters for paths outside the workspace", async () => {
  const store = new QdrantVectorStore("C:\\code\\example", "http://localhost:6333", 1536) as any
  let deleted = false
  store.client = {
    getCollection: async () => ({ points_count: 1 }),
    delete: async () => {
      deleted = true
    },
  }

  await store.deletePointsByFilePath("C:\\code\\secret.ts")
  assert.equal(deleted, false)
})
