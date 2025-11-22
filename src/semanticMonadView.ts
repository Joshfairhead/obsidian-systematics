/**
 * Semantic Monad View - Embedding-based knowledge exploration
 */

import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import SystematicsPlugin from '../main';
import { EmbeddingService } from './embeddingService';
import { VectorIndex } from './vectorIndex';
import { ProjectionEngine } from './projectionEngine';
import { SemanticMonad, Point2D, ConceptNode, ScoredNote } from './semanticTypes';
import { LLMService } from './llmService';

export const VIEW_TYPE_SEMANTIC_MONAD = 'systematics-semantic-monad';

export class SemanticMonadView extends ItemView {
    plugin: SystematicsPlugin;
    embeddingService: EmbeddingService;
    vectorIndex: VectorIndex;
    projectionEngine: ProjectionEngine;
    llmService: LLMService | null = null;

    // UI Elements
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    searchInput: HTMLInputElement;
    indexButton: HTMLButtonElement;
    statusDiv: HTMLElement;
    breadcrumbTrail: HTMLElement;
    notesList: HTMLElement;
    conceptsList: HTMLElement;

    // State
    currentMonad: SemanticMonad | null = null;
    isIndexing: boolean = false;
    conceptPositions: Map<string, Point2D> = new Map();
    conceptVelocities: Map<string, { vx: number; vy: number }> = new Map();
    hoveredConcept: string | null = null;
    animationFrame: number | null = null;
    animationTime: number = 0;

    constructor(leaf: WorkspaceLeaf, plugin: SystematicsPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.embeddingService = new EmbeddingService();
        this.vectorIndex = new VectorIndex();
        this.projectionEngine = new ProjectionEngine();
    }

    getViewType(): string {
        return VIEW_TYPE_SEMANTIC_MONAD;
    }

    getDisplayText(): string {
        return 'Latent Space Explorer';
    }

    getIcon(): string {
        return 'compass';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('systematics-semantic-monad');

        // Initialize services
        await this.initializeServices();

        // Create UI
        this.createUI(container);

        // Register vault listeners for incremental indexing
        this.registerVaultListeners();
    }

