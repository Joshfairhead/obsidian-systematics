/**
 * Type definitions for semantic search system
 */

export interface Embedding {
    vector: number[];
    dimensions: number;
}

export interface EmbeddingRecord {
    id: string;              // Note path
    embedding: number[];     // Vector representation
    text: string;            // Note content snippet
    metadata: NoteMetadata;
    timestamp: number;       // When embedding was created
}

export interface NoteMetadata {
    title: string;
    path: string;
    mtime: number;          // Last modified time
    tags: string[];
    links: string[];
}

export interface ScoredNote {
    path: string;
    score: number;          // Cosine similarity (0-1)
    embedding: number[];
    metadata: NoteMetadata;
}

export interface Point2D {
    x: number;
    y: number;
    label: string;
    noteId?: string;
}

export interface SemanticMonad {
    id: string;
    query: string;
    queryEmbedding: number[];
    notes: ScoredNote[];
    concepts: ConceptNode[];
    projection2D?: Point2D[];
    createdAt: Date;
}

export interface ConceptNode {
    term: string;
    embedding: number[];
    similarity: number;      // To monad center
    position2D?: Point2D;
    hasNotes?: boolean;      // Whether vault has notes for this concept
    noteCount?: number;      // How many notes reference this concept
}

export interface IndexStats {
    totalNotes: number;
    indexedNotes: number;
    lastUpdated: Date;
    modelInfo: {
        name: string;
        dimensions: number;
    };
}
