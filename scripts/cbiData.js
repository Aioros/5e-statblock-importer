export const Blocks = {
    name: {id: "name", name: "Class Name"},
    level: {id: "level", name: "Level", top: true},
    hitDie: {id: "hitDie", name: "Hit Die", top: true},
    hitPoints: {id: "hitPoints", name: "Hit Points", top: true},
    proficiencyBonus: {id: "proficiencyBonus", name: "Proficiency Bonus", top: true},
    armorProficiencies: {id: "armorProficiencies", name: "Armor Proficiencies", top: true},
    weaponProficiencies: {id: "weaponProficiencies", name: "Weapon Proficiencies", top: true},
    toolProficiencies: {id: "toolProficiencies", name: "Tool Proficiencies", top: true},
    savingThrows: {id: "savingThrows", name: "Saving Throw Proficiencies", top: true},
    skills: {id: "skills", name: "Skill Proficiencies", top: true},
    equipment: {id: "equipment", name: "Equipment", top: true},
    classFeatures: {id: "classFeatures", name: "Class Features"},
    subclass: {id: "subclass", name: "Subclass", top: true},
    subclassFeatures: {id: "subclassFeatures", name: "Subclass Features"},
    spellcasting: {id: "spellcasting", name: "Spellcasting"},
    spellSlots: {id: "spellSlots", name: "Spell Slots", top: true},
    cantrips: {id: "cantrips", name: "Cantrips"},
    spells: {id: "spells", name: "Spells"},
    multiclassing: {id: "multiclassing", name: "Multiclassing", top: true},
    otherBlock: {id: "otherBlock", name: "Other (Description)"}
}

/*
name: string
value: object
*/
export class NameValueData {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
}

/*
level: int
hitDie: string (e.g., "1d8")
*/
export class LevelData {
    constructor(level, hitDie) {
        this.level = level;
        this.hitDie = hitDie;
    }
}

/*
value: int
diceFormula: string
*/
export class RollData {
    constructor(value, diceFormula) {
        this.value = value;
        this.formula = diceFormula;
    }
}

/*
name: string
level: int
description: string
*/
export class FeatureData {
    constructor(name, level, description) {
        this.name = name;
        this.level = level;
        this.description = description;
    }
}

/*
ability: string (e.g., "int", "wis", "cha")
dc: int
attackBonus: int
*/
export class SpellcastingData {
    constructor(ability, dc, attackBonus) {
        this.ability = ability;
        this.dc = dc;
        this.attackBonus = attackBonus;
    }
}

export const KnownAbilities = [
    "str", "dex", "con", "int", "wis", "cha"
];

export const KnownSkills = [
    "acrobatics", "animal handling", "arcana", "athletics",
    "deception", "history", "insight", "intimidation",
    "investigation", "medicine", "nature", "perception",
    "performance", "persuasion", "religion", "sleight of hand",
    "stealth", "survival"
];
