export const Blocks = {
    abilities: {id: "abilities", name: "Abilities", top: true},
    actions: {id: "actions", name: "Actions"},
    armor: {id: "armor", name: "Armor", top: true},
    bonusActions: {id: "bonusActions", name: "Bonus Actions"},
    challenge: {id: "challenge", name: "Challenge", top: true},
    conditionImmunities: {id: "conditionImmunities", name: "Condition Immunities", top: true},
    damageImmunities: {id: "damageImmunities", name: "Damage Immunities", top: true},
    immunities2024: {id: "immunities2024", name: "Immunities (2024)", top: true},
    damageResistances: {id: "damageResistances", name: "Damage Resistances", top: true},
    damageVulnerabilities: {id: "damageVulnerabilities", name: "Damage Vulnerabilities", top: true},
    features: {id: "features", name: "Features"},
    gear: {id: "gear", name: "Gear", top: true},
    health: {id: "health", name: "Health", top: true},
    initiative: {id: "initiative", name: "Initiative", top: true},
    lairActions: {id: "lairActions", name: "Lair Actions"},
    languages: {id: "languages", name: "Languages", top: true},
    legendaryActions: {id: "legendaryActions", name: "Legendary Actions"},
    mythicActions: {id: "mythicActions", name: "Mythic Actions"},
    name: {id: "name", name: "Name"},
    proficiencyBonus: {id: "proficiencyBonus", name: "Proficiency Bonus", top: true},
    racialDetails: {id: "racialDetails", name: "Racial Details", top: true},
    reactions: {id: "reactions", name: "Reactions"},
    savingThrows: {id: "savingThrows", name: "Saving Throws", top: true},
    senses: {id: "senses", name: "Senses", top: true},
    skills: {id: "skills", name: "Skills", top: true},
    souls: {id: "souls", name: "Souls", top: true},
    source: {id: "source", name: "Source", top: true},
    speed: {id: "speed", name: "Speed", top: true},
    traits: {id: "traits", name: "Traits"},
    utilitySpells: {id: "utilitySpells", name: "Utility Spells"},
    villainActions: {id: "villainActions", name: "Villain Actions"},
    otherBlock: {id: "otherBlock", name: "Other (Bio)"}
}

export class DamageConditionId {
    static immunities = "immunities";
    static resistances = "resistances";
    static vulnerabilities = "vulnerabilities";
}

export const KnownCreatureTypes = [
    "aberration",
    "celestial",
    "dragon",
    "fey",
    "giant",
    "monstrosity",
    "plant",
    "beast",
    "construct",
    "elemental",
    "fiend",
    "humanoid",
    "ooze",
    "undead"
];

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
ac: int
types: string[]
*/
export class ArmorData {
    constructor(ac, types) {
        this.ac = ac;
        this.types = types || [];
    }
}

/*
cr: int
xp: int
pb: int
*/
export class ChallengeData {
    constructor(cr, xp, pb) {
        this.cr = cr;
        this.xp = xp;
        this.pb = pb;
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
knownLanguages: string[]
unknownLanguages: string[]
telepathy: int
*/
export class LanguageData {
    constructor(knownLanguages, unknownLanguages, telepathy) {
        this.knownLanguages = knownLanguages;
        this.unknownLanguages = unknownLanguages;
        this.telepathy = telepathy;
    }
}

