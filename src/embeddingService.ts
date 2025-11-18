/**
 * Embedding Service - Generates semantic embeddings using Transformers.js
 * Loads model from CDN to keep plugin bundle size small
 */

import { Notice } from 'obsidian';
import { Embedding } from './semanticTypes';

export class EmbeddingService {
    private pipeline: any = null;
    private model: string = 'Xenova/all-MiniLM-L6-v2';  // 384 dimensions, fast
    private dimensions: number = 384;
    private isInitializing: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor() {}

    /**
     * Initialize the embedding model
     * Downloads model on first use (~23MB cached in browser)
     */
    async initialize(): Promise<void> {
        if (this.pipeline) return;
        if (this.isInitializing && this.initPromise) {
            return this.initPromise;
        }

        this.isInitializing = true;
        this.initPromise = this._initializeInternal();

        try {
            await this.initPromise;
        } finally {
            this.isInitializing = false;
        }
    }

    private async _initializeInternal(): Promise<void> {
        try {
            console.log('Starting embedding model initialization...');
            new Notice('Loading embedding model (first time only)...', 3000);

            // Dynamically import transformers.js from CDN
            console.log('Importing transformers.js from CDN...');
            // @ts-expect-error - Dynamic CDN import not in type system
            const transformersModule = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0');
            console.log('Transformers.js module loaded:', Object.keys(transformersModule));

            // Access the pipeline function
            const { pipeline, env } = transformersModule;

            if (!pipeline) {
                throw new Error('Pipeline function not found in transformers module');
            }

            console.log('Configuring transformers.js environment...');
            // Configure for local execution
            if (env) {
                env.allowLocalModels = false;
                env.useBrowserCache = true;
                console.log('Environment configured');
            }

            // Initialize the feature extraction pipeline
            console.log('Initializing feature extraction pipeline...');
            this.pipeline = await pipeline('feature-extraction', this.model, {
                progress_callback: (progress: any) => {
                    console.log('Model download progress:', progress);
                }
            });
            console.log('Pipeline initialized successfully');

            new Notice('Embedding model ready!');
        } catch (error) {
            console.error('Failed to initialize embedding model:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load embedding model: ${errorMsg}. Check console for full error details.`);
        }
    }

    /**
     * Generate embedding for a single text
     */
    async embed(text: string): Promise<number[]> {
        if (!this.pipeline) {
            await this.initialize();
        }

        try {
            // Truncate text if too long (model has 512 token limit)
            const truncated = this.truncateText(text, 500);

            // Generate embedding
            const output = await this.pipeline(truncated, {
                pooling: 'mean',
                normalize: true
            });

            // Convert to plain array
            const embedding = Array.from(output.data) as number[];

            return embedding;
        } catch (error) {
            console.error('Embedding generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings for multiple texts (more efficient)
     */
    async embedBatch(texts: string[], batchSize: number = 32): Promise<number[][]> {
        if (!this.pipeline) {
            await this.initialize();
        }

        const embeddings: number[][] = [];

        // Process in batches to avoid memory issues
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const truncated = batch.map(t => this.truncateText(t, 500));

            const output = await this.pipeline(truncated, {
                pooling: 'mean',
                normalize: true
            });

            // Extract embeddings from batch output
            if (batch.length === 1) {
                embeddings.push(Array.from(output.data) as number[]);
            } else {
                for (let j = 0; j < batch.length; j++) {
                    const start = j * this.dimensions;
                    const end = start + this.dimensions;
                    const embedding = Array.from(output.data.slice(start, end)) as number[];
                    embeddings.push(embedding);
                }
            }
        }

        return embeddings;
    }

    /**
     * Truncate text to fit model's token limit
     */
    private truncateText(text: string, maxWords: number): string {
        const words = text.split(/\s+/);
        if (words.length <= maxWords) {
            return text;
        }
        return words.slice(0, maxWords).join(' ') + '...';
    }

    /**
     * Check if service is ready
     */
    isReady(): boolean {
        return this.pipeline !== null;
    }

    /**
     * Get model info
     */
    getModelInfo() {
        return {
            name: this.model,
            dimensions: this.dimensions
        };
    }

    /**
     * Calculate cosine similarity between two embeddings
     */
    static cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have same dimensions');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    /**
     * Find k nearest neighbors using cosine similarity
     */
    static findNearest(
        query: number[],
        embeddings: { id: string; embedding: number[] }[],
        k: number
    ): { id: string; score: number }[] {
        const scored = embeddings.map(item => ({
            id: item.id,
            score: EmbeddingService.cosineSimilarity(query, item.embedding)
        }));

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, k);
    }
}
