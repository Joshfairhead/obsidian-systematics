# Product Requirements Document: Systematic Contextual Search

**Version:** 0.1.0
**Date:** 2025-11-16
**Status:** Draft - Prototype Phase

## Executive Summary

Systematic Contextual Search is a dynamic, ontology-driven search interface that enables users to navigate conceptual spaces through systematic lenses (K2-K12 complete graphs). The system defines a **monad** (bounded search scope) and discovers **polarities** (complementary oppositions) within that scope, allowing recursive drill-down through progressively refined conceptual contexts.

---

## 1. Vision & Goals

### Vision
Create a generalized search engine that navigates knowledge by discovering and visualizing the inherent systematic structure within any corpus of text (notes, web pages, documents).

### Goals
- **Contextual Scoping**: Dynamically define search boundaries (monads) with fuzzy relevance
- **Polarity Discovery**: Automatically detect complementary oppositions within scope
- **Systematic Navigation**: Apply K2-K12 analytical lenses to structure data
- **Conceptual Abstraction**: Display conceptual spaces, not individual documents
- **Recursive Exploration**: Drill down infinitely through monad → dyad → monad → ...
- **Portability**: Build standalone (eventually migrate beyond Obsidian)

---

## 2. Core Concepts

### 2.1 Monad (Search Scope / Context)
**Definition**: The bounded universe of discourse for analysis.

**Properties:**
- **Center**: A single concept or search query
- **Boundary**: Fuzzy relevance threshold (proximity to center)
- **Hierarchy**: Can nest infinitely (Vault → Holochain → DHT → Entries)
- **Dynamic**: Defined at runtime, not stored in metadata

**Examples:**
- Entire vault = top-level monad
- "Holochain" note + all linked notes = monad
- Search query "distributed hash table" = monad
- A single pole from a dyad (e.g., "Entries") = monad

### 2.2 Dyad (Polarity-Based Clustering)
**Definition**: Complementary binary oppositions that structure a monad.

**Types:**
1. **Same-context proximity**: Terms paired in same conceptual space
   - Example: "male/female" (theme: mammals)
   - Example: "entries/links" (theme: DHT)

