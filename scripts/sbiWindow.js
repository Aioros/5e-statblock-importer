import { sbiUtils } from "./sbiUtils.js";
import { sbiParser } from "./sbiParser.js";
import { MODULE_NAME, CompendiumOptionsMenu } from "./sbiConfig.js";
import { Blocks } from "./sbiData.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class sbiWindow extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options) {
        super(options);
        this.keyupParseTimeout = null;
        this.pauseAutoParse = false;
    }

    static DEFAULT_OPTIONS = {
        id: "sbi-window",
        position: { width: 800, height: 640 },
        classes: ["sbi-window"],
        window: {
            resizable: true,
            title: "5e Statblock Importer"
        },
        actions: {
            parse: sbiWindow.parse,
            reset: sbiWindow.reset,
            import: sbiWindow.import,
            compendiumOptions: sbiWindow.openCompendiumOptions,
        }
    };

    static PARTS = {
        form: {
            template: `modules/${MODULE_NAME}/templates/sbiWindow.hbs`
        }
    };

    static openCompendiumOptions() {
        const menu = new CompendiumOptionsMenu();
        menu.render(true);
    }

    static sbiInputWindowInstance = {};

    static async renderWindow() {
        sbiWindow.sbiInputWindowInstance = new sbiWindow();
        sbiWindow.sbiInputWindowInstance.render(true);
    }

    _onRender(context, options) {
        const input = document.getElementById("sbi-input");

        input.addEventListener("keydown", e => {
            const selectionRange = sbiUtils.getSelectionRange(input);

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

            sbiUtils.setSelectionRange(input, selectionRange);
            
            //override pressing enter in contenteditable
            if (e.key == "Enter") {
                //don't automatically put in divs
                e.preventDefault();
                e.stopPropagation();
                //insert newline
                sbiUtils.insertTextAtSelection("\n");
            }
            input.dispatchEvent(new Event("input"));
        });

        input.addEventListener("paste", e => {
            //cancel paste
            e.preventDefault();
            //get plaintext from clipboard
            let text = (e.originalEvent || e).clipboardData.getData("text/plain");
            //remove unicode format control characters
            text = text.replace(/\p{Cf}/gu, "");
            //insert text manually
            sbiUtils.insertTextAtSelection(text);
        });

        const folderSelect = document.getElementById("sbi-import-select");

        // Add a default option.
        folderSelect.add(new Option("None", ""));

        const actorFolders = [...game.folders]
            .filter(f => f.type === "Actor")
            .map(f => ({ "name": f.name, "id": f._id }));

        // Add the available folders.
        for (const folder of actorFolders) {
            folderSelect.add(new Option(folder.name, folder.id));
        }

        ["blur", "input", "paste"].forEach(eventType => {
            input.addEventListener(eventType, (e) => {
                if (document.getElementById("sbi-import-autoparse").checked && !this.pauseAutoParse) {
                    if (this.keyupParseTimeout) clearTimeout(this.keyupParseTimeout);
                    this.keyupParseTimeout = setTimeout(sbiWindow.parse, e.type == "input" ? 1000 : 0);
                }
            });
        });

        sbiUtils.log("Listeners activated");
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
        sbiWindow.sbiInputWindowInstance.pauseAutoParse = true;

        const lineText = lineElement.innerText;
        const content = `<q class="line-text">${lineText}</q>` + sbiWindow.getBlockSelectInputGroup(lineElement.getAttribute("data-hint"));

        foundry.applications.api.DialogV2.prompt({
            window: { title: "Line Hint" },
            position: { width: 400 },
            classes: ["sbi-dialog"],
            modal: true,
            rejectClose: false,
            content,
            ok: {
                callback: (event, button, dialog) => new FormDataExtended(button.form).object
            }
        }).then(hint => {
            if (hint) {
                hint = hint.hint;
                sbiWindow.sbiInputWindowInstance.pauseAutoParse = false;
                if (!hint) {
                    lineElement.removeAttribute("data-hint");
                    lineElement.querySelector(".hint").remove?.();
                } else {
                    lineElement.setAttribute("data-hint", hint);
                    lineElement.querySelector(".hint")?.setAttribute("data-block-id", hint);
                    lineElement.querySelector(".hint")?.setAttribute("data-block-name", Blocks[hint].name);
                }
                sbiWindow.parse();
            }
        });
    }

    static parse() {
        const input = document.getElementById("sbi-input");

        if (!input.innerText.trim().length) return;

        const hints = [...input.querySelectorAll("[data-hint]")].map(l => ({text: l.innerText, blockId: l.getAttribute("data-hint")}));

        try {
            const { actor, statBlocks, unknownLines, lines } = sbiParser.parseInput(input.innerText, hints);
            //console.log(actor, statBlocks);

            if (!statBlocks.size) {
                sbiUtils.error("Unable to parse statblock");
                return {};
            }

            if (unknownLines.length) {
                sbiUtils.warn("Found unaccounted for lines", /*true,*/ unknownLines);
            }

            sbiUtils.log("Parsing completed", /*true,*/ statBlocks, actor);
            
            // Each line will be its own div, with data attributes indicating their block
            let divLines = lines.map((line, i) => {
                const block = [...statBlocks.entries()].find(e => e[1].some(l => l.lineNumber == i))?.[0];
                const spanLine = document.createElement("span");

                const hint = statBlocks.get(block)?.find(l => l.lineNumber == i).hint;

                // If the line has matched data, we also surround each matched part with a span
                const matchData = statBlocks.get(block)?.find(l => l.lineNumber == i).matchData || [];
                matchData.sort((a, b) => a.indices[0] - b.indices[0]);

                let encompassingEndDoneIndex = -1;
                for (let md = matchData.length - 1; md >= 0; md--) {
                    const spanStart = matchData[md].indices[0];
                    const spanEnd = matchData[md].indices[1];

                    // We check if this match is inside a "previous" one, like "1st level (4 slots)" where the number of slots is inside the spell group name.
                    // We only manage one level of nesting, it should be enough.
                    const parentSpanIndex = matchData.slice(0, md).findIndex(m => m.indices[1] > spanEnd);
                    if (parentSpanIndex !== -1 && parentSpanIndex !== encompassingEndDoneIndex) {
                        // The "previous" span encompasses this one, and we didn't already process that, so we insert the parent span end first and mark it as done
                        line = [line.slice(0, matchData[parentSpanIndex].indices[1]), "</span>", line.slice(matchData[parentSpanIndex].indices[1])].join("");
                        encompassingEndDoneIndex = parentSpanIndex;
                    }

                    // We only add the span end if it's not been done already
                    if (encompassingEndDoneIndex !== md) {
                        line = [line.slice(0, spanEnd), "</span>", line.slice(spanEnd)].join("");
                    }

                    line = [
                        line.slice(0, spanStart),
                        `<span class="matched" data-tooltip="${Blocks[block].name + ": " + sbiUtils.camelToTitleUpperIfTwoLetters(matchData[md].label)}">`,
                        line.slice(spanStart)
                    ].join("").trim();
                }
                
                spanLine.innerHTML = line;

                const divLine = document.createElement("div");
                divLine.classList.add("line-container");
                divLine.setAttribute("data-line", i);
                divLine.setAttribute("data-block-id", block);
                divLine.setAttribute("draggable", true);
                divLine.appendChild(spanLine);
                divLine.addEventListener("contextmenu", (evt) => {
                    sbiWindow.hintDialog(evt.target.closest(".line-container"));
                });

                if (hint) {
                    divLine.setAttribute("data-hint", hint);
                    const hintSpan = document.createElement("span");
                    hintSpan.classList.add("hint");
                    hintSpan.setAttribute("data-block-id", hint);
                    hintSpan.setAttribute("data-block-name", Blocks[hint].name);
                    hintSpan.addEventListener("click", (evt) => {
                        sbiWindow.hintDialog(evt.target.closest("[data-hint]"));
                    });
                    divLine.appendChild(hintSpan);
                }

                return divLine;
            });

            // Insert the span lines, with headers for each block
            const scrollTop = input.scrollTop;

            const nameSpanLine = `<span>${actor.name}</span>`;
            input.innerHTML = `<div class="block-container" data-block-id="name" data-block-name="Name"><div class="line-container" data-line="-1" data-block-id="name">${nameSpanLine}</div></div>`;

            let previousBlock = "";
            let blockContainer;
            divLines.forEach(l => {
                if (l.getAttribute("data-block-id") != previousBlock) {
                    if (blockContainer) {
                        input.appendChild(blockContainer);
                    }
                    blockContainer = document.createElement("div");
                    blockContainer.classList.add("block-container");
                    blockContainer.setAttribute("data-block-id", l.getAttribute("data-block-id"));
                    blockContainer.setAttribute("data-block-name", Blocks[l.getAttribute("data-block-id")]?.name || "???");
                    previousBlock = l.getAttribute("data-block-id");
                }
                blockContainer.appendChild(l);
            });
            input.appendChild(blockContainer);

            input.querySelectorAll(".line-container").forEach(c => {
                c.addEventListener("dragstart", (evt) => {
                    const lineNumber = evt.target.getAttribute("data-line");
                    evt.dataTransfer.setData("text/plain", lineNumber);
                    evt.dataTransfer.effectAllowed = "move";
                });
                c.addEventListener("dragend", (evt) => {
                    blockContainers.forEach(c => { c.classList.remove("drag-over"); });
                });
            });
            const blockContainers = input.querySelectorAll(".block-container");
            blockContainers.forEach(c => {
                c.addEventListener("dragover", (evt) => {
                    evt.preventDefault();
                    evt.dataTransfer.dropEffect = "move";
                    blockContainers.forEach(c => { c.classList.remove("drag-over"); });
                    evt.target.closest(".block-container").classList.add("drag-over");
                });
                c.addEventListener("drop", (evt) => {
                    evt.preventDefault();
                    const lineNumber = evt.dataTransfer.getData("text/plain");
                    const originalBlockId = input.querySelector(`.line-container[data-line="${lineNumber}"]`).getAttribute("data-block-id");
                    const blockId = evt.target.closest(".block-container").getAttribute("data-block-id");
                    if (blockId !== originalBlockId) {
                        input.querySelector(`.line-container[data-line="${lineNumber}"]`).setAttribute("data-hint", blockId);
                        if (document.getElementById("sbi-import-autoparse").checked) {
                            sbiWindow.parse();
                        }
                    }
                });
            });

            input.scrollTop = scrollTop;

            return { actor, statBlocks };
            
        } catch (error) {
            sbiUtils.error("An error has occured (" + error.stack.split("\n", 1).join("") + "). Please report it using the module link so it can get fixed.", error);
        }
    }

    static reset() {
        document.getElementById("sbi-input").innerHTML = "";
        document.getElementById("sbi-issues").innerHTML = "";
    }

    static async import() {
        sbiUtils.log("Clicked import button");
        const folderSelect = document.getElementById("sbi-import-select");
        const selectedFolderId = folderSelect.options[folderSelect.selectedIndex].value ?? undefined;
        const parseResult = sbiWindow.parse();
        if (parseResult?.actor) {
            try {
                const { actor5e, importIssues } = await parseResult.actor.createActor5e(selectedFolderId);
                document.querySelectorAll(".sbi-issue").forEach(i => i.remove());
                sbiWindow.processIssues(importIssues);
                // Open the sheet.
                actor5e.sheet.render(true);
            } catch (error) {
                sbiUtils.error("An error has occured (" + error.stack.split("\n", 1).join("") + "). Please report it using the module link so it can get fixed.", error);
            }
        }
    }

    static addIssueMessage(content) {
        const issueElement = document.createElement("div");
        issueElement.classList.add("sbi-issue");
        issueElement.innerHTML = content;
        document.getElementById("sbi-issues").appendChild(issueElement);
        sbiUtils.warn(issueElement.innerText);
    }

    static processIssues(issues) {
        let message;
        if (issues.missingSpells?.length) {
            message = "Some spells could not be found in your compendiums and have been created as placeholders: " + issues.missingSpells.join(", ");
            this.addIssueMessage(message);
        }
        if (issues.obsoleteSpells?.length) {
            message = `Some spells have been imported from 2014 sources while you are playing with 2024 rules, review your <a data-action="compendiumOptions">Compendium Options</a>: ` + issues.obsoleteSpells.join(", ");
            this.addIssueMessage(message);
        }
        if (issues.crNotFound) {
            message = "Could not find CR information. Some calculated attack information could be wrong.";
            this.addIssueMessage(message);
        }
        
    }

}
