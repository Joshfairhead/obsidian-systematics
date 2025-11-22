/**
 * Vector Index - Stores and retrieves embeddings using IndexedDB
 */

import { EmbeddingRecord, ScoredNote, IndexStats, NoteMetadata } from './semanticTypes';
import { EmbeddingService } from './embeddingService';

export class VectorIndex {
    private dbName: string = 'obsidian-systematics-embeddings';
    private storeName: string = 'embeddings';
    private db: IDBDatabase | null = null;
    private modelDimensions: number = 384;

    constructor() {}

    /**
     * Initialize IndexedDB connection
     */
    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object store with path as key
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });

                    // Create indexes for efficient queries
                    store.createIndex('by-mtime', 'metadata.mtime', { unique: false });
                    store.createIndex('by-timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * Add or update a note's embedding
     */
    async addNote(
        path: string,
        embedding: number[],
        text: string,
        metadata: NoteMetadata
    ): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const record: EmbeddingRecord = {
            id: path,
            embedding,
            text,
            metadata,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(record);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update an existing note's embedding
     */
    async updateNote(path: string, embedding: number[]): Promise<void> {
        const existing = await this.getNote(path);
        if (!existing) {
            throw new Error(`Note not found: ${path}`);
        }

        existing.embedding = embedding;
        existing.timestamp = Date.now();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(existing);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a note's embedding
     */
    async deleteNote(path: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(path);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a note's embedding record
     */
    async getNote(path: string): Promise<EmbeddingRecord | null> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(path);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all embedding records
     */
    async getAllRecords(): Promise<EmbeddingRecord[]> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Find k nearest neighbors to query embedding with hybrid scoring
     */
    async findNearest(
        queryEmbedding: number[],
        k: number,
        queryText?: string
    ): Promise<ScoredNote[]> {
        const records = await this.getAllRecords();

        const scored = records.map(record => {
            // Base semantic similarity score
            const semanticScore = EmbeddingService.cosineSimilarity(queryEmbedding, record.embedding);

            // Boost score based on metadata if query text provided
            let boost = 0;
            if (queryText) {
                const queryLower = queryText.toLowerCase();
                const pathLower = record.id.toLowerCase();
                const titleLower = record.metadata.title.toLowerCase();
                const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

                // Boost based on individual query words in path
                for (const word of queryWords) {
                    if (word.length > 3) {
                        // Strong boost if word appears in folder name
                        const pathParts = pathLower.split('/');
                        for (const part of pathParts) {
                            // Split folder name into words
                            const folderWords = part.split(/[\s-_]+/);
                            for (const folderWord of folderWords) {
                                // Match whole word or abbreviation
                                // e.g., "science" matches "sci", "computer" matches "comp"
                                if (folderWord === word ||
                                    folderWord.includes(word) ||
                                    (folderWord.length >= 3 && word.startsWith(folderWord))) {
                                    boost += 0.12;
                                    break;
                                }
                            }
                        }

                        // Medium boost if word in title
                        if (titleLower.includes(word)) {
                            boost += 0.08;
                        }
                    }
                }

                // Extra boost if multiple query words match the same folder
                let folderMatchCount = 0;
                const pathParts = pathLower.split('/');
                for (const part of pathParts) {
                    const matchCount = queryWords.filter(w =>
                        w.length > 3 && part.includes(w)
                    ).length;
                    if (matchCount > folderMatchCount) {
                        folderMatchCount = matchCount;
                    }
                }
                if (folderMatchCount >= 2) {
                    boost += 0.15; // Big boost for folders matching multiple query terms
                }
            }

            // Combine semantic score with metadata boost
            const finalScore = Math.min(1.0, semanticScore + boost);

            return {
                path: record.id,
                score: finalScore,
                embedding: record.embedding,
                metadata: record.metadata
            };
        });

        // Sort by final score descending
        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, k);
    }

    /**
     * Check if a note needs re-indexing (modified since last embedding)
     */
    async needsReindex(path: string, currentMtime: number): Promise<boolean> {
        const record = await this.getNote(path);

        if (!record) return true;  // Not indexed yet

        return record.metadata.mtime < currentMtime;  // Modified since indexing
    }

    /**
     * Get index statistics
     */
    async getStats(): Promise<IndexStats> {
        const records = await this.getAllRecords();

        let lastUpdated = new Date(0);
        if (records.length > 0) {
            const newest = Math.max(...records.map(r => r.timestamp));
            lastUpdated = new Date(newest);
        }

        return {
            totalNotes: records.length,
            indexedNotes: records.length,
            lastUpdated,
            modelInfo: {
                name: 'Xenova/all-MiniLM-L6-v2',
                dimensions: this.modelDimensions
            }
        };
    }

    /**
     * Clear all embeddings (for re-indexing)
     */
    async clear(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Close database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
