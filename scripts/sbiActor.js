import { sbiUtils as sUtils } from "./sbiUtils.js";
import { BlockID } from "./sbiData.js";
import { sbiRegex as sRegex } from "./sbiRegex.js";

export class sbiActor {
    static async convertCreatureToActorAsync(creatureData, selectedFolderId) {
        const actor = await Actor.create({
            name: sUtils.capitalizeAll(creatureData.name),
            type: "npc",
            folder: selectedFolderId
        });

        await this.setAbilitiesAsync(actor, creatureData);
        await this.setActionsAsync(actor, creatureData);
        await this.setMajorActionAsync(actor, BlockID.legendaryActions, creatureData);
        await this.setMajorActionAsync(actor, BlockID.lairActions, creatureData);
        await this.setMajorActionAsync(actor, BlockID.villainActions, creatureData);
        await this.setMinorActionsAsync(actor, BlockID.bonusActions, creatureData);
        await this.setMinorActionsAsync(actor, BlockID.reactions, creatureData);
        await this.setArmorAsync(actor, creatureData);
        await this.setChallengeAsync(actor, creatureData);
        await this.setDamagesAndConditionsAsync(actor, creatureData);
        await this.setFeaturesAsync(actor, creatureData);
        await this.setHealthAsync(actor, creatureData);
        await this.setLanguagesAsync(actor, creatureData);
        await this.setRacialDetailsAsync(actor, creatureData);
        await this.setRoleAsync(actor, creatureData);
        await this.setSavingThrowsAsync(actor, creatureData);
        await this.setSensesAsync(actor, creatureData);
        await this.setSkillsAsync(actor, creatureData);
        await this.setSpeedAsync(actor, creatureData);
        await this.setSpells(actor, creatureData);
        await this.setSoulsAsync(actor, creatureData);

        return actor;
    }

    static async setActionsAsync(actor, creatureData) {
        for (const actionData of creatureData.actions) {
            const name = actionData.name;
            const lowerName = name.toLowerCase();
            const description = actionData.value;

            const itemData = {};
            itemData.name = sUtils.capitalizeAll(name);
            itemData.type = "feat";

            sUtils.assignToObject(itemData, "system.description.value", description);
            sUtils.assignToObject(itemData, "system.activation.type", "action");
            sUtils.assignToObject(itemData, "system.activation.cost", 1);

            // The "Multiattack" action isn't a real action, so there's nothing more to add to it.
            if (lowerName !== "multiattack") {
                // We'll assume that an NPC with stuff will have that stuff identified, equipped, attuned, etc.
                sUtils.assignToObject(itemData, "system.identified", true);
                sUtils.assignToObject(itemData, "system.equipped", true);
                sUtils.assignToObject(itemData, "system.attunement", 2);
                sUtils.assignToObject(itemData, "system.proficient", true);
                sUtils.assignToObject(itemData, "system.quantity", 1);

                this.setAttackOrSave(description, itemData, actor);
                this.setPerDay(name, itemData);
                this.setReach(description, itemData);
                this.setRecharge(name, itemData);
                this.setRange(description, itemData);
                this.setTarget(description, itemData);
            }

            if (game.system.version > "4" && !Object.keys(itemData.system.activities ?? {}).length) {
                let activityId = foundry.utils.randomID();
                sUtils.assignToObject(itemData, `system.activities.${activityId}`, {_id: activityId, type: "utility", activation: {type: "action", value: 1}});
            }

            // Remove Recharge information from the name
            const rechargeMatch = sRegex.recharge.exec(name);
            if (rechargeMatch) {
                itemData.name = itemData.name.slice(0, rechargeMatch.index).trim();
            }

            itemData.img = await sUtils.getImgFromPackItemAsync(itemData.name.toLowerCase());

            await this.setItemAsync(itemData, actor);
        }
    }

