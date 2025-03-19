export class sbiRegex {
    // Regexes for checking known types of lines. They have to be written carefully 
    // so that it matches on the line we care about, but not any other random line
    // that happens to start with same the word(s).
    // Each of these must match one of the keys of Blocks for it to be used when parsing.
    static armor = /^((armor|armour) class|ac)[\s:]+\d+/i;
    static actions = /^actions$/i;
    static abilities = /^(\bstr\b|\bdex\b|\bcon\b|\bint\b|\bwis\b|\bcha\b|\bMod\s+Save\b)/i;
    static about = /^(about|info|details)[\s:]*$/i;
    static bonusActions = /^bonus actions$/i;
    static challenge = /^(challenge|\bcr\b|challenge rating)[\s:]+\d+/i;
    static conditionImmunities = /^condition\simmunities[\s:]+/i;
    static damageImmunities = /^damage\simmunities[\s:]+/i;
    static immunities2024 = /^immunities[\s:]+/i;
    static damageResistances = /^(damage\s)?resistances[\s:]+/i;
    static damageVulnerabilities = /^(damage\s)?vulnerabilities[\s:]+/i;
    static gear = /^gear[\s:]+/i;
    static health = /^(hit points|\bhp\b)[\s:]+\d+/i;
    // Initiative should be in the same line as AC, but we can expect handcrafted blocks to often have their own line for it, so we will check in both places
    static initiative = /^initiative[\s:]+/i;
    static lairActions = /^lair actions$/i;
    static languages = /^languages[\s:]+/i;
    static legendaryActions = /^legendary actions(\s+\([^\)]*\)$)?/i;
    static mythicActions = /^mythic actions(\s+\([^\)]*\)$)?/i;
    // Proficiency Bonus isn't normally used because Foundry calculates it automatically, but could be useful if somehow CR info is missing.
    // It's often in the Challenge line, but it could be separate, so it's also here.
    static proficiencyBonus = /^proficiency bonus[\s:]+\+/i;
    static public = /^public(\s(info|details))?[\s:]*$/i;
    // The racial details line is here instead of below because it doesn't have a 
    // standard starting word, so we have to look at the whole line.
    static racialDetails = /^(?<size>\bfine\b|\bdiminutive\b|\btiny\b|\bsmall\b|\bmedium\b|\blarge\b|\bhuge\b|\bgargantuan\b|\bcolossal\b)(\sor\s\w+)?(\sswarm of (?<swarmSize>\w+))?\s(?<type>\w+)([,\s]+\((?<race>[,\w\s]+)\))?([,\s]+(?<alignment>[\w\s\-]+))?/idg;
    static reactions = /^reactions$/i;
    static savingThrows = /^(saving throws|saves)[\s:]+(\bstr\b|\bdex\b|\bcon\b|\bint\b|\bwis\b|\bcha\b)/i;
    static senses = /^senses( passive)?(.+\d+\s\bft\b)?/i;
    static skills = /^skills.+[\+-]\d+/i;
    static souls = /^souls[\s:]+\d+/i;
    static speed = /^speed[\s:]+\d+\sft/i;
    static traits = /^traits$/i;
    static utilitySpells = /^utility spells$/i;
    static villainActions = /^villain actions$/i;

    // This identifies all the block starters that go to a new line instead of having the info in the same one.
    // This is a lot of repetition. While these rarely change, we might want a cleaner way to derive these.
    static pureBlockHeader = String.raw`((armor|armour) class|ac)|(challenge|\bcr\b|challenge rating)|condition\simmunities|damage\simmunities|immunities|(damage\s)?resistances|(damage\s)?vulnerabilities|gear|(hit points|\bhp\b)|initiative|languages|proficiency bonus|(saving throws|saves)|senses|skills|souls|speed`;
    static removeNewLines = new RegExp(String.raw`^(?<header>${this.pureBlockHeader})\s*\n(?!^(${this.pureBlockHeader})\s+)`, "igm");

    static conditionBase = String.raw`(?<condition>\bblinded\b|\bcharmed\b|\bdeafened\b|\bdiseased\b|\bexhaustion\b|\bfrightened\b|\bgrappled\b|\bincapacitated\b|\binvisible\b|\bparalyzed\b|\bpetrified\b|\bpoisoned\b|\bprone\b|\brestrained\b|\bstunned\b|\bunconscious\b)`;

    // Regexes for pulling the details out of the lines we identified using the ones above.
    static initiativeDetailsBase = String.raw`(?<initiativeModifier>[\+\-−–]?\d+)(\s+\((?<initiativeScore>\d+)\))?`;
    static initiativeDetails = new RegExp(this.initiativeDetailsBase, "idg");
    static armorDetails = new RegExp(String.raw`(?<ac>(?<=\s)\d+)(\s\((?<armorType>[^)]+)\))?(\s+Initiative\s${this.initiativeDetailsBase})?`, "idg");
    static proficiencyBonusBase = String.raw`(?:pb|proficiency\sbonus)\s\+?(?<pb>\d+)`;
    static proficiencyBonusDetails = new RegExp(this.proficiencyBonusBase, "idg");
    static bioDetails = new RegExp(String.raw`^(?:(?:about|info|details)[\s:]+)\s?(?<details>\w+.*)`, "idgs")
    static bioPublicDetails = new RegExp(String.raw`^(?:public(?:\s(?:info|details))?[\s:]+)\s?(?<details>\w+.*)`, "idgs")
    static challengeDetails = new RegExp(String.raw`(?<cr>(?:½|[\d\/]+))\s?(?<role>[A-Za-z]+)?\s?(?:\(?(?:(?<xp>[\d,]+)\s?xp|xp\s(?<experiencePoints>[\d,]+))(?:\W+${this.proficiencyBonusBase})?)?`, "idg");
    static gearDetails = /(?<=gear|,)\s?(?<name>\w+(?:\s\w+)*)(?:\s?\((?<quantity>\d+)\))?/idg;
    static perDayBase = String.raw`(?<perDay>\d+)\/day`;
    static perDayDetails = new RegExp(this.perDayBase, "idg");
    static perDayCountFull = new RegExp(`\\(${this.perDayBase}[\\),;]`, "idg");
    static rollDetails = /(?<value>\d+)\s?(\((?<formula>\d+d\d+(\s?[\+\-−–]\s?\d+)?)\))?/idg;
    static savingThrowDetails = new RegExp(String.raw`must\s(make|succeed\son)\sa\sdc\s(?<saveDc>\d+)\s(?<saveAbility>\w+)\s(?<saveText>saving\sthrow|save)(?:.*${this.conditionBase})?(?:.*(?<halfDamage>\bhalf\b)[A-Z\s]*damage)?`, "idgs");
    static savingThrowDetails24 = new RegExp(String.raw`(?<saveAbility>\w+)\s(?<saveText>saving throw):\s*dc\s(?<saveDc>\d+)(?:.*${this.conditionBase})?(?:.*success:\s(?<halfDamage>\bhalf\b))?`, "idgs");
    static sensesDetails = /(?<name>\w+) (?<modifier>\d+)/idg;
    static skillDetails = /(?<name>\bacrobatics\b|\barcana\b|\banimal handling\b|\bathletics\b|\bdeception\b|\bhistory\b|\binsight\b|\bintimidation\b|\binvestigation\b|\bmedicine\b|\bnature\b|\bperception\b|\bperformance\b|\bpersuasion\b|\breligion\b|\bsleight of hand\b|\bstealth\b|\bsurvival\b) (?<modifier>[\+|-]\d+)/idg;
    static speedDetails = /(?<name>\w+)\s?(?<value>\d+)/idg;
    static spellcastingDetails = /spellcasting\sability\sis\s(?<ability>\w+)|(?<innateAbility>\w+)\sas\sthe\sspellcasting\sability|spell\ssave\sdc\s(?<saveDc>\d+)|(?<level>\d+)(.+)level\sspellcaster/idg;

    // The block title regex is complicated. Here's the breakdown...
    // (^|[.!]\s*\n)                                    <-  Before the title there's either the string start, or the end of a sentence and a newline.
    // ([A-Z][\w\d\-+,;'’]+[\s\-]?)                         Represents the first word of the title, followed by a space or hyphen. It has to start with a capital letter.
    //                                                      The word can include word characters, digits, and some punctuation characters.
    //                                                      NOTE: Don't add more punctuation than is absolutely neccessary so that we don't get false positives.
    // ((of|and|the|from|in|at|on|with|to|by|into)\s)?  <-  Represents the preposition words we want to ignore.
    // ([\w\d\-+,;'’]+\s?){0,3}                         <-  Represents the words that follow the first word, using the same regex for the allowed characters.
    //                                                      We assume the title only has 0-3 words following it, otherwise it's probably a sentence.
    // (\((?!spell save)[^)]+\))?                       <-  Represents an optional bit in parentheses, like '(Recharge 5-6)'.
    static blockTitle = /(?:^|[.:!]\s*\n)(?<title>(?:[A-Z][\w\d\-+,;'’]+[\s\-]?)(?:(?:of|and|the|from|in|at|on|with|to|by|into)\s)?(?:[\w\d\-+,;'’]+\s?){0,3})(?:\s\((?!spell save)[^)]+\))?[.!]/dg;
    static villainActionTitle = /(^|[.!]\s*\n)(?<title>Action\s[123]:\s.+[.!?])/dg;
    // The rest of these are utility regexes to pull out specific data.
    static abilityNames = /(?<abilityName>\bstr\b|\bdex\b|\bcon\b|\bint\b|\bwis\b|\bcha\b)/idg;
    static abilityValues = /(?<base>\d+)\s?\((?<modifier>[\+\-−–]?\d+)\)/dg;
    static abilitySaves = /(?<name>\bstr\b|\bdex\b|\bcon\b|\bint\b|\bwis\b|\bcha\b) (?<modifier>[\+|-]\d+)/ig;
    static abilityValues24 = /(?<base>\d+)\s?(?<modifier>[\+\-−–]?\d+)\s?(?<saveModifier>[\+\-−–]?\d+)/dg;
    static actionCost = /\((costs )?(?<cost>\d+) action(s)?\)/idg;
    static attack = new RegExp(String.raw`\+(?<toHit>\d+)\sto\shit\b(?:(?:.(?!dc\s\d+))*${this.conditionBase})?`, "idgs");
    static attack24 = new RegExp(String.raw`attack\sroll:\s*\+(?<toHit>\d+)(?:(?:.(?!dc\s\d+))*${this.conditionBase})?`, "idgs");
    static castAction = /^(?<featureName>[^.]+)\.\s?(?<monsterDesc>(?:\w+\s){1,4})(?:\bcasts|\bcan innately cast|\bspellcasting to cast)\s(?!a\s|one\s\of\s)(?<spellList>.*?),?\s?(?:in response|using|requiring|\.)/idg;
    static castActionSpell = /(?<=^|,|\bor\s)\s?(?:(?:or\s)?(?<spellName>\b(?:[^,.:;](?!or|\())+)(?:\s\(level\s(?<spellLevel>\d+)\sversion\))?)/idg;
    static conditionTypes = new RegExp(this.conditionBase, "idg");
    static damageRoll = /\(?(?<baseDamageRoll>\d+d\d+?)\s?(?<baseDamageMod>[+-]\s?\d+)?\)?\s(?<baseDamageType>\w+)(?:\sdamage)(?:.+(?:(?:\bor\s+(?:\d+\s+\(*)?(?:(?<versatileDamageRoll>\d+d\d+?)\s?(?<versatileDamageMod>[+-]\s?\d+)?)\)?\s(?<versatileDamageType>\w+)(?:\sdamage\sif\sused\swith\stwo\shands))|(?:plus|and)\s+(?:\d+\s+\(*)?(?:(?<addDamageRoll>\d+d\d+?)\s?(?<addDamageMod>[+-]\s?\d+)?)\)?\s(?<addDamageType>\w+)(?:\sdamage)))?/idg
    static damageTypes = /(?<damageType>\bbludgeoning\b|\bpiercing\b|\bslashing\b|\bacid\b|\bcold\b|\bfire\b|\blightning\b|\bnecrotic\b|\bpoison\b|\bpsychic\b|\bradiant\b|\bthunder\b)/idg;
    static knownLanguages = /(?:\w+\s*\()?(?<language>\baarakocra\b|\babyssal\b|\baquan\b|\bauran\b|\bcelestial\b|\bcommon\b|\bdeep\b|\bdraconic\b|\bdruidic\b|\bdwarvish\b|\belvish\b|\bgiant\b|\bgith\b|\bgnoll\b|\bgnomish\b|\bgoblin\b|\bhalfling\b|\bignan\b|\binfernal\b|\borc\b|\bprimordial\b|\bsylvan\b|\bterran\b|\bcant\b|\bundercommon\b|\btelepathy\s(?<telepathyRange>\d+)\s(f(ee|oo)?t\.?|'|’))\)?/idg;
    static legendaryActionCount = /take\s(?<count>\d+)\slegendary|legendary\saction\suses:\s?(?<uses>\d+)(?:\s?\((?<lairUses>\d+)\sin\slair\))?\s*\./idg;
    static lairInitiativeCount = /initiative\scount\s(?<initiativeCount>\d+)/idg;
    
    static spellGroup = /(?<spellGroup>(?:cantrips|at.will|(?<level>\d+)(?:st|nd|rd|th)\slevel|(?<perDay>\d+)\/day)\s?(?:each)?(?:\s?\((?:(?<slots>\d+)\sslots?|at.will)\))?):\s?/idg;
    static spellName = /(?<=^|,)\s*[*\s]*(?<spellName>[^.,:]+?)(?:\s\(level\s(?<spellLevel>\d+)[^)]*\))?(?:\s\((?<affectsAC>included in ac)\))?[*\s]*(\s[ABR]|\s?\+)?(?:\s*\(.*?\)\s*)?(?=,|[\s.:]*$)/idg;
    
    static spellLine = /(at-will|cantrips|1st|2nd|3rd|4th|5th|6th|7th|8th|9th)[\w\s\(\)-]*:/ig;
    static spellInnateLine = /at will:|\d\/day( each)?/ig;
    static spellInnateSingle = /(?<perDay>\d+)\/day.*innately\scast\s(?<spellName>[\w|\s]+)(\s\(.+\))?,/idg;
    static spellActionTitle = /\d+\/day(?:[,;]\s?(?<spellLevel>\d)(?:st|nd|rd|th)[-\s]level\sspell)?(?:[,;]\s?(?<concentration>concentration))?/idg;
    static range = /range\s(?<near>\d+)(\/(?<far>\d+))?\s?(f(ee|oo)?t|'|’)/idg;
    static reach = /reach\s(?<reach>\d+)\s?(f(ee|oo)?t|'|’)/idg;
    static recharge = /\(recharge\s(?<recharge>\d+)([–|-]\d+)?\)/idg;
    static target = /(?:a\s(?<areaRange>\d+)(?:-?(?:foot|feet|ft?.|'|’)\s(?<shape>\w+))|(?<targetsAmount>each|a|one)\s[\w\s]+?(?:within\s(?<range>\d+)\s(?:foot|feet|ft?.|'|’)))/idg;

    // Regexes for description enrichment
    static makesAttack1 = String.raw`with\sa\suse\sof\s(?:.*\sor\s(?:\(\w\)\s)?)?(?<attack1>(?:[^,.:;(\s]+\s?){1,4})(?:[,.:;]|\sto cast)`;
    static makesAttack2 = String.raw`makes?\s\w+\s(?<attack2>(?:[^,.:;\s]+\s?){1,4})\sattacks?(?:\sand\s\w+\s(?<attack3>(?:[^,.:;\s]+\s?){1,4})\sattacks?)?(?:\sand\suses\s(?<attack4>(?:(?:[^,.:;](?!or))+))(?:\sor\s(?<attack5>\w+))?)?`;
    static makesAttack3 = String.raw`makes?\s\w+\sattacks?[,:]?\s(?:using\s(?<attack6>(?:.(?!or))*)(?:\sor\s(?<attack7>.*))?\sin any combination|(?:\w+\s)?with\sits\s(?<attack8>(?:.(?!and))*)(?:\sand\s\w+\swith\sits\s(?<attack9>[^.]+))?.)`;
    static makesAttack4 = String.raw`\suses?\sits\s(?<attack10>(?:[^.,:;](?!or))*)`
    //static makesAttack = /with\sa\suse\sof\s(?:.*\sor\s(?:\(\w\)\s)?)?(?<attack1>(?:[^,.:;(\s]+\s?){1,4})(?:[,.:;]|\sto cast)|makes?\s\w+\s(?<attack2>(?:[^,.:;\s]+\s?){1,4})\sattacks?(?:\sand\s\w+\s(?<attack3>(?:[^,.:;\s]+\s?){1,4})\sattacks?)?(?:\sand\suses\s(?<attack4>(?:(?:[^,.:;](?!or))+))(?:\sor\s(?<attack5>\w+))?)?|makes?\s\w+\sattacks?[,:]?\s(?:using\s(?<attack6>(?:.(?!or))*)(?:\sor\s(?<attack7>.*))?\sin any combination|(?:\w+\s)?with\sits\s(?<attack8>(?:.(?!and))*)(?:\sand\s\w+\swith\sits\s(?<attack9>[^.]+))?.)/ig;
    static makesAttack = new RegExp(this.makesAttack1 + "|" + this.makesAttack2 + "|" + this.makesAttack3 + "|" + this.makesAttack4, "igs");

}
