/**
 * Vocabulary Service - Provides conceptual vocabulary for latent space exploration
 *
 * This service maintains a curated vocabulary of terms across various domains
 * that can be used to explore the embedding model's latent space.
 */

export class VocabularyService {
    /**
     * Core vocabulary across multiple domains
     * This is a seed vocabulary - can be expanded significantly
     */
    private static readonly CORE_VOCABULARY = [
        // Computer Science & Technology
        "algorithm", "database", "programming", "software", "hardware", "network",
        "encryption", "protocol", "interface", "compiler", "architecture", "distributed",
        "blockchain", "bitcoin", "ethereum", "holochain", "cryptocurrency",
        "machine-learning", "artificial-intelligence", "neural-network", "deep-learning",
        "data-structure", "binary-tree", "graph-theory", "complexity", "optimization",
        "cloud-computing", "virtualization", "container", "microservices", "api",
        "frontend", "backend", "fullstack", "javascript", "typescript", "python",
        "framework", "library", "repository", "version-control", "deployment",

        // Philosophy & Metaphysics
        "philosophy", "metaphysics", "epistemology", "ontology", "phenomenology",
        "existentialism", "pragmatism", "rationalism", "empiricism", "idealism",
        "materialism", "dualism", "monism", "consciousness", "qualia", "intentionality",
        "ethics", "morality", "virtue", "deontology", "consequentialism", "utilitarianism",
        "aesthetics", "beauty", "sublime", "transcendental", "immanent",
        "being", "becoming", "essence", "existence", "substance", "accident",
        "causality", "determinism", "free-will", "necessity", "contingency",
        "universals", "particulars", "abstraction", "concreteness",

        // Process Philosophy & Systems Thinking
        "process", "relational", "organic", "holistic", "emergent", "systemic",
        "complexity", "self-organization", "autopoiesis", "homeostasis", "feedback",
        "iteration", "recursion", "fractal", "scale-invariance", "hierarchy",
        "network", "topology", "connectivity", "centrality", "modularity",
        "dynamics", "evolution", "adaptation", "resilience", "robustness",
        "entropy", "information", "organization", "structure", "pattern",

        // Mathematics & Logic
        "mathematics", "algebra", "geometry", "topology", "calculus", "analysis",
        "number-theory", "set-theory", "category-theory", "group-theory",
        "logic", "proposition", "predicate", "inference", "deduction", "induction",
        "proof", "theorem", "axiom", "lemma", "corollary", "conjecture",
        "function", "relation", "mapping", "transformation", "isomorphism",
        "symmetry", "invariance", "conservation", "continuity", "discontinuity",

        // Physics & Natural Sciences
        "physics", "mechanics", "thermodynamics", "electromagnetism", "quantum",
        "relativity", "spacetime", "gravity", "force", "energy", "momentum",
        "field", "particle", "wave", "duality", "uncertainty", "entanglement",
        "chemistry", "molecule", "atom", "element", "compound", "reaction",
        "biology", "organism", "cell", "gene", "protein", "evolution",
        "ecology", "ecosystem", "biodiversity", "symbiosis", "adaptation",

        // Social Sciences & Economics
        "economics", "market", "supply", "demand", "equilibrium", "efficiency",
        "game-theory", "strategy", "cooperation", "competition", "coordination",
        "institution", "governance", "regulation", "policy", "incentive",
        "sociology", "society", "culture", "norms", "values", "identity",
        "anthropology", "ritual", "myth", "symbol", "meaning", "interpretation",
        "psychology", "cognition", "perception", "emotion", "motivation", "behavior",

        // Art & Creativity
        "art", "creativity", "imagination", "expression", "representation",
        "music", "rhythm", "harmony", "melody", "composition", "improvisation",
        "visual-art", "painting", "sculpture", "photography", "design",
        "literature", "poetry", "narrative", "metaphor", "symbolism",
        "architecture", "space", "form", "function", "proportion",

        // Language & Communication
        "language", "semantics", "syntax", "pragmatics", "grammar", "meaning",
        "communication", "dialogue", "discourse", "rhetoric", "persuasion",
        "semiotics", "sign", "signifier", "signified", "reference", "context",
        "linguistics", "phonetics", "morphology", "etymology", "translation",

        // Cognition & Knowledge
        "knowledge", "understanding", "wisdom", "insight", "intuition", "reason",
        "learning", "memory", "attention", "thinking", "reasoning", "judgment",
        "concept", "category", "abstraction", "generalization", "analogy",
        "model", "theory", "hypothesis", "explanation", "prediction", "inference",
        "representation", "mental-model", "schema", "frame", "prototype",

        // Spirituality & Mysticism
        "spirituality", "mysticism", "transcendence", "enlightenment", "awakening",
        "meditation", "contemplation", "mindfulness", "presence", "awareness",
        "unity", "oneness", "nonduality", "emptiness", "void", "fullness",
        "sacred", "profane", "divine", "immanence", "transcendence",
    ];

    /**
     * Get the core vocabulary
     */
    static getCoreVocabulary(): string[] {
        return [...this.CORE_VOCABULARY];
    }

    /**
     * Get vocabulary filtered by domain
     */
    static getVocabularyByDomain(domain: string): string[] {
        // Simple implementation - can be enhanced with proper categorization
        const domainMap: Record<string, string[]> = {
            "technology": this.CORE_VOCABULARY.filter(term =>
                ["algorithm", "database", "programming", "software", "hardware",
                 "network", "blockchain", "machine-learning", "api"].some(keyword =>
                    term.includes(keyword.toLowerCase())
                )
            ),
            "philosophy": this.CORE_VOCABULARY.filter(term =>
                ["philosophy", "metaphysics", "epistemology", "ethics", "consciousness",
                 "being", "existence", "ontology"].some(keyword =>
                    term.includes(keyword.toLowerCase())
                )
            ),
            // Add more domain mappings as needed
        };

        return domainMap[domain.toLowerCase()] || this.CORE_VOCABULARY;
    }

    /**
     * Merge vault terms with core vocabulary
     * @param vaultTerms Terms extracted from vault notes
     */
    static mergeWithVaultTerms(vaultTerms: string[]): string[] {
        const combined = new Set([
            ...this.CORE_VOCABULARY,
            ...vaultTerms.map(t => t.toLowerCase())
        ]);
        return Array.from(combined);
    }
}
