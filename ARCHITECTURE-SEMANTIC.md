# Semantic Search Architecture for Obsidian Systematics

## Overview

This document describes the semantic embedding-based search system that replaces keyword matching with true conceptual understanding.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       User Interface                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Search Input │  │ Monad Canvas │  │ Concept List │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Semantic Monad View                        │
│  • Query embedding                                           │
│  • Similarity search                                         │
│  • 2D projection                                             │
│  • Interactive navigation                                    │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Embedding   │  │   Vector     │  │  Projection  │
│   Service    │  │   Index      │  │   Engine     │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Core Components

### 1. EmbeddingService

**Responsibility**: Generate semantic embeddings for text

**Technology**: Transformers.js with ONNX Runtime Web
- Runs entirely in browser (no server needed)
- Models: Xenova/all-MiniLM-L6-v2 (384 dimensions, fast)
- Pure JavaScript/TypeScript

**API**:
```typescript
class EmbeddingService {
  async initialize(): Promise<void>
  async embed(text: string): Promise<number[]>
  async embedBatch(texts: string[]): Promise<number[][]>
  isReady(): boolean
}
```

**Features**:
- Lazy loading (download model on first use)
- Caching in memory
- Batch processing for efficiency

### 2. VectorIndex

**Responsibility**: Store and search embeddings

**Storage**: IndexedDB
- Persistent across sessions
- Fast key-value lookups
- Can handle large vaults

**Data Structure**:
```typescript
interface EmbeddingRecord {
  id: string;           // Note path
  embedding: number[];  // 384-dimensional vector
  text: string;         // Note content (for display)
  metadata: {
    title: string;
    path: string;
    mtime: number;      // Last modified time
    tags: string[];
  }
}
```

**API**:
```typescript
class VectorIndex {
  async addNote(path: string, embedding: number[], metadata: any): Promise<void>
  async updateNote(path: string, embedding: number[]): Promise<void>
  async deleteNote(path: string): Promise<void>
  async findNearest(queryEmbedding: number[], k: number): Promise<ScoredNote[]>
  async getAll(): Promise<EmbeddingRecord[]>
  async clear(): Promise<void>
}
```

**Search Algorithm**:
1. **Cosine Similarity** (initial implementation)
   - Simple, accurate for normalized vectors
   - O(n) search - acceptable for <10k notes

2. **HNSW** (future optimization)
   - Hierarchical Navigable Small World graph
   - O(log n) search
   - Implement when vault > 5k notes

**Calculation**:
```typescript
cosine_similarity(a, b) = dot(a, b) / (norm(a) * norm(b))
```

### 3. Projection Engine

**Responsibility**: Project high-dimensional embeddings to 2D for visualization

**Technology**: UMAP.js
- Preserves local structure (nearby points stay nearby)
- Better than t-SNE for our use case
- Runs in browser

**API**:
```typescript
class ProjectionEngine {
  async project2D(embeddings: number[][]): Promise<Point2D[]>
  async projectIncremental(newEmbedding: number[]): Promise<Point2D>
}
```

**Configuration**:
- n_neighbors: 15 (local structure preservation)
- min_dist: 0.1 (point spacing)
- n_components: 2 (2D output)

### 4. Semantic Monad View

**Responsibility**: Orchestrate semantic search and visualization

**Workflow**:

```
User enters query
      ↓
Embed query with EmbeddingService
      ↓
Search VectorIndex for nearest neighbors
      ↓
Get top-K most similar notes (semantic monad)
      ↓
Extract concepts from monad notes
      ↓
Project all embeddings to 2D
      ↓
Render monad visualization
      ↓
User clicks concept → Re-center monad
```

**Enhanced Features**:

1. **Semantic Ranking**
   - Replace keyword frequency with cosine similarity
   - Scores represent actual conceptual relevance
   - Range: 0.0 (unrelated) to 1.0 (identical meaning)

2. **Concept Extraction**
   - Embed all unique terms from monad notes
   - Find terms most similar to monad center
   - Position by semantic distance in 2D

3. **Interactive Navigation**
   - Click concept → Search for that concept
   - Smooth transitions between monads
   - Breadcrumb trail shows navigation history

4. **Spatial Accuracy**
   - Concepts positioned by ACTUAL semantic similarity
   - Distance in visualization = conceptual distance
   - Clusters emerge naturally

## Data Flow

### Initial Indexing

```
For each note in vault:
  1. Read note content
  2. Generate embedding via EmbeddingService
  3. Store in VectorIndex with metadata
  4. Update progress indicator
```

**Performance**: ~100-200 notes/second (depends on hardware)

