/**
 * Semantic Monad View - Embedding-based knowledge exploration
 */

import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import SystematicsPlugin from '../main';
import { EmbeddingService } from './embeddingService';
import { VectorIndex } from './vectorIndex';
import { ProjectionEngine } from './projectionEngine';
import { SemanticMonad, Point2D, ConceptNode, ScoredNote } from './semanticTypes';

export const VIEW_TYPE_SEMANTIC_MONAD = 'systematics-semantic-monad';

export class SemanticMonadView extends ItemView {
    plugin: SystematicsPlugin;
    embeddingService: EmbeddingService;
    vectorIndex: VectorIndex;
    projectionEngine: ProjectionEngine;

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
        return 'Semantic Monad';
    }

    getIcon(): string {
        return 'brain-circuit';
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
        } catch (error) {
            new Notice('Failed to initialize semantic search: ' + error.message);
            console.error(error);
        }
    }

    createUI(container: Element) {
        // Header
        const header = container.createDiv('semantic-monad-header');
        header.createEl('h2', { text: 'Semantic Monad Explorer' });

        // Status and controls
        const controlsSection = container.createDiv('controls-section');

        this.statusDiv = controlsSection.createDiv('index-status');
        this.updateIndexStatus();

        this.indexButton = controlsSection.createEl('button', {
            text: 'Index Vault',
            cls: 'index-vault-button'
        });
        this.indexButton.addEventListener('click', () => this.indexVault());

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

        // Add click handler for canvas
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Concepts panel
        const conceptsPanel = leftColumn.createDiv('concepts-panel');
        conceptsPanel.createEl('h3', { text: 'Semantic Concepts' });
        this.conceptsList = conceptsPanel.createDiv('concepts-list');

        // Right column: Notes list
        const rightColumn = contentLayout.createDiv('right-column');

        const notesPanel = rightColumn.createDiv('notes-panel');
        notesPanel.createEl('h3', { text: 'Semantically Related Notes' });
        this.notesList = notesPanel.createDiv('notes-list');

        // Initialize canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        if (parent) {
            const parentWidth = parent.clientWidth || 400;
            const size = Math.min(Math.max(parentWidth - 40, 300), 600);

            this.canvas.width = size;
            this.canvas.height = size;
            this.canvas.style.width = size + 'px';
            this.canvas.style.height = size + 'px';

            this.draw();
        }
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
                const msg = `Failed to connect to embedding server: ${error.message}`;
                this.statusDiv.setText(msg);
                new Notice('Cannot connect to embedding server. Please ensure the Rust server is running on localhost:8765', 15000);
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
                const msg = `Indexed ${indexed} notes!` + (failed > 0 ? ` (${failed} failed)` : '');
                new Notice(msg);
                this.statusDiv.setText(`Index: ${indexed} notes` + (failed > 0 ? ` (${failed} errors)` : ''));
            } else {
                const msg = 'No notes were indexed - all failed. See errors above.';
                new Notice(msg, 10000);
                this.statusDiv.setText(msg);
            }

            await this.updateIndexStatus();

        } catch (error) {
            const msg = 'Indexing failed: ' + error.message;
            new Notice(msg, 10000);
            this.statusDiv.setText(msg);
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

        // Extract metadata
        const metadata = {
            title: file.basename,
            path: file.path,
            mtime: file.stat.mtime,
            tags: [], // Could extract from frontmatter
            links: []  // Could extract from content
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

            // Ensure server is connected
            if (!this.embeddingService.isReady()) {
                await this.embeddingService.initialize();
            }

            // Generate query embedding
            const queryEmbedding = await this.embeddingService.embed(query);

            // Find nearest notes
            const nearestNotes = await this.vectorIndex.findNearest(queryEmbedding, 50);

            if (nearestNotes.length === 0) {
                new Notice('No indexed notes found. Please index your vault first.');
                return;
            }

            // Extract concepts from top notes
            const concepts = await this.extractSemanticConcepts(nearestNotes.slice(0, 20));

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
     * Extract semantic concepts from notes
     */
    async extractSemanticConcepts(notes: ScoredNote[]): Promise<ConceptNode[]> {
        // Aggregate all words from notes
        const termFreq: Map<string, number> = new Map();

        for (const note of notes) {
            const file = this.app.vault.getAbstractFileByPath(note.path);
            if (!(file instanceof TFile)) continue;

            const content = await this.app.vault.cachedRead(file);
            const words = this.extractTerms(content);

            for (const word of words) {
                termFreq.set(word, (termFreq.get(word) || 0) + 1);
            }
        }

        // Get top terms
        const topTerms = Array.from(termFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([term]) => term);

        // Embed concepts
        const conceptEmbeddings = await this.embeddingService.embedBatch(topTerms);

        // Calculate similarity to query
        const concepts: ConceptNode[] = topTerms.map((term, i) => {
            const similarity = EmbeddingService.cosineSimilarity(
                this.currentMonad!.queryEmbedding,
                conceptEmbeddings[i]
            );

            return {
                term,
                embedding: conceptEmbeddings[i],
                similarity
            };
        });

        // Sort by similarity and return top 12
        concepts.sort((a, b) => b.similarity - a.similarity);
        return concepts.slice(0, 12);
    }

    /**
     * Extract meaningful terms from text
     */
    private extractTerms(content: string): string[] {
        const stopWords = new Set([
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
            'it', 'for', 'not', 'on', 'with', 'as', 'you', 'do', 'at'
        ]);

        return content
            .toLowerCase()
            .replace(/[#*_`\[\]()]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 4 && !stopWords.has(w) && !/^\d+$/.test(w))
            .map(w => w.replace(/[^a-z0-9]/g, ''));
    }

    /**
     * Project embeddings to 2D for visualization
     */
    async projectToVisualization(
        queryEmbedding: number[],
        concepts: ConceptNode[],
        topNotes: ScoredNote[]
    ): Promise<Point2D[]> {
        // Combine all embeddings
        const allEmbeddings = [
            queryEmbedding,
            ...concepts.map(c => c.embedding)
        ];

        const labels = [
            'query',
            ...concepts.map(c => c.term)
        ];

        // Project to 2D with query at center
        const { center, others } = await this.projectionEngine.projectWithCenter(
            queryEmbedding,
            concepts.map(c => c.embedding),
            concepts.map(c => c.term)
        );

        // Scale to fit within canvas
        const scaled = ProjectionEngine.scaleToRadius(others, 0.8);

        // Store positions for click detection
        this.conceptPositions.clear();
        scaled.forEach((point, i) => {
            concepts[i].position2D = point;
            this.conceptPositions.set(concepts[i].term, point);
        });

        return [center, ...scaled];
    }

    /**
     * Draw semantic visualization
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

            const pos = ProjectionEngine.toCanvasCoords(
                concept.position2D,
                centerX,
                centerY,
                radius * 0.85
            );

            // Draw concept dot (color by similarity)
            const intensity = Math.floor(concept.similarity * 200 + 55);
            this.ctx.fillStyle = `rgb(${intensity}, 100, ${255 - intensity})`;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
            this.ctx.fill();

            // Draw concept label
            this.ctx.fillStyle = textColor;
            this.ctx.fillText(concept.term, pos.x, pos.y - 10);
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

        const noteItems = this.notesList.createEl('ul', { cls: 'note-items' });

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
            const tag = conceptItems.createEl('span', {
                text: `${concept.term} (${(concept.similarity * 100).toFixed(0)}%)`,
                cls: 'concept-tag clickable'
            });

            tag.addEventListener('click', () => {
                this.searchInput.value = concept.term;
                this.handleSemanticSearch();
            });
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
        this.statusDiv.setText(`Index: ${stats.indexedNotes} notes`);
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
        this.vectorIndex.close();
    }
}