    // These are things like legendary, mythic, and lair actions
    static async setMajorActionAsync(actor, type, creatureData) {
        // Set the type of action this is.
        let activationType = "";
        const isLegendaryTypeAction = type === BlockID.legendaryActions || type === BlockID.villainActions;

        if (isLegendaryTypeAction) {
            activationType = "legendary";
        }

        // Create the items for each action.
        // NOTE: If we hit an exception here that 'creature[type]' is undefined, make sure
        // to add that type to the CreatureData constructor with a default array value.
        for (const actionData of creatureData[type]) {
            const actionName = actionData.name;
            const description = actionData.value;
            const itemData = {};
            itemData.name = actionName;
            itemData.type = "feat";

            sUtils.assignToObject(itemData, "system.description.value", description);

            if (actionName === "Description") {
                itemData.name = sUtils.camelToTitleCase(type);
                // Add these just so that it doesn't say the action is not equipped and not proficient in the UI.
                sUtils.assignToObject(itemData, "system.equipped", true);
                sUtils.assignToObject(itemData, "system.proficient", true);

                // Determine whether this is a legendary or lair action.
                if (type === BlockID.lairActions) {
                    sUtils.assignToObject(itemData, "flags.adnd5e.itemInfo.type", "lair");

                    // Lair actions don't use titles, so it's just one item with all actions included in the description 
                    // text. Because of that, we need to assign the type here instead of in the 'else' block below.
                    sUtils.assignToObject(itemData, "system.activation.type", "lair");

                    if (game.system.version > "4") {
                        let activityId = foundry.utils.randomID();
                        sUtils.assignToObject(itemData, `system.activities.${activityId}`, {
                            _id: activityId, type: "utility",
                            activation: {type: "lair"}
                        });
                    }

                    // What iniative count does the lair action activate?
                    const lairInitiativeRegex = /initiative count (?<count>\d+)/i;
                    const lairInitiativeMatch = lairInitiativeRegex.exec(description);

                    if (lairInitiativeMatch) {
                        await actor.update(sUtils.assignToObject({}, "system.resources.lair.value", true));
                        await actor.update(sUtils.assignToObject({}, "system.resources.lair.initiative", parseInt(lairInitiativeMatch.groups.count)));
                    }
                } else if (isLegendaryTypeAction) {
                    sUtils.assignToObject(itemData, "flags.adnd5e.itemInfo.type", "legendary");

                    // How many legendary actions can it take?
                    const legendaryActionMatch = sRegex.legendaryActionCount.exec(description);
                    const actionCount = legendaryActionMatch ? parseInt(legendaryActionMatch.groups.count) : 3;

                    await actor.update(sUtils.assignToObject({}, "system.resources.legact.value", actionCount));
                    await actor.update(sUtils.assignToObject({}, "system.resources.legact.max", actionCount));
                }
            } else {
                itemData.name = actionName;
                
                if (type === BlockID.lairActions) {
                    // This is to allow Lair Actions formatted like regular actions (with a title and a description).
                    activationType = "lair";
                    if (game.system.version > "4") {
                        let activityId = foundry.utils.randomID();
                        sUtils.assignToObject(itemData, `system.activities.${activityId}`, {
                            _id: activityId, type: "utility",
                            activation: {type: "lair"}
                        });
                    }
                    if (!actor.system.resources?.lair?.value) {
                        await actor.update(sUtils.assignToObject({}, "system.resources.lair.value", true));
                        await actor.update(sUtils.assignToObject({}, "system.resources.lair.initiative", 20));
                    }
                }

                sUtils.assignToObject(itemData, "system.activation.type", activationType);

                // How many actions does this cost?
                const actionCostMatch = sRegex.actionCost.exec(actionName);
                let actionCost = 1;

                if (actionCostMatch) {
                    actionCost = parseInt(actionCostMatch.groups.cost);
                    itemData.name = itemData.name.slice(0, actionCostMatch.index).trim();
                }
                
                this.setAttackOrSave(description, itemData, actor);
                this.setRecharge(itemData.name, itemData);
                sUtils.assignToObject(itemData, "system.consume.type", "attribute");
                sUtils.assignToObject(itemData, "system.consume.target", "resources.legact.value");
                sUtils.assignToObject(itemData, "system.consume.amount", actionCost);
                sUtils.assignToObject(itemData, "system.activation.cost", actionCost);

                if (isLegendaryTypeAction && game.system.version > "4") {
                    let activityId = foundry.utils.randomID();
                    sUtils.assignToObject(itemData, `system.activities.${activityId}`, {
                        _id: activityId, type: "utility",
                        activation: {type: "legendary", value: actionCost},
                        consumption: {
                            targets: [{
                                type: "attribute",
                                target: "resources.legact.value",
                                value: actionCost
                            }]
                        },
                    });
                }
            }

            // Clean up unnecessary activities
            if (game.system.version > "4") {
                if (Object.keys(itemData.system.activities || {}).length > 1) {
                    const cleanedActivities = {};
                    const activationType = Object.values(itemData.system.activities).find(a => a.type === "utility").activation.type;
                    Object.values(itemData.system.activities).filter(a => a.type !== "utility").forEach(a => {
                        sUtils.assignToObject(a, "activation.type", activationType);
                        cleanedActivities[a._id] = a;
                    });
                    itemData.system.activities = cleanedActivities;
                }
            }

            itemData.img = await sUtils.getImgFromPackItemAsync(itemData.name.toLowerCase());

            await this.setItemAsync(itemData, actor);
        }
    }

    // These are things like bonus actions and reactions.
    static async setMinorActionsAsync(actor, type, creatureData) {
        // NOTE: If we hit an exception here that 'creature[type]' is undefined, make sure
        // to add that type to the CreatureData constructor with a default array value.
        for (const actionData of creatureData[type]) {
            const name = actionData.name;
            const description = actionData.value;

            const itemData = {};
            itemData.name = sUtils.capitalizeAll(name);
            itemData.type = "feat";
            itemData.img = await sUtils.getImgFromPackItemAsync(name);

            sUtils.assignToObject(itemData, "system.description.value", description);
            sUtils.assignToObject(itemData, "system.activation.cost", 1);

            let activationType = null;

            if (type == BlockID.bonusActions) {
                activationType = "bonus";
            } else if (type === BlockID.reactions) {
                activationType = "reaction";
            }

            sUtils.assignToObject(itemData, "flags.adnd5e.itemInfo.type", activationType);
            sUtils.assignToObject(itemData, "system.activation.type", activationType);

            if (game.system.version > "4") {
                let activityId = foundry.utils.randomID();
                sUtils.assignToObject(itemData, `system.activities.${activityId}`, {
                    _id: activityId, type: "utility",
                    activation: {type: activationType}
                });
            }

            this.setPerDay(name, itemData);
            this.setRecharge(name, itemData);
            await this.setItemAsync(itemData, actor);
        }
    }

    static async setArmorAsync(actor, creatureData) {
        if (!creatureData.armor) return;

        const actorObj = {};
        const armorValue = creatureData.armor.ac;
        let foundArmorItems = false;

        for (const armorType of creatureData.armor.types) {
            if (armorType.toLowerCase() === "natural armor") {
                sUtils.assignToObject(actorObj, "system.attributes.ac.calc", "natural");
                sUtils.assignToObject(actorObj, "system.attributes.ac.flat", armorValue);

                foundArmorItems = true;
            } else {
                let item;
                item = await sUtils.getItemFromPacksAsync(armorType, "equipment");
                if (!item) {
                    item = await sUtils.getItemFromPacksAsync(`${armorType} armor`, "equipment");
                }
                if (item) {
                    item.system.equipped = true;
                    item.system.proficient = true;
                    item.system.attunement = 2;

                    await actor.createEmbeddedDocuments("Item", [item]);

                    foundArmorItems = true;
                }
            }
        }

        if (!foundArmorItems) {
            sUtils.assignToObject(actorObj, "system.attributes.ac.calc", "flat");
            sUtils.assignToObject(actorObj, "system.attributes.ac.flat", armorValue);
        }

        await actor.update(actorObj);
    }

