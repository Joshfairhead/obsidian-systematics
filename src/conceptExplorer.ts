/**
 * Concept Explorer - The core monad that explores latent space
 *
 * Connects a VocabularySource (what to explore) with an EmbeddingSource (how to embed)
 * to enable exploration of semantic/conceptual space.
 */

import { VocabularySource } from './vocabularySource';
import { EmbeddingSource, cosineSimilarity } from './embeddingSource';

export interface ConceptWithScore {
    term: string;
    score: number;  // Similarity score (0-1)
    embedding?: number[];  // Optional: include embedding for further processing
}

/**
 * Concept Explorer - Routes vocabulary through embedding space
 */
export class ConceptExplorer {
    private vocabularySource: VocabularySource;
    private embeddingSource: EmbeddingSource;

    // Cache for embeddings (term -> vector)
    private embeddingCache: Map<string, number[]> = new Map();

    constructor(vocabularySource: VocabularySource, embeddingSource: EmbeddingSource) {
        this.vocabularySource = vocabularySource;
        this.embeddingSource = embeddingSource;
    }

    /**
     * Change the vocabulary source (lens swap)
     */
    setVocabularySource(source: VocabularySource): void {
        this.vocabularySource = source;
        // Clear cache when changing vocabulary
        this.embeddingCache.clear();
    }

    /**
     * Change the embedding source (lens swap)
     */
    setEmbeddingSource(source: EmbeddingSource): void {
        this.embeddingSource = source;
        // Clear cache when changing embedding method
        this.embeddingCache.clear();
    }

    /**
     * Explore concepts similar to query
     * This is the core K1 monad operation
     */
    async explore(query: string, count: number = 50): Promise<ConceptWithScore[]> {
        console.log(`🔍 Exploring "${query}" using ${this.vocabularySource.name} + ${this.embeddingSource.name}`);

        // 1. Embed the query
        const queryEmbedding = await this.embeddingSource.embed(query);
        console.log(`📍 Query embedded (${queryEmbedding.length} dimensions)`);

        // 2. Get vocabulary to explore
        let vocabulary: string[];
        if (this.vocabularySource.getRelevantSubset) {
            vocabulary = await this.vocabularySource.getRelevantSubset(query, 1000);
            console.log(`📚 Loaded relevant subset: ${vocabulary.length} terms`);
        } else {
            vocabulary = await this.vocabularySource.getVocabulary();
            console.log(`📚 Loaded full vocabulary: ${vocabulary.length} terms`);
        }

        // 3. Embed vocabulary (with caching)
        const conceptsWithScores: ConceptWithScore[] = [];

        for (const term of vocabulary) {
            // Skip if term is too similar to query (avoid echo)
            if (term.toLowerCase() === query.toLowerCase()) {
                continue;
            }

            // Get or compute embedding
            let termEmbedding: number[];
            if (this.embeddingCache.has(term)) {
                termEmbedding = this.embeddingCache.get(term)!;
            } else {
                termEmbedding = await this.embeddingSource.embed(term);
                this.embeddingCache.set(term, termEmbedding);
            }

            // Compute similarity
            const score = cosineSimilarity(queryEmbedding, termEmbedding);

            conceptsWithScores.push({
                term,
                score,
                embedding: termEmbedding
            });
        }

        // 4. Sort by similarity and return top N
        conceptsWithScores.sort((a, b) => b.score - a.score);
        const results = conceptsWithScores.slice(0, count);

        console.log(`✅ Found ${results.length} concepts (scores: ${results[0]?.score.toFixed(3)} - ${results[results.length-1]?.score.toFixed(3)})`);

        return results;
    }

    /**
     * Batch embed vocabulary for faster subsequent queries
     * Call this once to pre-populate cache
     */
    async preloadVocabulary(): Promise<void> {
        const vocabulary = await this.vocabularySource.getVocabulary();
        console.log(`⏳ Pre-loading ${vocabulary.length} vocabulary embeddings...`);

        // Use batch embedding if available
        if (this.embeddingSource.embedBatch) {
            const embeddings = await this.embeddingSource.embedBatch(vocabulary);
            for (let i = 0; i < vocabulary.length; i++) {
                this.embeddingCache.set(vocabulary[i], embeddings[i]);
            }
        } else {
            // Fall back to sequential
            for (const term of vocabulary) {
                if (!this.embeddingCache.has(term)) {
                    const embedding = await this.embeddingSource.embed(term);
                    this.embeddingCache.set(term, embedding);
                }
            }
        }

        console.log(`✅ Vocabulary preloaded: ${this.embeddingCache.size} embeddings cached`);
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; vocabulary: string; embedding: string } {
        return {
            size: this.embeddingCache.size,
            vocabulary: this.vocabularySource.name,
            embedding: this.embeddingSource.name
        };
    }

    /**
     * Clear embedding cache
     */
    clearCache(): void {
        this.embeddingCache.clear();
    }
}
