/**
 * LLM Service - Generates related concepts from various LLM providers
 * Routes requests to Ollama, Claude, or OpenAI based on configuration
 */

export interface LLMProvider {
    generateConcepts(query: string, count: number): Promise<string[]>;
}

/**
 * Validates a concept term against quality criteria
 * Returns true if concept passes all validation checks
 */
function validateConcept(term: string, queryTerm: string): boolean {
    // 1. Length check: 3-20 chars (tighten upper bound)
    if (term.length < 3 || term.length > 20) {
        return false;
    }

    // 2. Hyphen count: Max 1 hyphen (reject "object-oriented-programming")
    const hyphenCount = (term.match(/-/g) || []).length;
    if (hyphenCount > 1) {
        return false;
    }

    // 3. Query echo detection: Reject if term is substring of query or vice versa
    const termNormalized = term.replace(/-/g, '').toLowerCase();
    const queryNormalized = queryTerm.replace(/[^a-z]/g, '').toLowerCase();
    if (termNormalized.includes(queryNormalized) || queryNormalized.includes(termNormalized)) {
        // Allow if they're very different in length (e.g., "human" from "humanity" is ok)
        if (Math.abs(termNormalized.length - queryNormalized.length) < 3) {
            return false;
        }
    }

    // 4. Meta-language filter: Reject common junk patterns
    const junkPatterns = [
        /^(example|here|are|the|terms|for|now|generate|related|following|list|some|many|various|types|kinds|forms|aspects|elements|components|parts)/,
        /-(of|the|and|or|in|to|for|with|from|by|at|on)$/,  // Ends with preposition
        /^(sub|meta|type|kind|form|aspect)-/,               // Meta-category prefixes
        /(field|area|domain|discipline|branch|study|science|ology)$/  // Academic meta-terms
    ];

    for (const pattern of junkPatterns) {
        if (pattern.test(term)) {
            return false;
        }
    }

    // 5. Character variety: Reject if too repetitive (e.g., "aaaa")
    const uniqueChars = new Set(term.replace(/-/g, '')).size;
    if (uniqueChars < 3) {
        return false;
    }

    // 6. Common word filter: Reject very generic words
    const genericWords = new Set([
        'thing', 'stuff', 'item', 'object', 'element', 'part', 'piece',
        'way', 'method', 'approach', 'technique', 'process', 'system',
        'concept', 'idea', 'notion', 'theory', 'principle', 'rule'
    ]);
    if (genericWords.has(term)) {
        return false;
    }

    return true;
}

/**
 * Ollama Provider - Local LLM via Ollama
 */
export class OllamaProvider implements LLMProvider {
    private endpoint: string;
    private model: string;

    constructor(endpoint: string = 'http://localhost:11434', model: string = 'llama2') {
        this.endpoint = endpoint;
        this.model = model;
    }

