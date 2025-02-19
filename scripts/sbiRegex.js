import { BlockID } from "./sbiData.js";

export class sbiRegex {
    // Regexes for checking known types of lines. They have to be written carefully 
    // so that it matches on the line we carea bout, but not any other random line
    // that happens to start with same the word(s).
    static armor = /^((armor|armour) class|ac)\s\d+/i;
    static actions = /^actions$/i;
    static abilities = /^(\bstr\b|\bdex\b|\bcon\b|\bint\b|\bwis\b|\bcha\b|\bmod\s+save\b)/i;
    static bonusActions = /^bonus actions$/i;
    static challenge = /^(challenge|\bcr\b|challenge rating)\s\d+/i;
    static conditionImmunities = /^condition immunities\s/i;
    static damageImmunities = /^damage immunities\s/i;
    static immunities2024 = /^immunities\s/i;
    static damageResistances = /^damage resistances\s|^resistances\s/i;
    static damageVulnerabilities = /^damage vulnerabilities\s/i;
    static health = /^(hit points|\bhp\b)\s\d+/i;
    static lairActions = /^lair actions$/i;
    static languages = /^languages\s/i;
    static legendaryActions = /^legendary actions$/i;
    static mythicActions = /^mythic actions$/i;
    // Proficiency Bonus isn't used because Foundry calculates it automatically.
    // This is just here for completeness.
    static proficiencyBonus = /^proficiency bonus\s\+/i;
    // The racial details line is here instead of below because it doesn't have a 
    // standard starting word, so we have to look at the whole line.
    static racialDetails = /^(?<size>\bfine\b|\bdiminutive\b|\btiny\b|\bsmall\b|\bmedium\b|\blarge\b|\bhuge\b|\bgargantuan\b|\bcolossal\b)(\sswarm of (?<swarmSize>\w+))?\s(?<type>\w+)([,\s]+\((?<race>[,\w\s]+)\))?([,\s]+(?<alignment>[\w\s\-]+))?/idg;
    static reactions = /^reactions$/i;
    static savingThrows = /^(saving throws|saves)\s(\bstr\b|\bdex\b|\bcon\b|\bint\b|\bwis\b|\bcha\b)/i;
    static senses = /^senses( passive)?(.+\d+\s\bft\b)?/i;
    static skills = /^skills.+[\+-]\d+/i;
    static souls = /^souls\s\d+/i;
    static speed = /^speed\s\d+\sft/i;
    static traits = /^traits$/i;
    static utilitySpells = /^utility spells$/i;
    static villainActions = /^villain actions$/i;

