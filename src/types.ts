/**
 * Represents a vertex in a graph
 */
export interface Vertex {
    index: number;
    label: string;
    x: number;
    y: number;
    z?: number;
    noteFile?: string; // Path to the linked note
}

/**
 * Represents an edge connecting two vertices
 */
export interface Edge {
    from: number;
    to: number;
}

/**
 * Represents a complete graph (Kn)
 */
export interface GraphGeometry {
    name: string;
    order: number; // The 'n' in Kn
    vertices: Vertex[];
    edges: Edge[];
}

/**
 * Settings for node labeling in the graph view
 */
export interface NodeLabelSettings {
    [nodeIndex: number]: {
        label: string;
        noteFile: string;
        labelOffsetX?: number; // Custom X offset for label position
        labelOffsetY?: number; // Custom Y offset for label position
    };
}

/**
 * Plugin settings structure
 */
export interface SystematicsSettings {
    currentGraph: number; // Which Kn graph is currently selected (3-12)
    nodeLabelSettings: { [graphKey: string]: NodeLabelSettings };

    // Latent Space Explorer Settings
    llmProvider: 'ollama' | 'claude' | 'openai';
    ollamaModel: string;
    ollamaEndpoint: string;
    claudeApiKey: string;
    openaiApiKey: string;
}

/**
 * Contextual Search System Types
 */

/**
 * Represents a monad (bounded search scope/context)
 */
export interface Monad {
    id: string;                                 // Unique identifier
    name: string;                               // "Holochain", "DHT", auto-generated
    query: string;                              // Original search query
    centerNote?: string;                        // Central note file path (if applicable)

    // Fuzzy boundary
    contentInScope: Map<string, number>;        // noteFile → relevance score (0-1)
    relevanceThreshold: number;                 // Cutoff for inclusion (default 0.3)

    // Hierarchy
    parent?: Monad;                             // Parent monad (for drill-down)
    children?: Monad[];                         // Discovered sub-monads

    // Metadata
    createdAt: Date;
    noteCount: number;                          // Notes within threshold
}

/**
 * Represents a conceptual node (cluster of related notes/concepts)
 */
export interface ConceptualNode {
    label: string;                              // "Entries", "Private Space"
    terms: string[];                            // Keywords representing this concept
    notes: string[];                            // Note file paths in this cluster
    relevance: number;                          // Relevance to parent monad
}

/**
 * Represents a polarity (complementary binary opposition)
 */
export interface Polarity {
    id: string;
    poleA: ConceptualNode;                      // One pole of dyad
    poleB: ConceptualNode;                      // Opposite pole
    confidence: number;                         // 0-1 score
    type: 'same-context' | 'cross-context';     // Proximity type
    isManual: boolean;                          // User-defined or auto-detected
}

/**
 * Represents a dyad view (K2 visualization)
 */
export interface DyadView {
    monad: Monad;                               // The scoped context
    selectedPolarity: Polarity;                 // Chosen dyad to visualize
    alternativePolarities: Polarity[];          // Other suggestions
}

/**
 * Represents a systematic view (any Kn lens applied to monad)
 */
export interface SystematicView {
    monad: Monad;
    systemOrder: number;                        // 2 for K2, 3 for K3, etc.
    vertices: ConceptualNode[];                 // Mapped to graph vertices
    edges: Edge[];                              // Relationships between vertices
}