    static async setAbilitiesAsync(actor, creatureData) {
        const actorObj = {};

        for (const data of creatureData.abilities) {
            const propPath = `system.abilities.${data.name.toLowerCase()}.value`;
            sUtils.assignToObject(actorObj, propPath, parseInt(data.value));
        }

        await actor.update(actorObj);
    }

    static async setChallengeAsync(actor, creatureData) {
        if (!creatureData.challenge) return;

        const actorObject = {};
        sUtils.assignToObject(actorObject, "system.details.cr", creatureData.challenge.cr);

        if (creatureData.challenge.xp) {
            sUtils.assignToObject(actorObject, "system.details.xp.value", creatureData.challenge.xp);
        }

        await actor.update(actorObject);
    }

    static async setDamagesAndConditionsAsync(actor, creatureData) {
        const actorObject = {};

        if (creatureData.standardConditionImmunities.length) {
            await actor.update(sUtils.assignToObject({}, "system.traits.ci.value", creatureData.standardConditionImmunities));
        }

        if (creatureData.specialConditionImmunities) {
            sUtils.assignToObject(actorObject, "system.traits.ci.custom", sUtils.capitalizeFirstLetter(creatureData.specialConditionImmunities))
        }

        await this.setDamageDataAsync(creatureData.standardDamageImmunities, creatureData.specialDamageImmunities, "di", actorObject);
        await this.setDamageDataAsync(creatureData.standardDamageResistances, creatureData.specialDamageResistances, "dr", actorObject);
        await this.setDamageDataAsync(creatureData.standardDamageVulnerabilities, creatureData.specialDamageVulnerabilities, "dv", actorObject);

        await actor.update(actorObject);
    }

    static async setFeaturesAsync(actor, creatureData) {
        for (const featureData of creatureData.features) {
            const name = featureData.name;
            const nameLower = name.toLowerCase();
            const description = featureData.value;
            const itemData = {};

            itemData.name = sUtils.capitalizeAll(name);
            itemData.type = "feat";

            sUtils.assignToObject(itemData, "system.description.value", description);

            if (nameLower.startsWith("legendary resistance")) {
                // Example:
                // Legendary Resistance (3/day)
                const resistanceCountRegex = /\((?<perDay>\d+)\/day\)/i;
                const resistanceMatch = resistanceCountRegex.exec(name);

                if (resistanceMatch) {
                    itemData.name = itemData.name.slice(0, resistanceMatch.index).trim();
                    await actor.update(sUtils.assignToObject({}, "system.resources.legres.value", parseInt(resistanceMatch.groups.perDay)));
                    await actor.update(sUtils.assignToObject({}, "system.resources.legres.max", parseInt(resistanceMatch.groups.perDay)));
                }

                sUtils.assignToObject(itemData, "system.activation.type", "special");
                sUtils.assignToObject(itemData, "system.consume.type", "attribute");
                sUtils.assignToObject(itemData, "system.consume.target", "resources.legres.value");
                sUtils.assignToObject(itemData, "system.consume.amount", 1);

                if (game.system.version > "4") {
                    let activityId = foundry.utils.randomID();
                    sUtils.assignToObject(itemData, `system.activities.${activityId}`, {
                        _id: activityId, type: "utility",
                        activation: {type: "special"},
                        consumption: {
                            targets: [{
                                type: "attribute",
                                target: "resources.legres.value",
                                value: 1
                            }]
                        },
                    });
                }
            }

            // Remove Recharge information from the name
            const rechargeMatch = sRegex.recharge.exec(name);
            if (rechargeMatch) {
                itemData.name = itemData.name.slice(0, rechargeMatch.index).trim();
            }

            this.setPerDay(name, itemData);
            if (itemData.system.uses?.value) {
                if (game.system.version > "4") {
                    let activityId = foundry.utils.randomID();
                    sUtils.assignToObject(itemData, `system.activities.${activityId}`, {
                        _id: activityId, type: "utility",
                        activation: {type: "special"}
                    });
                }
                sUtils.assignToObject(itemData, "system.activation.type", "special");
            }

            itemData.img = await sUtils.getImgFromPackItemAsync(itemData.name.toLowerCase());

            await this.setItemAsync(itemData, actor);
        }
    }

    static async setHealthAsync(actor, creatureData) {
        const actorObject = {};

        sUtils.assignToObject(actorObject, "system.attributes.hp.value", creatureData.health?.value || 0);
        sUtils.assignToObject(actorObject, "system.attributes.hp.max", creatureData.health?.value || 0);
        sUtils.assignToObject(actorObject, "system.attributes.hp.formula", creatureData.health?.formula || 0);

        await actor.update(actorObject);
    }

    static async setLanguagesAsync(actor, creatureData) {
        if (!creatureData.language) return;

        const knownValues = creatureData.language.knownLanguages.map(str => this.convertLanguage(str));
        const unknownValues = creatureData.language.unknownLanguages.map(str => this.convertLanguage(str));

        const actorObject = {};
        sUtils.assignToObject(actorObject, "system.traits.languages.value", knownValues);
        sUtils.assignToObject(actorObject, "system.traits.languages.custom", sUtils.capitalizeFirstLetter(unknownValues.join(";")));

        await actor.update(actorObject);
    }

