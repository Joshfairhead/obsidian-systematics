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

        const inputRow = searchSection.createDiv('input-row');

        this.searchInput = inputRow.createEl('input', {
            type: 'text',
            placeholder: 'Enter topic (e.g., holochain, AI, blockchain)...'
        });

        const searchButton = inputRow.createEl('button', { text: 'Search' });
        searchButton.addEventListener('click', () => this.handleSearch());

        const deriveButton = inputRow.createEl('button', {
            text: 'Derive from Open Notes',
            cls: 'derive-topic-button'
        });
        deriveButton.addEventListener('click', () => this.handleDeriveTopic());

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
            // Maintain square aspect ratio to keep circle circular
            const size = Math.min(parent.clientWidth, 400);
            this.canvas.width = size;
            this.canvas.height = size;
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
     * Auto-derive topic from currently open notes
     * Uses TF-IDF to find the most distinctive term across open notes
     */
    async handleDeriveTopic() {
        const { workspace, vault } = this.app;

        // Get all currently open markdown files
        const openFiles: TFile[] = [];
        workspace.iterateAllLeaves(leaf => {
            const view = leaf.view;
            if (view.getViewType() === 'markdown') {
                const file = (view as any).file;
                if (file instanceof TFile) {
                    openFiles.push(file);
                }
            }
        });

        if (openFiles.length === 0) {
            new Notice('No notes are currently open. Please open some notes first.');
            return;
        }

        new Notice(`Analyzing ${openFiles.length} open note${openFiles.length === 1 ? '' : 's'}...`);

        try {
            // Extract terms from open notes
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
                'these', 'give', 'day', 'most', 'us'
            ]);

            // Calculate term frequency in open notes
            const termFreq: Map<string, number> = new Map();

            for (const file of openFiles) {
                const content = await vault.cachedRead(file);
                const words = this.extractWords(content, stopWords);

                for (const word of words) {
                    termFreq.set(word, (termFreq.get(word) || 0) + 1);
                }
            }

            // Calculate IDF from vault (sample for performance)
            const allFiles = vault.getMarkdownFiles();
            const sampleSize = Math.min(200, allFiles.length);
            const sampledFiles = this.sampleArray(allFiles, sampleSize);
            const docFreq: Map<string, number> = new Map();

            for (const file of sampledFiles) {
                const content = await vault.cachedRead(file);
                const words = new Set(this.extractWords(content, stopWords));

                for (const word of words) {
                    docFreq.set(word, (docFreq.get(word) || 0) + 1);
                }
            }

            // Calculate TF-IDF scores
            const tfidfScores: Map<string, number> = new Map();

            for (const [term, freq] of termFreq) {
                const tf = freq / openFiles.length;
                const df = docFreq.get(term) || 1;
                const idf = Math.log(sampleSize / df);
                const tfidf = tf * idf;

                tfidfScores.set(term, tfidf);
            }

            // Get top term as the derived topic
            const sortedTerms = Array.from(tfidfScores.entries())
                .sort((a, b) => b[1] - a[1]);

            if (sortedTerms.length === 0) {
                new Notice('Could not derive a topic from open notes');
                return;
            }

            const derivedTopic = sortedTerms[0][0];

            // Set the search input and trigger search
            this.searchInput.value = derivedTopic;
            new Notice(`Derived topic: "${derivedTopic}"`);

            // Auto-trigger search
            await this.handleSearch();

        } catch (error) {
            new Notice('Error deriving topic: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Define a monad based on search query
     * Enhanced algorithm with better relevance scoring:
     * 1. Find all notes matching the topic (in title or content)
     * 2. Score by multiple factors: exact match, frequency, position, headers
     * 3. Return all matching notes with normalized scores
     */
    async defineMonad(query: string): Promise<Monad> {
        const { vault } = this.app;

        // Find all matching files
        const files = vault.getMarkdownFiles();
        const relevanceMap = new Map<string, number>();

        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

        // Search in file names and content
        for (const file of files) {
            const basename = file.basename.toLowerCase();
            const path = file.path.toLowerCase();

            let score = 0;

            // 1. Title matching (highest weight)
            if (basename === queryLower) {
                score = 100; // Exact title match
            } else if (basename.includes(queryLower)) {
                score = 80; // Partial title match
            } else if (queryTerms.some(term => basename.includes(term))) {
                score = 60; // Individual term in title
            }

            // 2. Path matching
            if (score < 60 && path.includes(queryLower)) {
                score = 50; // Path contains query
            }

            // 3. Content matching (with frequency and position weighting)
            const content = await vault.cachedRead(file);
            const contentLower = content.toLowerCase();

            if (contentLower.includes(queryLower)) {
                // Count occurrences
                const occurrences = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;

                // Check if in headers (lines starting with #)
                const lines = content.split('\n');
                let headerMatches = 0;
                let firstParagraphMatch = false;

                for (let i = 0; i < Math.min(lines.length, 20); i++) {
                    const line = lines[i];
                    if (line.toLowerCase().includes(queryLower)) {
                        if (line.trim().startsWith('#')) {
                            headerMatches++;
                        }
                        if (i < 5) {
                            firstParagraphMatch = true;
                        }
                    }
                }

                // Calculate content score
                let contentScore = 30; // Base content match
                contentScore += Math.min(occurrences * 5, 30); // Up to +30 for frequency
                contentScore += headerMatches * 15; // +15 per header match
                contentScore += firstParagraphMatch ? 10 : 0; // +10 if in first paragraph

                score = Math.max(score, contentScore);
            }

            if (score > 0) {
                // Normalize score to 0-1 range
                relevanceMap.set(file.path, Math.min(score / 100, 1.0));
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
     * Uses TF-IDF scoring to find most RELEVANT terms (not just most frequent)
     */
    async extractConcepts(monad: Monad): Promise<string[]> {
        const { vault } = this.app;

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
            'had', 'were', 'said', 'did', 'having', 'may', 'should', 'am', 'being',
            'here', 'more', 'much', 'such', 'very', 'each', 'between', 'through',
            'during', 'before', 'under', 'again', 'further', 'where', 'both', 'few',
            'doing', 'same', 'once', 'since', 'until', 'while', 'does', 'done'
        ]);

        // Step 1: Calculate term frequency in monad notes
        const monadTermFreq: Map<string, number> = new Map();
        const monadNoteCount = monad.contentInScope.size;

        for (const [notePath, _score] of monad.contentInScope) {
            const file = vault.getAbstractFileByPath(notePath);
            if (!(file instanceof TFile)) continue;

            const content = await vault.cachedRead(file);
            const words = this.extractWords(content, stopWords);

            for (const word of words) {
                monadTermFreq.set(word, (monadTermFreq.get(word) || 0) + 1);
            }
        }

        // Step 2: Calculate document frequency across entire vault for IDF
        const allFiles = vault.getMarkdownFiles();
        const totalDocs = allFiles.length;
        const docFreq: Map<string, number> = new Map();

        // Sample up to 200 random files for IDF calculation (for performance)
        const sampleSize = Math.min(200, totalDocs);
        const sampledFiles = this.sampleArray(allFiles, sampleSize);

        for (const file of sampledFiles) {
            const content = await vault.cachedRead(file);
            const words = new Set(this.extractWords(content, stopWords));

            for (const word of words) {
                docFreq.set(word, (docFreq.get(word) || 0) + 1);
            }
        }

        // Step 3: Calculate TF-IDF scores
        const tfidfScores: Map<string, number> = new Map();

        for (const [term, freq] of monadTermFreq) {
            const tf = freq / monadNoteCount; // Term frequency in monad
            const df = docFreq.get(term) || 1;
            const idf = Math.log(sampleSize / df); // Inverse document frequency
            const tfidf = tf * idf;

            tfidfScores.set(term, tfidf);
        }

        // Step 4: Get top concepts by TF-IDF score
        const concepts = Array.from(tfidfScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([term, _score]) => term);

        return concepts;
    }

    /**
     * Extract words from content with filtering
     */
    private extractWords(content: string, stopWords: Set<string>): string[] {
        return content
            .toLowerCase()
            .replace(/[#*_`\[\]()]/g, ' ') // Remove markdown syntax
            .split(/\s+/)
            .filter(w => w.length > 3)
            .map(w => w.replace(/[^a-z0-9]/g, ''))
            .filter(w => {
                // Filter out stopwords, pure numbers, and years
                if (w.length === 0 || stopWords.has(w)) return false;
                if (/^\d+$/.test(w)) return false; // Pure numbers (including years)
                if (w.length < 4) return false; // Too short
                return true;
            });
    }

    /**
     * Random sample from array
     */
    private sampleArray<T>(arr: T[], size: number): T[] {
        if (arr.length <= size) return arr;
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, size);
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

        // Draw concepts inside the circle in concentric rings
        if (this.currentConcepts.length > 0) {
            this.ctx.font = '11px sans-serif';

            // Distribute concepts in concentric rings inside the monad
            const rings = Math.ceil(this.currentConcepts.length / 6); // Max 6 concepts per ring
            let conceptIndex = 0;

            for (let ring = 0; ring < rings && conceptIndex < this.currentConcepts.length; ring++) {
                // Calculate radius for this ring (inside the monad, avoiding center text)
                const ringRadius = (radius * 0.4) + (ring * radius * 0.35 / Math.max(rings, 1));
                const conceptsInRing = Math.min(6, this.currentConcepts.length - conceptIndex);
                const angleStep = (2 * Math.PI) / conceptsInRing;

                for (let i = 0; i < conceptsInRing && conceptIndex < this.currentConcepts.length; i++, conceptIndex++) {
                    const angle = i * angleStep - Math.PI / 2; // Start at top
                    const x = centerX + ringRadius * Math.cos(angle);
                    const y = centerY + ringRadius * Math.sin(angle);

                    // Draw concept dot
                    this.ctx.fillStyle = '#9b59b6';
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
                    this.ctx.fill();

                    // Draw concept label next to dot (inside the circle)
                    this.ctx.fillStyle = '#555';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(this.currentConcepts[conceptIndex], x, y - 8);
                }
            }
        }
    }

    async onClose() {
        // Cleanup
    }
}