    async generateConcepts(query: string, count: number = 25): Promise<string[]> {
        const prompt = `Generate ${count} fundamental concepts related to "${query}".

Focus on core ideas and essences, not categories or subtypes.
Return single words or hyphenated terms only.
Format: comma-separated list, no explanations.

Example for "philosophy": truth, knowledge, justice, ethics, virtue, wisdom, logic, reason, consciousness, reality, existence, morality, freedom, meaning, beauty, good, evil, mind, matter, form

Concepts for "${query}":`;

        try {
            console.log(`🔧 Ollama: Requesting ${count} concepts with enhanced parameters`);

            const response = await fetch(`${this.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.8,
                        num_ctx: 4096,        // Context window - CRITICAL for long outputs
                        num_predict: -1,      // No limit on output tokens (-1 = unlimited)
                        repeat_penalty: 1.1,  // Encourage variety
                        top_k: 40,            // Diversity in token selection
                        top_p: 0.9            // Nucleus sampling for quality
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const text = data.response.trim();

            console.log(`🦙 Ollama raw response for "${query}" (length: ${text.length} chars):`, text.substring(0, 300));
            console.log(`🦙 Ollama raw response END:`, text.substring(text.length - 100));

            // Parse comma-separated terms, very lenient parsing
            const terms = text
                .split(/[,\n]/)  // Split by comma OR newline
                .map((term: string) => term.trim().toLowerCase())
                .map((term: string) => term.replace(/^[-\d.)\s]+/, ''))  // Remove leading numbers/bullets
                .map((term: string) => term.replace(/[^a-z-\s]/g, ''))  // Remove special chars except hyphens and spaces
                .map((term: string) => term.trim())
                .map((term: string) => term.replace(/\s+/g, '-'))  // Convert spaces to hyphens for multi-word terms
                .filter((term: string) => term.length > 2 && term.length < 35)  // Allow slightly longer for multi-word
                .filter((term: string) => !term.match(/^(example|here|are|the|terms|for|now|generate|related)/))
                .filter((term: string) => term.match(/^[a-z][a-z-]*$/));  // Single word or hyphenated terms

            // Deduplicate terms
            const uniqueTerms = Array.from(new Set<string>(terms));
            console.log(`🦙 Ollama parsed ${uniqueTerms.length} unique terms (from ${terms.length} total)`);

            // Apply validation filter
            const validatedTerms = uniqueTerms.filter((term: string) => validateConcept(term, query));
            const rejectedCount = uniqueTerms.length - validatedTerms.length;
            console.log(`✓ Validation: ${validatedTerms.length} passed, ${rejectedCount} rejected as junk`);

            // FALLBACK STRATEGY: If we got less than 50% of requested concepts, make additional requests
            if (validatedTerms.length < count * 0.5 && count > 25) {
                console.warn(`⚠️ Only got ${validatedTerms.length}/${count} validated concepts (${Math.round(validatedTerms.length/count*100)}%). Trying multi-batch strategy...`);

                // Strategy: Make multiple smaller requests (25-50 concepts each) and combine
                const batchSize = 50;
                const numBatches = Math.ceil(count / batchSize);
                const allConcepts = new Set<string>(validatedTerms);

                for (let i = 1; i < numBatches && allConcepts.size < count; i++) {
                    console.log(`📦 Batch ${i+1}/${numBatches}: Requesting ${batchSize} more concepts...`);

                    const batchResponse = await fetch(`${this.endpoint}/api/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: this.model,
                            prompt: prompt.replace(`${count} CORE CONCEPTS`, `${batchSize} CORE CONCEPTS`),
                            stream: false,
                            options: {
                                temperature: 0.8 + (i * 0.05), // Increase temp slightly for variety
                                num_ctx: 4096,
                                num_predict: -1,
                                repeat_penalty: 1.1,
                                top_k: 40,
                                top_p: 0.9
                            }
                        })
                    });

                    if (batchResponse.ok) {
                        const batchData = await batchResponse.json();
                        const batchText = batchData.response.trim();

                        // Parse batch concepts
                        const batchTerms = batchText
                            .split(/[,\n]/)
                            .map((term: string) => term.trim().toLowerCase())
                            .map((term: string) => term.replace(/^[-\d.)\s]+/, ''))
                            .map((term: string) => term.replace(/[^a-z-\s]/g, ''))
                            .map((term: string) => term.trim())
                            .map((term: string) => term.replace(/\s+/g, '-'))
                            .filter((term: string) => term.match(/^[a-z][a-z-]*$/))
                            .filter((term: string) => validateConcept(term, query));  // Apply validation

                        batchTerms.forEach((term: string) => allConcepts.add(term));
                        console.log(`📦 Batch ${i+1}: Added ${batchTerms.length} validated terms (total: ${allConcepts.size})`);
                    }
                }

                const finalTerms = Array.from(allConcepts).slice(0, count);
                console.log(`✅ Multi-batch complete: ${finalTerms.length}/${count} concepts (${Math.round(finalTerms.length/count*100)}%)`);
                return finalTerms;
            }

            // Normal case: we got enough concepts
            const finalTerms = validatedTerms.slice(0, count);
            console.log(`✅ Single request complete: ${finalTerms.length}/${count} concepts (${Math.round(finalTerms.length/count*100)}%)`);
            return finalTerms;

        } catch (error) {
            console.error('Ollama error:', error);
            throw new Error(`Failed to connect to Ollama: ${error.message}`);
        }
    }
}

