# Semantic Monad Explorer - Architecture Handover

## Executive Summary

The Semantic Monad Explorer is an Obsidian plugin for semantic knowledge exploration. This document captures the current state, critical issues discovered during development, and the architectural redesign needed for production readiness.

**Current Status**: Functional but architecturally flawed
**Key Issue**: We're using semantic similarity as primary signal when explicit note structure (links, titles) should be primary

---

## Philosophical Framework: Presentation → Representation → Interpretation

### 1. PRESENTATION (What users see)
**Current Interface:**
- Search input field
- Circular monad visualization (UMAP 2D projection)
- Query term at center
- Semantic concepts positioned around it
- List of related notes ranked by relevance
- Similarity scores shown as percentages

**UX Issues Fixed:**
- ✅ Scores capped at 100% (was showing >100%)
- ✅ Case-insensitive search
- ✅ Query terms filtered from concept list (avoid redundancy)

### 2. REPRESENTATION (How we model reality)

**Data Structures:**

```typescript
// Note Index (IndexedDB)
interface EmbeddingRecord {
    id: string;              // File path
    embedding: number[];     // 384-dim vector from all-MiniLM-L6-v2
    text: string;           // Content snippet
    metadata: {
        title: string;
        path: string;
        mtime: number;
        tags: string[];     // Currently unused
        links: string[];    // Currently unused ⚠️ CRITICAL GAP
    }
}

// Search Results
interface ScoredNote {
    path: string;
    score: number;          // 0-1, semantic similarity + metadata boost
    embedding: number[];
    metadata: NoteMetadata;
}

// Concepts (discovered from semantic neighborhood)
interface ConceptNode {
    term: string;
    embedding: number[];
    similarity: number;     // Similarity to query
    position2D?: Point2D;   // UMAP projection for visualization
}
```

**Embeddings:**
- Model: `all-MiniLM-L6-v2` (384 dimensions)
- Server: Rust-based HTTP server on `localhost:8765`
- Strategy: Full note content embedded (truncated to 500 words)
- Quality: Good for semantic similarity, but **ignores explicit graph structure**

### 3. INTERPRETATION (How we extract meaning)

**Current Algorithm Flow:**

```
1. Query Input (e.g., "computer science")
   ↓
2. Generate Query Embedding
   ↓
3. Search Index (Hybrid Scoring)
   - Base: Cosine similarity to all notes
   - Boost: +0.12 for folder name match
   - Boost: +0.08 for title match
   - Boost: +0.15 for multi-word folder match
   ↓
4. Concept Extraction (from top 20 notes)
   Phase 1 (COARSE): Extract all words from titles, folders, content
   Phase 2 (FINE): Calculate global TF-IDF, filter generic terms
   ↓
5. Visualization
   - UMAP projects concepts to 2D
   - Positions concepts around query center
```

---

## Critical Architectural Issues

### Issue 1: Inverted Signal Priority ⚠️

**Problem:** We treat semantic similarity as primary, graph structure as secondary.

**What's Wrong:**
- Searching "computer science" should prioritize:
  1. **Direct title match** → "Computer Science.md" (currently not guaranteed top)
  2. **Explicit links** → Pages linked FROM Computer Science.md
  3. **Link depth** → Pages 1-2 hops away
  4. **Semantic similarity** → Only as fallback or augmentation

**What We're Doing:**
- Pure semantic similarity + metadata boosts
- Links are extracted but **never used** in ranking

### Issue 2: Stub Note Problem

**Context:**
- User's notes are mostly stubs (tags + title + 1-2 links)
- Example: "Bitcoin.md" contains just: `Tags: [Primitives]`, `Related: [[Crypto]]`, title

**Problem:**
- Embeddings from sparse content are weak
- Generic terms ("science", "process") rank higher than distinctive ones
- Even with TF-IDF, we're fishing in shallow water

**Solution:**
- Extract concepts from **link graph**, not just content
- PageRank-like algorithm: concepts linked from index notes matter more

### Issue 3: No Direct Match Priority

**Problem:**
- Searching "philosophy" doesn't guarantee "Philosophy.md" is result #1
- Query term appears both as center AND as a concept (redundant)

**Fixed (partial):**
- ✅ Query words now filtered from concept list
- ❌ Still no direct title match priority in note ranking

### Issue 4: Forest Landry vs. Monad Forrest