### Incremental Updates

Listen for vault events:
```typescript
vault.on('modify', async (file) => {
  const content = await vault.read(file);
  const embedding = await embeddingService.embed(content);
  await vectorIndex.updateNote(file.path, embedding);
});

vault.on('delete', async (file) => {
  await vectorIndex.deleteNote(file.path);
});
```

### Search Flow

```
1. User query: "holochain"
2. Embed query: [0.23, -0.45, 0.12, ...]
3. Find nearest 50 notes by cosine similarity
4. Extract top 12 concepts from those notes
5. Project to 2D: concepts + center query
6. Render visualization with accurate positioning
7. User clicks "distributed systems"
8. Repeat from step 1 with new query
```

## Storage Schema

### IndexedDB Structure

**Database**: `obsidian-systematics-embeddings`

**Object Store**: `embeddings`
- Key: Note path (string)
- Value: EmbeddingRecord

**Indexes**:
- `by-mtime`: For finding stale embeddings
- `by-path`: For fast lookups

**Size Estimation**:
- 1000 notes × 384 floats × 4 bytes = ~1.5 MB
- Very manageable even for large vaults

## Dependencies

### New Packages

```json
{
  "@xenova/transformers": "^2.17.0",  // Local embeddings
  "umap-js": "^1.4.0"                  // Dimensionality reduction
}
```

### Bundle Size Impact

- Transformers.js runtime: ~200KB
- Model (downloaded once): ~23MB
- UMAP.js: ~50KB
- Total added to plugin: ~250KB (model cached separately)

## Performance Characteristics

### Embedding Generation
- **Cold start**: 2-3s (model download + initialization)
- **Warm**: 20-50ms per note
- **Batch**: 10-20 notes/second

### Search
- **Small vault (<1k notes)**: <10ms
- **Medium vault (1-5k notes)**: <50ms
- **Large vault (>5k notes)**: <200ms (can optimize with HNSW)

### Indexing
- **Initial**: 1000 notes in ~5-10 minutes
- **Incremental**: Real-time (<100ms per note)

## Migration Strategy

### Phase 1: Parallel Implementation (Week 1)
- Add new EmbeddingService alongside existing code
- Implement VectorIndex with IndexedDB
- Create basic semantic search (no UI changes)

### Phase 2: UI Integration (Week 2)
- Add "Semantic Mode" toggle to Monad Explorer
- Implement 2D projection visualization
- Add clickable concept navigation

### Phase 3: Optimization (Week 3)
- Implement HNSW index for large vaults
- Add batch embedding for faster initial indexing
- Optimize UMAP parameters

### Phase 4: Full Replacement (Week 4)
- Make semantic search default
- Remove keyword-based search
- Polish UX

## Scalability

### Data Source Flexibility

The architecture supports ANY text corpus:

1. **Obsidian Vault** (current)
   - File system API
   - Markdown parsing

2. **Websites** (future)
   - Fetch + HTML parsing
   - Store URL as ID

3. **DHT Entries** (future)
   - Network queries
   - Distributed indexing

4. **Internet Scale** (future)
   - Would need server-side indexing
   - Client queries pre-built index
   - Still uses same embedding/search logic

**Abstract Interface**:
```typescript
interface DataSource {
  getDocuments(): AsyncIterator<Document>
  getDocument(id: string): Promise<Document>
  watchChanges(callback: (doc: Document) => void): void
}
```

## Future Enhancements

### 1. Hybrid Search
Combine semantic + keyword for best results:
```
score = 0.7 × semantic_similarity + 0.3 × keyword_match
```

### 2. Semantic Clustering
Auto-discover topic clusters in vault:
- Use HDBSCAN on embeddings
- Suggest folder structures
- Find orphan notes

### 3. Query Expansion
- "AI" → also search "artificial intelligence", "machine learning"
- Use embedding neighbors of query terms

### 4. Multi-Modal
- Embed images (CLIP model)
- Embed code (CodeBERT)
- Unified semantic space

## Testing Strategy

### Unit Tests
- EmbeddingService: Model loading, embedding generation
- VectorIndex: CRUD operations, search accuracy
- ProjectionEngine: Dimensionality reduction correctness

### Integration Tests
- End-to-end search workflow
- Incremental indexing
- Performance benchmarks

### User Testing
- Search relevance compared to keyword search
- Visual clarity of 2D projection
- Navigation intuitiveness

## References

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [UMAP Algorithm Paper](https://arxiv.org/abs/1802.03426)
- [Sentence Transformers](https://www.sbert.net/)
- [HNSW Algorithm](https://arxiv.org/abs/1603.09320)