    async initializeServices() {
        try {
            await this.vectorIndex.initialize();
            // Embedding service initializes lazily on first use

            // Initialize LLM service based on settings
            this.initializeLLMService();
        } catch (error) {
            new Notice('Failed to initialize semantic search: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Initialize LLM service from plugin settings
     */
    initializeLLMService() {
        try {
            const settings = this.plugin.settings;
            this.llmService = new LLMService(settings.llmProvider, {
                ollamaEndpoint: settings.ollamaEndpoint,
                ollamaModel: settings.ollamaModel,
                claudeApiKey: settings.claudeApiKey,
                openaiApiKey: settings.openaiApiKey
            });
            console.log(`✨ LLM Service initialized with provider: ${settings.llmProvider}`);
        } catch (error) {
            console.error('Failed to initialize LLM service:', error);
            new Notice(`LLM initialization failed: ${error.message}. Check settings.`);
        }
    }

    createUI(container: Element) {
        // Header
        const header = container.createDiv('semantic-monad-header');
        const titleRow = header.createDiv('title-row');
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'baseline';
        titleRow.style.gap = '10px';

        titleRow.createEl('h2', { text: 'Latent Space Explorer' });
        const versionEl = titleRow.createEl('span', {
            text: 'v0.4.0',
            cls: 'version-badge'
        });
        versionEl.style.fontSize = '11px';
        versionEl.style.color = 'var(--text-muted)';
        versionEl.style.fontWeight = 'normal';

        // Status and controls
        const controlsSection = container.createDiv('controls-section');

        this.statusDiv = controlsSection.createDiv('index-status');
        this.statusDiv.style.fontSize = '14px';
        this.statusDiv.style.padding = '8px';
        this.statusDiv.style.marginBottom = '8px';
        this.updateIndexStatus();

        this.indexButton = controlsSection.createEl('button', {
            text: 'Index Vault',
            cls: 'index-vault-button'
        });
        this.indexButton.addEventListener('click', () => this.indexVault());

        // Debug button to inspect index
        const debugButton = controlsSection.createEl('button', {
            text: 'Debug Index',
            cls: 'index-vault-button'
        });
        debugButton.style.backgroundColor = 'var(--background-modifier-border)';
        debugButton.addEventListener('click', () => this.debugIndex());

        // Breadcrumb trail
        this.breadcrumbTrail = container.createDiv('breadcrumb-trail');
        this.updateBreadcrumb();

        // Search section
        const searchSection = container.createDiv('search-section');
        searchSection.createEl('label', { text: 'Semantic Search:' });

        const inputRow = searchSection.createDiv('input-row');

        this.searchInput = inputRow.createEl('input', {
            type: 'text',
            placeholder: 'Enter concept (e.g., "distributed systems", "consciousness")...'
        });

        const searchButton = inputRow.createEl('button', { text: 'Search' });
        searchButton.addEventListener('click', () => this.handleSemanticSearch());

        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSemanticSearch();
            }
        });

        // Two-column layout
        const contentLayout = container.createDiv('content-layout');

        // Left column: Canvas and concepts
        const leftColumn = contentLayout.createDiv('left-column');

        this.canvas = leftColumn.createEl('canvas', {
            cls: 'semantic-monad-canvas'
        });

        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        this.ctx = ctx;

        // Add click and hover handlers for canvas
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredConcept = null;
            this.draw();
        });

        // Start animation loop
        this.startAnimation();

        // Concepts panel
        const conceptsPanel = leftColumn.createDiv('concepts-panel');
        conceptsPanel.createEl('h3', { text: 'Semantic Concepts' });
        this.conceptsList = conceptsPanel.createDiv('concepts-list');

        // Right column: Notes list
        const rightColumn = contentLayout.createDiv('right-column');

        const notesPanel = rightColumn.createDiv('notes-panel');
        this.notesList = notesPanel; // Store the entire panel, we'll populate it dynamically

        // Initialize canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        if (parent) {
            // Match width to parent column (concepts panel below it)
            const parentWidth = parent.clientWidth || 400;

            // Make canvas square and fill the parent width
            const size = Math.min(Math.max(parentWidth - 10, 300), 600);

            this.canvas.width = size;
            this.canvas.height = size;

            // Use CSS to make it fill parent width while maintaining aspect ratio
            this.canvas.style.width = '100%';
            this.canvas.style.height = 'auto';
            this.canvas.style.display = 'block';
            this.canvas.style.margin = '0 auto';

            this.draw();
        }
    }

    /**
     * Debug: Inspect what's in the index
     */
    async debugIndex() {
        const records = await this.vectorIndex.getAllRecords();

        console.log('=== INDEX CONTENTS ===');
        console.log(`Total indexed: ${records.length} notes`);

        // Group by folder
        const byFolder: Map<string, number> = new Map();
        const samplePaths: string[] = [];

        for (const record of records) {
            // Extract folder path
            const parts = record.id.split('/');
            const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
            byFolder.set(folder, (byFolder.get(folder) || 0) + 1);

            // Collect sample paths
            if (samplePaths.length < 20) {
                samplePaths.push(record.id);
            }
        }

        console.log('\n=== Notes by Folder ===');
        const sortedFolders = Array.from(byFolder.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30);

        for (const [folder, count] of sortedFolders) {
            console.log(`${folder}: ${count} notes`);
        }

        console.log('\n=== Sample Paths ===');
        for (const path of samplePaths) {
            console.log(path);
        }

        // Search for computer science related paths
        const csRelated = records.filter(r =>
            r.id.toLowerCase().includes('computer') ||
            r.id.toLowerCase().includes('cs') ||
            r.id.toLowerCase().includes('programming') ||
            r.id.toLowerCase().includes('algorithm') ||
            r.id.toLowerCase().includes('software')
        );

        console.log(`\n=== Computer Science Related Paths (${csRelated.length}) ===`);
        for (const record of csRelated.slice(0, 20)) {
            console.log(record.id);
        }

        new Notice(`Index contains ${records.length} notes. Check console for details.`);
    }

    /**
     * Index the entire vault
     */
    async indexVault() {
        if (this.isIndexing) {
            new Notice('Indexing already in progress');
            return;
        }

        this.isIndexing = true;
        this.indexButton.disabled = true;
        this.indexButton.setText('Indexing...');
        this.statusDiv.setText('Initializing embedding model...');

        let indexed = 0;
        let failed = 0;

        try {
            // Initialize embedding service first (connects to local server)
            this.statusDiv.setText('Connecting to embedding server...');
            new Notice('Connecting to local embedding server (localhost:8765)...', 4000);

            try {
                await this.embeddingService.initialize();
                const modelInfo = this.embeddingService.getModelInfo();
                this.statusDiv.setText(`Connected to ${modelInfo.name}! Starting to index...`);
                new Notice(`Embedding server ready! Using ${modelInfo.name}`, 3000);
            } catch (error) {
                const msg = `❌ Failed to connect to embedding server: ${error.message}`;
                this.statusDiv.setText(msg);
                this.statusDiv.style.color = 'var(--text-error)';
                new Notice('❌ Cannot connect to embedding server. Please ensure the Rust server is running on localhost:8765', 15000);
                console.error('Embedding service initialization failed:', error);
                throw new Error('Embedding server unavailable: ' + error.message);
            }

            const files = this.app.vault.getMarkdownFiles();
            new Notice(`Found ${files.length} notes to index`);
            this.statusDiv.setText(`Indexing 0/${files.length} notes...`);

            const batchSize = 5;

            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);

                for (const file of batch) {
                    try {
                        await this.indexNote(file);
                        indexed++;

                        // Update status more frequently
                        if (indexed % 5 === 0) {
                            this.statusDiv.setText(`Indexing ${indexed}/${files.length} notes...`);
                        }

                        if (indexed % 20 === 0) {
                            new Notice(`Progress: ${indexed}/${files.length} notes`, 2000);
                            console.log(`Progress: ${indexed}/${files.length} notes indexed`);
                        }
                    } catch (error) {
                        failed++;
                        console.error(`Failed to index ${file.path}:`, error);

                        // Show error for first few failures
                        if (failed <= 3) {
                            new Notice(`Error indexing ${file.basename}: ${error.message}`, 8000);
                            this.statusDiv.setText(`Error on ${file.basename}: ${error.message}`);
                        }

                        // If too many failures early on, abort
                        if (failed > 5 && indexed < 10) {
                            throw new Error(`Too many indexing failures. Last error: ${error.message}`);
                        }
                    }
                }
            }

            if (indexed > 0) {
                const msg = `✅ Indexed ${indexed} notes!` + (failed > 0 ? ` (${failed} failed)` : '');
                new Notice(msg);
                this.statusDiv.setText(`✅ Index: ${indexed} notes` + (failed > 0 ? ` (${failed} errors)` : ''));
                this.statusDiv.style.color = 'var(--text-success)';
            } else {
                const msg = '❌ No notes were indexed - all failed. See errors above.';
                new Notice(msg, 10000);
                this.statusDiv.setText(msg);
                this.statusDiv.style.color = 'var(--text-error)';
            }

            await this.updateIndexStatus();

        } catch (error) {
            const msg = '❌ Indexing failed: ' + error.message;
            new Notice(msg, 10000);
            this.statusDiv.setText(msg);
            this.statusDiv.style.color = 'var(--text-error)';
            console.error('Indexing error:', error);
        } finally {
            this.isIndexing = false;
            this.indexButton.disabled = false;
            this.indexButton.setText('Re-index Vault');

            console.log(`Indexing complete: ${indexed} successful, ${failed} failed`);
        }
    }

    /**
     * Index a single note
     */
    async indexNote(file: TFile) {
        const content = await this.app.vault.cachedRead(file);

        // Skip if too short
        if (content.length < 50) return;

        // Check if needs reindexing
        const needsReindex = await this.vectorIndex.needsReindex(file.path, file.stat.mtime);
        if (!needsReindex) return;

        // Generate embedding
        const embedding = await this.embeddingService.embed(content);

        // Debug: Log first indexed note to verify embeddings are diverse
        const stats = await this.vectorIndex.getStats();
        if (stats.indexedNotes < 3) {
            console.log(`Indexed note #${stats.indexedNotes + 1}: ${file.basename}`, {
                embeddingLength: embedding.length,
                embeddingPreview: embedding.slice(0, 5),
                embeddingSum: embedding.reduce((a, b) => a + b, 0),
                contentPreview: content.slice(0, 100)
            });
        }

        // Extract metadata
        const metadata = {
            title: file.basename,
            path: file.path,
            mtime: file.stat.mtime,
            tags: [], // Could extract from frontmatter
            links: this.extractWikiLinks(content)
        };

        // Store in index
        await this.vectorIndex.addNote(
            file.path,
            embedding,
            content.slice(0, 500), // Store snippet
            metadata
        );
    }

    /**
     * Perform semantic search
     */
    async handleSemanticSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            new Notice('Please enter a search query');
            return;
        }

        try {
            new Notice('Searching semantic space...');

            // Normalize query (lowercase for matching)
            const queryNormalized = query.toLowerCase();

            // Ensure server is connected
            if (!this.embeddingService.isReady()) {
                await this.embeddingService.initialize();
            }

            // Generate query embedding
            const queryEmbedding = await this.embeddingService.embed(query);
            console.log('Query embedding generated:', {
                query,
                embeddingLength: queryEmbedding.length,
                embeddingPreview: queryEmbedding.slice(0, 5),
                embeddingSum: queryEmbedding.reduce((a, b) => a + b, 0)
            });

            // Find nearest notes with hybrid scoring (semantic + metadata)
            const nearestNotes = await this.vectorIndex.findNearest(queryEmbedding, 50, queryNormalized);
            console.log('Nearest notes found:', {
                count: nearestNotes.length,
                topScores: nearestNotes.slice(0, 5).map(n => ({ path: n.path, score: n.score })),
                scoreDiversity: new Set(nearestNotes.slice(0, 10).map(n => n.score.toFixed(3))).size
            });

            if (nearestNotes.length === 0) {
                new Notice('No indexed notes found. Please index your vault first.');
                return;
            }

            // Extract concepts from top notes (pass query words to filter out)
            const queryWords = new Set(queryNormalized.split(/\s+/).filter(w => w.length > 3));
            const concepts = await this.extractSemanticConcepts(
                nearestNotes.slice(0, 20),
                queryEmbedding,
                queryWords
            );

            // Project to 2D
            const projection = await this.projectToVisualization(
                queryEmbedding,
                concepts,
                nearestNotes.slice(0, 12)
            );

            // Create monad
            this.currentMonad = {
                id: Date.now().toString(),
                query,
                queryEmbedding,
                notes: nearestNotes,
                concepts,
                projection2D: projection,
                createdAt: new Date()
            };

            // Update UI
            this.updateBreadcrumb();
            this.displayNotes();
            this.displayConcepts();
            this.draw();

            new Notice(`Found ${nearestNotes.length} semantically related notes`);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('embedding server') || errorMsg.includes('localhost:8765')) {
                new Notice('Search failed: Cannot connect to embedding server. Please ensure the Rust server is running.', 10000);
            } else {
                new Notice('Search failed: ' + errorMsg, 8000);
            }
            console.error('Semantic search error:', error);
        }
    }

    /**
     * Extract semantic concepts using LLM-GENERATED discovery
     * Explores LLM's latent space, then maps to notes
     */
    async extractSemanticConcepts(
        notes: ScoredNote[],
        queryEmbedding: number[],
        queryWords?: Set<string>
    ): Promise<ConceptNode[]> {
        console.log('🔮 Exploring latent space with LLM...');

        if (!this.llmService) {
            console.error('LLM service not initialized');
            new Notice('LLM service not configured. Check plugin settings.');
            return [];
        }

        try {
            // STEP 1: Ask LLM to generate related concepts
            const query = Array.from(queryWords || []).join(' ');
            console.log(`🤖 Asking LLM for concepts related to: "${query}"`);

            const llmConcepts = await this.llmService.generateConcepts(query, 30);
            console.log(`📝 LLM returned ${llmConcepts.length} concepts:`, llmConcepts.slice(0, 10));

            // Filter out query words to avoid redundancy
            const filteredConcepts = llmConcepts.filter(term => {
                if (!queryWords) return true;
                return !queryWords.has(term.toLowerCase());
            });

            if (filteredConcepts.length === 0) {
                console.warn('No concepts after filtering');
                return [];
            }

            // STEP 2: Embed LLM-generated concepts
            console.log('🧬 Embedding LLM concepts...');
            const conceptEmbeddings = await this.embeddingService.embedBatch(filteredConcepts);

            // STEP 3: Rank by semantic similarity to query
            const rankedConcepts = filteredConcepts.map((term, i) => {
                const similarity = EmbeddingService.cosineSimilarity(
                    queryEmbedding,
                    conceptEmbeddings[i]
                );

                return {
                    term,
                    embedding: conceptEmbeddings[i],
                    similarity
                };
            });

            // Sort by similarity and take top 25
            rankedConcepts.sort((a, b) => b.similarity - a.similarity);
            const topConcepts = rankedConcepts.slice(0, 25);

            console.log('🎯 Top ranked concepts:', topConcepts.slice(0, 5).map(c => `${c.term} (${(c.similarity * 100).toFixed(0)}%)`));

            // STEP 4: Check which concepts have notes in vault
            const allRecords = await this.vectorIndex.getAllRecords();
            const conceptsWithNotes: ConceptNode[] = topConcepts.map(concept => {
                // Check if any notes relate to this concept
                const relatedNotes = allRecords.filter(record => {
                    const title = record.metadata.title.toLowerCase();
                    const path = record.id.toLowerCase();
                    const term = concept.term.toLowerCase();

                    return title.includes(term) || path.includes(term);
                });

                return {
                    ...concept,
                    hasNotes: relatedNotes.length > 0,
                    noteCount: relatedNotes.length
                };
            });

            // Return top 18 concepts (increased from 12 for richer visualization)
            const finalConcepts = conceptsWithNotes.slice(0, 18);

            const withNotes = finalConcepts.filter(c => c.hasNotes).length;
            console.log(`✨ Final: ${finalConcepts.length} concepts (${withNotes} with notes, ${finalConcepts.length - withNotes} pure latent)`);

            return finalConcepts;

        } catch (error) {
            console.error('Error generating concepts:', error);
            new Notice(`Failed to generate concepts: ${error.message}`);
            return [];
        }
    }

    /**
     * Extract wiki links from markdown content
     */
    private extractWikiLinks(content: string): string[] {
        const linkPattern = /\[\[([^\]]+)\]\]/g;
        const links: string[] = [];
        let match;

        while ((match = linkPattern.exec(content)) !== null) {
            // Extract link text (may include alias like [[Link|Alias]])
            const linkText = match[1].split('|')[0].trim();
            links.push(linkText);
        }

        return [...new Set(links)]; // Remove duplicates
    }

    /**
     * Extract meaningful terms from text
     */
    private extractTerms(content: string): string[] {
        const stopWords = new Set([
            // Common words
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
            'it', 'for', 'not', 'on', 'with', 'as', 'you', 'do', 'at',
            'this', 'but', 'his', 'from', 'they', 'we', 'say', 'her', 'she',
            'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
            'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which',
            'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just',
            'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good',
            'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
            'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
            'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well',
            'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give',
            'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had',
            'were', 'said', 'did', 'having', 'may', 'should', 'does', 'being',
            'such', 'through', 'where', 'much', 'those', 'very', 'here',
            'yeah', 'really', 'something', 'things', 'thing', 'more', 'many',
            // Additional generic words
            'mean', 'means', 'kind', 'sort', 'type', 'types', 'maybe', 'perhaps',
            'question', 'questions', 'answer', 'answers', 'seems', 'seem',
            'might', 'must', 'shall', 'need', 'needs', 'needed',
            'probably', 'actually', 'basically', 'literally', 'generally',
            'usually', 'often', 'sometimes', 'always', 'never',
            'every', 'each', 'either', 'neither', 'both', 'few', 'several',
            'between', 'among', 'before', 'during', 'within', 'without',
            'against', 'since', 'until', 'while', 'though', 'although',
            'however', 'therefore', 'thus', 'hence', 'whether',
            'going', 'doing', 'made', 'making', 'used', 'using',
            'called', 'call', 'found', 'find', 'given', 'give',
            'became', 'become', 'comes', 'goes', 'gone', 'went',
            // Vague qualifiers
            'enough', 'quite', 'rather', 'somewhat', 'fairly',
            'pretty', 'almost', 'nearly', 'hardly', 'barely',
            'simply', 'merely', 'certainly', 'surely', 'indeed',
            // Common verbs
            'think', 'thought', 'know', 'knew', 'tell', 'told',
            'feel', 'felt', 'show', 'shown', 'try', 'tried',
            'ask', 'asked', 'help', 'helped', 'turn', 'turned'
        ]);

        return content
            .toLowerCase()
            .replace(/[#*_`\[\]()]/g, ' ')
            .split(/\s+/)
            .filter(w => {
                // More aggressive filtering
                if (w.length < 5) return false;  // Increased from 3 to 5
                if (stopWords.has(w)) return false;
                if (/^\d+$/.test(w)) return false;  // No pure numbers
                if (w.match(/^(https?|ftp|file)/)) return false;  // No URLs
                return true;
            })
            .map(w => w.replace(/[^a-z0-9]/g, ''))
            .filter(w => w.length >= 5);  // Re-filter after cleanup
    }

    /**
     * Project embeddings to 2D for visualization
     * Using force-directed layout with repulsion (like Obsidian graph)
     */
    async projectToVisualization(
        queryEmbedding: number[],
        concepts: ConceptNode[],
        topNotes: ScoredNote[]
    ): Promise<Point2D[]> {
        const center: Point2D = { x: 0, y: 0, label: 'query' };
        const others: Point2D[] = [];

        const count = concepts.length;
        const radius = 0.7; // Base distance from center

        // Initialize positions in a circle with some randomness
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.3;
            const r = radius + (Math.random() - 0.5) * 0.2;
            const point: Point2D = {
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r,
                label: concepts[i].term
            };
            others.push(point);
        }

        // Store positions and initialize velocities
        this.conceptPositions.clear();
        this.conceptVelocities.clear();
        others.forEach((point, i) => {
            concepts[i].position2D = point;
            this.conceptPositions.set(concepts[i].term, point);
            this.conceptVelocities.set(concepts[i].term, { vx: 0, vy: 0 });
        });

        return [center, ...others];
    }

    /**
     * Apply physics forces to concepts (repulsion + center attraction)
     */
    applyForces() {
        if (!this.currentMonad) return;

        const concepts = this.currentMonad.concepts;
        const repulsionStrength = 0.05;
        const centerAttractionStrength = 0.01;
        const damping = 0.85;
        const minDistance = 0.2; // Minimum distance between concepts

        // Apply repulsion between all concepts
        for (let i = 0; i < concepts.length; i++) {
            const conceptA = concepts[i];
            if (!conceptA.position2D) continue;

            const velA = this.conceptVelocities.get(conceptA.term);
            if (!velA) continue;

            let fx = 0, fy = 0;

            // Repulsion from other concepts
            for (let j = 0; j < concepts.length; j++) {
                if (i === j) continue;
                const conceptB = concepts[j];
                if (!conceptB.position2D) continue;

                const dx = conceptA.position2D.x - conceptB.position2D.x;
                const dy = conceptA.position2D.y - conceptB.position2D.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < minDistance) {
                    // Strong repulsion when too close
                    const force = repulsionStrength / (dist + 0.01);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                }
            }

            // Weak attraction to ideal circular radius (keeps from flying off)
            const dist = Math.sqrt(
                conceptA.position2D.x ** 2 + conceptA.position2D.y ** 2
            );
            const targetRadius = 0.7;
            if (dist > 0) {
                const centerForce = (dist - targetRadius) * centerAttractionStrength;
                fx -= (conceptA.position2D.x / dist) * centerForce;
                fy -= (conceptA.position2D.y / dist) * centerForce;
            }

            // Update velocity
            velA.vx = (velA.vx + fx) * damping;
            velA.vy = (velA.vy + fy) * damping;

            // Update position
            conceptA.position2D.x += velA.vx;
            conceptA.position2D.y += velA.vy;

            // Update stored position
            this.conceptPositions.set(conceptA.term, conceptA.position2D);
        }
    }

    /**
     * Start animation loop with physics simulation
     */
    startAnimation() {
        const animate = () => {
            this.animationTime += 0.01;
            this.applyForces(); // Update physics
            this.draw();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    /**
     * Stop animation loop
     */
    stopAnimation() {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /**
     * Handle mouse hover on canvas
     */
    handleCanvasHover(e: MouseEvent) {
        if (!this.currentMonad) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) / 3;

        let foundHover = false;

        // Check if hovering near any concept
        for (const concept of this.currentMonad.concepts) {
            if (!concept.position2D) continue;

            const pos = ProjectionEngine.toCanvasCoords(
                concept.position2D,
                centerX,
                centerY,
                radius * 0.85
            );

            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);

            if (dist < 20) {  // Hover threshold
                if (this.hoveredConcept !== concept.term) {
                    this.hoveredConcept = concept.term;
                    this.canvas.style.cursor = 'pointer';
                }
                foundHover = true;
                break;
            }
        }

        if (!foundHover && this.hoveredConcept !== null) {
            this.hoveredConcept = null;
            this.canvas.style.cursor = 'default';
        }
    }

    /**
     * Draw semantic visualization with animation and hover effects
     */
    draw() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.clearRect(0, 0, width, height);

        const textColor = getComputedStyle(document.body).getPropertyValue('--text-normal').trim() || '#000';
        const mutedColor = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#888';

        if (!this.currentMonad) {
            this.ctx.fillStyle = mutedColor;
            this.ctx.font = '16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Enter a query to explore semantic space', width / 2, height / 2);
            return;
        }

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;

        // Draw monad boundary
        this.ctx.strokeStyle = '#4a9eff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.stroke();

        // Draw center (query)
        this.ctx.fillStyle = '#4a9eff';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
        this.ctx.fill();

        this.ctx.fillStyle = textColor;
        this.ctx.font = 'bold 14px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.currentMonad.query, centerX, centerY + 25);

        // Draw concepts at their projected 2D positions
        this.ctx.font = '11px sans-serif';

        for (const concept of this.currentMonad.concepts) {
            if (!concept.position2D) continue;

            // Use physics-updated position (no artificial drift needed)
            const pos = ProjectionEngine.toCanvasCoords(
                concept.position2D,
                centerX,
                centerY,
                radius * 0.9
            );

            // Check if this concept is hovered
            const isHovered = this.hoveredConcept === concept.term;

            // Visual distinction: opacity based on whether concept has notes
            const baseOpacity = concept.hasNotes ? 1.0 : 0.4;
            const opacity = isHovered ? 1.0 : baseOpacity;

            // Draw concept dot (color by similarity)
            const intensity = Math.floor(concept.similarity * 200 + 55);
            this.ctx.globalAlpha = opacity;

            // Glow effect on hover
            if (isHovered) {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = `rgb(${intensity}, 100, ${255 - intensity})`;
            }

            this.ctx.fillStyle = `rgb(${intensity}, 100, ${255 - intensity})`;
            this.ctx.beginPath();
            const dotSize = isHovered ? 7 : 4;  // Larger on hover
            this.ctx.arc(pos.x, pos.y, dotSize, 0, 2 * Math.PI);
            this.ctx.fill();

            // Reset shadow
            this.ctx.shadowBlur = 0;

            // Draw concept label (larger and bold on hover)
            this.ctx.fillStyle = textColor;
            this.ctx.font = isHovered ? 'bold 12px sans-serif' : '11px sans-serif';
            this.ctx.fillText(concept.term, pos.x, pos.y - 12);

            // Reset alpha and font
            this.ctx.globalAlpha = 1.0;
            this.ctx.font = '11px sans-serif';
        }
    }

    /**
     * Handle click on canvas (for concept navigation)
     */
    handleCanvasClick(e: MouseEvent) {
        if (!this.currentMonad) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) / 3;

        // Check if clicked near any concept
        for (const concept of this.currentMonad.concepts) {
            if (!concept.position2D) continue;

            const pos = ProjectionEngine.toCanvasCoords(
                concept.position2D,
                centerX,
                centerY,
                radius * 0.85
            );

            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);

            if (dist < 15) {  // Click threshold
                // Navigate to this concept
                this.searchInput.value = concept.term;
                this.handleSemanticSearch();
                break;
            }
        }
    }

    displayNotes() {
        this.notesList.empty();

        if (!this.currentMonad || this.currentMonad.notes.length === 0) {
            this.notesList.createEl('p', { text: 'No notes found', cls: 'empty-message' });
            return;
        }

        // Find the top match (likely the direct match if query matched a title)
        const topMatch = this.currentMonad.notes[0];
        const topFile = this.app.vault.getAbstractFileByPath(topMatch.path);

        // If top match has links, show them separately
        if (topFile instanceof TFile && topMatch.metadata.links.length > 0) {
            const linkedSection = this.notesList.createDiv('linked-notes-section');
            linkedSection.createEl('h3', { text: 'Linked Notes' });
            linkedSection.createEl('p', {
                text: `From: ${topFile.basename}`,
                cls: 'section-subtitle'
            });

            const linkedItems = linkedSection.createEl('ul', { cls: 'note-items' });

            for (const linkTitle of topMatch.metadata.links) {
                // Try to find the linked note in our results
                const linkedNote = this.currentMonad.notes.find(n =>
                    n.metadata.title.toLowerCase() === linkTitle.toLowerCase()
                );

                const item = linkedItems.createEl('li', { cls: 'note-item linked-note' });

                const link = item.createEl('a', {
                    text: linkTitle,
                    cls: 'note-link'
                });

                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Try to open the linked note
                    this.app.workspace.openLinkText(linkTitle, topMatch.path, false);
                });

                if (linkedNote) {
                    const score = item.createEl('span', {
                        text: `${(linkedNote.score * 100).toFixed(0)}%`,
                        cls: 'relevance-score'
                    });
                }
            }
        }

        // Show all notes by semantic similarity
        const semanticSection = this.notesList.createDiv('semantic-notes-section');
        semanticSection.createEl('h3', { text: 'Semantically Related Notes' });

        const noteItems = semanticSection.createEl('ul', { cls: 'note-items' });

        for (const note of this.currentMonad.notes) {
            const file = this.app.vault.getAbstractFileByPath(note.path);
            if (!(file instanceof TFile)) continue;

            const item = noteItems.createEl('li', { cls: 'note-item' });

            const link = item.createEl('a', {
                text: file.basename,
                cls: 'note-link'
            });

            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.app.workspace.openLinkText(file.path, '', false);
            });

            const score = item.createEl('span', {
                text: `${(note.score * 100).toFixed(0)}%`,
                cls: 'relevance-score'
            });
        }
    }

    displayConcepts() {
        this.conceptsList.empty();

        if (!this.currentMonad || this.currentMonad.concepts.length === 0) {
            this.conceptsList.createEl('p', { text: 'No concepts', cls: 'empty-message' });
            return;
        }

        const conceptItems = this.conceptsList.createEl('div', { cls: 'concept-items' });

        for (const concept of this.currentMonad.concepts) {
            // Show note indicator if concept has notes
            const noteIndicator = concept.hasNotes ? ` 📝${concept.noteCount}` : '';
            const opacity = concept.hasNotes ? '1.0' : '0.5';

            const tag = conceptItems.createEl('span', {
                text: `${concept.term} (${(concept.similarity * 100).toFixed(0)}%)${noteIndicator}`,
                cls: 'concept-tag clickable'
            });

            tag.style.opacity = opacity;

            tag.addEventListener('click', () => {
                // If concept has notes, show those specific notes
                if (concept.hasNotes) {
                    this.showNotesForConcept(concept.term);
                } else {
                    // Otherwise, search for the concept in latent space
                    this.searchInput.value = concept.term;
                    this.handleSemanticSearch();
                }
            });
        }
    }

    /**
     * Show only notes that match a specific concept
     */
    async showNotesForConcept(conceptTerm: string) {
        if (!this.currentMonad) return;

        const allRecords = await this.vectorIndex.getAllRecords();

        // Find notes that contain this concept in title or path
        const matchingNotes = allRecords.filter(record => {
            const title = record.metadata.title.toLowerCase();
            const path = record.id.toLowerCase();
            const term = conceptTerm.toLowerCase();

            return title.includes(term) || path.includes(term);
        });

        if (matchingNotes.length === 0) {
            new Notice(`No notes found for concept: ${conceptTerm}`);
            return;
        }

        // Clear and show only matching notes
        this.notesList.empty();

        const section = this.notesList.createDiv('concept-notes-section');
        section.createEl('h3', { text: `Notes for: ${conceptTerm}` });
        section.createEl('p', {
            text: `${matchingNotes.length} note(s) found`,
            cls: 'section-subtitle'
        });

        const noteItems = section.createEl('ul', { cls: 'note-items' });

        for (const record of matchingNotes) {
            const file = this.app.vault.getAbstractFileByPath(record.id);
            if (!(file instanceof TFile)) continue;

            const item = noteItems.createEl('li', { cls: 'note-item' });

            const link = item.createEl('a', {
                text: file.basename,
                cls: 'note-link'
            });

            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.app.workspace.openLinkText(file.path, '', false);
            });

            // Show path for context
            const pathSpan = item.createEl('span', {
                text: ` - ${record.id}`,
                cls: 'note-path'
            });
            pathSpan.style.fontSize = '11px';
            pathSpan.style.color = 'var(--text-muted)';
        }
    }

    updateBreadcrumb() {
        this.breadcrumbTrail.empty();

        this.breadcrumbTrail.createEl('span', { text: 'Semantic Space', cls: 'breadcrumb-vault' });

        if (this.currentMonad) {
            this.breadcrumbTrail.createEl('span', { text: ' > ', cls: 'breadcrumb-separator' });
            this.breadcrumbTrail.createEl('span', {
                text: this.currentMonad.query,
                cls: 'breadcrumb-topic'
            });
        }
    }

    async updateIndexStatus() {
        const stats = await this.vectorIndex.getStats();
        if (stats.indexedNotes === 0) {
            this.statusDiv.setText(`📊 Index: ${stats.indexedNotes} notes (Click "Index Vault" to start)`);
            this.statusDiv.style.color = 'var(--text-muted)';
        } else {
            this.statusDiv.setText(`📊 Index: ${stats.indexedNotes} notes`);
            this.statusDiv.style.color = 'var(--text-normal)';
        }
    }

    registerVaultListeners() {
        // Incremental indexing on file changes
        this.registerEvent(
            this.app.vault.on('modify', async (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    try {
                        await this.indexNote(file);
                    } catch (error) {
                        console.error('Failed to update index:', error);
                    }
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', async (file) => {
                if (file instanceof TFile) {
                    await this.vectorIndex.deleteNote(file.path);
                }
            })
        );
    }

    async onClose() {
        this.stopAnimation();
        this.vectorIndex.close();
    }
}