    static async setRoleAsync(actor, creatureData) {
        if (!creatureData.role) return;

        await actor.update(sUtils.assignToObject({}, "system.details.source.custom", creatureData.role));
        await actor.update(sUtils.assignToObject({}, "system.details.source.book", "Flee, Mortals!"));
    }

    static async setSavingThrowsAsync(actor, creatureData) {
        const actorObject = {};

        for (const savingThrow of creatureData.savingThrows) {
            const name = savingThrow.toLowerCase();
            const propPath = `system.abilities.${name}.proficient`;
            sUtils.assignToObject(actorObject, propPath, 1);
        }

        await actor.update(actorObject);
    }

    static async setSensesAsync(actor, creatureData) {
        if (!creatureData.senses) return;

        const actorObject = {};
        const specialSenses = [];

        for (const sense of creatureData.senses) {
            const senseName = sense.name.toLowerCase();
            const senseRange = sense.value;
            if (senseName === "perception") {
                continue;
            } else if (senseName === "blindsight" || senseName === "darkvision" || senseName === "tremorsense" || senseName === "truesight") {
                sUtils.assignToObject(actorObject, `system.attributes.senses.${senseName}`, senseRange);
                switch (senseName) {
                    case "darkvision":
                        sUtils.assignToObject(actorObject, "token.dimSight", senseRange);
                        sUtils.assignToObject(actorObject, "prototypeToken.sight.range", senseRange);
                        break;
                    case "tremorsense":
                        sUtils.assignToObject(actorObject, "prototypeToken.detectionModes", (actorObject.prototypeToken?.detectionModes || []).concat([{enabled: true, id: "feelTremor", range: senseRange}]));
                        break;
                    case "blindsight":
                        sUtils.assignToObject(actorObject, "prototypeToken.detectionModes", (actorObject.prototypeToken?.detectionModes || []).concat([{enabled: true, id: "blindsight", range: senseRange}]));
                        break;
                    case "truesight":
                        sUtils.assignToObject(actorObject, "prototypeToken.detectionModes", (actorObject.prototypeToken?.detectionModes || []).concat([{enabled: true, id: "seeAll", range: senseRange}]));
                        break;
                    default:
                        break;
                }
            } else {
                const specialSense = sUtils.capitalizeFirstLetter(senseName);
                specialSenses.push(`${specialSense} ${senseRange} ft`);
            }
        }

        actorObject["system.attributes.senses.special"] = specialSenses.join('; ');

        await actor.update(actorObject);
    }

    static async setSkillsAsync(actor, creatureData) {
        // Calculate skill proficiency value by querying the actor data. This must happen after the abilities are set.
        // 1 is regular proficiency, 2 is double proficiency, etc.
        for (const skill of creatureData.skills) {
            const skillId = this.convertToShortSkill(skill.name);
            const skillMod = parseInt(skill.value);
            const actorSkill = actor.system.skills[skillId];
            const abilityMod = actor.system.abilities[actorSkill.ability].mod;
            const generalProf = actor.system.attributes.prof;
            const skillProf = (skillMod - abilityMod) / generalProf;

            await actor.update(sUtils.assignToObject({}, `system.skills.${skillId}.value`, skillProf));
        }
    }

    static async setSpells(actor, creatureData) {
        let name;
        const itemObject = {};

        if (creatureData.spellcasting.length) {
            name = "Spellcasting";
            await this.setSpellcastingAsync(creatureData.spellcasting, itemObject, actor, true);
        }

        if (creatureData.innateSpellcasting.length) {
            name = "Innate Spellcasting";
            await this.setSpellcastingAsync(creatureData.innateSpellcasting, itemObject, actor, false);
        }

        if (creatureData.utilitySpells.length) {
            name = "Utility Spells";
            await this.setSpellcastingAsync(creatureData.utilitySpells, itemObject, actor, false);
        }

        if (itemObject.data) {
            itemObject.name = sUtils.capitalizeAll(name);
            itemObject.type = "feat";

            // Look for spell attacks and set their ability modifier to match the spellcasting ability.
            for (const item of [...actor.items]) {
                if (item.system.actionType === "msak" || item.system.actionType === "rsak") {
                    item.update(sUtils.assignToObject({}, "system.ability", actor.system.attributes.spellcasting));
                }
            }

            await this.setItemAsync(itemObject, actor);
        }
    }

    static async setSoulsAsync(actor, creatureData) {
        if (!creatureData.souls) return;

        let description = "<p>Demons feast not on food or water, but on souls. These fuel their ";
        description += "bloodthirsty powers, and while starved for souls, a demon can scarcely think.</p>";
        description += "<p>A demon’s stat block states the number of souls a given demon ";
        description += "has already consumed at the beginning of combat, ";
        description += "both as a die expression and as an average number.</p>";

        const itemData = {};
        itemData.name = `Souls: ${creatureData.souls.value} (${creatureData.souls.formula})`;
        itemData.type = "feat";

        sUtils.assignToObject(itemData, "system.description.value", description);
        await this.setItemAsync(itemData, actor);
    }

