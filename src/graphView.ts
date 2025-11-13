import { ItemView, WorkspaceLeaf, TFile, Menu } from 'obsidian';
import { GraphGeometry, Vertex } from './types';
import SystematicsPlugin from '../main';

export const VIEW_TYPE_SYSTEMATICS = "systematics-graph-view";

export class SystematicsGraphView extends ItemView {
    plugin: SystematicsPlugin;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    currentGraph: GraphGeometry;
    scale: number = 150;
    offsetX: number = 0;
    offsetY: number = 0;
    hoveredVertex: number | null = null;
    selectedVertex: number | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: SystematicsPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_SYSTEMATICS;
    }

    getDisplayText(): string {
        return "Systematics Graph";
    }

    getIcon(): string {
        return "git-fork";
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('systematics-view-container');

        // Create controls
        const controlsDiv = container.createDiv({ cls: 'systematics-controls' });

        // Graph selector
        const selectorLabel = controlsDiv.createEl('label', { text: 'Graph: ' });
        const selector = controlsDiv.createEl('select', { cls: 'dropdown' });

        for (let i = 3; i <= 12; i++) {
            const option = selector.createEl('option', {
                value: i.toString(),
                text: `K${i}`
            });
            if (i === this.plugin.settings.currentGraph) {
                option.selected = true;
            }
        }

        selector.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const graphOrder = parseInt(target.value);
            this.plugin.settings.currentGraph = graphOrder;
            this.plugin.saveSettings();
            this.loadGraph(graphOrder);
        });

        // Instructions
        const instructions = controlsDiv.createDiv({ cls: 'systematics-instructions' });
        instructions.createEl('p', {
            text: 'Click on a node to assign a label and link it to a note.'
        });

        // Canvas
        this.canvas = container.createEl('canvas', { cls: 'systematics-canvas' });
        this.ctx = this.canvas.getContext('2d')!;

        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Event listeners
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('click', this.onCanvasClick.bind(this));

        // Load initial graph
        this.loadGraph(this.plugin.settings.currentGraph);
    }

    resizeCanvas() {
        const container = this.containerEl.children[1];
        const rect = container.getBoundingClientRect();

        // Get the actual size we want
        const displayWidth = Math.max(rect.width - 40, 400);
        const displayHeight = Math.max(rect.height - 140, 400);

        // Account for device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;

        // Setting width/height resets the canvas, including transforms
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';

        // Get fresh context and scale it
        this.ctx = this.canvas.getContext('2d')!;
        this.ctx.scale(dpr, dpr);

        // Set offsets based on display size (not canvas size)
        this.offsetX = displayWidth / 2;
        this.offsetY = displayHeight / 2;

        // Adaptive scale based on canvas size with extra margin for labels
        const minDimension = Math.min(displayWidth, displayHeight);
        this.scale = (minDimension - 100) / 3; // More conservative scale for label space

        this.draw();
    }

    loadGraph(order: number) {
        const { GRAPHS } = require('./graphData');
        this.currentGraph = GRAPHS[order];
        this.draw();
    }

    draw() {
        if (!this.ctx || !this.currentGraph) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Get theme colors from CSS variables
        const edgeColor = this.getThemeColor('--text-muted') || '#888888';

        // Draw edges
        this.ctx.strokeStyle = edgeColor;
        this.ctx.lineWidth = 1.5;

        for (const edge of this.currentGraph.edges) {
            const from = this.currentGraph.vertices[edge.from];
            const to = this.currentGraph.vertices[edge.to];

            const fromX = this.offsetX + from.x * this.scale;
            const fromY = this.offsetY - from.y * this.scale; // Flip Y axis
            const toX = this.offsetX + to.x * this.scale;
            const toY = this.offsetY - to.y * this.scale;

            this.ctx.beginPath();
            this.ctx.moveTo(fromX, fromY);
            this.ctx.lineTo(toX, toY);
            this.ctx.stroke();
        }

        // Draw vertices
        for (let i = 0; i < this.currentGraph.vertices.length; i++) {
            const vertex = this.currentGraph.vertices[i];
            this.drawVertex(vertex, i === this.hoveredVertex, i === this.selectedVertex);
        }
    }

    getThemeColor(cssVar: string): string | null {
        const style = getComputedStyle(document.body);
        const color = style.getPropertyValue(cssVar).trim();
        return color || null;
    }

    drawVertex(vertex: Vertex, isHovered: boolean, isSelected: boolean) {
        const x = this.offsetX + vertex.x * this.scale;
        const y = this.offsetY - vertex.y * this.scale;
        const radius = isHovered ? 12 : 10;

        // Get custom label if exists
        const graphKey = `K${this.currentGraph.order}`;
        const customLabel = this.plugin.settings.nodeLabelSettings[graphKey]?.[vertex.index];
        const hasNote = customLabel && customLabel.noteFile;

        // Draw node circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI);

        // Better colors that work with both themes
        if (hasNote) {
            this.ctx.fillStyle = isSelected ? '#3b82f6' : '#60a5fa';
        } else {
            this.ctx.fillStyle = isSelected ? '#6b7280' : '#9ca3af';
        }

        this.ctx.fill();

        // Add stroke for better visibility
        if (isHovered || isSelected) {
            this.ctx.strokeStyle = this.getThemeColor('--interactive-accent') || '#3b82f6';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        } else {
            this.ctx.strokeStyle = this.getThemeColor('--background-modifier-border') || '#333333';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
        }

        // Draw label outside the graph with background for visibility
        const displayLabel = customLabel?.label || vertex.label;
        const lines = this.wrapText(displayLabel, 120);
        const lineHeight = 18;
        const startY = y + radius + 25; // Position text further from node

        this.ctx.font = isHovered ? 'bold 14px sans-serif' : '12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Draw text with background for better visibility
        lines.forEach((line, index) => {
            const textY = startY + (index * lineHeight);
            const metrics = this.ctx.measureText(line);
            const textWidth = metrics.width;
            const padding = 4;

            // Draw background rectangle
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.fillRect(
                x - textWidth / 2 - padding,
                textY - lineHeight / 2,
                textWidth + padding * 2,
                lineHeight
            );

            // Draw text in black
            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(line, x, textY);
        });
    }

    wrapText(text: string, maxWidth: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = this.ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    onMouseMove(event: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let foundVertex = null;

        for (let i = 0; i < this.currentGraph.vertices.length; i++) {
            const vertex = this.currentGraph.vertices[i];
            const x = this.offsetX + vertex.x * this.scale;
            const y = this.offsetY - vertex.y * this.scale;
            const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);

            if (distance <= 12) {
                foundVertex = i;
                break;
            }
        }

        if (foundVertex !== this.hoveredVertex) {
            this.hoveredVertex = foundVertex;
            this.canvas.style.cursor = foundVertex !== null ? 'pointer' : 'default';
            this.draw();
        }
    }

    onCanvasClick(event: MouseEvent) {
        if (this.hoveredVertex !== null) {
            this.selectedVertex = this.hoveredVertex;
            this.showNodeEditMenu(this.hoveredVertex, event);
            this.draw();
        }
    }

    showNodeEditMenu(vertexIndex: number, event: MouseEvent) {
        const vertex = this.currentGraph.vertices[vertexIndex];
        const graphKey = `K${this.currentGraph.order}`;
        const currentSettings = this.plugin.settings.nodeLabelSettings[graphKey]?.[vertexIndex];

        const menu = new Menu();

        menu.addItem((item) => {
            item
                .setTitle("Set label")
                .setIcon("tag")
                .onClick(async () => {
                    const newLabel = prompt(
                        `Enter label for node ${vertexIndex}:`,
                        currentSettings?.label || vertex.label
                    );

                    if (newLabel !== null) {
                        if (!this.plugin.settings.nodeLabelSettings[graphKey]) {
                            this.plugin.settings.nodeLabelSettings[graphKey] = {};
                        }
                        if (!this.plugin.settings.nodeLabelSettings[graphKey][vertexIndex]) {
                            this.plugin.settings.nodeLabelSettings[graphKey][vertexIndex] = {
                                label: vertex.label,
                                noteFile: ''
                            };
                        }
                        this.plugin.settings.nodeLabelSettings[graphKey][vertexIndex].label = newLabel;
                        await this.plugin.saveSettings();
                        this.draw();
                    }
                });
        });

        menu.addItem((item) => {
            item
                .setTitle("Link to note")
                .setIcon("link")
                .onClick(async () => {
                    const files = this.app.vault.getMarkdownFiles();
                    const fileNames = files.map(f => f.path);

                    const selectedFile = prompt(
                        `Enter note path to link (e.g., "folder/note.md"):\n\nAvailable notes:\n${fileNames.slice(0, 10).join('\n')}${fileNames.length > 10 ? '\n...' : ''}`,
                        currentSettings?.noteFile || ''
                    );

                    if (selectedFile !== null) {
                        if (!this.plugin.settings.nodeLabelSettings[graphKey]) {
                            this.plugin.settings.nodeLabelSettings[graphKey] = {};
                        }
                        if (!this.plugin.settings.nodeLabelSettings[graphKey][vertexIndex]) {
                            this.plugin.settings.nodeLabelSettings[graphKey][vertexIndex] = {
                                label: vertex.label,
                                noteFile: ''
                            };
                        }
                        this.plugin.settings.nodeLabelSettings[graphKey][vertexIndex].noteFile = selectedFile;
                        await this.plugin.saveSettings();
                        this.draw();
                    }
                });
        });

        if (currentSettings?.noteFile) {
            menu.addItem((item) => {
                item
                    .setTitle("Open linked note")
                    .setIcon("file-text")
                    .onClick(async () => {
                        const file = this.app.vault.getAbstractFileByPath(currentSettings.noteFile);
                        if (file instanceof TFile) {
                            await this.app.workspace.getLeaf(false).openFile(file);
                        }
                    });
            });
        }

        menu.showAtMouseEvent(event);
    }

    async onClose() {
        // Cleanup
    }
}
