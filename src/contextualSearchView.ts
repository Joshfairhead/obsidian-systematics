import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import SystematicsPlugin from '../main';
import { Monad, Polarity, ConceptualNode, DyadView } from './types';

export const VIEW_TYPE_CONTEXTUAL_SEARCH = 'systematics-contextual-search';

export class ContextualSearchView extends ItemView {
    plugin: SystematicsPlugin;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

    // State
    currentMonad: Monad | null = null;
    currentDyadView: DyadView | null = null;
    currentConcepts: string[] = [];
    searchInput: HTMLInputElement;
    monadInfo: HTMLElement;
    breadcrumbTrail: HTMLElement;
    notesList: HTMLElement;
    conceptsList: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: SystematicsPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_CONTEXTUAL_SEARCH;
    }

    getDisplayText(): string {
        return 'Contextual Search';
    }

    getIcon(): string {
        return 'search';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('systematics-contextual-search');

        // Create UI structure
        this.createUI(container);
    }

    createUI(container: Element) {
        // Header section
        const header = container.createDiv('contextual-search-header');
        header.createEl('h2', { text: 'Monad Explorer' });

        // Breadcrumb trail
        this.breadcrumbTrail = container.createDiv('breadcrumb-trail');
        this.updateBreadcrumb();

        // Search section
        const searchSection = container.createDiv('search-section');
        searchSection.createEl('label', { text: 'Specify Topic:' });

        this.searchInput = searchSection.createEl('input', {
            type: 'text',
            placeholder: 'Enter topic (e.g., holochain, AI, blockchain)...'
        });

        const searchButton = searchSection.createEl('button', { text: 'Search' });
        searchButton.addEventListener('click', () => this.handleSearch());

        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // Create two-column layout
        const contentLayout = container.createDiv('content-layout');

        // Left column: Canvas and concepts
        const leftColumn = contentLayout.createDiv('left-column');

        // Canvas for monad visualization
        this.canvas = leftColumn.createEl('canvas', {
            cls: 'contextual-search-canvas'
        });

        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }
        this.ctx = ctx;

        // Concepts panel (below canvas)
        const conceptsPanel = leftColumn.createDiv('concepts-panel');
        conceptsPanel.createEl('h3', { text: 'Key Concepts' });
        this.conceptsList = conceptsPanel.createDiv('concepts-list');

        // Right column: Monad info and notes list
        const rightColumn = contentLayout.createDiv('right-column');

        // Monad info panel
        this.monadInfo = rightColumn.createDiv('monad-info');

        // Notes list panel
        const notesPanel = rightColumn.createDiv('notes-panel');
        notesPanel.createEl('h3', { text: 'Related Notes' });
        this.notesList = notesPanel.createDiv('notes-list');

        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = 400;
            this.draw();
        }
    }

    async handleSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            new Notice('Please enter a topic');
            return;
        }

        new Notice('Searching vault...');

        try {
            // Define monad based on search query (simplified - no parent hierarchy)
            this.currentMonad = await this.defineMonad(query);

            // Update UI
            this.updateMonadInfo();
            this.updateBreadcrumb();
            this.displayNotes();

            // Extract and display concepts
            this.currentConcepts = await this.extractConcepts(this.currentMonad);
            this.displayConcepts(this.currentConcepts);

            // Draw visualization with concepts
            this.draw();

            new Notice(`Found ${this.currentMonad.noteCount} related notes`);
        } catch (error) {
            new Notice('Error searching: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Define a monad based on search query
     * Simplified algorithm:
     * 1. Find all notes matching the topic (in title or content)
     * 2. Score by relevance (exact match > partial match)
     * 3. Return all matching notes as the monad scope
     */
    async defineMonad(query: string): Promise<Monad> {
        const { vault } = this.app;

        // Find all matching files
        const files = vault.getMarkdownFiles();
        const relevanceMap = new Map<string, number>();

        // Search in file names and content
        for (const file of files) {
            const basename = file.basename.toLowerCase();
            const path = file.path.toLowerCase();
            const queryLower = query.toLowerCase();

            let score = 0;

            // Exact match in basename (highest score)
            if (basename === queryLower) {
                score = 1.0;
            }
            // Partial match in basename
            else if (basename.includes(queryLower)) {
                score = 0.8;
            }
            // Match in path
            else if (path.includes(queryLower)) {
                score = 0.6;
            }
            // Search in content
            else {
                const content = await vault.cachedRead(file);
                if (content.toLowerCase().includes(queryLower)) {
                    score = 0.5;
                }
            }

            if (score > 0) {
                relevanceMap.set(file.path, score);
            }
        }

        if (relevanceMap.size === 0) {
            throw new Error(`No notes found matching "${query}"`);
        }

        // Create monad (no parent hierarchy - always top-level from Vault)
        const monad: Monad = {
            id: Date.now().toString(),
            name: query,
            query: query,
            contentInScope: relevanceMap,
            relevanceThreshold: 0.0, // Include all matches
            parent: undefined, // Always top-level
            createdAt: new Date(),
            noteCount: relevanceMap.size
        };

        return monad;
    }

    /**
     * Extract key concepts from notes in the monad
     * Returns the most frequent meaningful terms
     */
    async extractConcepts(monad: Monad): Promise<string[]> {
        const { vault } = this.app;

        // Extract terms from notes
        const allTerms: Map<string, number> = new Map(); // term → frequency

        // Common words to filter out
        const stopWords = new Set([
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
            'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
            'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
            'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
            'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
            'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
            'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
            'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its',
            'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our',
            'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any',
            'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has',
            'had', 'were', 'said', 'did', 'having', 'may', 'should', 'am', 'being'
        ]);

        for (const [notePath, _score] of monad.contentInScope) {
            const file = vault.getAbstractFileByPath(notePath);
            if (!(file instanceof TFile)) continue;

            const content = await vault.cachedRead(file);

            // Extract terms (split on whitespace, lowercase, filter short/common words)
            const words = content
                .toLowerCase()
                .replace(/[#*_`\[\]()]/g, ' ') // Remove markdown syntax
                .split(/\s+/)
                .filter(w => w.length > 3)
                .map(w => w.replace(/[^a-z0-9]/g, ''))
                .filter(w => w.length > 0 && !stopWords.has(w));

            for (const word of words) {
                allTerms.set(word, (allTerms.get(word) || 0) + 1);
            }
        }

        // Get top concepts by frequency
        const concepts = Array.from(allTerms.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12) // Top 12 concepts
            .map(([term, _freq]) => term);

        return concepts;
    }

    /**
     * Display the list of notes in the monad
     */
    displayNotes() {
        this.notesList.empty();

        if (!this.currentMonad || this.currentMonad.contentInScope.size === 0) {
            this.notesList.createEl('p', { text: 'No notes found', cls: 'empty-message' });
            return;
        }

        // Sort notes by relevance score
        const sortedNotes = Array.from(this.currentMonad.contentInScope.entries())
            .sort((a, b) => b[1] - a[1]);

        const noteItems = this.notesList.createEl('ul', { cls: 'note-items' });

        for (const [notePath, score] of sortedNotes) {
            const file = this.app.vault.getAbstractFileByPath(notePath);
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

            // Add relevance indicator
            const relevance = item.createEl('span', {
                text: `${(score * 100).toFixed(0)}%`,
                cls: 'relevance-score'
            });
        }
    }

    /**
     * Display extracted concepts
     */
    displayConcepts(concepts: string[]) {
        this.conceptsList.empty();

        if (concepts.length === 0) {
            this.conceptsList.createEl('p', { text: 'No concepts extracted', cls: 'empty-message' });
            return;
        }

        const conceptItems = this.conceptsList.createEl('div', { cls: 'concept-items' });

        for (const concept of concepts) {
            conceptItems.createEl('span', {
                text: concept,
                cls: 'concept-tag'
            });
        }
    }

    updateMonadInfo() {
        this.monadInfo.empty();

        if (!this.currentMonad) {
            this.monadInfo.createEl('p', { text: 'Enter a topic to explore', cls: 'empty-message' });
            return;
        }

        this.monadInfo.createEl('h3', { text: this.currentMonad.name });
        this.monadInfo.createEl('p', {
            text: `${this.currentMonad.noteCount} note${this.currentMonad.noteCount === 1 ? '' : 's'} found`,
            cls: 'note-count'
        });
    }

    updateBreadcrumb() {
        this.breadcrumbTrail.empty();

        // Always show "Vault" first
        this.breadcrumbTrail.createEl('span', { text: 'Vault', cls: 'breadcrumb-vault' });

        // Add topic if monad is defined
        if (this.currentMonad) {
            this.breadcrumbTrail.createEl('span', { text: ' > ', cls: 'breadcrumb-separator' });
            this.breadcrumbTrail.createEl('span', {
                text: this.currentMonad.name,
                cls: 'breadcrumb-topic'
            });
        }
    }

    /**
     * Draw the monad visualization with concepts
     */
    draw() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        if (!this.currentMonad) {
            // Draw empty state
            this.ctx.fillStyle = '#888';
            this.ctx.font = '16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Enter a topic to begin exploring', width / 2, height / 2);
            return;
        }

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;

        // Draw monad boundary (circle)
        this.ctx.strokeStyle = '#4a9eff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.stroke();

        // Draw center dot
        this.ctx.fillStyle = '#4a9eff';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        this.ctx.fill();

        // Draw monad label at center
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.currentMonad.name, centerX, centerY + 25);

        // Draw concepts around the circle
        if (this.currentConcepts.length > 0) {
            const angleStep = (2 * Math.PI) / this.currentConcepts.length;
            this.ctx.font = '12px sans-serif';

            for (let i = 0; i < this.currentConcepts.length; i++) {
                const angle = i * angleStep - Math.PI / 2; // Start at top
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);

                // Draw concept dot
                this.ctx.fillStyle = '#9b59b6';
                this.ctx.beginPath();
                this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
                this.ctx.fill();

                // Draw concept label
                this.ctx.fillStyle = '#555';
                this.ctx.textAlign = 'center';

                // Position text outside the circle
                const labelX = centerX + (radius + 30) * Math.cos(angle);
                const labelY = centerY + (radius + 30) * Math.sin(angle);

                this.ctx.fillText(this.currentConcepts[i], labelX, labelY);
            }
        }
    }

    async onClose() {
        // Cleanup
    }
}