    static async setSpeedAsync(actor, creatureData) {
        const speedData = creatureData.speeds.find(d => d.name.toLowerCase() === "speed");

        if (speedData != null) {
            const speedValue = speedData.value;

            await actor.update({
                "system": {
                    "attributes": {
                        "speed": {
                            "value": speedValue
                        },
                        "movement": {
                            "walk": parseInt(speedValue)
                        }
                    }
                }
            })
        }

        const otherSpeeds = creatureData.speeds.filter(d => d != speedData);

        if (otherSpeeds.length) {
            await actor.update({
                "system": {
                    "attributes": {
                        "speed": {
                            "special": otherSpeeds
                                .map(d => `${sUtils.capitalizeAll(d.name)} ${d.value} ft`)
                                .join(", ")
                        },
                        "movement": {
                            "burrow": parseInt(otherSpeeds.find(d => d.name.toLowerCase() === "burrow")?.value ?? 0),
                            "climb": parseInt(otherSpeeds.find(d => d.name.toLowerCase() === "climb")?.value ?? 0),
                            "fly": parseInt(otherSpeeds.find(d => d.name.toLowerCase() === "fly")?.value ?? 0),
                            "swim": parseInt(otherSpeeds.find(d => d.name.toLowerCase() === "swim")?.value ?? 0),
                            "hover": otherSpeeds.find(d => d.name.toLowerCase() === "hover") != undefined
                        }
                    }
                }
            })
        }
    }

    static async setRacialDetailsAsync(actor, creatureData) {
        const getSizeAbbreviation = (size) => {
            switch (size) {
                case "small":
                    return "sm";
                case "medium":
                    return "med";
                case "large":
                    return "lg";
                case "gargantuan":
                    return "grg";
                default:
                    return size;
            }
        };

        const sizeValue = creatureData.size.toLowerCase();
        const swarmSizeValue = creatureData.swarmSize?.toLowerCase();
        const detailsData = {};

        sUtils.assignToObject(detailsData, "system.traits.size", getSizeAbbreviation(sizeValue));

        if (swarmSizeValue) {
            sUtils.assignToObject(detailsData, "system.details.type.swarm", getSizeAbbreviation(swarmSizeValue));
        }

        sUtils.assignToObject(detailsData, "system.details.alignment", sUtils.capitalizeAll(creatureData.alignment?.trim()));
        sUtils.assignToObject(detailsData, "system.details.type.subtype", sUtils.capitalizeAll(creatureData.race?.trim()));
        sUtils.assignToObject(detailsData, "system.details.type.value", creatureData.type?.trim().toLowerCase());

        const hasCustomType = creatureData.customType?.trim();
        if (hasCustomType) {
            sUtils.assignToObject(detailsData, "system.details.type.value", "custom");
            sUtils.assignToObject(detailsData, "system.details.type.custom", sUtils.capitalizeAll(creatureData.customType?.trim()));
        }

        await actor.update(detailsData);
    }

    static async setSpellcastingAsync(spellDatas, itemData, actor, isSpellcasting) {
        const description = spellDatas[0].value;
        const spells = spellDatas.slice(1);

        let spellObjs = [];

        if (spells.length) {
            const descriptionLines = [];
            descriptionLines.push(`<p>${description}</p>`);

            // Put spell groups on their own lines in the description so that it reads better.
            for (const spell of spells) {
                descriptionLines.push(`<p><b>${spell.name}</b>: ${spell.value.join(", ")}</p>`);

                const spellLevel = spell.name.toLowerCase();
                const spellNames = spell.value;
                const spellMatches = [...spellLevel.matchAll(sRegex.spellcastingDetails)];
                const slots = this.getGroupValue("slots", spellMatches);
                const perDay = this.getGroupValue("perDay", spellMatches);

                let spellType;
                let spellCount;

                if (slots) {
                    spellType = "slots";
                    spellCount = parseInt(slots);
                } else if (perDay) {
                    spellType = "innate";
                    spellCount = parseInt(perDay);
                } else if (spellLevel.includes("at will")) {
                    spellType = isSpellcasting ? "cantrip" : "at will";
                }

                for (const spellName of spellNames) {
                    // Remove text in parenthesis when storing the spell name for lookup later.
                    let cleanName = spellName.replace(/\(.*\)/, "").trim()

                    spellObjs.push({
                        "name": cleanName,
                        "type": spellType,
                        "count": spellCount
                    });
                }
            }

            sUtils.assignToObject(itemData, "system.description.value", descriptionLines.join(""));
        } else {
            // Some spell casting description bury the spell in the description, like Mehpits.
            // Example: The mephit can innately cast fog cloud, requiring no material components.
            var match = sRegex.spellInnateSingle.exec(description);

            if (match) {
                const spell = await sUtils.getItemFromPacksAsync(match.groups.spellName, "spell");

                if (spell) {
                    const perDay = this.getGroupValue("perDay", [...itemData.name.matchAll(sRegex.spellcastingDetails)]);

                    spellObjs.push({
                        "name": spell.name,
                        "type": "innate",
                        "count": parseInt(perDay)
                    });
                }
            }
        }

        // Set spellcaster level
        const spellcasterLevelMatch = sRegex.spellcasterLevel.exec(description);

        if (spellcasterLevelMatch) {
            await actor.update(sUtils.assignToObject({}, "system.details.spellLevel", parseInt(spellcasterLevelMatch.groups.level)));
        }

        // Set spellcasting ability.
        const spellMatches = [...description.matchAll(sRegex.spellcastingDetails)];
        let spellcastingAbility = this.getGroupValue("ability1", spellMatches);

        if (spellcastingAbility == null) {
            spellcastingAbility = this.getGroupValue("ability2", spellMatches);
        }

        if (spellcastingAbility != null) {
            await actor.update(sUtils.assignToObject({}, "system.attributes.spellcasting", this.convertToShortAbility(spellcastingAbility)));
        }

        // Add spells to actor.
        for (const spellObj of spellObjs) {
            const spell = await sUtils.getItemFromPacksAsync(spellObj.name, "spell");

            if (spell) {
                if (spellObj.type === "slots") {
                    // Update the actor's number of slots per level.
                    let spellObject = {};
                    sUtils.assignToObject(spellObject, `system.spells.spell${spell.system.level}.value`, spellObj.count);
                    sUtils.assignToObject(spellObject, `system.spells.spell${spell.system.level}.max`, spellObj.count);
                    sUtils.assignToObject(spellObject, `system.spells.spell${spell.system.level}.override`, spellObj.count);

                    await actor.update(spellObject);
                } else if (spellObj.type === "innate") {
                    if (spellObj.count) {
                        sUtils.assignToObject(spell, "system.uses.value", spellObj.count);
                        sUtils.assignToObject(spell, "system.uses.max", spellObj.count);
                        sUtils.assignToObject(spell, "system.uses.per", "day");
                        sUtils.assignToObject(spell, "system.preparation.mode", "innate");
                        if (game.system.version > "4") {
                            let mainSpellActivityId = Object.values(spell.system.activities || {})[0]._id;
                            sUtils.assignToObject(spell, `system.activities.${mainSpellActivityId}.consumption.targets`, [{
                                type: "itemUses",
                                value: 1
                            }]);
                            sUtils.assignToObject(spell, `system.uses.recovery`, [{
                                period: "day",
                                type: "recoverAll"
                            }]);
                        }
                    } else {
                        sUtils.assignToObject(spell, "system.preparation.mode", "atwill");
                    }
                } else if (spellObj.type === "at will") {
                    sUtils.assignToObject(spell, "system.preparation.mode", "atwill");
                } else if (spellObj.type === "cantrip") {
                    // Don't need to set anything special because it should already be set on the spell we retrieved from the pack.
                }

                // Add the spell to the character sheet if it doesn't exist already.
                if (!actor.items.getName(spell.name)) {
                    await actor.createEmbeddedDocuments("Item", [spell]);
                }
            }
        }
    }