/**
 * Claude Provider - Anthropic's Claude API
 */
export class ClaudeProvider implements LLMProvider {
    private apiKey: string;
    private endpoint: string = 'https://api.anthropic.com/v1/messages';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async generateConcepts(query: string, count: number = 25): Promise<string[]> {
        const prompt = `Generate exactly ${count} single-word or hyphenated terms that are semantically related to: "${query}"

Return ONLY a comma-separated list of terms, no explanations.

Example: algorithm, programming, database, software, network`;

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 300,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Claude API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            const text = data.content[0].text;

            // Parse comma-separated terms
            const terms = text
                .split(',')
                .map((term: string) => term.trim().toLowerCase())
                .filter((term: string) => term.length > 2 && term.length < 30)
                .slice(0, count);

            console.log(`🤖 Claude generated ${terms.length} concepts for "${query}"`);
            return terms;

        } catch (error) {
            console.error('Claude API error:', error);
            throw new Error(`Failed to call Claude API: ${error.message}`);
        }
    }
}

/**
 * OpenAI Provider - OpenAI's GPT models
 */
export class OpenAIProvider implements LLMProvider {
    private apiKey: string;
    private endpoint: string = 'https://api.openai.com/v1/chat/completions';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async generateConcepts(query: string, count: number = 25): Promise<string[]> {
        const prompt = `Generate exactly ${count} single-word or hyphenated terms that are semantically related to: "${query}"

Return ONLY a comma-separated list of terms, no explanations.

Example: algorithm, programming, database, software, network`;

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    temperature: 0.7,
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            const text = data.choices[0].message.content;

            // Parse comma-separated terms
            const terms = text
                .split(',')
                .map((term: string) => term.trim().toLowerCase())
                .filter((term: string) => term.length > 2 && term.length < 30)
                .slice(0, count);

            console.log(`🧠 OpenAI generated ${terms.length} concepts for "${query}"`);
            return terms;

        } catch (error) {
            console.error('OpenAI API error:', error);
            throw new Error(`Failed to call OpenAI API: ${error.message}`);
        }
    }
}

/**
 * LLM Service - Routes concept generation to configured provider
 */
export class LLMService {
    private provider: LLMProvider;

    constructor(
        providerType: 'ollama' | 'claude' | 'openai',
        config: {
            ollamaEndpoint?: string;
            ollamaModel?: string;
            claudeApiKey?: string;
            openaiApiKey?: string;
        }
    ) {
        switch (providerType) {
            case 'ollama':
                this.provider = new OllamaProvider(
                    config.ollamaEndpoint || 'http://localhost:11434',
                    config.ollamaModel || 'llama2'
                );
                break;

            case 'claude':
                if (!config.claudeApiKey) {
                    throw new Error('Claude API key is required');
                }
                this.provider = new ClaudeProvider(config.claudeApiKey);
                break;

            case 'openai':
                if (!config.openaiApiKey) {
                    throw new Error('OpenAI API key is required');
                }
                this.provider = new OpenAIProvider(config.openaiApiKey);
                break;

            default:
                throw new Error(`Unknown LLM provider: ${providerType}`);
        }
    }

    /**
     * Generate semantically related concepts for a query
     */
    async generateConcepts(query: string, count: number = 25): Promise<string[]> {
        return await this.provider.generateConcepts(query, count);
    }
}
