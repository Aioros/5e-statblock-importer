import { cbiUtils as cUtils } from "./cbiUtils.js";
import { cbiRegex as cRegex } from "./cbiRegex.js";
import { cbiActor as cActor } from "./cbiActor.js";
import { Blocks, NameValueData, RollData, FeatureData, LevelData, SpellcastingData } from "./cbiData.js";

// Steps that the parser goes through:
//  - Break text into well defined class parts
//  - Create the Foundry data object from the parts

export class cbiParser {

    static actor;
    static classBlocks;

    static parseInput(text, hints = []) {
        const lines = cUtils.stripMarkdownAndCleanInput(text).split("\n");

        if (lines.length) {
            // Assume the first line is the class name.
            this.actor = new cActor(lines.shift().trim());

            // Go through each line and group them by block type
            this.classBlocks = new Map();
            let lastBlockId = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Ignore empty lines
                if (!line.length) {
                    continue;
                }

                // Ignore lines starting with an asterisk
                if (line.startsWith("*")) {
                    continue;
                }

                let match = null;

                // Check if there's a hint for this line
                const hint = hints.find(h => h.text.trim() === line);
                if (hint) {
                    match = Blocks[hint.blockId];
                } else {
                    // Try to match against known block patterns
                    match = cRegex.getFirstMatch(line);
                }

                // If we found a match, create a new block or add to existing
                if (match) {
                    lastBlockId = match.id;
                    if (!this.classBlocks.has(lastBlockId)) {
                        this.classBlocks.set(lastBlockId, []);
                    }
                }

                // Add line to the current block
                if (this.classBlocks.has(lastBlockId)) {
                    this.classBlocks.get(lastBlockId).push({lineNumber: i, line, ...(hint && {hint: hint.blockId})});
                }
            }

            // Process each block
            for (let [blockId, blockData] of this.classBlocks.entries()) {
                switch (blockId) {
                    case Blocks.level.id:
                        this.parseLevel(blockData);
                        break;
                    case Blocks.hitDie.id:
                        this.parseHitDie(blockData);
                        break;
                    case Blocks.hitPoints.id:
                        this.parseHitPoints(blockData);
                        break;
                    case Blocks.proficiencyBonus.id:
                        this.parseProficiencyBonus(blockData);
                        break;
                    case Blocks.armorProficiencies.id:
                        this.parseProficiencies(blockData, "armor");
                        break;
                    case Blocks.weaponProficiencies.id:
                        this.parseProficiencies(blockData, "weapon");
                        break;
                    case Blocks.toolProficiencies.id:
                        this.parseProficiencies(blockData, "tool");
                        break;
                    case Blocks.savingThrows.id:
                        this.parseSavingThrows(blockData);
                        break;
                    case Blocks.skills.id:
                        this.parseSkills(blockData);
                        break;
                    case Blocks.equipment.id:
                        this.parseEquipment(blockData);
                        break;
                    case Blocks.classFeatures.id:
                        this.parseFeatures(blockData, "class");
                        break;
                    case Blocks.subclass.id:
                        this.parseSubclass(blockData);
                        break;
                    case Blocks.subclassFeatures.id:
                        this.parseFeatures(blockData, "subclass");
                        break;
                    case Blocks.spellcasting.id:
                        this.parseSpellcasting(blockData);
                        break;
                    case Blocks.spellSlots.id:
                        this.parseSpellSlots(blockData);
                        break;
                    case Blocks.cantrips.id:
                        this.parseCantrips(blockData);
                        break;
                    case Blocks.spells.id:
                        this.parseSpells(blockData);
                        break;
                    case Blocks.multiclassing.id:
                        this.parseMulticlassing(blockData);
                        break;
                    case Blocks.otherBlock.id:
                        this.parseOther(blockData);
                        break;
                }
            }

            return this;
        }
    }

    static parseLevel(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        const match = text.match(cRegex.levelDetails);
        if (match) {
            this.actor.level = parseInt(match[1]);
        }
    }

    static parseHitDie(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        const match = text.match(cRegex.hitDieDetails);
        if (match) {
            this.actor.hitDie = match[1];
        }
    }

    static parseHitPoints(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        const match = text.match(cRegex.hitPointsDetails);
        if (match) {
            const value = parseInt(match[1]);
            const formula = match[2] || this.actor.hitDie;
            this.actor.hitPoints = new RollData(value, formula);
        }
    }

    static parseProficiencyBonus(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        const match = text.match(cRegex.proficiencyBonusDetails);
        if (match) {
            this.actor.proficiencyBonus = parseInt(match[1]);
        }
    }

    static parseProficiencies(blockData, type) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        // Remove the header part
        const cleaned = text.replace(/.+?:\s*/, '');
        const proficiencies = cleaned.split(/[,;]/).map(p => p.trim()).filter(p => p);

        if (type === "armor") {
            this.actor.armorProficiencies = proficiencies;
        } else if (type === "weapon") {
            this.actor.weaponProficiencies = proficiencies;
        } else if (type === "tool") {
            this.actor.toolProficiencies = proficiencies;
        }
    }

    static parseSavingThrows(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        const matches = text.matchAll(cRegex.abilityPattern);
        const abilities = [];
        for (const match of matches) {
            abilities.push(cUtils.convertToShortAbility(match[1]));
        }
        this.actor.savingThrows = [...new Set(abilities)]; // Remove duplicates
    }

    static parseSkills(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        const matches = text.matchAll(cRegex.skillPattern);
        const skills = [];
        for (const match of matches) {
            skills.push(cUtils.convertToShortSkill(match[1]));
        }
        this.actor.skills = [...new Set(skills)]; // Remove duplicates
    }

    static parseEquipment(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        // Remove the header
        const cleaned = text.replace(/.+?:\s*/, '');
        this.actor.equipment = cleaned.split(/[•\n]/).map(e => e.trim()).filter(e => e);
    }

    static parseFeatures(blockData, type) {
        const features = [];
        let currentFeature = null;

        for (const lineData of blockData) {
            const line = lineData.line;

            // Check if this line is a feature title
            const titleMatch = line.match(cRegex.featureTitle);
            if (titleMatch && cUtils.startsWithCapital(line)) {
                // Save the previous feature if any
                if (currentFeature) {
                    features.push(currentFeature);
                }

                // Start a new feature
                const name = titleMatch[1].trim();
                const level = titleMatch[2] ? parseInt(titleMatch[2]) : this.actor.level || 1;
                currentFeature = new FeatureData(name, level, "");
            } else if (currentFeature) {
                // Add to the current feature's description
                currentFeature.description += (currentFeature.description ? " " : "") + line;
            }
        }

        // Don't forget the last feature
        if (currentFeature) {
            features.push(currentFeature);
        }

        if (type === "class") {
            this.actor.classFeatures = features;
        } else if (type === "subclass") {
            this.actor.subclassFeatures = features;
        }
    }

    static parseSubclass(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        const cleaned = text.replace(/.+?:\s*/, '');
        this.actor.subclass = cleaned.trim();
    }

    static parseSpellcasting(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        const abilityMatch = text.match(cRegex.spellcastingAbility);
        if (abilityMatch) {
            const ability = cUtils.convertToShortAbility(abilityMatch[1]);
            this.actor.spellcastingAbility = ability;
        }
    }

    static parseSpellSlots(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        // This is a simplified parser - could be expanded for full spell slot tables
        this.actor.spellSlots = text;
    }

    static parseCantrips(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        const spells = text.split(/[,;•\n]/).map(s => s.trim()).filter(s => s && !s.match(/cantrip/i));
        this.actor.cantrips = spells;
    }

    static parseSpells(blockData) {
        const spells = [];
        let currentLevel = 0;

        for (const lineData of blockData) {
            const line = lineData.line;

            // Check for spell level
            const levelMatch = line.match(cRegex.spellLevelPattern);
            if (levelMatch) {
                currentLevel = parseInt(levelMatch[1]);
                continue;
            }

            // Parse spells from this line
            const spellNames = line.split(/[,;•]/).map(s => s.trim()).filter(s => s);
            for (const spellName of spellNames) {
                spells.push({name: spellName, level: currentLevel});
            }
        }

        this.actor.spells = spells;
    }

    static parseMulticlassing(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        this.actor.multiclassing = text;
    }

    static parseOther(blockData) {
        const text = cUtils.combineToString(blockData.map(l => l.line));
        this.actor.otherInfo = text;
    }
}
