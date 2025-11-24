/**
 * Embedding Source - Provides the method to embed text into vectors
 *
 * An embedding source takes text and returns a numeric vector representation
 * in a latent semantic space.
 */

export interface EmbeddingSource {
    name: string;
    description: string;
    dimensions: number;  // Size of embedding vector

    /**
     * Embed a single text string into a vector
     */
    embed(text: string): Promise<number[]>;

    /**
     * Batch embed multiple texts (more efficient)
     */
    embedBatch?(texts: string[]): Promise<number[][]>;
}

/**
 * Ollama Embeddings - Use Ollama's /api/embeddings endpoint
 */
export class OllamaEmbeddings implements EmbeddingSource {
    name = "Ollama";
    description = "Local LLM embeddings";
    dimensions = 4096;  // Llama2 default, adjust per model

    private endpoint: string;
    private model: string;

    constructor(endpoint: string = 'http://localhost:11434', model: string = 'llama2') {
        this.endpoint = endpoint;
        this.model = model;
    }

    async embed(text: string): Promise<number[]> {
        try {
            const response = await fetch(`${this.endpoint}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: text
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama embeddings failed: ${response.status}`);
            }

            const data = await response.json();
            return data.embedding;

        } catch (error) {
            console.error('Ollama embedding error:', error);
            throw new Error(`Failed to get Ollama embedding: ${error.message}`);
        }
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        // Ollama doesn't have native batch API, embed sequentially
        const embeddings: number[][] = [];

        for (const text of texts) {
            const embedding = await this.embed(text);
            embeddings.push(embedding);
        }

        return embeddings;
    }
}

/**
 * MiniLM Embeddings - Use existing Rust embedding server
 */
export class MiniLMEmbeddings implements EmbeddingSource {
    name = "MiniLM";
    description = "all-MiniLM-L6-v2 (384-dim)";
    dimensions = 384;

    private endpoint: string;

    constructor(endpoint: string = 'http://localhost:8765') {
        this.endpoint = endpoint;
    }

    async embed(text: string): Promise<number[]> {
        try {
            const response = await fetch(`${this.endpoint}/embed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error(`MiniLM embeddings failed: ${response.status}`);
            }

            const data = await response.json();
            return data.embedding;

        } catch (error) {
            console.error('MiniLM embedding error:', error);
            throw new Error(`Failed to get MiniLM embedding: ${error.message}`);
        }
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        // Check if batch endpoint exists
        try {
            const response = await fetch(`${this.endpoint}/embed_batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts })
            });

            if (response.ok) {
                const data = await response.json();
                return data.embeddings;
            }
        } catch (e) {
            // Fall through to sequential
        }

        // Fallback: embed sequentially
        const embeddings: number[][] = [];
        for (const text of texts) {
            const embedding = await this.embed(text);
            embeddings.push(embedding);
        }

        return embeddings;
    }
}

/**
 * OpenAI Embeddings - Use OpenAI's embedding API
 */
export class OpenAIEmbeddings implements EmbeddingSource {
    name = "OpenAI";
    description = "text-embedding-3-small";
    dimensions = 1536;

    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'text-embedding-3-small') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async embed(text: string): Promise<number[]> {
        try {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    input: text
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI embeddings failed: ${response.status}`);
            }

            const data = await response.json();
            return data.data[0].embedding;

        } catch (error) {
            console.error('OpenAI embedding error:', error);
            throw new Error(`Failed to get OpenAI embedding: ${error.message}`);
        }
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        try {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    input: texts
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI batch embeddings failed: ${response.status}`);
            }

            const data = await response.json();
            return data.data.map((item: any) => item.embedding);

        } catch (error) {
            console.error('OpenAI batch embedding error:', error);
            throw new Error(`Failed to get OpenAI batch embeddings: ${error.message}`);
        }
    }
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