    // Regexes for pulling the details out of the lines we identified using the ones above.
    static armorDetails = /(?<ac>\d+)( \((?<armorType>.+)\))?/id;
    static challengeDetails = /(?<cr>(½|[\d\/]+))\s?(\((?<xp>[\d,]+)\s?xp\))?/id;
    static rollDetails = /(?<value>\d+)\s?(\((?<formula>\d+d\d+(\s?[\+\-−–]\s?\d+)?)\))?/id;
    static perDayDetails = /(?<perDay>\d+)\/day/i;
    static roleDetails = /\d+\s(?<role>\w+)/i;
    static savingThrowDetails = /must (make|succeed on) a dc (?<saveDc>\d+) (?<saveAbility>\w+) (?<saveText>saving throw|save)/i;
    static savingThrowDetails24 = /(?<saveAbility>\w+) (?<saveText>saving throw):\s*dc (?<saveDc>\d+)/i;
    static sensesDetails = /(?<name>\w+) (?<modifier>\d+)/idg;
    static skillDetails = /(?<name>\bacrobatics\b|\barcana\b|\banimal handling\b|\bathletics\b|\bdeception\b|\bhistory\b|\binsight\b|\bintimidation\b|\binvestigation\b|\bmedicine\b|\bnature\b|\bperception\b|\bperformance\b|\bpersuasion\b|\breligion\b|\bsleight of hand\b|\bstealth\b|\bsurvival\b) (?<modifier>[\+|-]\d+)/idg;
    static speedDetails = /(?<name>\w+)\s?(?<value>\d+)/idg;
    static spellcastingDetails = /\((?<slots>\d+) slot|(?<perDay>\d+)\/day|spellcasting ability is (?<ability1>\w+)|(?<ability2>\w+) as the spellcasting ability|spell save dc (?<saveDc>\d+)/ig;

    // The block title regex is complicated. Here's the breakdown...
    // ([A-Z][\w\d\-+,;']+[\s\-]?)               <- Represents the first word of the title, followed by a space or hyphen. It has to start with a capital letter.
    //                                              The word can include word characters, digits, and some punctuation characters.
    //                                              NOTE: Don't add more punctuation than is absolutely neccessary so that we don't get false positives.
    // (of|and|the|from|in|at|on|with|to|by)\s)? <- Represents the prepostion words we want to ignore.
    // ([\w\d\-+,;']+\s?){0,3}                   <- Represents the words that follow the first word, using the same regex for the allowed characters.
    //                                              We assume the title only has 0-3 words following it, otherwise it's probably a sentence.
    // (\([\w –\-\/]+\))?                        <- Represents an optional bit in parentheses, like '(Recharge 5-6)'.
    static blockTitle = /^(([A-Z][\w\d\-+,;'’]+[\s\-]?)((of|and|the|from|in|at|on|with|to|by|into)\s)?([\w\d\-+,;'’]+\s?){0,3}(\((?!spell save)[^)]+\))?)[.!]/;
    static villainActionTitle = /(?<title>^Action\s[123]:\s.+[.!?])\s+(?<description>.*)/;
    // The rest of these are utility regexes to pull out specific data.
    static abilityNames = /(?<abilityName>\bstr\b|\bdex\b|\bcon\b|\bint\b|\bwis\b|\bcha\b)/idg;
    static abilityValues = /(?<base>\d+)\s?\((?<modifier>[\+\-−–]?\d+)\)/dg;
    static abilitySaves = /(?<name>\bstr\b|\bdex\b|\bcon\b|\bint\b|\bwis\b|\bcha\b) (?<modifier>[\+|-]\d+)/ig;
    static abilityValues24 = /(?<base>\d+)\s?(?<modifier>[\+\-−–]?\d+)\s?(?<saveModifier>[\+\-−–]?\d+)/dg;
    static actionCost = /\((costs )?(?<cost>\d+) action(s)?\)/i;
    static attack = /\+(?<toHit>\d+) to hit/i;
    static attack24 = /attack\sroll:\s*\+(?<toHit>\d+)/i;
    static conditionTypes = /(?<condition>\bblinded\b|\bcharmed\b|\bdeafened\b|\bdiseased\b|\bexhaustion\b|\bfrightened\b|\bgrappled\b|\bincapacitated\b|\binvisible\b|\bparalyzed\b|\bpetrified\b|\bpoisoned\b|\bprone\b|\brestrained\b|\bstunned\b|\bunconscious\b)/idg;
    static damageRoll = /\(?(?<damageRoll1>\d+d\d+?)\s?(?<damageMod1>[+-]\s?\d+)?\)? (?<damageType1>\w+)(?: damage)(?:.+(?:plus|and)\s+(?:\d+\s+\(*)?(?:(?<damageRoll2>\d+d\d+?)\s?(?<damageMod2>[+-]\s?\d+)?)\)? (?<damageType2>\w+)(?: damage))?/i;
    static damageTypes = /(?<damageType>\bbludgeoning\b|\bpiercing\b|\bslashing\b|\bacid\b|\bcold\b|\bfire\b|\blightning\b|\bnecrotic\b|\bpoison\b|\bpsychic\b|\bradiant\b|\bthunder\b)/idg;
    static knownLanguages = /(?:\w+\s*\()?(?<language>\baarakocra\b|\babyssal\b|\baquan\b|\bauran\b|\bcelestial\b|\bcommon\b|\bdeep\b|\bdraconic\b|\bdruidic\b|\bdwarvish\b|\belvish\b|\bgiant\b|\bgith\b|\bgnoll\b|\bgnomish\b|\bgoblin\b|\bhalfling\b|\bignan\b|\binfernal\b|\borc\b|\bprimordial\b|\bsylvan\b|\bterran\b|\bcant\b|\bundercommon\b)\)?/idg;
    static legendaryActionCount = /take (?<count>\d+) legendary/i;
    static nameValue = /(?<name>\w+)\s?(?<value>\d+)/ig;
    static spellcasterLevel = /(?<level>\d+)(.+)level spellcaster/i;
    static spellLine = /(at-will|cantrips|1st|2nd|3rd|4th|5th|6th|7th|8th|9th)[\w\d\s\(\)-]*:/ig;
    static spellInnateLine = /at will:|\d\/day( each)?:/ig;
    static spellInnateSingle = /innately cast (?<spellName>[\w|\s]+)(\s\(.+\))?,/i
    static range = /range (?<near>\d+)(\/(?<far>\d+))? ?(f(ee|oo)?t|'|’)/i;
    static reach = /reach (?<reach>\d+) ?(f(ee|oo)?t|'|’)/i;
    static recharge = /\(recharge (?<recharge>\d+)([–|-]\d+)?\)/i;
    static versatile = /\((?<damageRoll>\d+d\d+( ?\+ ?\d+)?)\) (?<damageType>\w+) damage if used with two hands/i;
    static target = /(?<range>\d+)?-(foot|ft?.|'|’) (?<shape>\w+)/i;

    // Store the regexs we use to determine line type and an identifier we can 
    // use to know which one it was that returned successfully.
    static lineCheckRegexes = [
        { r: this.armor, id: BlockID.armor },
        { r: this.actions, id: BlockID.actions },
        { r: this.abilities, id: BlockID.abilities },
        { r: this.bonusActions, id: BlockID.bonusActions },
        { r: this.challenge, id: BlockID.challenge },
        { r: this.conditionImmunities, id: BlockID.conditionImmunities },
        { r: this.damageImmunities, id: BlockID.damageImmunities },
        { r: this.immunities2024, id: BlockID.immunities2024 },
        { r: this.damageResistances, id: BlockID.damageResistances },
        { r: this.damageVulnerabilities, id: BlockID.damageVulnerabilities },
        { r: this.health, id: BlockID.health },
        { r: this.lairActions, id: BlockID.lairActions },
        { r: this.languages, id: BlockID.languages },
        { r: this.legendaryActions, id: BlockID.legendaryActions },
        { r: this.mythicActions, id: BlockID.mythicActions },
        { r: this.proficiencyBonus, id: BlockID.proficiencyBonus },
        { r: this.racialDetails, id: BlockID.racialDetails },
        { r: this.reactions, id: BlockID.reactions },
        { r: this.savingThrows, id: BlockID.savingThrows },
        { r: this.senses, id: BlockID.senses },
        { r: this.skills, id: BlockID.skills },
        { r: this.speed, id: BlockID.speed },
        { r: this.souls, id: BlockID.souls },
        { r: this.traits, id: BlockID.traits },
        { r: this.utilitySpells, id: BlockID.utilitySpells },
        { r: this.villainActions, id: BlockID.villainActions },
    ]

    static getFirstMatch(line, excludeIds = []) {
        return this.lineCheckRegexes.find(obj => obj.r.exec(line) && !excludeIds.includes(obj.id));
    }
}
