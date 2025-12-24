import { cbiUtils } from "./cbiUtils.js";
import { cbiParser } from "./cbiParser.js";
import { CBI_MODULE_NAME, CompendiumOptionsMenu } from "./cbiConfig.js";
import { Blocks } from "./cbiData.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class cbiWindow extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options) {
        super(options);
        this.keyupParseTimeout = null;
        this.pauseAutoParse = false;
    }

    static DEFAULT_OPTIONS = {
        id: "cbi-window",
        position: { width: 800, height: 640 },
        classes: ["cbi-window"],
        window: {
            resizable: true,
            title: "5e Class Importer"
        },
        actions: {
            parse: cbiWindow.parse,
            reset: cbiWindow.reset,
            import: cbiWindow.import,
            compendiumOptions: cbiWindow.openCompendiumOptions,
        }
    };

    static PARTS = {
        form: {
            template: `modules/5e-statblock-importer/templates/cbiWindow.hbs`
        }
    };

    static openCompendiumOptions() {
        const menu = new CompendiumOptionsMenu();
        menu.render(true);
    }

    static cbiInputWindowInstance = {};

    static async renderWindow() {
        cbiWindow.cbiInputWindowInstance = new cbiWindow();
        cbiWindow.cbiInputWindowInstance.render(true);
    }

    _onRender(context, options) {
        const input = document.getElementById("cbi-input");

        input.addEventListener("keydown", e => {
            const selectionRange = cbiUtils.getSelectionRange(input);

            input.querySelectorAll(".line-container > span").forEach(l => {
                const hint = l.closest(".line-container").getAttribute("data-hint");
                if (hint) {
                    l.setAttribute("data-hint", hint);
                }
                if (!l.classList.contains("hint")) {
                    input.appendChild(l);
                    input.innerHTML += "\n";
                }
            });
            input.querySelectorAll(".block-container").forEach(b => {
                input.removeChild(b);
            });

            cbiUtils.setSelectionRange(input, selectionRange);

            // Override pressing enter in contenteditable
            if (e.key == "Enter") {
                // Don't automatically put in divs
                e.preventDefault();
                e.stopPropagation();
                // Insert newline
                cbiUtils.insertTextAtSelection("\n");
            }
            input.dispatchEvent(new Event("input"));
        });

        input.addEventListener("paste", e => {
            // Cancel paste
            e.preventDefault();
            // Get plaintext from clipboard
            let text = (e.originalEvent || e).clipboardData.getData("text/plain");
            // Remove unicode format control characters
            text = text.replace(/\p{Cf}/gu, "");
            // Insert text manually
            cbiUtils.insertTextAtSelection(text);
        });

        const folderSelect = document.getElementById("cbi-import-select");

        // Add a default option
        folderSelect.add(new Option("None", ""));

        const itemFolders = [...game.folders]
            .filter(f => f.type === "Item")
            .map(f => ({ "name": f.name, "id": f._id }));

        // Add the available folders
        for (const folder of itemFolders) {
            folderSelect.add(new Option(folder.name, folder.id));
        }

        ["blur", "input", "paste"].forEach(eventType => {
            input.addEventListener(eventType, (e) => {
                if (document.getElementById("cbi-import-autoparse").checked && !this.pauseAutoParse) {
                    if (this.keyupParseTimeout) clearTimeout(this.keyupParseTimeout);
                    this.keyupParseTimeout = setTimeout(cbiWindow.parse, e.type == "input" ? 1000 : 0);
                }
            });
        });

        cbiUtils.log("Listeners activated");
    }

    static getBlockSelectInputGroup(selected) {
        const fields = foundry.applications.fields;

        const blockSelect = fields.createSelectInput({
            name: "hint",
            options: Object.values(Blocks),
            blank: "None",
            valueAttr: "id",
            labelAttr: "name",
            localize: false,
            value: selected
        });
        const blockGroup = fields.createFormGroup({
            input: blockSelect,
            label: "Hint Block",
            hint: "Select the block that this line should belong to."
        });
        const content = blockGroup.outerHTML;
        return content;
    }

    static hintDialog(lineElement) {
        cbiWindow.cbiInputWindowInstance.pauseAutoParse = true;

        const lineText = lineElement.innerText;
        const content = `<q class="line-text">${lineText}</q>` + cbiWindow.getBlockSelectInputGroup(lineElement.getAttribute("data-hint"));

        foundry.applications.api.DialogV2.prompt({
            window: { title: "Line Hint" },
            position: { width: 400 },
            classes: ["cbi-dialog"],
            modal: true,
            rejectClose: false,
            content,
            ok: {
                callback: (event, button, dialog) => new FormDataExtended(button.form).object
            }
        }).then(hint => {
            if (hint) {
                hint = hint.hint;
                cbiWindow.cbiInputWindowInstance.pauseAutoParse = false;
                if (!hint) {
                    lineElement.removeAttribute("data-hint");
                    lineElement.querySelector(".hint").remove?.();
                } else {
                    lineElement.setAttribute("data-hint", hint);
                    lineElement.querySelector(".hint")?.setAttribute("data-block-id", hint);
                    lineElement.querySelector(".hint")?.setAttribute("data-block-name", Blocks[hint].name);
                }
                cbiWindow.parse();
            }
        });
    }

    static parse() {
        const input = document.getElementById("cbi-input");

        if (!input.innerText.trim().length) return;

        const hints = [...input.querySelectorAll("[data-hint]")].map(l => ({text: l.innerText, blockId: l.getAttribute("data-hint")}));

        try {
            const parser = cbiParser.parseInput(input.innerText, hints);
            const { actor, classBlocks } = parser || {};

            if (!classBlocks || !classBlocks.size) {
                cbiUtils.error("Unable to parse class data");
                return {};
            }

            cbiUtils.log("Parsing completed", classBlocks, actor);

            // Create line display
            const lines = input.innerText.split("\n");
            let divLines = lines.map((line, i) => {
                const block = [...classBlocks.entries()].find(e => e[1].some(l => l.lineNumber == i))?.[0];
                const spanLine = document.createElement("span");
                spanLine.innerText = line;
                return { blockId: block, line: spanLine };
            });

            // Group lines by block
            const blocks = new Map();
            for (const divLine of divLines) {
                if (!blocks.has(divLine.blockId)) {
                    blocks.set(divLine.blockId, []);
                }
                blocks.get(divLine.blockId).push(divLine.line);
            }

            // Clear and rebuild input display
            input.innerHTML = "";

            for (const [blockId, lines] of blocks) {
                const blockContainer = document.createElement("div");
                blockContainer.classList.add("block-container");
                blockContainer.setAttribute("data-block-id", blockId);
                blockContainer.setAttribute("data-block-name", Blocks[blockId]?.name || "Unknown");

                for (let i = 0; i < lines.length; i++) {
                    const lineContainer = document.createElement("div");
                    lineContainer.classList.add("line-container");
                    lineContainer.setAttribute("data-line", i);

                    lineContainer.appendChild(lines[i]);
                    blockContainer.appendChild(lineContainer);
                }

                input.appendChild(blockContainer);
            }

            // Display any issues
            const issuesSection = document.getElementById("cbi-issues");
            issuesSection.innerHTML = "";

            if (actor.importIssues.missingSpells.length > 0) {
                const issueDiv = document.createElement("div");
                issueDiv.classList.add("cbi-issue");
                issueDiv.innerHTML = `<strong>Missing spells:</strong> ${actor.importIssues.missingSpells.join(", ")}`;
                issuesSection.appendChild(issueDiv);
            }

            return parser;
        } catch (error) {
            cbiUtils.error("Parse error: " + error.message);
            console.error(error);
            return {};
        }
    }

    static reset() {
        const input = document.getElementById("cbi-input");
        input.innerHTML = "";

        const issuesSection = document.getElementById("cbi-issues");
        issuesSection.innerHTML = "";

        cbiUtils.log("Input reset");
    }

    static async import() {
        const input = document.getElementById("cbi-input");
        const folderSelect = document.getElementById("cbi-import-select");
        const folderId = folderSelect.value || null;

        if (!input.innerText.trim().length) {
            cbiUtils.warn("No input to import");
            return;
        }

        try {
            const hints = [...input.querySelectorAll("[data-hint]")].map(l => ({text: l.innerText, blockId: l.getAttribute("data-hint")}));
            const parser = cbiParser.parseInput(input.innerText, hints);

            if (!parser || !parser.actor) {
                cbiUtils.error("Failed to parse class data");
                return;
            }

            const createdClass = await parser.actor.createClass5e(folderId);

            if (createdClass) {
                cbiUtils.log(`Class "${parser.actor.name}" imported successfully`);
                ui.notifications.info(`Class "${parser.actor.name}" created successfully`);
            }
        } catch (error) {
            cbiUtils.error("Import failed: " + error.message);
            console.error(error);
        }
    }
}
