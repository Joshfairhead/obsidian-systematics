import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { SystematicsSettings } from './src/types';
import { SystematicsGraphView, VIEW_TYPE_SYSTEMATICS } from './src/graphView';
import { SemanticMonadView, VIEW_TYPE_SEMANTIC_MONAD } from './src/semanticMonadView';

const DEFAULT_SETTINGS: SystematicsSettings = {
    currentGraph: 3,
    nodeLabelSettings: {},

    // Latent Space Explorer defaults
    llmProvider: 'ollama',
    ollamaModel: 'llama2',
    ollamaEndpoint: 'http://localhost:11434',
    claudeApiKey: '',
    openaiApiKey: ''
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
            VIEW_TYPE_SEMANTIC_MONAD,
            (leaf) => new SemanticMonadView(leaf, this)
        );

        // Add ribbon icons
        this.addRibbonIcon('git-fork', 'Open Systematics Graph', () => {
            this.activateView();
        });

        this.addRibbonIcon('compass', 'Open Latent Space Explorer', () => {
            this.activateSemanticMonad();
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
            id: 'open-latent-space-explorer',
            name: 'Open Latent Space Explorer',
            callback: () => {
                this.activateSemanticMonad();
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

    async activateSemanticMonad() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_SEMANTIC_MONAD);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the main area (not sidebar)
            leaf = workspace.getLeaf(true);
            await leaf?.setViewState({ type: VIEW_TYPE_SEMANTIC_MONAD, active: true });
        }

        // Reveal the leaf
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

        // Systematics Graph Settings
        containerEl.createEl('h3', { text: 'Systematics Graph' });

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

        // Latent Space Explorer Settings
        containerEl.createEl('h3', { text: 'Latent Space Explorer' });

        new Setting(containerEl)
            .setName('LLM Provider')
            .setDesc('Choose which LLM to use for concept generation')
            .addDropdown(dropdown => {
                dropdown.addOption('ollama', 'Ollama (Local)');
                dropdown.addOption('claude', 'Claude (API)');
                dropdown.addOption('openai', 'OpenAI (API)');
                dropdown.setValue(this.plugin.settings.llmProvider);
                dropdown.onChange(async (value: 'ollama' | 'claude' | 'openai') => {
                    this.plugin.settings.llmProvider = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide relevant settings
                });
            });

        // Ollama Settings (show if ollama selected)
        if (this.plugin.settings.llmProvider === 'ollama') {
            new Setting(containerEl)
                .setName('Ollama Endpoint')
                .setDesc('Ollama server URL (default: http://localhost:11434)')
                .addText(text => text
                    .setPlaceholder('http://localhost:11434')
                    .setValue(this.plugin.settings.ollamaEndpoint)
                    .onChange(async (value) => {
                        this.plugin.settings.ollamaEndpoint = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Ollama Model')
                .setDesc('Model name (e.g., llama2, mistral, phi)')
                .addText(text => text
                    .setPlaceholder('llama2')
                    .setValue(this.plugin.settings.ollamaModel)
                    .onChange(async (value) => {
                        this.plugin.settings.ollamaModel = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Claude Settings (show if claude selected)
        if (this.plugin.settings.llmProvider === 'claude') {
            new Setting(containerEl)
                .setName('Claude API Key')
                .setDesc('Your Anthropic API key')
                .addText(text => text
                    .setPlaceholder('sk-ant-...')
                    .setValue(this.plugin.settings.claudeApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.claudeApiKey = value;
                        await this.plugin.saveSettings();
                    })
                    .inputEl.type = 'password');
        }

        // OpenAI Settings (show if openai selected)
        if (this.plugin.settings.llmProvider === 'openai') {
            new Setting(containerEl)
                .setName('OpenAI API Key')
                .setDesc('Your OpenAI API key')
                .addText(text => text
                    .setPlaceholder('sk-...')
                    .setValue(this.plugin.settings.openaiApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openaiApiKey = value;
                        await this.plugin.saveSettings();
                    })
                    .inputEl.type = 'password');
        }

        containerEl.createEl('h3', { text: 'About' });
        containerEl.createEl('p', {
            text: 'This plugin allows you to view and organize your notes using complete graph (Kn) visualizations and explore semantic latent space.'
        });

        containerEl.createEl('h3', { text: 'Usage' });
        const usageList = containerEl.createEl('ul');
        usageList.createEl('li', { text: 'Systematics Graph: Click the graph icon to visualize Kn graphs' });
        usageList.createEl('li', { text: 'Latent Space Explorer: Click the compass icon to explore semantic concepts' });
        usageList.createEl('li', { text: 'Configure your preferred LLM provider above for concept generation' });
    }
}