    // ===============================
    // Utilities
    // ===============================

    static convertLanguage(language) {
        let result = language.toLowerCase();

        switch (result) {
            case "deep speech":
                result = "deep";
                break;
            case "thieves' cant":
                result = "cant";
                break;
            default:
                break;
        }

        return result;
    }

    static convertToShortSkill(skillName) {
        const skill = skillName.toLowerCase();

        switch (skill) {
            case "acrobatics":
                return "acr";
            case "animal handling":
                return "ani";
            case "arcana":
                return "arc";
            case "athletics":
                return "ath";
            case "deception":
                return "dec";
            case "history":
                return "his";
            case "insight":
                return "ins";
            case "intimidation":
                return "itm";
            case "investigation":
                return "inv";
            case "medicine":
                return "med";
            case "nature":
                return "nat";
            case "perception":
                return "prc";
            case "performance":
                return "prf";
            case "persuasion":
                return "per";
            case "religion":
                return "rel";
            case "sleight of hand":
                return "slt";
            case "stealth":
                return "ste";
            case "survival":
                return "sur";
            default:
                return skill;
        }
    }

    static convertToShortAbility(abilityName) {
        const ability = abilityName.toLowerCase();

        switch (ability) {
            case "strength":
                return "str";
            case "dexterity":
                return "dex";
            case "constitution":
                return "con";
            case "intelligence":
                return "int";
            case "wisdom":
                return "wis";
            case "charisma":
                return "cha";
            default:
                return ability;
        }
    }

    static async setDamageDataAsync(standardDamages, specialDamage, damageID, actorData) {
        if (standardDamages.length) {
            sUtils.assignToObject(actorData, `system.traits.${damageID}.value`, standardDamages)
        }

        if (specialDamage) {
            const specialDamagesLower = specialDamage.toLowerCase();

            // "mundane attacks" is an MCDM thing.
            if (specialDamagesLower.includes("nonmagical weapons")
                || specialDamagesLower.includes("nonmagical attacks")
                || specialDamagesLower.includes("mundane attacks")) {
                sUtils.assignToObject(actorData, `system.traits.${damageID}.bypasses`, "mgc")
            }

            if (specialDamagesLower.includes("adamantine")) {
                sUtils.assignToObject(actorData, `system.traits.${damageID}.bypasses`, ["ada", "mgc"])
            }

            if (specialDamagesLower.includes("silvered")) {
                sUtils.assignToObject(actorData, `system.traits.${damageID}.bypasses`, ["sil", "mgc"])
            }

            // If any bypasses have been set, then assume Foundry will take care of setting the special damage text.
            if (actorData.data && !actorData.system.traits[damageID]?.bypasses) {
                sUtils.assignToObject(actorData, `system.traits.${damageID}.custom`, sUtils.capitalizeFirstLetter(specialDamage))
            }
        }
    }

    static async setItemAsync(itemData, actor) {
        // Add an appropriate icon if the item doesn't already have one just so that it looks 
        // better next to ones that do have an icon.
        if (!itemData.img) {
            if (itemData.type === "weapon") {
                itemData.img = "icons/svg/sword.svg";
            } else if (itemData.system.activation?.cost) {
                itemData.img = "icons/svg/combat.svg";
            } else if (itemData.type === "feat") {
                itemData.img = "icons/svg/book.svg";
            } else {
                itemData.img = "icons/svg/d20.svg";
            }
        }

        const item = new Item(itemData);
        await actor.createEmbeddedDocuments("Item", [item.toObject()]);
    }

