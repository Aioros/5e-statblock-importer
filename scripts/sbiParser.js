import { sbiUtils as sUtils } from "./sbiUtils.js";
import { sbiRegex as sRegex } from "./sbiRegex.js";
import {
    CreatureData,
    ArmorData,
    ChallengeData,
    RollData,
    LanguageData,
    NameValueData,
    DamageConditionId,
    BlockID,
    TopBlocks,
    KnownCreatureTypes
} from "./sbiData.js";

// Steps that the parser goes through:
//  - Break text into well defined statblock parts
//  - Create the Foundry data object from the parts

export class sbiParser {
    static async parseInput(lines) {
        const creature = new CreatureData("unknown");

        if (lines.length) {
            // Assume the first line is the name.
            creature.name = lines.shift().trim();

            // The way this works is that this goes through each line, looks for something it recognizes,
            // and then gathers up the following lines until it hits a new thing it recognizes.
            // When that happens, it parses the lines it had been gathering up to that point.
            const statBlocks = new Map();
            let lastBlockId = null;

            // Ability scores are tricky because there's not a consistent pattern to how
            // they're formatted. So we have to jump through some hoops. The code currently 
            // handles all statblocks from creatures in the 'testBlocks' file.
            let foundAbilityLine = false;

            // Another tricky part are the features listed under the known stuff at the top of
            // the statblock, since there's no heading for them. So we have to collect everything
            // we can after we've gone out of that part up until the next known Block.
            let foundTopBlock = true;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Ignore empty lines.
                if (!line.length) {
                    continue;
                }

                // Ignore lines starting with an asterisk.
                if (line.startsWith("*")) {
                    continue;
                }

                // Get the first block match, excluding the ones we already have
                const match = sRegex.getFirstMatch(line, [...statBlocks.keys()]);

                // This check is a little shaky, but it's the best we can do. We assume that if
                // we've been going through the top blocks and hit a line that doesn't match anything
                // that we've found the first line of the 'features' block. BUT only if the line has
                // a block title in it, because it could also be the second in a long line of 
                // Damage Immunities or something like that.
                if (!match && foundTopBlock && sRegex.blockTitle.exec(line)) {
                    foundTopBlock = false;
                    lastBlockId = BlockID.features;
                    statBlocks.set(lastBlockId, []);
                }

                if (match) {
                    foundTopBlock = TopBlocks.includes(match.id);
                }

                // Turn off 'foundAbilityLine' when we've hit the next block.
                if (match && foundAbilityLine && match.id !== BlockID.abilities) {
                    foundAbilityLine = false;
                }

                // It should never find the same match twice, so don't bother checking to see
                // if the ID already exists on the 'statBlocks' object. Also skip over other
                // abilities after we've found the first one.
                if (match && !foundAbilityLine) {
                    lastBlockId = match.id;
                    statBlocks.set(lastBlockId, []);

                    // Set 'foundAbilityLine' to true when we've found the first ability.
                    foundAbilityLine = lastBlockId === BlockID.abilities;
                }

                if (statBlocks.has(lastBlockId)) {
                    statBlocks.get(lastBlockId).push({lineNumber: i, line});
                }
            }

            // Remove everything we've found so far and see what we end up with.
            const foundLines = [...statBlocks.values()].flat().map(l => l.line);
            let resultArray = lines.map(l => l.trim()).filter(item => !foundLines.includes(item));

            if (resultArray.length) {
                sUtils.log("Found unaccounted for lines.");
                //debugger;
            }

            for (let [key, value] of statBlocks.entries()) {
                switch (key) {
                    case BlockID.actions:
                    case BlockID.bonusActions:
                    case BlockID.features:
                    case BlockID.lairActions:
                    case BlockID.legendaryActions:
                    case BlockID.mythicActions:
                    case BlockID.reactions:
                    case BlockID.traits:
                    case BlockID.utilitySpells:
                    case BlockID.villainActions:
                        this.setActions(value, key, creature);
                        break;
                    case BlockID.health:
                    case BlockID.souls:
                        this.setRoll(value, key, creature);
                        break;
                    case BlockID.armor:
                        this.setArmor(value, creature);
                        break;
                    case BlockID.abilities:
                        this.setAbilities(value, creature);
                        break;
                    case BlockID.challenge:
                        this.setChallenge(value, creature);
                        break;
                    case BlockID.conditionImmunities:
                    case BlockID.immunities2024:
                        this.setDamagesAndConditions(value, key, creature);
                        break;
                    case BlockID.damageImmunities:
                        this.setDamagesAndConditions(value, DamageConditionId.immunities, creature);
                        break;
                    case BlockID.damageResistances:
                        this.setDamagesAndConditions(value, DamageConditionId.resistances, creature);
                        break;
                    case BlockID.damageVulnerabilities:
                        this.setDamagesAndConditions(value, DamageConditionId.vulnerabilities, creature);
                        break;
                    case BlockID.languages:
                        this.setLanguages(value, creature);
                        break;
                    case BlockID.racialDetails:
                        this.setRacialDetails(value, creature);
                        break;
                    case BlockID.savingThrows:
                        this.setSavingThrows(value, creature);
                        break;
                    case BlockID.senses:
                        this.setSenses(value, creature);
                        break;
                    case BlockID.skills:
                        this.setSkills(value, creature);
                        break;
                    case BlockID.speed:
                        this.setSpeed(value, creature);
                        break;
                    default:
                        // Ignore anything we don't recognize.
                        break;
                }
            }

            return { creature, statBlocks };
        }
    }

    static setActions(lines, type, creature) {
        const fullLines = [...lines];
        lines = lines.map(l => l.line);
        // Remove the first line because it's just the block name,
        // except for features because they don't have a heading.
        if (type !== BlockID.features) {
            lines.shift();
        }

        if (type === BlockID.villainActions) {
            creature[type] = this.getVillainActions(lines);
        } else if (type === BlockID.features || type === BlockID.traits) {
            const featureDatas = [];
            
            for (const actionData of this.getBlockDatas(lines)) {
                const nameLower = actionData.name.toLowerCase();

                // e.g. "Spellcasting", "Innate Spellcasting", "Innate Spellcasting (Psionics)"
                if (!/^(innate )?spellcasting( \(\w+\))?$/i.exec(nameLower)) {
                    featureDatas.push(new NameValueData(actionData.name, actionData.value));
                } else {
                    const { spellcastingType, spellInfo } = this.getSpells(actionData);
                    creature[spellcastingType] = spellInfo;
                    featureDatas.push(new NameValueData(sUtils.capitalizeAll(nameLower), spellInfo[0].value + "<br>" + spellInfo.slice(1).map(sl => sl.name + ": " + sl.value.join(", ")).join("<br>")));
                }
            }

            creature.features = featureDatas;
        } else if (type === BlockID.utilitySpells) {
            const spellDatas = this.getBlockDatas(lines);

            // There should only be one block under the Utility Spells title.
            if (spellDatas.length === 1) {
                let { spellInfo } = this.getSpells(spellDatas[0], sRegex.spellInnateLine);
                creature.utilitySpells = spellInfo;
                creature[BlockID.features].push(new NameValueData("Utility Spells", spellInfo[0].value + "<br>" + spellInfo.slice(1).map(sl => sl.name + ": " + sl.value.join(", ")).join("<br>")));
            }
        } else {
            let blockDatas = this.getBlockDatas(lines);
            let spellcastingOutsideFeatures = blockDatas.find(b => b.name.toLowerCase() == "spellcasting");
            if (spellcastingOutsideFeatures) {
                blockDatas = blockDatas.filter(b => b.name !== spellcastingOutsideFeatures.name);
                let { spellInfo } = this.getSpells(spellcastingOutsideFeatures, sRegex.spellInnateLine);
                creature.innateSpellcasting = spellInfo;
                blockDatas.push(new NameValueData(spellcastingOutsideFeatures.name, spellInfo[0].value + "<br>" + spellInfo.slice(1).map(sl => sl.name + ": " + sl.value.join(", ")).join("<br>")));
            }
            creature[type] = this.getBlockDatas(lines);
        }
    }

    static setArmor(lines, creature) {
        const line = sUtils.combineToString(lines.map(l => l.line));
        const match = sRegex.armorDetails.exec(line);
        if (!match) return;

        lines.matchData = match.indices.groups;
        // AC value
        const ac = match.groups.ac;
        // Armor types, like "natural armor" or "leather armor, shield"
        const armorTypes = match.groups.armorType?.split(",").map(str => str.trim());

        creature.armor = new ArmorData(parseInt(ac), armorTypes);
    }

    static setAbilities(fullLines, creature) {
        const foundLines = [];

        // Check for standard abilities first.
        ////////////////////////////////////////////////
        const foundAbilityNames = [];
        const foundAbilityValues = [];
        const abilitiesMatchedData = [];
        const savingThrows24Data = [];

        const lines = fullLines.map(l => l.line);
        for (let l=0; l<lines.length; l++) {
            const line = lines[l];
            const trimmedLine = line.trim();

            // Names come before values, so if we've found all the values then we've found all the names.
            if (foundAbilityValues.length == 6) {
                break;
            }

            // Look for ability identifiers, like STR, DEX, etc.
            const abilityMatches = [...trimmedLine.matchAll(sRegex.abilityNames)];

            if (abilityMatches.length) {
                const names = abilityMatches.map(m => m[0]);
                foundAbilityNames.push.apply(foundAbilityNames, names);
                foundLines.push(line);
            }

            // Look for ability values, like 18 (+4).
            const valueMatches = [...trimmedLine.matchAll(sRegex.abilityValues)];

            if (valueMatches.length) {
                const values = valueMatches.map(m => m.groups.base);
                foundAbilityValues.push.apply(foundAbilityValues, values);
                abilitiesMatchedData.push(...valueMatches.map(m => ({...m.indices.groups, line: fullLines[l].lineNumber})));
                foundLines.push(line);
            }

            // Look for ability and save values (2024 format), like 18 +4 +6
            const valueMatches24 = [...trimmedLine.matchAll(sRegex.abilityValues24)];

            if (valueMatches24.length) {
                const values = valueMatches24.map(m => m.groups.base);
                foundAbilityValues.push.apply(foundAbilityValues, values);
                abilitiesMatchedData.push(...valueMatches24.map(m => ({...m.indices.groups, line: fullLines[l].lineNumber})));
                foundLines.push(line);
                // The 2024 format includes saving throws proficiencies here. We just check if the modifier is the same or not.
                savingThrows24Data.push.apply(savingThrows24Data, valueMatches24.map(m => m.groups.modifier !== m.groups.saveModifier));
            }
        }

        fullLines.matchData = abilitiesMatchedData;
        const abilitiesData = [];

        for (let i = 0; i < foundAbilityNames.length; i++) {
            abilitiesData.push(new NameValueData(foundAbilityNames[i], parseInt(foundAbilityValues[i])));
            if (savingThrows24Data[i]) {
                creature.savingThrows.push(foundAbilityNames[i]);
            }
        }

        creature.abilities = abilitiesData;
    }

    static setChallenge(lines, creature) {
        const line = sUtils.combineToString(lines.map(l => l.line));
        const match = sRegex.challengeDetails.exec(line);
        if (!match) return;

        lines.matchData = match.indices.groups;
        const crValue = match.groups.cr;
        let cr = 0;

        // Handle fractions.
        if (crValue === "½") {
            cr = 0.5;
        } else if (crValue.includes("/")) {
            cr = sUtils.parseFraction(crValue);
        } else {
            cr = parseInt(match.groups.cr);
        }

        let xp = 0;

        if (match.groups.xp) {
            xp = parseInt(match.groups.xp.replace(",", ""));
        }

        creature.challenge = new ChallengeData(cr, xp);

        // MCDM's "Flee, Mortals!" puts the role alongside the challege rating,
        // so handle that here.
        creature.role = sRegex.roleDetails.exec(line)?.groups.role;
    }

    // Example: Damage Vulnerabilities bludgeoning, fire
    static setDamagesAndConditions(lines, type, creature) {
        let line = sUtils.combineToString(lines.map(l => l.line));
        let lineStartMatch = line.match(/((damage|condition)\s)?(resistances|vulnerabilities|immunities)/i);
        line = line.replace(lineStartMatch[0] ?? "", "").trim();
        let offset = (lineStartMatch[0] ?? "").length + 1;

        let match = [];
        // Order is important here. Damage types appear first in the block, so we parse them first to keep the order of matches consistent
        if ([DamageConditionId.immunities, DamageConditionId.resistances, DamageConditionId.vulnerabilities, BlockID.immunities2024].includes(type)) {
            match = [...match, ...line.matchAll(sRegex.damageTypes)];
        }
        if ([BlockID.conditionImmunities, BlockID.immunities2024].includes(type)) {
            match = [...match, ...line.matchAll(sRegex.conditionTypes)];
        }
        
        for (let m of match) {
            for (let g in m.indices.groups) {
                m.indices.groups[g] = m.indices.groups[g].map(i => i + offset);
            }
        }
        lines.matchData = match.map(m => m.indices.groups);

        // Parse out the known damage types.
        const knownTypes = match
            .filter(arr => arr[0].length)
            .map(arr => arr[0].toLowerCase());

        // Now see if there is any custom text we should add.
        let customType = null;

        if (type !== BlockID.immunities2024) {
            // Split on ";" first for lines like "poison; bludgeoning, piercing, and slashing from nonmagical attacks"
            const strings = line.split(";");

            if (strings.length === 2) {
                customType = strings[1].trim();
            } else {
                // Handle something like "piercing from magic weapons wielded by good creatures"
                // by taking out the known types, commas, and spaces, and seeing if there's anything left.
                const descLeftover = line.replace(type === BlockID.conditionImmunities ? sRegex.conditionTypes : sRegex.damageTypes, "").replace(/,/g, "").trim();
                if (descLeftover) {
                    customType = descLeftover;
                }
            }
        }

        if (knownTypes.length) {
            switch (type) {
                case DamageConditionId.immunities:
                    creature.standardDamageImmunities = knownTypes;
                    break;
                case DamageConditionId.resistances:
                    creature.standardDamageResistances = knownTypes;
                    break;
                case DamageConditionId.vulnerabilities:
                    creature.standardDamageVulnerabilities = knownTypes;
                    break;
                case BlockID.conditionImmunities:
                    creature.standardConditionImmunities = knownTypes;
                    break;
                case BlockID.immunities2024:
                    creature.standardDamageImmunities = knownTypes.filter(t => t.match(sRegex.damageTypes));
                    creature.standardConditionImmunities = knownTypes.filter(t => t.match(sRegex.conditionTypes));
                    break;
            }
        }

        if (customType) {
            switch (type) {
                case DamageConditionId.immunities:
                    creature.specialDamageImmunities = customType;
                    break;
                case DamageConditionId.resistances:
                    creature.specialDamageResistances = customType;
                    break;
                case DamageConditionId.vulnerabilities:
                    creature.specialDamageVulnerabilities = customType;
                    break;
                case BlockID.conditionImmunities:
                    creature.specialConditionImmunities = customType;
                    break;
            }
        }
    }

    static setRoll(lines, type, creature) {
        const line = sUtils.combineToString(lines.map(l => l.line));
        const match = sRegex.rollDetails.exec(line);
        if (!match) return;

        lines.matchData = match.indices.groups;
        creature[type] = new RollData(parseInt(match.groups.value), match.groups.formula);
    }

    static setLanguages(lines, creature) {
        const trimCount = "Languages".length;
        const line = sUtils.combineToString(lines.map(l => l.line)).slice(trimCount).trim();
        const regex = sRegex.knownLanguages;
        const match = [...line.matchAll(regex)];
        for (let m of match) {
            for (let g in m.indices.groups) {
                m.indices.groups[g] = m.indices.groups[g].map(i => i + trimCount + 1);
            }
        }
        lines.matchData = match.map(m => m.indices.groups);
        const knownLanguages = match
            .filter(arr => arr[0].length)
            .map(arr => arr.groups.language.toLowerCase());
        const unknownLanguages = line.replaceAll(regex, "").replaceAll(/(,\s)+/g, ";").replaceAll(/,,+/g, ";").replace(/^;/, "").split(";").filter(l => l).map(lang => sUtils.capitalizeFirstLetter(lang));
        creature.language = new LanguageData(knownLanguages, unknownLanguages);
    }

    static setSavingThrows(lines, creature) {
        const line = sUtils.combineToString(lines.map(l => l.line));

        const match = [...line.matchAll(sRegex.abilityNames)];
        lines.matchData = match.map(m => m.indices.groups);

        // Save off the ability names associated with the saving throws.
        // No need to save the modifier numbers because that's calculated 
        // by Foundry when they're added to the actor.
        creature.savingThrows = match.map(m => m[0]);
    }

    // Example: Senses darkvision 60 ft., passive Perception 18
    static setSenses(lines, creature) {
        const line = sUtils.combineToString(lines.map(l => l.line));
        const matches = [...line.matchAll(sRegex.sensesDetails)];
        lines.matchData = matches.map(m => m.indices.groups);
        creature.senses = matches.map(m => new NameValueData(m.groups.name, m.groups.modifier));
    }

    static setSkills(lines, creature) {
        const line = sUtils.combineToString(lines.map(l => l.line));
        const matches = [...line.matchAll(sRegex.skillDetails)];
        lines.matchData = matches.map(m => m.indices.groups);
        creature.skills = matches.map(m => new NameValueData(m.groups.name, m.groups.modifier));
    }

    static setSpeed(lines, creature) {
        const line = sUtils.combineToString(lines.map(l => l.line));
        const match = [...line.matchAll(sRegex.speedDetails)];
        if (!match) return;

        lines.matchData = match.map(m => m.indices.groups);
        const speeds = match
            .map(m => new NameValueData(m.groups.name, m.groups.value))
            .filter(nv => nv.name != null && nv.value != null);

        if (line.toLowerCase().includes("hover")) {
            speeds.push(new NameValueData("hover", ""));
        }

        creature.speeds = speeds;
    }

    static setRacialDetails(lines, creature) {
        const line = sUtils.combineToString(lines.map(l => l.line));
        const match = [...line.matchAll(sRegex.racialDetails)][0];
        if (!match) return;

        lines.matchData = match.indices.groups;
        creature.size = match.groups.size;
        creature.alignment = match.groups.alignment?.trim();
        creature.race = match.groups.race?.trim();
        creature.swarmSize = match.groups.swarmSize?.trim();

        const creatureType = match.groups.type?.toLowerCase().trim();
        let singleCreatureType = creatureType.endsWith('s') ? creatureType.slice(0, -1) : creatureType;
        if (singleCreatureType === "monstrositie") {
            singleCreatureType = "monstrosity";
        };
        const isKnownType = KnownCreatureTypes.includes(singleCreatureType);
        creature.type = isKnownType ? singleCreatureType : undefined;
        creature.customType = isKnownType ? undefined : creatureType;
    }

    // Combines lines of text into sentences and paragraphs. This is complicated because finding 
    // sentences that can span multiple lines are hard to describe to a computer.
    static getBlockDatas(lines) {
        const result = [];
        const validLines = lines.filter(l => l);
        let actionData = null;
        let foundTitle = false;

        // Pull out the entire spell block because it's formatted differently than all the other action blocks.
        const notSpellLines = [];
        const spellLines = [];
        let foundSpellBlock = false;

        // Start taking lines from the spell block when we've found the beginning until 
        // we've gotten into the spells and hit a line where the next line has a period.
        for (let index = 0; index < validLines.length; index++) {
            let line = validLines[index];

            if (!foundSpellBlock) {
                foundSpellBlock = line.match(/\binnate spellcasting\b|\bspellcasting\b/i) != null;

                if (foundSpellBlock && line === "Spellcasting" && !line.endsWith(".")) {
                    line = line + ".";
                }
            }

            // If we're inside of a spell block, store it off in the spell lines array,
            // otherwise store it into the not spell lines array.
            if (foundSpellBlock) {
                spellLines.push(line);
            } else {
                foundSpellBlock = false;
                notSpellLines.push(line);
            }

            // Check to see if we've reached the end of the spell block by seeing if 
            // the next line is a title.
            const nextLineIsTitle = index < validLines.length - 1
                && sRegex.blockTitle.exec(validLines[index + 1]) != null;

            if (foundSpellBlock && nextLineIsTitle) {
                // Add a period at the end so that blocks are extracted correctly.
                if (!spellLines[spellLines.length - 1].endsWith(".")) {
                    spellLines[spellLines.length - 1] = spellLines[spellLines.length - 1] + ".";
                }

                // Break out of the spell block.
                foundSpellBlock = false;
            }
        }

        const notSpellSentences = sUtils.makeSentences(notSpellLines);
        const spellSentences = sUtils.makeSentences(spellLines);
        const sentences = notSpellSentences.concat(spellSentences);

        for (let s in sentences) {
            let sentence = sentences[s];
            // A title can't be the last sentence
            const titleMatch = (s < sentences.length - 1) && sRegex.blockTitle.exec(sentence);

            if (titleMatch && !foundTitle) {
                // Ignore two titles in a row because it means that the second one is just a short description and not a real title.
                foundTitle = true;

                // Remove the period or exclamation mark from the title.
                const title = sentence.replace(/[.!]$/, "");
                actionData = new NameValueData(title);

                result.push(actionData);
            } else {
                foundTitle = false;

                if (actionData == null) {
                    actionData = new NameValueData("Description", sentence);
                    result.push(actionData);
                } else if (actionData.value == null) {
                    actionData.value = sentence;
                } else {
                    actionData.value = `${actionData.value} ${sentence}`;
                }
            }
        }

        for (let index = 0; index < result.length; index++) {
            const aData = result[index];
            if (aData.value == null && index != 0) {
                // If there's no description, assume it's a line at the end of the last action description that just looks like a title.
                result[index - 1].value = result[index - 1].value + " " + aData.name;
            } else {
                aData.value = this.formatForDisplay(aData.value);
            }
        }

        return result;
    }

    static getVillainActions(lines) {
        const result = [];
        let actionData = null;

        for (const line of lines) {
            const titleMatch = sRegex.villainActionTitle.exec(line);

            if (titleMatch) {
                actionData = new NameValueData(titleMatch.groups.title, titleMatch.groups.description);
                result.push(actionData);
            } else {
                if (actionData == null) {
                    actionData = new NameValueData("Description", line);
                    result.push(actionData);
                } else {
                    actionData.value = `${actionData.value} ${line}`;
                }
            }
        }

        return result;
    }

    static getSpells(spellBlock) {
        let spellRegex = sRegex.spellInnateLine;
        let spellcastingType = "innateSpellcasting";
        let spellMatches = [...spellBlock.value.matchAll(spellRegex)];

        if (!spellMatches.length) {
            spellRegex = sRegex.spellLine;
            spellcastingType = "spellcasting";
            spellMatches = [...spellBlock.value.matchAll(spellRegex)];
        }

        const spellGroups = [];

        // Put spell groups on their own lines in the description so that it reads better.
        if (spellMatches.length) {
            const introDescription = spellBlock.value.slice(0, spellMatches[0].index);
            spellGroups.push(new NameValueData("Description", introDescription));

            for (let idx = 0; idx < spellMatches.length; idx++) {
                const match = spellMatches[idx];
                let lastIndex = idx < spellMatches.length - 1 ? spellMatches[idx + 1].index : undefined;

                const spellNames = spellBlock.value
                    .slice(match.index + match[0].length, lastIndex)
                    .split(/,(?![^\(]*\))/) // split on commas that are outside of parenthesis
                    .map(spell => spell.replaceAll("*", "")) // remove asterisks
                    .map(spell => spell.trim()) // remove spaces
                    .map(spell => sUtils.trimStringEnd(spell, ".")) // remove end period
                    .map(spell => spell.replace(/(\s[ABR]|\s?\+)$/, "")) // remove MCDM activation symbols
                    .map(spell => sUtils.capitalizeAll(spell)); // capitalize words

                spellGroups.push(new NameValueData(sUtils.trimStringEnd(match[0], ":"), spellNames));
            }
        }

        return { spellcastingType, spellInfo: spellGroups };
    }

    // ===============================
    // Utilities
    // ===============================

    static formatForDisplay(text) {
        const textArr = text.replaceAll("•", "\n•").split("\n");

        if (textArr.length > 1) {
            return `<p>${textArr.join("</p><p>")}</p>`
        } else {
            return textArr.join("");
        }
    }
}
