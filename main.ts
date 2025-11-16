import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { SystematicsSettings } from './src/types';
import { SystematicsGraphView, VIEW_TYPE_SYSTEMATICS } from './src/graphView';
import { ContextualSearchView, VIEW_TYPE_CONTEXTUAL_SEARCH } from './src/contextualSearchView';

const DEFAULT_SETTINGS: SystematicsSettings = {
    currentGraph: 3,
    nodeLabelSettings: {}
};

export default class SystematicsPlugin extends Plugin {
    settings: SystematicsSettings;

    async onload() {
        await this.loadSettings();

        // Register the custom views
        this.registerView(
            VIEW_TYPE_SYSTEMATICS,
            (leaf) => new SystematicsGraphView(leaf, this)
        );

        this.registerView(
            VIEW_TYPE_CONTEXTUAL_SEARCH,
            (leaf) => new ContextualSearchView(leaf, this)
        );

        // Add ribbon icons
        this.addRibbonIcon('git-fork', 'Open Systematics Graph', () => {
            this.activateView();
        });

        this.addRibbonIcon('search', 'Open Contextual Search', () => {
            this.activateContextualSearch();
        });

        // Add commands to open the views
        this.addCommand({
            id: 'open-systematics-graph',
            name: 'Open Systematics Graph',
            callback: () => {
                this.activateView();
            }
        });

        this.addCommand({
            id: 'open-contextual-search',
            name: 'Open Contextual Search',
            callback: () => {
                this.activateContextualSearch();
            }
        });

        // Add settings tab
        this.addSettingTab(new SystematicsSettingTab(this.app, this));
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_SYSTEMATICS);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            await leaf?.setViewState({ type: VIEW_TYPE_SYSTEMATICS, active: true });
        }

        // Reveal the leaf in case it is in a collapsed sidebar
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async activateContextualSearch() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_CONTEXTUAL_SEARCH);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            await leaf?.setViewState({ type: VIEW_TYPE_CONTEXTUAL_SEARCH, active: true });
        }

        // Reveal the leaf in case it is in a collapsed sidebar
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    onunload() {
        // Cleanup
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SystematicsSettingTab extends PluginSettingTab {
    plugin: SystematicsPlugin;

    constructor(app: App, plugin: SystematicsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Systematics Plugin Settings' });

        new Setting(containerEl)
            .setName('Default Graph')
            .setDesc('Select which graph (K3-K12) to display by default')
            .addDropdown(dropdown => {
                for (let i = 3; i <= 12; i++) {
                    dropdown.addOption(i.toString(), `K${i}`);
                }
                dropdown.setValue(this.plugin.settings.currentGraph.toString());
                dropdown.onChange(async (value) => {
                    this.plugin.settings.currentGraph = parseInt(value);
                    await this.plugin.saveSettings();
                });
            });

        containerEl.createEl('h3', { text: 'About' });
        containerEl.createEl('p', {
            text: 'This plugin allows you to view and organize your notes using complete graph (Kn) visualizations. Click on nodes to label them and link them to your notes.'
        });

        containerEl.createEl('h3', { text: 'Usage' });
        const usageList = containerEl.createEl('ul');
        usageList.createEl('li', { text: 'Click the graph icon in the ribbon or use the command palette to open the Systematics Graph view' });
        usageList.createEl('li', { text: 'Select a graph type (K3-K12) from the dropdown' });
        usageList.createEl('li', { text: 'Click on any node to set a custom label and link it to a note' });
        usageList.createEl('li', { text: 'Nodes with linked notes will appear in blue' });
        usageList.createEl('li', { text: 'Click on a linked node and select "Open linked note" to navigate to that note' });
    }
}
