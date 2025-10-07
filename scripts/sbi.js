import { MODULE_NAME } from "./sbiConfig.js";
import { registerSettings } from "./sbiConfig.js";
import { sbiUtils } from "./sbiUtils.js";
import { sbiWindow } from "./sbiWindow.js";
import { sbiParser } from "./sbiParser.js";

Hooks.on("init", () => {
    registerSettings();
    const parse = sbiParser.parseInput.bind(sbiParser);

    game.modules.get(MODULE_NAME).api = {
        parse,
        import: async (text, folderId) => {
            return await parse(text).actor?.createActor5e(folderId);
        }
    };
});

Hooks.on("renderActorDirectory", (app, html, data) => {
    html = html instanceof jQuery ? html.get(0) : html;
    let importButton = html.querySelector("#sbi-main-button");
    if (game.user.hasPermission("ACTOR_CREATE") && !importButton) {
        sbiUtils.log("Rendering SBI button");
        importButton = document.createElement("button");
        importButton.id = "sbi-main-button";
        importButton.setAttribute("type", "button")
        importButton.innerHTML = `<i class="fas fa-file-import"></i>Import Statblock`;
        importButton.addEventListener("click", () => {
            sbiUtils.log("SBI button clicked");
            sbiWindow.renderWindow();
        });
        html.querySelector(".directory-footer").appendChild(importButton);
    }
});