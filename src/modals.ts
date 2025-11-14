import { App, Modal, Setting, SuggestModal, TFile } from 'obsidian';

export class TextInputModal extends Modal {
    result: string;
    onSubmit: (result: string) => void;
    title: string;
    placeholder: string;
    defaultValue: string;

    constructor(
        app: App,
        title: string,
        placeholder: string,
        defaultValue: string,
        onSubmit: (result: string) => void
    ) {
        super(app);
        this.title = title;
        this.placeholder = placeholder;
        this.defaultValue = defaultValue;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: this.title });

        new Setting(contentEl)
            .setName("Value")
            .addText((text) =>
                text
                    .setValue(this.defaultValue)
                    .setPlaceholder(this.placeholder)
                    .onChange((value) => {
                        this.result = value;
                    })
            );

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Submit")
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onSubmit(this.result || this.defaultValue);
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText("Cancel")
                    .onClick(() => {
                        this.close();
                    })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class FileSuggestModal extends SuggestModal<TFile> {
    onSubmit: (result: string) => void;
    files: TFile[];

    constructor(
        app: App,
        onSubmit: (result: string) => void
    ) {
        super(app);
        this.onSubmit = onSubmit;
        this.files = this.app.vault.getMarkdownFiles();
    }

    getSuggestions(query: string): TFile[] {
        const lowerQuery = query.toLowerCase();
        return this.files.filter(file =>
            file.path.toLowerCase().includes(lowerQuery)
        );
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        el.createEl("div", { text: file.path });
    }

    onChooseSuggestion(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSubmit(file.path);
    }
}