    // Example:
    // Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10(2d6 + 3) slashing damage plus 3(1d6) acid damage.
    // or
    // Frost Breath (Recharge 5–6). The hound exhales a 15-foot cone of frost. Each creature in the cone must make a DC 13 
    // Dexterity saving throw, taking 44(8d10) cold damage on a failed save or half as much damage on a successful one.
    static setAttackOrSave(description, itemData, actor) {
        // Some attacks include a saving throw, so we'll just check for both attack rolls and saving throw rolls
        let attackDescription = description;
        let saveDescription = null;
        let attackMatch = null;
        const saveMatch = sRegex.savingThrowDetails.exec(description) || sRegex.savingThrowDetails24.exec(description);
        let attackActivityId, saveActivityId;

        if (saveMatch) {
            attackDescription = description.slice(0, saveMatch.index);
            saveDescription = description.slice(saveMatch.index);
        }

        if (attackDescription?.length) {
            attackMatch = sRegex.attack.exec(attackDescription) || sRegex.attack24.exec(attackDescription);
            if (attackMatch) {
                itemData.type = "weapon";
                if (game.system.version > "4") {
                    attackActivityId = foundry.utils.randomID();
                    sUtils.assignToObject(itemData, "system.type.value", "natural");
                    sUtils.assignToObject(itemData, `system.activities.${attackActivityId}`, {
                        _id: attackActivityId, type: "attack", activation: {type: "action", value: 1},
                        attack: {ability: actor.system.abilities.str.mod > actor.system.abilities.dex.mod ? "str" : "dex"}
                    });
                } else {
                    sUtils.assignToObject(itemData, "system.weaponType", "natural");
                    sUtils.assignToObject(itemData, "system.ability", actor.system.abilities.str.mod > actor.system.abilities.dex.mod ? "str" : "dex");
                }

                this.setDamageRolls("attack", attackDescription, itemData, actor);
            }
        }

        if (saveDescription) {
            saveActivityId = foundry.utils.randomID();

            if (game.system.version > "4") {
                sUtils.assignToObject(itemData, `system.activities.${saveActivityId}`, {_id: saveActivityId, type: "save", activation: {type: "action", value: 1}});
            }

            if (!attackMatch) {
                sUtils.assignToObject(itemData, "system.actionType", "save");
            }

            const savingThrowMatch = sRegex.savingThrowDetails.exec(description) || sRegex.savingThrowDetails24.exec(description);
            if (savingThrowMatch) {
                const dc = savingThrowMatch.groups.saveDc;
                const ability = savingThrowMatch.groups.saveAbility;

                if (game.system.version > "4") {
                    sUtils.assignToObject(itemData, `system.activities.${saveActivityId}.save`, {ability: this.convertToShortAbility(ability), dc: {formula: parseInt(dc)}});
                } else {
                    sUtils.assignToObject(itemData, "system.save.ability", this.convertToShortAbility(ability));
                    sUtils.assignToObject(itemData, "system.save.dc", parseInt(dc));
                    sUtils.assignToObject(itemData, "system.save.scaling", "flat");
                }

                this.setDamageRolls("save", saveDescription, itemData, actor);
            }
        }
    }

    // Example: Dizzying Hex (2/Day; 1st-Level Spell)
    static setPerDay(text, itemData) {
        const match = sRegex.perDayDetails.exec(text);

        if (match) {
            const uses = match.groups.perDay;
            sUtils.assignToObject(itemData, "system.uses.value", parseInt(uses));
            sUtils.assignToObject(itemData, "system.uses.max", uses);
            sUtils.assignToObject(itemData, "system.uses.per", "day");
        }
    }

    // Example: Ranged Weapon Attack: +7 to hit, range 150/600 ft., one target.
    static setRange(text, itemData) {
        const match = sRegex.range.exec(text);

        if (match) {
            const nearRange = parseInt(match.groups.near);
            const farRange = match.groups.far ? parseInt(match.groups.far) : null;

            sUtils.assignToObject(itemData, "system.range.value", nearRange);
            sUtils.assignToObject(itemData, "system.range.long", farRange);
            sUtils.assignToObject(itemData, "system.range.units", "ft");
            sUtils.assignToObject(itemData, "system.ability", "dex");

            if (text.match(/spell attack/i)) {
                sUtils.assignToObject(itemData, "system.actionType", "rsak");

                if (game.system.version > "4") {
                    let attackActivityId = Object.values(itemData.system.activities).find(a => a.type == "attack")._id;
                    sUtils.assignToObject(itemData, `system.activities.${attackActivityId}.attack.type.value`, "ranged");
                    sUtils.assignToObject(itemData, `system.activities.${attackActivityId}.attack.type.classification`, "spell");
                    sUtils.assignToObject(itemData, `system.activities.${attackActivityId}.attack.ability`, "spellcasting");
                }
            } else {
                sUtils.assignToObject(itemData, "system.actionType", "rwak");

                if (game.system.version > "4") {
                    let attackActivityId = Object.values(itemData.system.activities).find(a => a.type == "attack")._id;
                    sUtils.assignToObject(itemData, `system.activities.${attackActivityId}.attack.type.value`, "ranged");
                    sUtils.assignToObject(itemData, `system.activities.${attackActivityId}.attack.ability`, "");
                }
            }
        }
    }

    // Example: Frost Breath (Recharge 5–6).
    static setRecharge(text, itemData) {
        const match = sRegex.recharge.exec(text);

        if (match) {
            sUtils.assignToObject(itemData, "system.recharge.value", parseInt(match.groups.recharge));
            sUtils.assignToObject(itemData, "system.recharge.charged", true);
            if (game.system.version > "4") {
                sUtils.assignToObject(itemData, "system.uses", {max: "1", recovery: [{period: "recharge", formula: parseInt(match.groups.recharge)}]});
            }
        }
    }

