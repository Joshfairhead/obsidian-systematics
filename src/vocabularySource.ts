/**
 * Vocabulary Source - Provides the set of concepts to explore
 *
 * A vocabulary is a discrete set of terms/concepts that can be embedded
 * and queried to explore a latent space.
 */

export interface VocabularySource {
    name: string;
    description: string;

    /**
     * Get the full vocabulary (all available terms)
     * May be async if loading from file/API
     */
    getVocabulary(): Promise<string[]>;

    /**
     * Get a subset of vocabulary based on initial query
     * Used for performance optimization
     */
    getRelevantSubset?(query: string, maxSize: number): Promise<string[]>;
}

/**
 * Systematics Vocabulary - Bennett's K1-K12 Ontological Terms
 * Small, highly curated set with geometric/ontological structure
 */
export class SystematicsVocabulary implements VocabularySource {
    name = "Systematics (K1-K12)";
    description = "Bennett's ontological systematics - geometrically structured concepts";

    async getVocabulary(): Promise<string[]> {
        // K1-K12 ontological terms
        // TODO: Load from file or expand this set
        return [
            // K1 - Monad
            "monad", "unity", "whole", "one", "singularity",

            // K2 - Dyad
            "dyad", "duality", "polarity", "opposition", "pair",
            "subject", "object", "self", "other",

            // K3 - Triad
            "triad", "trinity", "synthesis", "mediation",
            "thesis", "antithesis", "reconciliation",

            // K4 - Tetrad
            "tetrad", "quaternary", "foundation", "stability",
            "element", "direction", "season",

            // K5 - Pentad
            "pentad", "quintessence", "center", "integration",

            // K6 - Hexad
            "hexad", "harmony", "balance", "proportion",

            // K7 - Heptad
            "heptad", "process", "transformation", "cycle",

            // K8 - Octad
            "octad", "regeneration", "recursion",

            // K9 - Ennead
            "ennead", "completion", "fulfillment",

            // K10 - Decad
            "decad", "perfection", "manifestation",

            // K11 - Endecad
            "endecad", "transition", "threshold",

            // K12 - Dodecad
            "dodecad", "totality", "cosmos", "completion"
        ];
    }
}

/**
 * Vault Vocabulary - Extract concepts from user's Obsidian vault
 */
export class VaultVocabulary implements VocabularySource {
    name = "Vault Terms";
    description = "Unique concepts extracted from your notes";

    private app: any;

    constructor(app: any) {
        this.app = app;
    }

    async getVocabulary(): Promise<string[]> {
        const files = this.app.vault.getMarkdownFiles();
        const termsSet = new Set<string>();

        // Extract from note titles
        for (const file of files) {
            const title = file.basename;

            // Split title into words
            const words = title
                .toLowerCase()
                .split(/[\s\-_\/]+/)
                .filter((word: string) => word.length > 2);

            words.forEach((word: string) => termsSet.add(word));
        }

        // TODO: Also extract from note content (tags, headings, etc.)
        // For now, just use titles to keep it fast

        return Array.from(termsSet).sort();
    }

    async getRelevantSubset(query: string, maxSize: number): Promise<string[]> {
        const allTerms = await this.getVocabulary();

        // Simple filtering: terms that contain query or query contains term
        const queryNorm = query.toLowerCase();
        const relevant = allTerms.filter(term =>
            term.includes(queryNorm) || queryNorm.includes(term)
        );

        // If filtered set is small enough, return it
        if (relevant.length <= maxSize) {
            return relevant;
        }

        // Otherwise return first maxSize terms (could be smarter)
        return allTerms.slice(0, maxSize);
    }
}

/**
 * Common Concepts Vocabulary - General knowledge base
 * TODO: Load from ConceptNet, WordNet, or Wikipedia
 */
export class CommonConceptsVocabulary implements VocabularySource {
    name = "Common Concepts";
    description = "General knowledge vocabulary (~10k concepts)";

    async getVocabulary(): Promise<string[]> {
        // TODO: Load from external source
        // For now, return a small curated list
        return [
            "knowledge", "truth", "justice", "beauty", "wisdom",
            "algorithm", "data", "information", "computation",
            "nature", "culture", "society", "individual",
            // ... would expand to ~10k terms
        ];
    }
}

/**
 * LLM Token Vocabulary - The model's own vocabulary
 * Requires access to tokenizer
 */
export class LLMTokenVocabulary implements VocabularySource {
    name = "LLM Tokens";
    description = "Model's native token vocabulary";

    async getVocabulary(): Promise<string[]> {
        // TODO: Extract from Ollama's tokenizer
        // This would require calling Ollama API or loading tokenizer
        throw new Error("LLM token vocabulary not yet implemented");
    }
}