**Observation:**
- "Philosophy" search returns "forrest" concept
- This is "Forrest Landry" (person's name) from note titles
- Also "Monad Forrest" (folder name, should be "Forest")

**Root Causes:**
- Case sensitivity (partially fixed)
- No entity recognition
- Extracting from folder names without context

---

## What Works Well

### ✅ Hybrid Scoring (Semantic + Metadata)
- Boosts notes in relevant folders
- Matches abbreviations ("science" matches "Sci" folder)
- Multi-word matching works

### ✅ Global TF-IDF Filtering
- Samples 500 random notes for global term frequency
- Filters out terms appearing in >30% of vault
- Two-phase (coarse/fine) approach is sound

### ✅ Embedding Server
- Fast, reliable Rust server
- Generates diverse embeddings
- Model quality is good for semantic tasks

### ✅ IndexedDB Storage
- Efficient client-side persistence
- Handles 2500+ notes
- Incremental updates work

---

## Proposed Architecture Redesign

### Phase 1: Link-First Search (HIGH PRIORITY)

**Objective:** Use explicit note structure as primary signal

**Implementation:**
```typescript
interface SearchStrategy {
    // 1. Direct match
    findDirectTitleMatch(query: string): TFile | null;

    // 2. Extract links from direct match
    extractOutgoingLinks(file: TFile): string[];

    // 3. Build link graph (1-2 hops)
    buildLinkNeighborhood(rootFile: TFile, depth: number): NoteGraph;

    // 4. Rank by PageRank + semantic similarity
    rankNotes(
        graph: NoteGraph,
        queryEmbedding: number[]
    ): ScoredNote[];
}
```

**Algorithm:**
```
1. Query: "computer science"
   ↓
2. Direct Match: Find "Computer Science.md" → SCORE 1.0
   ↓
3. Extract Links: Bitcoin, ML, AI, UX, Blockchain (from content)
   ↓
4. Assign Weights:
   - Direct links from index: 0.8 base score
   - Semantic similarity: +/- 0.2 adjustment
   - 2nd degree links: 0.5 base score
   ↓
5. Rank Results:
   1. Computer Science.md (1.0)
   2. Bitcoin.md (0.85 - direct link + high semantic sim)
   3. Blockchain.md (0.82)
   4. ML.md (0.78)
   ...
```

### Phase 2: Link-Based Concept Extraction

**Objective:** Discover concepts from what index notes link to

**Algorithm:**
```
1. Start with top note (e.g., Computer Science.md)
   ↓
2. Extract all linked note titles
   ↓
3. Weight by:
   - Link frequency (how many top notes link to it)
   - Semantic similarity to query
   - Note importance (how many inbound links)
   ↓
4. Return: Bitcoin, Ethereum, AI, ML, Holochain, etc.
```

### Phase 3: Monad Hierarchy (Index → Dyad → Triad)

**User's Vision:**
- "Monads Index" page links to all monads
- Each monad links to its dyad
- Each dyad links to its triad
- This is a golden thread through structured knowledge

**Implementation:**
```typescript
interface MonadHierarchy {
    monad: string;      // e.g., "Philosophy"
    dyad?: string;      // e.g., "Philosophy Dyad"
    triad?: string;     // e.g., "Philosophy Triad"

    // Auto-detect from note content/links
    discoverHierarchy(monadNote: TFile): MonadHierarchy;
}
```

---

## Implementation Roadmap

### Quick Wins (1-2 hours)
1. ✅ **Fix bugs** (DONE - scores, case sensitivity, redundancy)
2. **Add direct title match priority**
   - Boost score to 1.0 for exact title match
3. **Extract and display links in UI**
   - Show "Linked Notes" section separate from "Semantic Similarity"

### Core Redesign (4-6 hours)
4. **Implement link extraction**
   - Parse markdown `[[WikiLinks]]` from note content
   - Store in `metadata.links[]` during indexing
5. **Build link graph data structure**
   - Map: note → [outgoing links]
   - Map: note → [incoming links]
6. **Implement link-based ranking**
   - Primary: direct links from query match
   - Secondary: semantic similarity
   - Tertiary: PageRank-style importance

### Advanced Features (8-12 hours)
7. **Monad hierarchy detection**
   - Detect "X Monad", "X Dyad", "X Triad" patterns
   - Visualize hierarchy in UI
8. **Interactive graph visualization**
   - Replace UMAP with force-directed graph
   - Nodes = notes, Edges = links
   - Color by semantic similarity to query
9. **Concept clustering**
   - Group related concepts (e.g., crypto: Bitcoin, Ethereum, Blockchain)
   - Show as conceptual nebulae

---

## Data Flow Diagrams

### Current (Semantic-First)
```
Query → Embedding → Cosine Similarity → Metadata Boost → Results
                                           ↓
                              Concept Extraction (TF-IDF)
```

### Proposed (Link-First)
```
Query → Direct Title Match → Found? ─YES→ Extract Links → Rank by PageRank
                              │                              + Semantic
                              NO
                              ↓
                        Semantic Search (fallback)
```

---

## Known Issues & Edge Cases

### 1. Case Variants
- "Computer Science" vs "computer science" vs "Computer Sci"
- **Fix:** Normalize to lowercase for matching, preserve original for display

### 2. Multi-word Queries
- "process philosophy" should match both words
- Currently: splits into "process" + "philosophy", matches separately
- **Better:** Use phrase matching or bigram embeddings

### 3. Abbreviations
- "CS" should match "Computer Science"
- Currently: partial support in folder matching
- **Better:** Abbreviation dictionary or learned from note content

### 4. Orphan Notes
- Notes with no links or linked TO by anyone
- Currently: rely purely on semantic similarity
- **Better:** Boost notes with many inbound links

### 5. Daily Notes Pollution
- 1000+ daily notes (highest count folder)
- Generic content dilutes concept extraction
- **Fix:** Exclude by folder pattern (configurable)

---

## Testing Strategy

### Unit Tests Needed
- [ ] Link extraction from markdown
- [ ] PageRank calculation
- [ ] TF-IDF with query filtering
- [ ] UMAP projection with <15 points

### Integration Tests
- [ ] Index 100 notes, verify all stored
- [ ] Search "computer science", verify top results
- [ ] Extract concepts, verify no query words
- [ ] Verify scores never exceed 1.0

### User Acceptance Tests
- [ ] Search for domain (e.g., "philosophy")
  - Top result is "Philosophy.md"
  - Concepts include: whitehead, bennett, process, metaphysics
  - Notes include direct links from Philosophy.md
- [ ] Search for non-existent term
  - Falls back to semantic similarity
  - Shows related concepts
- [ ] Case insensitivity
  - "Philosophy" = "philosophy" = "PHILOSOPHY"

---

## Code Hotspots

### Files to Modify for Link-First Architecture

**1. `src/vectorIndex.ts`**
- Add link extraction during indexing
- Store links in `metadata.links[]`
- Build link graph maps

**2. `src/semanticMonadView.ts`**
- Implement `findDirectTitleMatch()`
- Implement `extractLinkedNotes()`
- Modify `findNearest()` to prioritize links
- Update concept extraction to use link graph

**3. `src/semanticTypes.ts`**
- Add `NoteGraph` interface
- Add `LinkRankingStrategy` interface

**4. New file: `src/linkGraphRanker.ts`**
- PageRank algorithm
- Link-based concept extraction
- Graph traversal utilities

---

## Performance Considerations

### Current Bottlenecks
1. **Concept extraction is slow** (~2-3 seconds)
   - Samples 500 notes for global TF-IDF
   - Reads file content for each
   - **Optimization:** Cache global DF map, update incrementally

2. **UMAP projection** (~500ms)
   - Required for visualization
   - **Optimization:** Pre-compute common concept projections

3. **Embedding generation** (200-300ms per batch)
   - Server is fast, but network roundtrip
   - **Optimization:** Batch more aggressively (50+ at once)

### Scalability Targets
- Support 10,000+ notes
- Sub-second search response
- Real-time incremental indexing

---

## Configuration & Tuning Knobs

**Hybrid Scoring Weights:**
```typescript
const SCORING_CONFIG = {
    titleExactMatch: 1.0,        // Boost for exact title match
    folderMatch: 0.12,           // Boost per folder word match
    titleWordMatch: 0.08,        // Boost per title word match
    multiFolderMatch: 0.15,      // Extra boost for multi-word folder

    semanticSimilarityWeight: 0.6,   // Weight of cosine similarity
    linkRankWeight: 0.4,            // Weight of PageRank score
};
```

**Concept Extraction:**
```typescript
const CONCEPT_CONFIG = {
    minWordLength: 5,            // Minimum concept word length
    maxGlobalDF: 0.3,           // Filter if >30% of notes contain term
    sampleSize: 500,            // Notes sampled for global DF
    topCandidates: 25,          // Candidates before semantic ranking
    finalConcepts: 12,          // Concepts shown in monad
};
```

**Link Graph:**
```typescript
const LINK_CONFIG = {
    maxDepth: 2,                // How many hops to traverse
    minLinkWeight: 0.3,         // Minimum score to include linked note
    dampingFactor: 0.85,        // PageRank damping
};
```

---

## Debugging Tools

### Console Commands (in DevTools)
```javascript
// Inspect index
window.semanticMonad.debugIndex();

// Show search results
window.semanticMonad.lastSearchResults;

// Force re-index
window.semanticMonad.forceReindex();
```

### Debug Logging
- Search results logged to console with scores
- Query embedding logged with preview
- Concept extraction shows TF-IDF scores
- UMAP configuration logged before projection

---

## Future Vision

### Short Term (Next PR)
1. Implement link-first search architecture
2. Add direct title match priority
3. Extract concepts from link graph
4. Fix remaining UX issues

### Medium Term (1-2 months)
1. Interactive graph visualization
2. Monad hierarchy detection & display
3. Smart abbreviation handling
4. Performance optimizations

### Long Term (Research)
1. **Learned abbreviations** - ML model to detect "CS" = "Computer Science"
2. **Temporal awareness** - Recent notes weighted higher
3. **Personalization** - Learn user's concept preferences
4. **Multi-modal** - Include images, diagrams in embeddings
5. **Collaborative** - Share semantic indices between users

---

## Handover Checklist

### For Next Developer

**Before starting:**
- [ ] Read this entire document
- [ ] Review commit history on `claude/debug-obsidian-indexing-*` branch
- [ ] Understand the "presentation → representation → interpretation" framework
- [ ] Run the plugin locally and test search functionality

**Understanding current state:**
- [ ] Index a test vault (100-500 notes)
- [ ] Search several queries, examine console output
- [ ] Click "Debug Index" button, review distribution
- [ ] Understand why "philosophy" search returns "forrest"

**Architecture decision:**
- [ ] Decide: Quick fixes or full redesign?
- [ ] If redesign: Start with link extraction
- [ ] If quick fixes: Prioritize direct title match

**Key files to read:**
1. `src/semanticMonadView.ts` - Main search logic
2. `src/vectorIndex.ts` - IndexedDB storage & hybrid scoring
3. `src/embeddingService.ts` - Connection to Rust server
4. `src/semanticTypes.ts` - Type definitions

**Testing approach:**
- Use user's vault structure (stub notes with links)
- Test with: "computer science", "philosophy", "holochain"
- Verify concepts are domain-specific, not generic

---

## Open Questions

1. **Should we replace UMAP with force-directed graph?**
   - Pro: Shows link structure explicitly
   - Con: Harder to interpret, more CPU intensive

2. **How to handle note renames/moves?**
   - Currently: Path is key, rename breaks index
   - Solution: Use content hash or stable ID?

3. **Should embeddings include metadata?**
   - Currently: Just content
   - Alternative: Embed "title | tags | content"

4. **What's the right PageRank damping factor?**
   - Default: 0.85 (Google's choice)
   - Notes aren't web pages - maybe lower?

5. **How to visualize monad hierarchy?**
   - Nested circles?
   - Tree view?
   - Tabs?

---

## Conclusion

The Semantic Monad Explorer has a solid foundation but needs architectural realignment. The key insight is:

> **Explicit structure (links, titles) should drive discovery, with semantic similarity as augmentation, not the reverse.**

The current implementation is 80% there - we have all the pieces (embeddings, indexing, visualization), but they're assembled in the wrong order. The path forward is clear:

1. Extract and use link structure
2. Prioritize direct matches
3. Use PageRank + semantic similarity for ranking
4. Extract concepts from what users link to, not just word frequency

This aligns with how human knowledge actually works - we organize ideas explicitly (through linking, hierarchy, categories), then discover connections semantically.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-22
**Branch:** `claude/debug-obsidian-indexing-01ERTi6vohsW2Un6hxD4wPWg`
**Status:** Ready for PR + handover
