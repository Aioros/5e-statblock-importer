import { cbiUtils as cUtils } from "./cbiUtils.js";
import { Blocks } from "./cbiData.js";
import { CBI_MODULE_NAME } from "./cbiConfig.js";

export class cbiActor {
    #dnd5e = {};

    constructor(name) {
        this.name = name;                           // string
        this.level = 1;                             // int
        this.hitDie = null;                         // string (e.g., "1d8")
        this.hitPoints = null;                      // RollData
        this.proficiencyBonus = null;               // int
        this.armorProficiencies = [];               // string[]
        this.weaponProficiencies = [];              // string[]
        this.toolProficiencies = [];                // string[]
        this.savingThrows = [];                     // string[] (ability shortcuts)
        this.skills = [];                           // string[] (skill shortcuts)
        this.equipment = [];                        // string[]
        this.classFeatures = [];                    // FeatureData[]
        this.subclass = null;                       // string
        this.subclassFeatures = [];                 // FeatureData[]
        this.spellcastingAbility = null;            // string
        this.spellSlots = null;                     // string or object
        this.cantrips = [];                         // string[]
        this.spells = [];                           // {name: string, level: int}[]
        this.multiclassing = null;                  // string
        this.otherInfo = null;                      // string
        this.importIssues = {
            missingSpells: [],
            missingFeatures: [],
        };
    }

    get actorData() {
        return this.#dnd5e;
    }

    async updateActorData() {
        this.setProficiencies();
        this.setSavingThrows();
        this.setSkills();
        await this.setFeatures();
        await this.setSpells();
        this.setOtherInfo();
    }

    set5eProperty(path, value) {
        return foundry.utils.setProperty(this.#dnd5e, path, value);
    }

    addItem(itemObject) {
        if (typeof this.#dnd5e.items === "undefined") {
            this.#dnd5e.items = [];
        }
        this.#dnd5e.items.push(itemObject);
    }

    enrichDescription(description) {
        let enrichedDescription = description;

        // Convert roll formulas to Foundry format
        enrichedDescription = enrichedDescription.replace(/(\d+d\d+(\s?\+\s?\d+)?)/gi, "[[/r $1]]");

        // Add enclosing paragraph if necessary
        if (!enrichedDescription.startsWith("<p>")) {
            enrichedDescription = "<p>" + enrichedDescription + "</p>";
        }

        return enrichedDescription;
    }

    setProficiencies() {
        // Set armor proficiencies
        if (this.armorProficiencies.length > 0) {
            this.set5eProperty("system.traits.armorProf.value", this.armorProficiencies.map(a => a.toLowerCase()));
        }

        // Set weapon proficiencies
        if (this.weaponProficiencies.length > 0) {
            this.set5eProperty("system.traits.weaponProf.value", this.weaponProficiencies.map(w => w.toLowerCase()));
        }

        // Set tool proficiencies
        if (this.toolProficiencies.length > 0) {
            this.set5eProperty("system.traits.toolProf.value", this.toolProficiencies.map(t => t.toLowerCase()));
        }
    }

    setSavingThrows() {
        if (this.savingThrows.length > 0) {
            for (const ability of this.savingThrows) {
                this.set5eProperty(`system.abilities.${ability}.proficient`, 1);
            }
        }
    }

    setSkills() {
        if (this.skills.length > 0) {
            for (const skill of this.skills) {
                this.set5eProperty(`system.skills.${skill}.proficient`, 1);
            }
        }
    }

    async setFeatures() {
        // Add class features
        for (const feature of this.classFeatures) {
            await this.createFeatureItem(feature);
        }

        // Add subclass features
        for (const feature of this.subclassFeatures) {
            await this.createFeatureItem(feature, true);
        }
    }

    async createFeatureItem(feature, isSubclass = false) {
        const itemData = {};
        itemData.name = cUtils.capitalizeAll(feature.name);
        itemData.type = "feat";

        const description = this.enrichDescription(feature.description);
        foundry.utils.setProperty(itemData, "system.description.value", description);

        // Set activation type for class features
        foundry.utils.setProperty(itemData, "system.activation.type", "special");

        // Set the feature requirement level
        if (feature.level) {
            foundry.utils.setProperty(itemData, "system.requirements", `${this.name} ${feature.level}`);
        }

        // Try to find matching image
        const matchingImage = await cUtils.getImgFromPackItemAsync(itemData.name.toLowerCase(), "feat");
        if (matchingImage) {
            itemData.img = matchingImage;
        }

        this.addItem(itemData);
    }

    async setSpells() {
        // Set spellcasting ability
        if (this.spellcastingAbility) {
            this.set5eProperty("system.spellcasting.ability", this.spellcastingAbility);
        }

        // Add cantrips
        for (const cantripName of this.cantrips) {
            await this.addSpellItem(cantripName, 0);
        }

        // Add spells
        for (const spellData of this.spells) {
            await this.addSpellItem(spellData.name, spellData.level);
        }
    }

    async addSpellItem(spellName, level) {
        const cleanName = spellName.trim();
        const spellItem = await cUtils.getItemFromPacksAsync(cleanName, "spell");

        if (spellItem) {
            this.addItem(spellItem);
        } else {
            cUtils.warn(`Spell "${cleanName}" not found in compendiums`);
            this.importIssues.missingSpells.push(cleanName);
        }
    }

    setOtherInfo() {
        if (this.otherInfo) {
            const enriched = this.enrichDescription(this.otherInfo);
            this.set5eProperty("system.description.value", enriched);
        }

        // Add class level info to biography
        let bio = "";
        if (this.level) {
            bio += `<p><strong>Level:</strong> ${this.level}</p>`;
        }
        if (this.hitDie) {
            bio += `<p><strong>Hit Die:</strong> ${this.hitDie}</p>`;
        }
        if (this.subclass) {
            bio += `<p><strong>Subclass:</strong> ${this.subclass}</p>`;
        }

        if (bio) {
            const currentBio = this.#dnd5e.system?.description?.value || "";
            this.set5eProperty("system.description.value", currentBio + bio);
        }
    }

    async createClass5e(folderId = null) {
        this.set5eProperty("name", this.name);
        this.set5eProperty("type", "class");

        // Set hit die
        if (this.hitDie) {
            this.set5eProperty("system.hitDice", this.hitDie);
        }

        await this.updateActorData();

        // Log the issues
        if (this.importIssues.missingSpells.length > 0) {
            cUtils.warn(`Missing spells: ${this.importIssues.missingSpells.join(", ")}`);
        }

        // Create the item
        const itemData = {
            name: this.name,
            type: "class",
            folder: folderId,
            system: this.#dnd5e.system || {},
            items: this.#dnd5e.items || []
        };

        cUtils.log("Creating class item", itemData);

        try {
            const createdItem = await Item.create(itemData);
            cUtils.log(`Class "${this.name}" created successfully`);
            return createdItem;
        } catch (error) {
            cUtils.error(`Failed to create class: ${error.message}`);
            throw error;
        }
    }
}
