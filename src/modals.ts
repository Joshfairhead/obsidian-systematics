import { App, Modal, Setting } from 'obsidian';

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

export class FileSuggestModal extends Modal {
    files: string[];
    onSubmit: (result: string) => void;
    title: string;
    currentValue: string;

    constructor(
        app: App,
        title: string,
        files: string[],
        currentValue: string,
        onSubmit: (result: string) => void
    ) {
        super(app);
        this.title = title;
        this.files = files;
        this.currentValue = currentValue;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: this.title });

        let selectedFile = this.currentValue;

        new Setting(contentEl)
            .setName("Note path")
            .setDesc("Enter the path to the note (e.g., folder/note.md)")
            .addText((text) =>
                text
                    .setValue(this.currentValue)
                    .setPlaceholder("folder/note.md")
                    .onChange((value) => {
                        selectedFile = value;
                    })
            );

        // Show available files
        const fileListEl = contentEl.createDiv({ cls: 'systematics-file-list' });
        fileListEl.createEl('h4', { text: 'Available notes:' });

        const listEl = fileListEl.createEl('ul', { cls: 'systematics-file-items' });
        this.files.slice(0, 20).forEach(file => {
            const itemEl = listEl.createEl('li');
            itemEl.createEl('a', {
                text: file,
                cls: 'systematics-file-item'
            });
            itemEl.addEventListener('click', () => {
                selectedFile = file;
                this.close();
                this.onSubmit(selectedFile);
            });
        });

        if (this.files.length > 20) {
            fileListEl.createEl('p', {
                text: `...and ${this.files.length - 20} more`,
                cls: 'systematics-file-more'
            });
        }

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Submit")
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onSubmit(selectedFile);
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
