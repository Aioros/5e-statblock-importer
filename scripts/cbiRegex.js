import { Blocks } from "./cbiData.js";

export class cbiRegex {
    // Block header patterns - identify which section a line belongs to
    static levelHeader = /^(level|class level|lvl)[:\s]/i;
    static hitDieHeader = /^(hit die|hit dice|hd)[:\s]/i;
    static hitPointsHeader = /^(hit points|hp|health)[:\s]/i;
    static proficiencyBonusHeader = /^(proficiency bonus|prof bonus|pb)[:\s]/i;
    static armorProficienciesHeader = /^(armor proficienc(y|ies))[:\s]/i;
    static weaponProficienciesHeader = /^(weapon proficienc(y|ies))[:\s]/i;
    static toolProficienciesHeader = /^(tool proficienc(y|ies))[:\s]/i;
    static savingThrowsHeader = /^(saving throw(s)?( proficienc(y|ies))?)[:\s]/i;
    static skillsHeader = /^(skill(s)?( proficienc(y|ies))?)[:\s]/i;
    static equipmentHeader = /^(equipment|starting equipment)[:\s]/i;
    static classFeaturesHeader = /^(class features?|features?)[:\s]/i;
    static subclassHeader = /^(subclass|archetype|path|tradition|patron|domain|circle)[:\s]/i;
    static subclassFeaturesHeader = /^(subclass features?|archetype features?)[:\s]/i;
    static spellcastingHeader = /^(spellcasting|magic)[:\s]/i;
    static spellSlotsHeader = /^(spell slots?)[:\s]/i;
    static cantripsHeader = /^(cantrips?( known)?)[:\s]/i;
    static spellsHeader = /^(spells?( known)?|prepared spells?)[:\s]/i;
    static multiclassingHeader = /^(multiclassing)[:\s]/i;

    // Data extraction patterns
    static levelDetails = /(?:level|lvl)\s*(\d+)/i;
    static hitDieDetails = /(\d+d\d+)/i;
    static hitPointsDetails = /(\d+)\s*(?:\+\s*(.+))?/;
    static proficiencyBonusDetails = /\+?(\d+)/;

    // Feature pattern - matches "Feature Name (Level X)" or "Feature Name"
    static featureTitle = /^([^(]+?)(?:\s*\((?:level\s*)?(\d+)\))?$/i;

    // Ability pattern - matches ability names
    static abilityPattern = /(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)/gi;

    // Skill pattern - matches skill names
    static skillPattern = /(acrobatics|animal handling|arcana|athletics|deception|history|insight|intimidation|investigation|medicine|nature|perception|performance|persuasion|religion|sleight of hand|stealth|survival)/gi;

    // Spellcasting ability pattern
    static spellcastingAbility = /(?:spellcasting ability|spell save dc|spell attack)[^.]*?(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)/i;

    // Spell level pattern - matches "1st level", "2nd level", etc.
    static spellLevelPattern = /(\d+)(?:st|nd|rd|th)\s*level/i;

    // Cantrip pattern
    static cantripPattern = /cantrip/i;

    // Pure block header - a line that ends with a colon and has data on the next line
    static pureBlockHeader = /^[^:]+:\s*$/;

    /**
     * Returns the first block that matches the given line
     * @param {string} line - The line to test
     * @returns {object|null} - The matching block or null
     */
    static getFirstMatch(line) {
        const trimmedLine = line.trim();
        if (!trimmedLine) return null;

        // Check each block header pattern
        if (this.levelHeader.test(trimmedLine)) return Blocks.level;
        if (this.hitDieHeader.test(trimmedLine)) return Blocks.hitDie;
        if (this.hitPointsHeader.test(trimmedLine)) return Blocks.hitPoints;
        if (this.proficiencyBonusHeader.test(trimmedLine)) return Blocks.proficiencyBonus;
        if (this.armorProficienciesHeader.test(trimmedLine)) return Blocks.armorProficiencies;
        if (this.weaponProficienciesHeader.test(trimmedLine)) return Blocks.weaponProficiencies;
        if (this.toolProficienciesHeader.test(trimmedLine)) return Blocks.toolProficiencies;
        if (this.savingThrowsHeader.test(trimmedLine)) return Blocks.savingThrows;
        if (this.skillsHeader.test(trimmedLine)) return Blocks.skills;
        if (this.equipmentHeader.test(trimmedLine)) return Blocks.equipment;
        if (this.classFeaturesHeader.test(trimmedLine)) return Blocks.classFeatures;
        if (this.subclassHeader.test(trimmedLine)) return Blocks.subclass;
        if (this.subclassFeaturesHeader.test(trimmedLine)) return Blocks.subclassFeatures;
        if (this.spellcastingHeader.test(trimmedLine)) return Blocks.spellcasting;
        if (this.spellSlotsHeader.test(trimmedLine)) return Blocks.spellSlots;
        if (this.cantripsHeader.test(trimmedLine)) return Blocks.cantrips;
        if (this.spellsHeader.test(trimmedLine)) return Blocks.spells;
        if (this.multiclassingHeader.test(trimmedLine)) return Blocks.multiclassing;

        return null;
    }

    /**
     * Tests if a line matches a specific block pattern
     * @param {string} line - The line to test
     * @param {object} block - The block to test against
     * @returns {boolean} - True if the line matches the block
     */
    static testBlock(line, block) {
        if (!block) return false;
        const trimmedLine = line.trim();

        switch (block.id) {
            case Blocks.level.id:
                return this.levelHeader.test(trimmedLine);
            case Blocks.hitDie.id:
                return this.hitDieHeader.test(trimmedLine);
            case Blocks.hitPoints.id:
                return this.hitPointsHeader.test(trimmedLine);
            case Blocks.proficiencyBonus.id:
                return this.proficiencyBonusHeader.test(trimmedLine);
            case Blocks.armorProficiencies.id:
                return this.armorProficienciesHeader.test(trimmedLine);
            case Blocks.weaponProficiencies.id:
                return this.weaponProficienciesHeader.test(trimmedLine);
            case Blocks.toolProficiencies.id:
                return this.toolProficienciesHeader.test(trimmedLine);
            case Blocks.savingThrows.id:
                return this.savingThrowsHeader.test(trimmedLine);
            case Blocks.skills.id:
                return this.skillsHeader.test(trimmedLine);
            case Blocks.equipment.id:
                return this.equipmentHeader.test(trimmedLine);
            case Blocks.classFeatures.id:
                return this.classFeaturesHeader.test(trimmedLine);
            case Blocks.subclass.id:
                return this.subclassHeader.test(trimmedLine);
            case Blocks.subclassFeatures.id:
                return this.subclassFeaturesHeader.test(trimmedLine);
            case Blocks.spellcasting.id:
                return this.spellcastingHeader.test(trimmedLine);
            case Blocks.spellSlots.id:
                return this.spellSlotsHeader.test(trimmedLine);
            case Blocks.cantrips.id:
                return this.cantripsHeader.test(trimmedLine);
            case Blocks.spells.id:
                return this.spellsHeader.test(trimmedLine);
            case Blocks.multiclassing.id:
                return this.multiclassingHeader.test(trimmedLine);
            default:
                return false;
        }
    }
}