2. **Cross-context contrast**: Large conceptual spaces in opposition
   - Example: "phenomena/noumena" (Kant's philosophy)
   - Example: "private/public" (Holochain architecture)

**Discovery Process:**
1. Analyze all terms/concepts within monad
2. Detect pairs via:
   - Co-occurrence (appear together frequently)
   - Contextual opposition (appear in contrasting contexts)
   - Semantic relationships (antonyms, complements)
3. Abstract/generalize to meta-dyad (single overarching polarity)

### 2.3 Systematic Lenses (K2-K12)
**K2 (Dyad)**: Binary polarity analysis
**K3 (Triad)**: Derived from dyad relationships:
- Vertex 1: A → B (A influences B)
- Vertex 2: B → A (B influences A)
- Vertex 3: A ↔ B (bidirectional relationship)

**K4-K12**: To be formalized in future iterations

### 2.4 Conceptual Spaces
**Definition**: Clusters of notes/documents representing a unified concept.

**Properties:**
- A concept may span multiple documents
- Documents may belong to multiple concepts
- Clicking a conceptual node reveals all constituent documents
- Concepts are discovered/clustered dynamically (not pre-defined)

---

## 3. Algorithm

### 3.1 Monad Definition
```
1. User enters search query or selects note
2. System identifies central node(s)
3. System discovers all connected content (links, backlinks, references)
4. PageRank-like algorithm scores relevance (distance from center)
5. Fuzzy boundary defined by relevance threshold
6. Monad = { center, content, relevanceMap }
```

### 3.2 Polarity Detection (Dyad Derivation)
```
1. Extract terms/concepts from monad content
2. Analyze term relationships:
   a. Same-context: Terms co-occurring in similar contexts
   b. Cross-context: Terms in contrasting/complementary contexts
3. Identify candidate dyadic pairs
4. Rank pairs by:
   - Frequency
   - Semantic strength
   - Coverage (how much of monad do they explain)
5. Abstract to meta-dyad (generalize specific pairs)
6. Present top N pairs + allow manual selection/override
```

**Co-occurrence Analysis**: Statistical technique measuring how often terms appear together (or in similar contexts) vs. expected by chance. High co-occurrence suggests related concepts.

### 3.3 Higher System Derivation
```
K2 → K3:
  Given dyad poles A and B, derive triad:
  - Analyze relationships: A→B, B→A, A↔B
  - Map to K3 vertices

K3 → K4, etc.: To be defined in future iterations
```

### 3.4 Interactive Navigation
```
1. Display monad + dyad visualization
2. User clicks dyad pole (e.g., "Entries")
3. System redefines monad scope to clicked pole
4. Process repeats: discover new polarities within "Entries" monad
5. Breadcrumb trail: Vault > Holochain > DHT > Entries
```

---

## 4. User Interface

### 4.1 Standalone Interface
**Not integrated into existing graph view** - separate visualization mode.

**Rationale**: Designed for portability beyond Obsidian (future: general web search, document corpora).

### 4.2 Visual Representation

#### Monad Visualization
```
        Boundary (fuzzy relevance threshold)
              ╱────────────╲
            ╱                ╲
          │      Conceptual   │
          │        Nodes      │
          │          ●        │ ← Center (dot)
          │                   │
            ╲                ╱
              ╲────────────╱
                  Circle
```

- **Center Dot**: The monad's focal concept
- **Circle**: Boundary of scope (inside = in scope, outside = out of scope)
- **Conceptual Nodes**: Clusters of related notes (not individual files)

#### Dyad Visualization (K2)
```
        Pole A                 Pole B
          ●────────────────────●
       (Entries)            (Links)
          │                     │
      [5 notes]             [8 notes]
```

- Two vertices connected by edge
- Labels show discovered polarities
- Click pole → redefine monad to that pole

### 4.3 UI Components

**1. Search/Scope Selector**
- Text input: "Enter search query or note name"
- Autocomplete: Suggest note names from vault
- Button: "Define Monad"

**2. Monad Info Panel**
- Name: "Holochain" (auto-generated or from note title)
- Scope: "47 notes in scope"
- Breadcrumb: "Vault > Holochain > DHT"

**3. Polarity Discovery Panel**
- Title: "Discovered Polarities"
- List of suggested dyads with confidence scores:
  ```
  ✓ entries/links (0.87)
  ○ private/public (0.72)
  ○ agent/network (0.65)
  ```
- Button: "Add Manual Pairing"
- Button: "Visualize Selected Dyad"

**4. Graph Canvas**
- Monad circle visualization
- Conceptual nodes (clustered)
- Dyad vertices when activated
- Interactive: click to drill down

**5. Content Inspector**
- Triggered by clicking conceptual node
- Shows list of constituent notes/documents
- Preview pane for selected document

**6. Navigation Controls**
- Back button (return to parent monad)
- Breadcrumb trail (click to jump up hierarchy)
- Reset (return to vault-level monad)

---

## 5. Technical Architecture

### 5.1 Data Structures

```typescript
interface Monad {
  id: string;                           // Unique identifier
  name: string;                         // "Holochain", "DHT", auto-generated
  query: string;                        // Original search query
  centerNote?: string;                  // Central note file path (if applicable)

  // Fuzzy boundary
  contentInScope: Map<string, number>;  // noteFile → relevance score (0-1)
  relevanceThreshold: number;           // Cutoff for inclusion (default 0.3)

  // Hierarchy
  parent?: Monad;                       // Parent monad (for drill-down)
  children?: Monad[];                   // Discovered sub-monads

  // Metadata
  createdAt: Date;
  noteCount: number;                    // Notes within threshold
}

interface Polarity {
  id: string;
  poleA: ConceptualNode;                // One pole of dyad
  poleB: ConceptualNode;                // Opposite pole
  confidence: number;                   // 0-1 score
  type: 'same-context' | 'cross-context';
  isManual: boolean;                    // User-defined or auto-detected
}

interface ConceptualNode {
  label: string;                        // "Entries", "Private Space"
  terms: string[];                      // Keywords representing this concept
  notes: string[];                      // Note file paths in this cluster
  relevance: number;                    // Relevance to parent monad
}

interface DyadView {
  monad: Monad;                         // The scoped context
  selectedPolarity: Polarity;           // Chosen dyad to visualize
  alternativePolarities: Polarity[];    // Other suggestions
}

interface SystematicView {
  monad: Monad;
  systemOrder: number;                  // 2 for K2, 3 for K3, etc.
  vertices: ConceptualNode[];           // Mapped to graph vertices
  edges: Edge[];                        // Relationships between vertices
}
```

### 5.2 Core Algorithms

#### PageRank Relevance Scoring
```typescript
function calculateRelevance(
  centerNote: string,
  allNotes: string[],
  linkGraph: Map<string, string[]>
): Map<string, number> {
  // 1. Build graph: notes as nodes, links as edges
  // 2. Run PageRank with centerNote as boosted node
  // 3. Normalize scores to 0-1 range
  // 4. Return relevanceMap
}
```

#### Polarity Detection
```typescript
function detectPolarities(
  monad: Monad,
  noteContent: Map<string, string>
): Polarity[] {
  // 1. Extract terms/phrases from all notes in scope
  // 2. Build term co-occurrence matrix
  // 3. Identify frequent pairs (same-context)
  // 4. Identify contrasting pairs (cross-context via sentence analysis)
  // 5. Score and rank pairs
  // 6. Abstract to conceptual poles
  // 7. Return top N polarities
}
```

#### Conceptual Clustering
```typescript
function clusterConcepts(
  notes: string[],
  noteContent: Map<string, string>
): ConceptualNode[] {
  // 1. Extract key terms from each note (TF-IDF)
  // 2. Compute similarity matrix (cosine similarity)
  // 3. Cluster notes by similarity (k-means or hierarchical)
  // 4. Label each cluster with representative terms
  // 5. Return conceptual nodes
}
```

### 5.3 Technology Stack

**Language**: TypeScript
**Framework**:
- Obsidian Plugin API (current prototype)
- Standalone web app (future migration)

**Libraries**:
- **Graph algorithms**: PageRank implementation
- **NLP**: Term extraction, co-occurrence analysis
  - Consider: `natural` (Node.js NLP library)
  - Or lightweight TF-IDF + cosine similarity
- **Visualization**: Canvas API (like current graph view) or D3.js
- **Clustering**: k-means or simple hierarchical clustering

**Data Access**:
- Read Obsidian vault notes via API
- Parse markdown content
- Extract links, backlinks, tags

---

## 6. Implementation Phases

### Phase 1: Foundation (MVP)
**Goal**: Prove core concept with simple monad → dyad flow

**Deliverables**:
1. Monad definition via text search
2. Simple relevance scoring (link distance, not full PageRank)
3. Basic polarity detection (co-occurrence + manual override)
4. Standalone visualization (monad circle + dyad vertices)
5. Click to drill down (redefine monad to pole)

**Testing**: Use current Obsidian vault (read-only)

**Success Criteria**:
- Can search "Holochain" → get relevant notes
- System suggests "entries/links" as dyad
- Clicking "Entries" redefines monad successfully

### Phase 2: Enhanced Detection
**Goal**: Improve polarity discovery and relevance scoring

**Deliverables**:
1. PageRank-based relevance scoring
2. Cross-context polarity detection
3. Conceptual clustering (group notes into concepts)
4. Fuzzy boundary visualization (gradient circle)
5. Confidence scores for suggested dyads

### Phase 3: Higher Systems
**Goal**: Derive K3 from K2, formalize methodology

**Deliverables**:
1. K3 derivation algorithm (analyze A↔B relationships)
2. K3 visualization (triadic graph)
3. Methodology documentation for K4-K12
4. System transition UI (switch between K2, K3, K4...)

### Phase 4: Generalization
**Goal**: Port beyond Obsidian

**Deliverables**:
1. Standalone web application
2. Pluggable data sources (Obsidian, web crawler, API)
3. Test on Holochain documentation website
4. Generic corpus ingestion (any text corpus)

---

## 7. Testing & Validation

### 7.1 Test Data
- **Primary**: User's Obsidian vault (read-only, no writes)
- **Secondary**: Holochain documentation vault
- **Future**: Public websites, Wikipedia, academic papers

### 7.2 Test Scenarios

**Scenario 1: Holochain Monad**
1. Search "Holochain"
2. Verify relevant notes identified (DHT, zome, hApp, etc.)
3. Check suggested dyads include "entries/links"
4. Click "Entries" pole
5. Verify monad redefined to entries-related content

**Scenario 2: Broad Concept Monad**
1. Search "identity"
2. Verify fuzzy boundary (some notes more relevant than others)
3. Check dyads suggested (e.g., "personas/profiles")
4. Verify conceptual clustering (not just individual notes)

**Scenario 3: Recursive Drill-Down**
1. Start: Vault monad
2. Drill: Select "Holochain" → DHT → Entries → [specific entry type]
3. Verify breadcrumb trail works
4. Verify back navigation
5. Verify monad context preserved at each level

### 7.3 Success Metrics
- **Relevance Accuracy**: % of in-scope notes that are actually relevant
- **Polarity Quality**: % of suggested dyads that make semantic sense
- **User Satisfaction**: Can user successfully navigate to desired concept?
- **Performance**: Time to compute monad + polarities (target: <2s)

---

## 8. Future Enhancements

### 8.1 Advanced Features
- **Multi-pole selection**: Define monad as intersection of multiple poles
- **Temporal filtering**: Scope by creation/modification date
- **Source filtering**: Scope by author, domain, file type
- **Export**: Save monad definitions, discovered polarities
- **Sharing**: Publish monad exploration paths

### 8.2 AI Integration
- **LLM-assisted polarity discovery**: Use GPT to suggest abstract dyads
- **Semantic embeddings**: Vector similarity for better clustering
- **Auto-labeling**: Generate conceptual node labels via LLM

### 8.3 Visualization Enhancements
- **3D rendering**: For higher-order systems (K4+)
- **Animated transitions**: Smooth monad → dyad transformations
- **Heat maps**: Show relevance gradients within boundary
- **Force-directed layout**: For complex conceptual networks

---

## 9. Technical Constraints & Considerations

### 9.1 Performance
- **Large vaults**: May have 1000+ notes
  - Solution: Async processing, progressive loading
- **Real-time analysis**: Polarity detection may be compute-intensive
  - Solution: Cache results, incremental updates

### 9.2 Data Privacy
- **Vault contents**: User's personal notes (sensitive)
  - Solution: All processing local (no cloud APIs for MVP)
  - Future: Optional cloud processing with encryption

### 9.3 Obsidian Integration
- **Read-only**: Do not modify vault structure
- **Plugin conflicts**: May interact with other plugins
- **API limitations**: Obsidian plugin API may constrain functionality

### 9.4 Portability
- **Minimize Obsidian-specific code**: Abstract data access layer
- **Standard formats**: Support markdown, plain text, HTML
- **Modular architecture**: Easy to swap data source

---

## 10. Open Questions & Decisions Needed

### 10.1 Polarity Abstraction
- **Question**: How to generalize specific dyads to meta-dyads?
  - Example: "entries/links" → "private/public"
- **Options**:
  - Manual user input (for MVP)
  - LLM-based abstraction
  - Pattern matching (look for semantic hierarchies)

### 10.2 Relevance Threshold
- **Question**: What default threshold for fuzzy boundary?
- **Options**:
  - Fixed (e.g., 0.3)
  - Adaptive (top N% of notes)
  - User-configurable slider

### 10.3 Conceptual Clustering Algorithm
- **Question**: How to group notes into conceptual nodes?
- **Options**:
  - K-means clustering (need to pick K)
  - Hierarchical clustering (dendrograms)
  - Topic modeling (LDA)
  - Simple keyword matching

### 10.4 K3+ Derivation
- **Question**: Exact methodology for deriving K3, K4... from K2?
- **Status**: To be formalized through experimentation

---

## 11. Success Criteria (MVP)

### Must Have
- ✅ Define monad via text search
- ✅ Compute relevance scores for notes
- ✅ Detect at least 3 polarity suggestions
- ✅ Visualize monad boundary + dyad vertices
- ✅ Click pole to redefine monad
- ✅ Breadcrumb navigation

### Should Have
- 🔶 Manual polarity override
- 🔶 Conceptual clustering (not just note lists)
- 🔶 Confidence scores for polarities

### Could Have
- ⚪ PageRank (vs. simple link distance)
- ⚪ Cross-context polarity detection
- ⚪ Fuzzy boundary visualization

---

## 12. Timeline & Milestones

**Prototype Phase (Current)**:
- Week 1-2: Phase 1 MVP
- Week 3-4: Testing & iteration
- Week 5: Phase 2 enhancements

**Future Phases**: TBD based on MVP results

---

## Appendix A: Terminology

| Term | Definition |
|------|------------|
| **Monad** | Bounded search scope; universe of discourse |
| **Dyad** | Binary polarity; complementary opposition |
| **Triad** | Three-part system derived from dyad relationships |
| **K_n** | Complete graph with n vertices (systematic lens) |
| **Polarity** | Pair of complementary opposites structuring a space |
| **Conceptual Space** | Abstract concept spanning multiple documents |
| **Fuzzy Boundary** | Gradient relevance threshold (not binary in/out) |
| **Co-occurrence** | Statistical measure of terms appearing together |
| **PageRank** | Algorithm for scoring node importance in graph |
| **Relevance Score** | 0-1 measure of proximity to monad center |

---

## Appendix B: References

- **Graph Theory**: Complete graphs (K_n), PageRank algorithm
- **NLP**: TF-IDF, co-occurrence analysis, topic modeling
- **Ontology**: Formal concept analysis, faceted classification
- **Philosophy**: Systematic philosophy, dialectical thinking

---

**Document Owner**: Josh Fairhead
**Contributors**: Claude (Anthropic)
**Last Updated**: 2025-11-16
