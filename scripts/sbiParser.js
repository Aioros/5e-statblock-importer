import { sbiUtils as sUtils } from "./sbiUtils.js";
import { sbiRegex as sRegex } from "./sbiRegex.js";
import { sbiActor as sActor } from "./sbiActor.js";
import {
    NameValueData,
    ArmorData,
    RollData,
    ChallengeData,
    LanguageData,
    DamageConditionId,
    KnownCreatureTypes,
    Blocks
} from "./sbiData.js";

// Steps that the parser goes through:
//  - Break text into well defined statblock parts
//  - Create the Foundry data object from the parts

export class sbiParser {

    static actor;
    static statBlocks;
    static cleanLines = false;

    static fixNewLines(inputText) {
        // Identify unneeded line breaks, like:
        // Hit Points
        // 328 (16d20 + 160)
        return inputText.replace(sRegex.removeNewLines, "$<header> ");
    }

    static getFirstMatch(line, excludeIds = []) {
        return Object.keys(Blocks).filter(b => !["name", "features", "otherBlock"].includes(b)).find(b => line.match(sRegex[b]) && !excludeIds.includes(b));
    }

    static parseInput(text, hints = []) {
        const lines = sbiParser.fixNewLines(sUtils.stripMarkdownAndCleanInput(text)).split("\n");

        if (lines.length) {

            // Are new lines in this text actual new lines or just layout? We can make different assumptions based on this later.
            this.cleanLines = lines.every(l => l[0].toUpperCase() === l[0]);
            
            // Assume the first line is the name.
            this.actor = new sActor(lines.shift().trim());

            // The way this works is that this goes through each line, looks for something it recognizes,
            // and then gathers up the following lines until it hits a new thing it recognizes.
            // When that happens, it parses the lines it had been gathering up to that point.
            this.statBlocks = new Map();
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

                let match;

                const hint = hints.find(h => h.text.trim() === line);
                if (hint) {
                    match = hint.blockId;
                } else {
                    // Get the first block match, excluding the ones we already have
                    const excludeIds = [...this.statBlocks.keys()]
                    if (!foundTopBlock) excludeIds.push(Blocks.abilities.id); // We only accept an apparent ability block match if we are still in the top section
                    match = this.getFirstMatch(line, excludeIds);
                }

                // This check is a little shaky, but it's the best we can do. We assume that if
                // we've been going through the top blocks and hit a line that doesn't match anything
                // that we've found the first line of the 'features' block. BUT only if the line has
                // a block title in it, because it could also be the second in a long line of 
                // Damage Immunities or something like that.
                if (!match && foundTopBlock && line.match(sRegex.getBlockTitle(this.cleanLines))) {
                    foundTopBlock = false;
                    lastBlockId = Blocks.features.id;
                    this.statBlocks.set(lastBlockId, []);
                }

                // Final fallback: if this still didn't match anything, check if it looks like a section title (max 3 words).
                // These unknown blocks will be merged together and placed in the actor's biography.
                if (!match && !foundAbilityLine && line.match(sRegex.otherBlock)) {
                    foundTopBlock = false;
                    lastBlockId = Blocks.otherBlock.id;
                    if (!this.statBlocks.has(lastBlockId)) {
                        this.statBlocks.set(lastBlockId, []);
                    }
                }

                if (match) {
                    foundTopBlock = Blocks[match]?.top;
                }

                // Turn off 'foundAbilityLine' when we've hit the next block.
                if (match && foundAbilityLine && match !== Blocks.abilities.id) {
                    foundAbilityLine = false;
                }

                // It should never find the same match twice, so don't bother checking to see
                // if the ID already exists on the 'statBlocks' object. Also skip over other
                // abilities after we've found the first one.
                if (match && !foundAbilityLine) {
                    lastBlockId = match;
                    if (!hint || !this.statBlocks.has(lastBlockId)) { // If this line block was hinted, it could go to an existing block
                        this.statBlocks.set(lastBlockId, []);
                    }

                    // Set 'foundAbilityLine' to true when we've found the first ability.
                    foundAbilityLine = lastBlockId === Blocks.abilities.id;
                }

                if (this.statBlocks.has(lastBlockId)) {
                    this.statBlocks.get(lastBlockId).push({lineNumber: i, line, ...(hint && {hint: hint.blockId})});
                }
            }

            // Remove everything we've found so far and see what we end up with.
            const foundLines = [...this.statBlocks.values()].flat().map(l => l.line);
            let unknownLines = lines.filter(item => !foundLines.includes(item));

            for (let [blockId, blockData] of this.statBlocks.entries()) {
                switch (blockId) {
                    case Blocks.abilities.id:
                        this.parseAbilities(blockData);
                        break;
                    case Blocks.actions.id:
                    case Blocks.bonusActions.id:
                    case Blocks.features.id:
                    case Blocks.lairActions.id:
                    case Blocks.legendaryActions.id:
                    case Blocks.mythicActions.id:
                    case Blocks.reactions.id:
                    case Blocks.traits.id:
                    case Blocks.utilitySpells.id:
                    case Blocks.villainActions.id:
                        this.parseActions(blockData, blockId);
                        break;
                    case Blocks.armor.id:
                        this.parseArmor(blockData);
                        break;
                    case Blocks.challenge.id:
                        this.parseChallenge(blockData);
                        break;                    
                    case Blocks.conditionImmunities.id:
                    case Blocks.damageImmunities.id:
                    case Blocks.immunities2024.id:
                    case Blocks.damageResistances.id:
                    case Blocks.damageVulnerabilities.id:
                        this.parseDamagesAndConditions(blockData, blockId);
                        break;
                    case Blocks.health.id:
                    case Blocks.souls.id:
                        this.parseRoll(blockData, blockId);
                        break;
                    case Blocks.gear.id:
                        this.parseGear(blockData);
                        break;
                    case Blocks.initiative.id:
                        this.parseInitiative(blockData);
                        break;
                    case Blocks.languages.id:
                        this.parseLanguages(blockData);
                        break;
                    case Blocks.proficiencyBonus.id:
                        this.parseProficiencyBonus(blockData);
                        break;
                    case Blocks.racialDetails.id:
                        this.parseRacialDetails(blockData);
                        break;
                    case Blocks.savingThrows.id:
                        this.parseSavingThrows(blockData);
                        break;
                    case Blocks.senses.id:
                        this.parseSenses(blockData);
                        break;
                    case Blocks.skills.id:
                        this.parseSkills(blockData);
                        break;
                    case Blocks.source.id:
                        this.parseSource(blockData);
                        break;
                    case Blocks.speed.id:
                        this.parseSpeed(blockData);
                        break;
                    case Blocks.otherBlock.id:
                        this.parseOther(blockData);
                        break;
                    default:
                        // Ignore anything we don't recognize.
                        break;
                }
            }

            return { actor: this.actor, statBlocks: this.statBlocks, unknownLines, lines };
        }
    }

    // Takes an array of lines ([{lineNumber: n, line: "Line Text"}]) (I should probably make it an actual class for clarity)
    // Matches the joined lines on a regex, then adds match index information on any line that had any regex group matched
    static matchAndAnnotate(lines, regex, start = 0, end = Infinity) {
        if (!Array.isArray(lines)) {
            lines = [lines];
        }
        const text = sUtils.combineToString(lines.map(l => l.line));
        const matches = [...text.substring(start, end).matchAll(regex)];
        for (let match of matches) {
            const matchData = match.indices?.groups;
            for (const key in matchData) {
                if (matchData[key]) {
                    matchData[key][0] += start;
                    matchData[key][1] += start;
                }
            }
            // We filter out any entry without a valid array of two indices, and we sort
            const orderedMatches = Object.entries(matchData || {}).filter(e => e[1]?.length == 2).sort((a, b) => a[1][0] - b[1][0]).map(m => ({label: m[0], indices: m[1]}));
            for (let m=0; m<orderedMatches.length; m++) {
                // For each match, we go line by line (keeping track of the total length) until we find the applicable line.
                let length = 0;
                for (let l=0; l<lines.length; l++) {
                    let line = lines[l].line;
                    let lineNumber = lines[l].lineNumber;
                    if (orderedMatches[m].indices[0] >= length && orderedMatches[m].indices[0] <= length + line.length && orderedMatches[m].indices[1] <= length + line.length) {
                        orderedMatches[m].line = lineNumber;
                        orderedMatches[m].indices[0] -= length;
                        orderedMatches[m].indices[1] -= length;
                        if (!lines[l].hasOwnProperty("matchData")) {
                            lines[l].matchData = [];
                        }
                        lines[l].matchData.push(orderedMatches[m]);
                    }
                    length += line.length + 1;
                }
            }
        }

        return matches;
    }

    static parseAbilities(lines) {

        // Check for standard abilities first.
        const foundAbilityNames = [];
        const foundAbilityValues = [];
        const savingThrows24Data = [];

        for (let l of lines) {
            
            // Names come before values, so if we've found all the values then we've found all the names.
            if (foundAbilityValues.length == 6) {
                break;
            }

            // Look for ability identifiers, like STR, DEX, etc.
            const abilityMatches = [...l.line.matchAll(sRegex.abilityNames)];

            if (abilityMatches.length) {
                const names = abilityMatches.map(m => m[0].slice(0,3)); // This will also automatically transform Strength -> Str, in case the statblock used full ability names
                foundAbilityNames.push.apply(foundAbilityNames, names);
            }

            // Look for ability and save values (2024 format), like 18 +4 +6
            const valueMatches24 = this.matchAndAnnotate(l, sRegex.abilityValues24);
            
            if (valueMatches24.length) {

                const values = valueMatches24.map(m => m.groups.base);
                foundAbilityValues.push.apply(foundAbilityValues, values);
                // The 2024 format includes saving throws proficiencies here. We just check if the modifier is the same or not.
                savingThrows24Data.push.apply(savingThrows24Data, valueMatches24.map(m => m.groups.modifier !== m.groups.saveModifier));
                
            } else {

                // Look for ability values, like 18 (+4).
                const valueMatches = this.matchAndAnnotate(l, sRegex.abilityValues);

                if (valueMatches.length) {
                    const values = valueMatches.map(m => m.groups.base);
                    foundAbilityValues.push.apply(foundAbilityValues, values);
                }

            } 

        }

        const abilitiesData = [];

        for (let i = 0; i < foundAbilityNames.length; i++) {
            abilitiesData.push(new NameValueData(foundAbilityNames[i], parseInt(foundAbilityValues[i])));
            if (savingThrows24Data[i]) {
                this.actor.savingThrows.push(foundAbilityNames[i]);
            }
        }

        this.actor.abilities = abilitiesData;

    }

    static parseArmor(lines) {
        const match = this.matchAndAnnotate(lines, sRegex.armorDetails)?.[0];
        if (!match) return;

        // AC value
        const ac = match.groups.ac;
        // Armor types, like "natural armor" or "leather armor, shield"
        const armorTypes = match.groups.armorType?.split(",").map(str => str.trim()) || [];

        this.actor.armor = new ArmorData(parseInt(ac), armorTypes.filter(t => t.toLowerCase() === "natural armor"));
        this.actor.gear.push(...armorTypes.filter(t => t.toLowerCase() !== "natural armor").map(t => new NameValueData(t.toLowerCase(), 1)));

        if (match.groups.initiativeModifier) {
            this.actor.initiative = {mod: parseInt(match.groups.initiativeModifier.replace(/[−–]/, "-")), score: parseInt(match.groups.initiativeScore)};
        }
    }

    static parseGear(lines) {
        const matches = this.matchAndAnnotate(lines, sRegex.gearDetails);
        if (!matches) return;

        this.actor.gear.push(...matches.map(m => new NameValueData(m.groups.name.toLowerCase(), parseInt(m.groups.quantity || 1))));
    }

    static parseInitiative(lines) {
        const match = this.matchAndAnnotate(lines, sRegex.initiativeDetails)?.[0];
        if (!match) return;
        
        this.actor.initiative = {mod: parseInt(match.groups.initiativeModifier.replace(/[−–]/, "-")), score: parseInt(match.groups.initiativeScore)};
    }

    static parseChallenge(lines) {
        const match = this.matchAndAnnotate(lines, sRegex.challengeDetails)?.[0];
        if (!match) return;
        
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
        } else if (match.groups.experiencePoints) {
            xp = parseInt(match.groups.experiencePoints.replace(",", ""));
        }

        let pb = 0;
        if (match.groups.pb) {
            pb = parseInt(match.groups.pb);
        }

        this.actor.challenge = new ChallengeData(cr, xp, pb);

        // MCDM's "Flee, Mortals!" puts the role alongside the challege rating,
        // so handle that here.
        this.actor.role = match.groups.role;
    }

    // Example: Damage Vulnerabilities bludgeoning, fire
    static parseDamagesAndConditionsOld(lines, type) {
        const regex = type === Blocks.conditionImmunities.id ? sRegex.conditionTypes : sRegex.damageTypes;
        const matches = this.matchAndAnnotate(lines, regex);

        // Parse out the known damage types.
        const knownTypes = matches
            .filter(arr => arr[0].length)
            .map(arr => arr[0].toLowerCase());

        let fullLines = sUtils.combineToString(lines.map(l => l.line));
        // Remove the type name.
        switch (type) {
            case DamageConditionId.immunities:
                fullLines = fullLines.replace(/damage immunities/i, "").trim();
                break;
            case DamageConditionId.resistances:
                fullLines = fullLines.replace(/damage resistances/i, "").trim();
                break;
            case DamageConditionId.vulnerabilities:
                fullLines = fullLines.replace(/damage vulnerabilities/i, "").trim();
                break;
            case Blocks.conditionImmunities.id:
                fullLines = fullLines.replace(/condition immunities/i, "").trim();
                break;
        }

        // Now see if there is any custom text we should add.
        let customType = null;

        // Split on ";" first for lines like "poison; bludgeoning, piercing, and slashing from nonmagical attacks"
        const strings = fullLines.split(";");

        if (strings.length === 2) {
            customType = strings[1].trim();
        } else {
            // Handle something like "piercing from magic weapons wielded by good creatures"
            // by taking out the known types, commas, and spaces, and seeing if there's anything left.
            const descLeftover = fullLines.replace(regex, "").replace(/,/g, "").trim();
            if (descLeftover) {
                customType = descLeftover.replace("\n", " ");
            }
        }

        if (knownTypes.length) {
            switch (type) {
                case DamageConditionId.immunities:
                    this.actor.standardDamageImmunities = knownTypes;
                    break;
                case DamageConditionId.resistances:
                    this.actor.standardDamageResistances = knownTypes;
                    break;
                case DamageConditionId.vulnerabilities:
                    this.actor.standardDamageVulnerabilities = knownTypes;
                    break;
                case Blocks.conditionImmunities.id:
                    this.actor.standardConditionImmunities = knownTypes;
                    break;
            }
        }

        if (customType) {
            switch (type) {
                case DamageConditionId.immunities:
                    this.actor.specialDamageImmunities = customType;
                    break;
                case DamageConditionId.resistances:
                    this.actor.specialDamageResistances = customType;
                    break;
                case DamageConditionId.vulnerabilities:
                    this.actor.specialDamageVulnerabilities = customType;
                    break;
                case Blocks.conditionImmunities.id:
                    this.actor.specialConditionImmunities = customType;
                    break;
            }
        }
    }

    // Example: Damage Vulnerabilities bludgeoning, fire
    static parseDamagesAndConditions(lines, type) {
        let damageConditionId;
        switch (type) {
            case Blocks.damageImmunities.id:
            case Blocks.conditionImmunities.id:
            case Blocks.immunities2024.id:
                damageConditionId = DamageConditionId.immunities;
                break;
            case Blocks.damageResistances.id:
                damageConditionId = DamageConditionId.resistances;
                break;
            case Blocks.damageVulnerabilities.id:
                damageConditionId = DamageConditionId.vulnerabilities;
                break;
        }
        const damageTypes = this.matchAndAnnotate(lines, sRegex.damageTypes)
            .filter(arr => arr[0].length)
            .map(arr => arr[0].toLowerCase());
        const conditionTypes = this.matchAndAnnotate(lines, sRegex.conditionTypes)
            .filter(arr => arr[0].length)
            .map(arr => arr[0].toLowerCase());

        let fullLines = sUtils.combineToString(lines.map(l => l.line));
        // Remove the type name.
        fullLines = fullLines.replace(/^(damage\s|condition\s)?(immunities|resistances|vulnerabilities)[\s:]*/i, "").trim();

        // Now see if there is any custom text we should add.
        let customType = null;

        let bypasses = [];
        // "mundane attacks" is an MCDM thing.
        if (/nonmagical\sweapons/i.test(fullLines) || /nonmagical\sattacks/i.test(fullLines) || /mundane\sattacks/i.test(fullLines)) {
            bypasses.push("mgc");
        }
        if (fullLines.includes("adamantine")) {
            bypasses.push("ada");
        }
        if (fullLines.includes("silvered")) {
            bypasses.push("sil");
        }

        if (bypasses.length === 0) {
            // If no bypasses have been set, then assume Foundry will take care of setting the special damage text.
            // Handle something like "piercing from magic weapons wielded by good creatures"
            // by taking out the known types, commas, and spaces, and seeing if there's anything left.
            const descLeftover = fullLines
                .replace(sRegex.damageTypes, "")
                .replace(sRegex.conditionTypes, "")
                .replace(/,/g, "")
                .trim();
            if (descLeftover) {
                customType = descLeftover.replace("\n", " ");
            }
        }

        if (!this.actor.damagesAndConditions[`damage${sUtils.capitalizeFirstLetter(damageConditionId)}`]) {
            foundry.utils.setProperty(this.actor, `damagesAndConditions.damage${sUtils.capitalizeFirstLetter(damageConditionId)}`, {types: [], bypasses: [], special: ""});
        }
        this.actor.damagesAndConditions[`damage${sUtils.capitalizeFirstLetter(damageConditionId)}`].types.push(...damageTypes);
        this.actor.damagesAndConditions[`damage${sUtils.capitalizeFirstLetter(damageConditionId)}`].bypasses = bypasses;
        this.actor.damagesAndConditions[`damage${sUtils.capitalizeFirstLetter(damageConditionId)}`].special = customType;

        if (!this.actor.damagesAndConditions.conditionImmunities) {
            foundry.utils.setProperty(this.actor, "damagesAndConditions.conditionImmunities", {types: [], special: ""});
        }
        this.actor.damagesAndConditions.conditionImmunities.types.push(...conditionTypes);
    }

    static parseLanguages(lines) {
        const regex = sRegex.knownLanguages;
        const matches = this.matchAndAnnotate(lines, regex);
        if (!matches) return;

        const knownLanguages = matches
            .filter(arr => arr[0].length && !arr[0].includes("telepathy"))
            .map(arr => arr.groups.language.toLowerCase());

        const telepathy = matches.find(m => m.groups?.telepathyRange)?.groups.telepathyRange;
        
        const unknownLanguages = sUtils.combineToString(lines.map(l => l.line))
            .replace(/^languages[.:]?\s*/i, "")
            .replaceAll(regex, "")
            .replaceAll(/(,\s)+/g, ";")
            .replaceAll(/,,+/g, ";")
            .replace(/^;/, "")
            .split(";")
            .filter(l => l);

        this.actor.language = new LanguageData(knownLanguages, unknownLanguages, telepathy);
    }

    static parseProficiencyBonus(lines) {
        const match = this.matchAndAnnotate(lines, sRegex.proficiencyBonusDetails)?.[0];
        if (!match) return;

        this.actor.challenge ??= {};
        foundry.utils.setProperty(this.actor, "challenge.pb", parseInt(match.groups.pb));
    }

    static parseRacialDetails(lines) {
        const match = this.matchAndAnnotate(lines, sRegex.racialDetails)?.[0];
        if (!match) return;

        this.actor.size = match.groups.size;
        this.actor.alignment = match.groups.alignment?.trim();
        this.actor.race = match.groups.race?.trim();
        this.actor.swarmSize = match.groups.swarmSize?.trim();

        const creatureType = match.groups.type?.toLowerCase().trim();
        let singleCreatureType = creatureType.endsWith('s') ? creatureType.slice(0, -1) : creatureType;
        if (singleCreatureType === "monstrositie") {
            singleCreatureType = "monstrosity";
        };
        const isKnownType = KnownCreatureTypes.includes(singleCreatureType);
        this.actor.type = isKnownType ? singleCreatureType : undefined;
        this.actor.customType = isKnownType ? undefined : creatureType;
    }

    static parseRoll(lines, type) {
        const match = this.matchAndAnnotate(lines, sRegex.rollDetails)?.[0];
        if (!match) return;

        const formula = match.groups.formula?.replace(/[−–]/, "-");
        this.actor[type] = new RollData(parseInt(match.groups.value), formula);
    }

    static parseSavingThrows(lines) {
        const matches = this.matchAndAnnotate(lines, sRegex.abilityNames);
        if (!matches) return;

        // Save off the ability names associated with the saving throws.
        // No need to save the modifier numbers because that's calculated 
        // by Foundry when they're added to the actor.
        this.actor.savingThrows = matches.map(m => m[0]);
    }

    // Example: Senses darkvision 60 ft., passive Perception 18
    static parseSenses(lines) {
        const matches = this.matchAndAnnotate(lines, sRegex.sensesDetails);
        if (!matches) return;

        this.actor.senses = matches.map(m => new NameValueData(m.groups.name, m.groups.modifier));
    }

    static parseSkills(lines) {
        const matches = this.matchAndAnnotate(lines, sRegex.skillDetails);
        if (!matches) return;

        this.actor.skills = matches.map(m => new NameValueData(m.groups.name, m.groups.modifier));
    }

    static parseSource(lines) {
        const match = this.matchAndAnnotate(lines, sRegex.sourceDetails)?.[0];
        if (!match) return;

        this.actor.source = {book: match.groups.book};
        if (match.groups.page) {
            this.actor.source.page = match.groups.page;
        }
    }

    static parseSpeed(lines) {
        const matches = this.matchAndAnnotate(lines, sRegex.speedDetails);
        if (!matches) return;

        const speeds = matches
            .map(m => new NameValueData(m.groups.name || "walk", m.groups.value))
            .filter(nv => nv.name != null && nv.value != null);
        
        if (lines.some(l => l.line.toLowerCase().includes("hover"))) {
            speeds.push(new NameValueData("hover", ""));
        }

        this.actor.speeds = speeds;
    }

    static parseActions(lines, type) {
        // Remove the first line because it's just the block name,
        // except for features because they don't have a heading.
        if (type !== Blocks.features.id) {
            lines = lines.slice(1);
        }

        if (type === Blocks.traits.id) {
            type = Blocks.features.id;
        }

        if (type === Blocks.features.id) {
            for (const actionData of this.getBlockDatas(lines)) {
                // e.g. "Spellcasting", "Innate Spellcasting", "Innate Spellcasting (Psionics)"
                const isSpellcasting = !!/^(innate )?spellcasting( \([^)\/]+\))?\./i.test(actionData.value.lines[0].line);
                if (isSpellcasting) {
                    const { spellcastingType, spellcastingDetails, spellInfo } = this.getSpells(actionData);
                    this.actor[spellcastingType] = {featureName: actionData.name, spellcastingDetails, spellInfo};
                } else {
                    this.actor[Blocks.features.id].push(actionData);
                }
            }
        } else if (type === Blocks.utilitySpells.id) {
            const spellDatas = this.getBlockDatas(lines);

            // There should only be one block under the Utility Spells title.
            if (spellDatas.length === 1) {
                let { spellcastingDetails, spellInfo } = this.getSpells(spellDatas[0]);
                this.actor.utilitySpells = {featureName: spellDatas[0].name, spellcastingDetails, spellInfo};
            }
        } else {
            let blockDatas = this.getBlockDatas(lines);

            let spellcastingOutsideFeatures = blockDatas.find(b => b.name.toLowerCase() == "spellcasting");
            if (spellcastingOutsideFeatures) {
                blockDatas = blockDatas.filter(b => b.name !== spellcastingOutsideFeatures.name);
                let { spellcastingDetails, spellInfo } = this.getSpells(spellcastingOutsideFeatures);
                this.actor.innateSpellcasting = {featureName: "Spellcasting", spellcastingDetails, spellInfo};
            }
            this.actor[type] = blockDatas;
        }

        const typeActions = Array.isArray(this.actor[type]) ? this.actor[type] : [];
        for (const actionData of typeActions) {
            const isSpellcasting = /^(innate )?spellcasting( \([^)\/]+\))?$/i.test(actionData.value.lines[0].line);
            if (!isSpellcasting) {
                this.parseAttackOrSave(actionData);
                this.parsePerDay(actionData);
                this.parseRange(actionData);
                this.parseReach(actionData);
                this.parseRecharge(actionData);
                this.parseTarget(actionData);
                this.parseMajorFeatureInfo(actionData);
                this.parseSpellAction(actionData);
                this.parseCastAction(actionData);
            }
        }
    }

    static parseMajorFeatureInfo(actionData) {
        if (actionData.name === "Description") {
            // How many legendary actions can it take?
            const legendaryActionMatch = this.matchAndAnnotate(actionData.value.lines, sRegex.legendaryActionCount)?.[0];
            if (legendaryActionMatch) {
                actionData.value.legendaryActionCount = parseInt(legendaryActionMatch.groups.count || legendaryActionMatch.groups.uses);
            }
            // What iniative count does the lair action activate?
            const lairInitiativeMatch = this.matchAndAnnotate(actionData.value.lines, sRegex.lairInitiativeCount)?.[0];
            if (lairInitiativeMatch) {
                actionData.value.lairInitiativeCount = parseInt(lairInitiativeMatch.groups.initiativeCount);
            }
        } else if (actionData.name.toLowerCase().startsWith("legendary resistance")) {
            // Example:
            // Legendary Resistance (3/day)
            // This should have already been parsed by parsePerDay, we retrieve that
            const resistanceMatch = actionData.value.lines[0].matchData.find(m => m.label === "perDay");
            if (resistanceMatch) {
                actionData.value.legendaryResistanceCount = actionData.value.perDay;
            }
        } else {
            // How many actions does this cost?
            const actionCostMatch = this.matchAndAnnotate(actionData.value.lines, sRegex.actionCost)?.[0];
            if (actionCostMatch) {
                actionData.value.actionCost = parseInt(actionCostMatch.groups.cost);
            }
        }
    }

    // Example:
    // Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10(2d6 + 3) slashing damage plus 3(1d6) acid damage.
    // or
    // Frost Breath (Recharge 5–6). The hound exhales a 15-foot cone of frost. Each creature in the cone must make a DC 13 
    // Dexterity saving throw, taking 44(8d10) cold damage on a failed save or half as much damage on a successful one.
    static parseAttackOrSave(actionData) {
        // Some attacks include a saving throw, so we'll just check for both attack rolls and saving throw rolls
        const saveMatch = this.matchAndAnnotate(actionData.value.lines, sRegex.savingThrowDetails)?.[0] || this.matchAndAnnotate(actionData.value.lines, sRegex.savingThrowDetails24)?.[0];
        const attackMatch = this.matchAndAnnotate(actionData.value.lines, sRegex.attack)?.[0] || this.matchAndAnnotate(actionData.value.lines, sRegex.attack24)?.[0];
        if (saveMatch) {
            actionData.value.save = {
                dc: saveMatch.groups.saveDc,
                ability: saveMatch.groups.saveAbility,
                condition: saveMatch.groups.condition,
                damageOnSave: saveMatch.groups.halfDamage ? "half" : "none"
            };
        }
        if (attackMatch) {
            actionData.value.attack = {toHit: attackMatch.groups.toHit, condition: attackMatch.groups.condition};
        }
        const damageRollMatch = this.matchAndAnnotate(actionData.value.lines, sRegex.damageRoll)?.[0];
        if (damageRollMatch) {
            actionData.value.damage = {
                damageRoll: damageRollMatch.groups.baseDamageRoll,
                damageType: damageRollMatch.groups.baseDamageType?.toLowerCase(),
                damageMod: damageRollMatch.groups.baseDamageMod?.replace(/[+\s]/g, ""),
                plusDamageRoll: damageRollMatch.groups.addDamageRoll,
                plusDamageType: damageRollMatch.groups.addDamageType?.toLowerCase(),
                plusDamageMod: damageRollMatch.groups.addDamageMod?.replace(/[+\s]/g, ""),
                versatileDamageRoll: damageRollMatch.groups.versatileDamageRoll,
                versatileDamageType: damageRollMatch.groups.versatileDamageType?.toLowerCase(),
                versatileDamageMod: damageRollMatch.groups.versatileDamageMod?.replace(/[+\s]/g, ""),
            }
        }
    }

    // Example: Dizzying Hex (2/Day; 1st-Level Spell)
    static parsePerDay(actionData) {
        const match = this.matchAndAnnotate(actionData.value.lines, sRegex.perDayCountFull)?.[0];
        if (!match) return;
        actionData.value.perDay = match.groups.perDay;
    }

    // Example: Ranged Weapon Attack: +7 to hit, range 150/600 ft., one target.
    static parseRange(actionData) {
        const match = this.matchAndAnnotate(actionData.value.lines, sRegex.range)?.[0];
        if (!match) return;
        actionData.value.range = {near: parseInt(match.groups.near), far: match.groups.far ? parseInt(match.groups.far) : null};
        if (sUtils.combineToString(actionData.value.lines.map(l => l.line)).match(/spell attack/i)) {
            actionData.value.type = "spell";
        } else {
            actionData.value.type = "weapon";
        }
    }

    // Example: Melee Weapon Attack: +8 to hit, reach 5 ft., one target.
    static parseReach(actionData) {
        const match = this.matchAndAnnotate(actionData.value.lines, sRegex.reach)?.[0];
        if (!match) return;
        actionData.value.reach = parseInt(match.groups.reach);
        if (sUtils.combineToString(actionData.value.lines.map(l => l.line)).match(/spell attack/i)) {
            actionData.value.type = "spell";
        } else {
            actionData.value.type = "weapon";
        }
    }

    // Example: Frost Breath (Recharge 5–6).
    static parseRecharge(actionData) {
        const match = this.matchAndAnnotate(actionData.value.lines, sRegex.recharge)?.[0];
        if (!match) return;
        actionData.value.recharge = parseInt(match.groups.recharge);
    }

    // Example: Naughty Mousey (3/Day; 5th-Level Spell; Concentration).
    static parseSpellAction(actionData) {
        const match = this.matchAndAnnotate(actionData.value.lines, sRegex.spellActionTitle)?.[0];
        if (!match || (!match.groups.spellLevel && !match.groups.concentration)) return;
        actionData.value.spell = {level: match.groups.spellLevel, concentration: !!match.groups.concentration};
    }

    // Example: Misty Step (3/Day). The mage casts Misty Step, using the same spellcasting ability as Spellcasting.
    static parseCastAction(actionData) {
        let lines = actionData.value.lines;
        if (!Array.isArray(lines)) {
            lines = [lines];
        }
        const text = sUtils.combineToString(lines.map(l => l.line));
        const match = [...text.matchAll(sRegex.castAction)]?.[0];
        if (!match) return;

        const spellMatches = this.matchAndAnnotate(actionData.value.lines, sRegex.castActionSpell, match.indices.groups.spellList[0], match.indices.groups.spellList[1]);

        const spells = spellMatches.map(sm => ({name: sm.groups.spellName, level: sm.groups.spellLevel}));
        actionData.value.castSpells = spells;
    }

    // Example: The hound exhales a 15-foot cone of frost.
    static parseTarget(actionData) {
        const match = this.matchAndAnnotate(actionData.value.lines, sRegex.target)?.[0];
        if (!match) return;
        actionData.value.target = {range: match.groups.areaRange || match.groups.range};
        if (match.groups.areaRange) {
            actionData.value.target.shape = match.groups.shape;
        } else {
            actionData.value.target.type = "creature";
            if (["one", "a"].includes(match.groups.targetsAmount)) {
                actionData.value.target.amount = 1;
            }
        }
    }

    // Separates the action/feature block into individual items, keeping the lines objects intact for further matching.
    static getBlockDatas(lines) {
        const validLines = lines.filter(l => l.line);

        // Pull out the entire spell block because it's formatted differently than all the other action blocks.
        const notSpellLines = [];
        const spellLines = [];
        let foundSpellBlock = false;

        // Start taking lines from the spell block when we've found the beginning until 
        // we've gotten into the spells and hit a line where the next line has a period.
        for (let index = 0; index < validLines.length; index++) {
            let l = validLines[index];

            if (!foundSpellBlock) {
                foundSpellBlock = l.line.match(/^innate spellcasting\b|^spellcasting\b/i) != null;
                if (foundSpellBlock && l.line === "Spellcasting" && !l.line.endsWith(".")) {
                    l.line = l.line + ".";
                }
            }

            // If we're inside of a spell block, store it off in the spell lines array,
            // otherwise store it into the not spell lines array.
            if (foundSpellBlock) {
                spellLines.push(l);
            } else {
                foundSpellBlock = false;
                notSpellLines.push(l);
            }

            // Check to see if we've reached the end of the spell block
            // by seeing if the next line is a title.
            const nextLineIsTitle = index < validLines.length - 1
                && validLines[index + 1].line.match(sRegex.getBlockTitle(this.cleanLines))
                && !validLines[index + 1].line.match(sRegex.spellGroup);

            if (foundSpellBlock && nextLineIsTitle) {
                // Add a period at the end so that blocks are extracted correctly.
                if (!spellLines[spellLines.length - 1].line.endsWith(".")) {
                    spellLines[spellLines.length - 1].line = spellLines[spellLines.length - 1].line + ".";
                }

                // Break out of the spell block.
                foundSpellBlock = false;
            }
        }

        const actionsLines = [...notSpellLines, ...spellLines];
        const titleMatchesLines = [...notSpellLines, ...spellLines.slice(0, 1)];
        
        let titleMatches = this.matchAndAnnotate(titleMatchesLines, sRegex.getBlockTitle(this.cleanLines));
        if (!titleMatches.length) {
            titleMatches = this.matchAndAnnotate(titleMatchesLines, sRegex.getVillainActionTitle(this.cleanLines));
        }

        let i = -1;
        let action;
        const actions = actionsLines.reduce((acc, actionLine) => {
            if (actionLine.matchData?.some(m => m.label === "title")) {
                if (action) {
                    acc.push(action);
                }
                action = new NameValueData(titleMatches[++i].groups.title, {lines: [actionLine]});
            } else {
                if (!action) {
                    action = new NameValueData("Description", {lines: []});
                }
                action.value.lines.push(actionLine);
            }
            return acc;
        }, []);
        if (action) {
            actions.push(action);
        }

        return actions;
    }

    static getSpells(spellBlock) {
        let spellRegex = sRegex.spellInnateLine;
        let spellcastingType = "innateSpellcasting";
        let spellHeaderMatches = this.matchAndAnnotate(spellBlock.value.lines, spellRegex);

        if (!spellHeaderMatches.length) {
            spellRegex = sRegex.spellLine;
            spellcastingType = "spellcasting";
            spellHeaderMatches = this.matchAndAnnotate(spellBlock.value.lines, spellRegex);
        }

        let spellGroups = [];

        if (spellHeaderMatches.length) {
            let introDescription = sUtils.combineToString(spellBlock.value.lines.map(l => l.line))
                .replace(/\n/g, " ")
                .slice(0, spellHeaderMatches[0].index)
                .trim();

            const spellGroupMatches = this.matchAndAnnotate(spellBlock.value.lines, sRegex.spellGroup);

            spellGroupMatches.forEach((spellGroupMatch, i) => {
                const nextSpellGroupMatch = spellGroupMatches[i+1];
                const spellListStart = spellGroupMatch.indices[0][1];
                const spellListEnd = nextSpellGroupMatch?.indices[0][0] || Infinity;
                const spellGroup = new NameValueData(spellGroupMatch.groups.spellGroup, []);
                const spellNameMatches = this.matchAndAnnotate(spellBlock.value.lines, sRegex.spellName, spellListStart, spellListEnd);
                let spellType, spellCount, spellLevel;
                for (const spellMatch of spellNameMatches) {
                    spellLevel = undefined;
                    let spellName = sUtils.capitalizeAll(spellMatch.groups.spellName).replace(/\(.*\)/, "").trim();
                    if (spellMatch.groups.spellLevel) {
                        spellLevel = parseInt(spellMatch.groups.spellLevel);
                    }
                    if (spellGroupMatch.groups.slots) {
                        spellType = "slots";
                        spellCount = parseInt(spellGroupMatch.groups.slots);
                    } else if (spellGroupMatch.groups.perDay) {
                        spellType = "innate";
                        spellCount = parseInt(spellGroupMatch.groups.perDay);
                    } else if (spellGroupMatch.groups.spellGroup.toLowerCase().includes("at will")) {
                        spellType = spellcastingType === "spellcasting" ? "cantrip" : "at will";
                    }
                    spellGroup.value.push({name: spellName, type: spellType, count: spellCount, level: spellLevel});
                    // Special info for Mage Armor (included in AC), so we can calculate later
                    if (spellName === "Mage Armor" && spellMatch.groups.affectsAC) {
                        this.actor.armor.types.push("mage");
                    }
                }
                spellGroups.push(spellGroup);
            });

            spellGroups = [new NameValueData("Description", introDescription), ...spellGroups];
        }

        const spellcastingDetailsMatches = this.matchAndAnnotate(spellBlock.value.lines, sRegex.spellcastingDetails);

        let spellcastingDetails = {};
        for (let match of spellcastingDetailsMatches) {
            if (match.groups.ability || match.groups.innateAbility) {
                spellcastingDetails.ability = match.groups.ability || match.groups.innateAbility;
            }
            if (match.groups.saveDc) {
                spellcastingDetails.saveDc = match.groups.saveDc;
            }
            if (match.groups.level) {
                spellcastingDetails.level = match.groups.level;
            }
        }

        return { spellcastingType, spellcastingDetails, spellInfo: spellGroups };
    }

    static parseOther(lines) {
        this.actor.otherInfo = lines.map(l => l.line);
    }

}