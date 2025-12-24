import { CBI_MODULE_NAME } from "./cbiConfig.js";
import { registerSettings } from "./cbiConfig.js";
import { cbiUtils } from "./cbiUtils.js";
import { cbiWindow } from "./cbiWindow.js";
import { cbiParser } from "./cbiParser.js";

Hooks.on("init", () => {
    registerSettings();
    const parse = cbiParser.parseInput.bind(cbiParser);

    // Extend the existing module API
    const moduleApi = game.modules.get(CBI_MODULE_NAME).api || {};
    moduleApi.parseClass = parse;
    moduleApi.importClass = async (text, folderId) => {
        return await parse(text).actor?.createClass5e(folderId);
    };
    game.modules.get(CBI_MODULE_NAME).api = moduleApi;
});

Hooks.on("renderItemDirectory", (app, html, data) => {
    html = html instanceof jQuery ? html.get(0) : html;
    let importButton = html.querySelector("#cbi-main-button");
    if (game.user.hasPermission("ITEM_CREATE") && !importButton) {
        cbiUtils.log("Rendering CBI button");
        importButton = document.createElement("button");
        importButton.id = "cbi-main-button";
        importButton.setAttribute("type", "button")
        importButton.innerHTML = `<i class="fas fa-file-import"></i>Import Class`;
        importButton.addEventListener("click", () => {
            cbiUtils.log("CBI button clicked");
            cbiWindow.renderWindow();
        });
        html.querySelector(".directory-footer").appendChild(importButton);
    }
});
