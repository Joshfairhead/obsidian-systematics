/**
 * Embedding Service - Generates semantic embeddings via HTTP to Rust server
 * Connects to local embedding server (systematics-embeddings) on localhost:8765
 */

import { Notice } from 'obsidian';
import { Embedding } from './semanticTypes';

interface EmbedRequest {
    text: string;
}

interface EmbedResponse {
    embedding: number[];
    dimensions: number;
}

interface IndexRequest {
    id: string;
    text: string;
    metadata?: any;
}

interface IndexResponse {
    success: boolean;
    id: string;
}

interface SearchRequest {
    query: string;
    limit: number;
}

interface SearchResult {
    id: string;
    score: number;
    text: string;
}

interface SearchResponse {
    results: SearchResult[];
}

interface HealthResponse {
    status: string;
    model: string;
    dimensions: number;
}

export class EmbeddingService {
    private serverUrl: string = 'http://localhost:8765';
    private dimensions: number = 384;
    private isHealthy: boolean = false;
    private modelName: string = 'all-MiniLM-L6-v2';

    constructor() {}

    /**
     * Initialize by checking server health
     */
    async initialize(): Promise<void> {
        try {
            // Create timeout controller
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${this.serverUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const health: HealthResponse = await response.json();

            if (health.status !== 'ok') {
                throw new Error(`Server health check failed: ${health.status}`);
            }

            this.dimensions = health.dimensions;
            this.modelName = health.model;
            this.isHealthy = true;

            console.log(`Embedding server connected: ${health.model} (${health.dimensions}d)`);
        } catch (error) {
            this.isHealthy = false;
            const errorMsg = error instanceof Error ? error.message : String(error);

            // Provide helpful error message
            if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
                throw new Error(
                    'Cannot connect to embedding server. Please ensure:\n' +
                    '1. The Rust server is running: ./target/release/systematics-embeddings\n' +
                    '2. The server is listening on http://localhost:8765\n' +
                    '3. No firewall is blocking the connection'
                );
            }

            throw new Error(`Embedding server error: ${errorMsg}`);
        }
    }

    /**
     * Generate embedding for a single text via HTTP
     */
    async embed(text: string): Promise<number[]> {
        if (!this.isHealthy) {
            await this.initialize();
        }

        try {
            // Truncate text if too long (model has 512 token limit)
            const truncated = this.truncateText(text, 500);

            const request: EmbedRequest = { text: truncated };

            // Create timeout controller
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${this.serverUrl}/embed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data: EmbedResponse = await response.json();

            if (!data.embedding || !Array.isArray(data.embedding)) {
                throw new Error('Invalid embedding response from server');
            }

            return data.embedding;

        } catch (error) {
            console.error('Embedding generation failed:', error);
            this.isHealthy = false; // Mark as unhealthy to retry initialization
            throw error;
        }
    }

    /**
     * Generate embeddings for multiple texts (more efficient via batching)
     */
    async embedBatch(texts: string[], batchSize: number = 32): Promise<number[][]> {
        if (!this.isHealthy) {
            await this.initialize();
        }

        const embeddings: number[][] = [];

        // Process in batches to avoid overwhelming the server
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            // Process batch in parallel
            const batchPromises = batch.map(text => this.embed(text));
            const batchResults = await Promise.all(batchPromises);

            embeddings.push(...batchResults);

            // Small delay between batches to avoid overwhelming server
            if (i + batchSize < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return embeddings;
    }

    /**
     * Index a document on the server (optional - server maintains its own index)
     */
    async indexDocument(id: string, text: string, metadata?: any): Promise<boolean> {
        if (!this.isHealthy) {
            await this.initialize();
        }

        try {
            const request: IndexRequest = { id, text, metadata };

            // Create timeout controller
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${this.serverUrl}/index`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data: IndexResponse = await response.json();
            return data.success;

        } catch (error) {
            console.error('Document indexing failed:', error);
            throw error;
        }
    }

    /**
     * Search using the server's index (optional - plugin uses local IndexedDB)
     */
    async search(query: string, limit: number = 10): Promise<SearchResult[]> {
        if (!this.isHealthy) {
            await this.initialize();
        }

        try {
            const request: SearchRequest = { query, limit };

            // Create timeout controller
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${this.serverUrl}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data: SearchResponse = await response.json();
            return data.results;

        } catch (error) {
            console.error('Server search failed:', error);
            throw error;
        }
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
        return this.isHealthy;
    }

    /**
     * Get model info
     */
    getModelInfo() {
        return {
            name: this.modelName,
            dimensions: this.dimensions
        };
    }

    /**
     * Get server URL (for debugging)
     */
    getServerUrl(): string {
        return this.serverUrl;
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
