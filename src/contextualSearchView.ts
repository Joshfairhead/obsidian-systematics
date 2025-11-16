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
    searchInput: HTMLInputElement;
    polarityList: HTMLElement;
    monadInfo: HTMLElement;
    breadcrumbTrail: HTMLElement;

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
        header.createEl('h2', { text: 'Systematic Contextual Search' });

        // Breadcrumb trail
        this.breadcrumbTrail = container.createDiv('breadcrumb-trail');
        this.updateBreadcrumb();

        // Search section
        const searchSection = container.createDiv('search-section');
        searchSection.createEl('label', { text: 'Define Monad:' });

        this.searchInput = searchSection.createEl('input', {
            type: 'text',
            placeholder: 'Enter note name or search query...'
        });

        const searchButton = searchSection.createEl('button', { text: 'Search' });
        searchButton.addEventListener('click', () => this.handleSearch());

        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // Monad info panel
        this.monadInfo = container.createDiv('monad-info');

        // Polarity discovery panel
        const polaritySection = container.createDiv('polarity-section');
        polaritySection.createEl('h3', { text: 'Discovered Polarities' });
        this.polarityList = polaritySection.createDiv('polarity-list');

        const manualButton = polaritySection.createEl('button', { text: 'Add Manual Pairing' });
        manualButton.addEventListener('click', () => this.handleManualPolarity());

        // Canvas for visualization
        this.canvas = container.createEl('canvas', {
            cls: 'contextual-search-canvas'
        });

        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }
        this.ctx = ctx;

        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Content inspector (initially hidden)
        const inspector = container.createDiv('content-inspector');
        inspector.style.display = 'none';
    }

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = 600;
            this.draw();
        }
    }

    async handleSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            new Notice('Please enter a search query');
            return;
        }

        new Notice('Defining monad...');

        try {
            // Define monad based on search query
            this.currentMonad = await this.defineMonad(query);

            // Update UI
            this.updateMonadInfo();
            this.updateBreadcrumb();

            // Discover polarities
            const polarities = await this.discoverPolarities(this.currentMonad);
            this.displayPolarities(polarities);

            // Draw visualization
            this.draw();

            new Notice(`Monad defined: ${this.currentMonad.noteCount} notes in scope`);
        } catch (error) {
            new Notice('Error defining monad: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Define a monad based on search query
     * Algorithm:
     * 1. Find central note(s) matching query
     * 2. Discover all linked notes (outbound + inbound links)
     * 3. Calculate relevance scores using simplified PageRank
     * 4. Apply fuzzy boundary threshold
     */
    async defineMonad(query: string): Promise<Monad> {
        const { vault, metadataCache } = this.app;

        // Step 1: Find central note(s)
        const files = vault.getMarkdownFiles();
        const matchingFiles = files.filter(file =>
            file.basename.toLowerCase().includes(query.toLowerCase()) ||
            file.path.toLowerCase().includes(query.toLowerCase())
        );

        if (matchingFiles.length === 0) {
            throw new Error(`No notes found matching "${query}"`);
        }

        // Use best match as center (for now, just first match)
        // TODO: Rank by relevance
        const centerFile = matchingFiles[0];

        // Step 2: Discover connected notes
        const connectedNotes = new Set<string>();
        connectedNotes.add(centerFile.path);

        // Get all links from center note
        const cache = metadataCache.getFileCache(centerFile);
        if (cache?.links) {
            for (const link of cache.links) {
                const linkedFile = metadataCache.getFirstLinkpathDest(link.link, centerFile.path);
                if (linkedFile) {
                    connectedNotes.add(linkedFile.path);
                }
            }
        }

        // Get backlinks to center note (find all files that link to this one)
        for (const file of files) {
            const cache = metadataCache.getFileCache(file);
            if (cache?.links) {
                for (const link of cache.links) {
                    const linkedFile = metadataCache.getFirstLinkpathDest(link.link, file.path);
                    if (linkedFile?.path === centerFile.path) {
                        connectedNotes.add(file.path);
                        break;
                    }
                }
            }
        }

        // Step 3: Calculate relevance scores
        // For MVP: Simple distance-based scoring
        // Center = 1.0, direct links = 0.7, backlinks = 0.7
        const relevanceMap = new Map<string, number>();
        relevanceMap.set(centerFile.path, 1.0);

        for (const notePath of connectedNotes) {
            if (notePath !== centerFile.path) {
                relevanceMap.set(notePath, 0.7);
            }
        }

        // Step 4: Apply threshold
        const threshold = 0.3;
        const inScope = new Map<string, number>();
        let count = 0;

        for (const [path, score] of relevanceMap) {
            if (score >= threshold) {
                inScope.set(path, score);
                count++;
            }
        }

        // Create monad
        const monad: Monad = {
            id: Date.now().toString(),
            name: centerFile.basename,
            query: query,
            centerNote: centerFile.path,
            contentInScope: inScope,
            relevanceThreshold: threshold,
            parent: this.currentMonad || undefined,
            createdAt: new Date(),
            noteCount: count
        };

        return monad;
    }

    /**
     * Discover polarities within a monad
     * Algorithm:
     * 1. Extract terms from all notes in scope
     * 2. Find co-occurring term pairs (same-context)
     * 3. Find contrasting term pairs (cross-context)
     * 4. Rank by frequency and relevance
     */
    async discoverPolarities(monad: Monad): Promise<Polarity[]> {
        const { vault } = this.app;

        // Step 1: Extract terms from notes
        const allTerms: Map<string, number> = new Map(); // term → frequency
        const termContexts: Map<string, string[]> = new Map(); // term → contexts (sentences)

        for (const [notePath, _score] of monad.contentInScope) {
            const file = vault.getAbstractFileByPath(notePath);
            if (!(file instanceof TFile)) continue;

            const content = await vault.cachedRead(file);

            // Extract terms (simple: split on whitespace, lowercase, filter short words)
            const words = content
                .toLowerCase()
                .split(/\s+/)
                .filter(w => w.length > 3)
                .map(w => w.replace(/[^a-z0-9]/g, ''));

            for (const word of words) {
                allTerms.set(word, (allTerms.get(word) || 0) + 1);
            }

            // Extract contexts (sentences containing terms)
            const sentences = content.split(/[.!?]+/);
            for (const sentence of sentences) {
                const sentenceLower = sentence.toLowerCase();
                for (const word of words) {
                    if (!termContexts.has(word)) {
                        termContexts.set(word, []);
                    }
                    if (sentenceLower.includes(word)) {
                        termContexts.get(word)!.push(sentence.trim());
                    }
                }
            }
        }

        // Step 2: Find co-occurring pairs (simple co-occurrence in same sentences)
        const pairs: Map<string, { termA: string; termB: string; cooccurrence: number }> = new Map();

        for (const [termA, contextsA] of termContexts) {
            for (const [termB, contextsB] of termContexts) {
                if (termA >= termB) continue; // Avoid duplicates and self-pairs

                // Count sentences where both terms appear
                let cooccurrence = 0;
                for (const ctx of contextsA) {
                    if (contextsB.some(cb => cb === ctx)) {
                        cooccurrence++;
                    }
                }

                if (cooccurrence > 0) {
                    const key = `${termA}|${termB}`;
                    pairs.set(key, { termA, termB, cooccurrence });
                }
            }
        }

        // Step 3: Rank pairs by co-occurrence
        const rankedPairs = Array.from(pairs.values())
            .sort((a, b) => b.cooccurrence - a.cooccurrence)
            .slice(0, 10); // Top 10 pairs

        // Step 4: Convert to Polarity objects
        const polarities: Polarity[] = rankedPairs.map(pair => {
            const poleA: ConceptualNode = {
                label: pair.termA,
                terms: [pair.termA],
                notes: this.getNotesContainingTerm(monad, pair.termA),
                relevance: (allTerms.get(pair.termA) || 0) / monad.noteCount
            };

            const poleB: ConceptualNode = {
                label: pair.termB,
                terms: [pair.termB],
                notes: this.getNotesContainingTerm(monad, pair.termB),
                relevance: (allTerms.get(pair.termB) || 0) / monad.noteCount
            };

            return {
                id: `${pair.termA}-${pair.termB}`,
                poleA,
                poleB,
                confidence: pair.cooccurrence / monad.noteCount,
                type: 'same-context',
                isManual: false
            };
        });

        return polarities;
    }

    getNotesContainingTerm(monad: Monad, term: string): string[] {
        // This would need async implementation in production
        // For now, return empty array as placeholder
        return [];
    }

    displayPolarities(polarities: Polarity[]) {
        this.polarityList.empty();

        if (polarities.length === 0) {
            this.polarityList.createEl('p', { text: 'No polarities discovered' });
            return;
        }

        for (const polarity of polarities) {
            const item = this.polarityList.createDiv('polarity-item');

            const label = item.createEl('label');
            const checkbox = label.createEl('input', { type: 'radio', attr: { name: 'polarity' } });
            label.appendText(`${polarity.poleA.label} / ${polarity.poleB.label} `);
            label.createEl('span', {
                text: `(${polarity.confidence.toFixed(2)})`,
                cls: 'confidence-score'
            });

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.handlePolaritySelect(polarity);
                }
            });
        }
    }

    handlePolaritySelect(polarity: Polarity) {
        if (!this.currentMonad) return;

        this.currentDyadView = {
            monad: this.currentMonad,
            selectedPolarity: polarity,
            alternativePolarities: []
        };

        this.draw();
        new Notice(`Visualizing: ${polarity.poleA.label} / ${polarity.poleB.label}`);
    }

    handleManualPolarity() {
        new Notice('Manual polarity creation not yet implemented');
        // TODO: Show modal to manually define poles
    }

    updateMonadInfo() {
        this.monadInfo.empty();

        if (!this.currentMonad) {
            this.monadInfo.createEl('p', { text: 'No monad defined' });
            return;
        }

        this.monadInfo.createEl('h3', { text: this.currentMonad.name });
        this.monadInfo.createEl('p', { text: `Scope: ${this.currentMonad.noteCount} notes` });
        this.monadInfo.createEl('p', { text: `Query: "${this.currentMonad.query}"` });
    }

    updateBreadcrumb() {
        this.breadcrumbTrail.empty();

        if (!this.currentMonad) {
            this.breadcrumbTrail.createEl('span', { text: 'Vault' });
            return;
        }

        // Build breadcrumb from parent chain
        const crumbs: Monad[] = [];
        let current: Monad | undefined = this.currentMonad;
        while (current) {
            crumbs.unshift(current);
            current = current.parent;
        }

        this.breadcrumbTrail.createEl('span', { text: 'Vault' });

        for (const monad of crumbs) {
            this.breadcrumbTrail.createEl('span', { text: ' > ' });
            const crumb = this.breadcrumbTrail.createEl('a', { text: monad.name });
            crumb.addEventListener('click', () => this.navigateToMonad(monad));
        }
    }

    navigateToMonad(monad: Monad) {
        this.currentMonad = monad;
        this.updateMonadInfo();
        this.updateBreadcrumb();
        this.draw();
    }

    /**
     * Draw the monad visualization
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
            this.ctx.fillText('Enter a search query to define a monad', width / 2, height / 2);
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

        // Draw monad label
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 18px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.currentMonad.name, centerX, centerY - radius - 20);

        // If dyad is selected, draw poles
        if (this.currentDyadView) {
            const polarity = this.currentDyadView.selectedPolarity;

            // Pole A (left)
            const poleAX = centerX - radius / 2;
            const poleAY = centerY;

            this.ctx.fillStyle = '#ff6b6b';
            this.ctx.beginPath();
            this.ctx.arc(poleAX, poleAY, 10, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.fillStyle = '#333';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(polarity.poleA.label, poleAX, poleAY - 20);
            this.ctx.fillText(`(${polarity.poleA.notes.length} notes)`, poleAX, poleAY + 30);

            // Pole B (right)
            const poleBX = centerX + radius / 2;
            const poleBY = centerY;

            this.ctx.fillStyle = '#51cf66';
            this.ctx.beginPath();
            this.ctx.arc(poleBX, poleBY, 10, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.fillStyle = '#333';
            this.ctx.fillText(polarity.poleB.label, poleBX, poleBY - 20);
            this.ctx.fillText(`(${polarity.poleB.notes.length} notes)`, poleBX, poleBY + 30);

            // Draw edge between poles
            this.ctx.strokeStyle = '#999';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(poleAX, poleAY);
            this.ctx.lineTo(poleBX, poleBY);
            this.ctx.stroke();
        }
    }

    async onClose() {
        // Cleanup
    }
}