    // Example: Melee Weapon Attack: +8 to hit, reach 5 ft., one target.
    static setReach(text, itemData) {
        const match = sRegex.reach.exec(text);

        if (match) {
            const reach = parseInt(match.groups.reach);

            sUtils.assignToObject(itemData, "system.range.value", reach);
            sUtils.assignToObject(itemData, "system.range.units", "ft");

            if (text.match(/spell attack/i)) {
                sUtils.assignToObject(itemData, "system.actionType", "msak");

                if (game.system.version > "4") {
                    let attackActivityId = Object.values(itemData.system.activities).find(a => a.type == "attack")._id;
                    sUtils.assignToObject(itemData, `system.activities.${attackActivityId}.attack.type.classification`, "spell");
                    sUtils.assignToObject(itemData, `system.activities.${attackActivityId}.attack.ability`, "spellcasting");
                }
            } else {
                sUtils.assignToObject(itemData, "system.actionType", "mwak");
            }
        }
    }

    // Example: The hound exhales a 15-foot cone of frost.
    static setTarget(text, itemData) {
        const match = sRegex.target.exec(text);

        if (match) {
            sUtils.assignToObject(itemData, "system.target.value", match.groups.range);
            sUtils.assignToObject(itemData, "system.target.type", match.groups.shape);
            sUtils.assignToObject(itemData, "system.target.units", "ft");

            if (game.system.version > "4") {
                let saveActivityId = Object.values(itemData.system.activities || {}).find(a => a.type == "save")?._id;
                if (saveActivityId) {
                    sUtils.assignToObject(itemData, `system.activities.${saveActivityId}.target.template.size`, match.groups.range);
                    sUtils.assignToObject(itemData, `system.activities.${saveActivityId}.target.template.type`, match.groups.shape);
                }
            }
        }
    }

    static setDamageRolls(activity, description, itemData, actor) {
        // const regexQuery = sUtils.format(sbiRegex.damageRollsQuery, lookup);
        // const regex = new RegExp(regexQuery, "i");
        // const match = .exec(description);
        const match = sRegex.damageRoll.exec(description);

        if (match) {
            const damageRoll = match.groups.damageRoll1;
            const damageType = match.groups.damageType1;
            const hasDamageMod = match.groups.damageMod1 != undefined;
            const plusDamageRoll = match.groups.damageRoll2;
            const plusDamageType = match.groups.damageType2;
            const plusHasDamageMod = match.groups.damageMod2 != undefined;

            // Set the damage rolls and types. I've never seen more than two damage rolls for one attack.
            const damageParts = [];

            if (damageRoll && damageType) {
                var modText = hasDamageMod ? " + @mod" : "";
                damageParts.push([`${damageRoll}${modText}`, damageType]);
            }

            if (plusDamageRoll && plusDamageType) {
                var modText = plusHasDamageMod ? " + @mod" : "";
                damageParts.push([`${plusDamageRoll}${modText}`, plusDamageType]);
            }

            if (game.system.version > "4") {
                let activityId = Object.values(itemData.system.activities).find(a => a.type == activity)._id;
                let parts = [];
                if (activity == "attack" && !hasDamageMod) {
                    sUtils.assignToObject(itemData, `system.activities.${activityId}.damage.includeBase`, false);
                }
                if (activity == "save" || !hasDamageMod) {
                    if (damageRoll.includes("d")) {
                        parts.push({
                            number: parseInt(damageRoll.split("d")[0]),
                            denomination: parseInt(damageRoll.split("d")[1]),
                            types: [damageType]
                        });
                    } else {
                        parts.push({custom: {enabled: true, formula: damageRoll}});
                    }
                }
                if (damageParts.length > 1) {
                    if (damageRoll.includes("d")) {
                        parts.push({
                            number: parseInt(plusDamageRoll.split("d")[0]),
                            denomination: parseInt(plusDamageRoll.split("d")[1]),
                            types: [plusDamageType]
                        });
                    } else {
                        parts.push({custom: {enabled: true, formula: plusDamageRoll}});
                    }
                }
                sUtils.assignToObject(itemData, `system.activities.${activityId}.damage.parts`, parts);
            }

            if (itemData.system.damage === undefined) {
                itemData.system.damage = {};
            }

            if (damageParts.length) {
                const currentParts = itemData.system.damage.parts ?? [];
                itemData.system.damage.parts = currentParts.concat(damageParts);
            }

            // If the ability for the damage hasn't been set, try to find the correct 
            // one to use so that it doesn't just default to Strength.
            if (!itemData.system.ability) {
                if (match.groups.damageMod1) {
                    const damageMod = parseInt(match.groups.damageMod1);

                    if (damageMod === actor.system.abilities.str.mod) {
                        sUtils.assignToObject(itemData, "system.ability", "str");
                    } else if (damageMod === actor.system.abilities.dex.mod) {
                        sUtils.assignToObject(itemData, "system.ability", "dex");
                    } else if (damageMod === actor.system.abilities.con.mod) {
                        sUtils.assignToObject(itemData, "system.ability", "con");
                    } else if (damageMod === actor.system.abilities.int.mod) {
                        sUtils.assignToObject(itemData, "system.ability", "int");
                    } else if (damageMod === actor.system.abilities.wis.mod) {
                        sUtils.assignToObject(itemData, "system.ability", "wis");
                    } else if (damageMod === actor.system.abilities.cha.mod) {
                        sUtils.assignToObject(itemData, "system.ability", "cha");
                    }
                }
            }
        }

        const versatilematch = sRegex.versatile.exec(description);

        if (versatilematch) {
            itemData.system.damage.versatile = versatilematch.groups.damageRoll;

            if (itemData.system.properties) {
                itemData.system.properties.ver = true;
            }
        }
    }

    static getGroupValue(group, matches) {
        if (matches && matches.length) {
            return matches.map(m => m.groups[group]).find(val => val);
        }

        return null;
    }
}
