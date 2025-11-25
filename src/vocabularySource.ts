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
        // Bennett's K1-K12 ontological systematics
        // Comprehensive vocabulary including geometric and conceptual terms
        return [
            // K1 - Monad (Unity, Wholeness)
            "monad", "unity", "whole", "one", "singularity", "absolute",
            "undivided", "source", "origin", "totality", "being",

            // K2 - Dyad (Duality, Opposition)
            "dyad", "duality", "polarity", "opposition", "pair", "binary",
            "subject", "object", "self", "other", "inner", "outer",
            "active", "passive", "positive", "negative", "light", "dark",
            "male", "female", "mind", "body", "form", "matter",

            // K3 - Triad (Mediation, Synthesis)
            "triad", "trinity", "synthesis", "mediation", "reconciliation",
            "thesis", "antithesis", "neutralizing", "affirming", "denying",
            "past", "present", "future", "beginning", "middle", "end",
            "father", "mother", "child", "spirit", "soul", "essence",

            // K4 - Tetrad (Foundation, Stability)
            "tetrad", "quaternary", "foundation", "stability", "structure",
            "earth", "water", "air", "fire", "north", "south", "east", "west",
            "spring", "summer", "autumn", "winter", "solid", "liquid", "gas",
            "material", "vital", "automatic", "sensitive",

            // K5 - Pentad (Quintessence, Integration)
            "pentad", "quintessence", "center", "integration", "potential",
            "consciousness", "awareness", "will", "attention", "choice",

            // K6 - Hexad (Harmony, Completion)
            "hexad", "harmony", "balance", "proportion", "relationship",
            "interaction", "communication", "exchange", "function", "purpose",

            // K7 - Heptad (Process, Transformation)
            "heptad", "process", "transformation", "cycle", "octave",
            "development", "evolution", "growth", "change", "becoming",
            "do", "re", "mi", "fa", "sol", "la", "ti",

            // K8 - Octad (Regeneration, Recursion)
            "octad", "regeneration", "recursion", "pattern", "organization",
            "system", "wholeness", "integrity", "coherence", "order",

            // K9 - Ennead (Completion, Fulfillment)
            "ennead", "completion", "fulfillment", "realization", "actualization",
            "manifestation", "expression", "individuality", "personality",

            // K10 - Decad (Perfection, Law)
            "decad", "perfection", "law", "principle", "cosmos", "universe",
            "totality", "completeness", "all", "everything", "infinity",

            // K11 - Endecad (Transition, Threshold)
            "endecad", "transition", "threshold", "bridge", "passage",
            "transformation", "gateway", "boundary", "limit", "horizon",

            // K12 - Dodecad (Cosmic Completion)
            "dodecad", "zodiac", "cosmic", "universal", "absolute-completion",
            "eternal", "timeless", "spaceless", "infinite-potential"
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
