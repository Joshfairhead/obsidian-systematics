/**
 * LLM Service - Generates related concepts from various LLM providers
 * Routes requests to Ollama, Claude, or OpenAI based on configuration
 */

export interface LLMProvider {
    generateConcepts(query: string, count: number): Promise<string[]>;
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
        const prompt = `You are a semantic concept generator. Generate ${count} related terms for: "${query}"

Rules:
- Return ONLY single words or hyphenated-terms
- No explanations, numbers, or extra text
- Format as comma-separated list
- Related to the topic semantically

Example for "computer-science": algorithm, programming, software, database, network, compiler, data-structure, artificial-intelligence, machine-learning, operating-system

Now generate ${count} terms for "${query}":`;

        try {
            const response = await fetch(`${this.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.8,
                        num_predict: 300
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const text = data.response.trim();

            // Parse comma-separated terms, more lenient parsing
            const terms = text
                .split(/[,\n]/)  // Split by comma OR newline
                .map((term: string) => term.trim().toLowerCase())
                .map((term: string) => term.replace(/^[-\d.)\s]+/, ''))  // Remove leading numbers/bullets
                .filter((term: string) => term.length > 2 && term.length < 30)
                .filter((term: string) => !term.match(/^(example|here|are|the|terms|for)/))
                .filter((term: string) => term.match(/^[a-z-]+$/))  // Only letters and hyphens
                .slice(0, count);

            console.log(`🦙 Ollama generated ${terms.length} concepts for "${query}":`, terms.slice(0, 5));
            return terms;

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
