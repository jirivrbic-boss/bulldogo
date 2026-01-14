/**
 * Filtr zakázaných slov pro Bulldogo
 * Optimalizovaný pro web s inzeráty služeb
 */

(function() {
    'use strict';

    // Základní seznam zakázaných slov - pouze relevantní pro tento typ webu
    // Odstraněny nepotřebné varianty a duplicity
    const BANNED_WORDS = [
        // Vulgarismy a urážky
        'kurva', 'kokot', 'piča', 'píča', 'prdel', 'hovno', 'hajzl', 'zmrd', 'debil', 'blbec',
        'mrcha', 'děvka', 'kráva', 'svině', 'sráč', 'čurák', 'čůrák', 'čára',
        'ojeb', 'ojebat', 'ojebaný', 'zkurvený', 'zasraný',
        
        // Sexuální obsah
        'sex', 'porno', 'pornografie', 'erotika', 'erotický', 'masturbace', 'masturbovat',
        'ejakulace', 'orgasmus', 'soulož', 'souložit', 'anál', 'anální', 'orál', 'orální',
        'prostituce', 'prostitutka', 'escort', 'eskort', 'privát', 'sexshop',
        'placený sex', 'sex za peníze', 'kamasutra', 'fetish', 'fetishistický',
        
        // Drogová problematika
        'droga', 'drogy', 'kokain', 'heroin', 'pervitin', 'piko', 'marihuana', 'tráva',
        'weed', 'lsd', 'mdma', 'extáze', 'fentanyl', 'crack', 'joint', 'ganja',
        'houby', 'vařit piko', 'vařič', 'dealer', 'dealování',
        
        // Násilí a zbraně
        'vražda', 'zabít', 'zabíjení', 'vyhladit', 'masakr', 'bomba', 'granát',
        'výbušnina', 'zbraň', 'zbraně', 'pistole', 'kulomet', 'samopal', 'nůž',
        'náboje', 'střelba', 'střelivo', 'mačeta',
        
        // Extremismus a nenávist
        'nacismus', 'nacista', 'fašismus', 'fašista', 'rasismus', 'rasista',
        'xenofobie', 'nenávist', 'hitler', 'isis', 'al-káida', 'terorismus', 'terorista',
        
        // Podvody a scam
        'scam', 'scammer', 'podvod', 'podfuk', 'fake', 'falešný', 'padělek',
        'phishing', 'spoofing', 'kryptoscam', 'krádež', 'kradené', 'kradený',
        
        // Finanční podvody (relevantní pro inzeráty)
        'bez rizika', 'garantovaný zisk', 'zaručený zisk', 'peníze hned',
        'investuj hned', 'pasivní příjem', 'výdělek z domova', 'rychlé peníze',
        'bez práce', 'bez papírů', 'legalizace výnosů', 'praní peněz',
        'forex bez rizika', 'zbohani', 'klikni',
        
        // Další nevhodný obsah
        'retard', 'idiot', 'negro', 'negr', 'nahota', 'nahý', 'nahá', 'nahé',
        'dominance', 'submise', 'bdsm', 'balení'
    ];

    // Leetspeak mapování (čísla a znaky místo písmen)
    const LEET_MAP = {
        '0': ['o', 'ó'],
        '1': ['i', 'í', 'l'],
        '3': ['e', 'ě'],
        '4': ['a', 'á'],
        '5': ['s', 'š'],
        '7': ['t', 'ť'],
        '@': ['a', 'á'],
        '$': ['s', 'š'],
        '!': ['i', 'í'],
        '(': ['c', 'č'],
        'x': ['ks', 'ch']
    };

    /**
     * Normalizuje text pro kontrolu (odstraní diakritiku, převede na malá písmena)
     */
    function normalizeText(text) {
        if (!text || typeof text !== 'string') return '';
        
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // odstranění diakritiky
            .replace(/[^\w\s]/g, ' ') // nahrazení speciálních znaků mezerou
            .replace(/\s+/g, ' ') // normalizace mezer
            .trim();
    }

    /**
     * Vytvoří varianty slova s leetspeakem
     */
    function generateLeetVariants(word) {
        const variants = new Set([word]);
        
        // Základní leetspeak substituce
        const leetReplacements = {
            'a': ['4', '@'],
            'e': ['3'],
            'i': ['1', '!'],
            'o': ['0'],
            's': ['5', '$'],
            't': ['7'],
            'c': ['('],
            'á': ['4'],
            'é': ['3'],
            'í': ['1'],
            'ó': ['0'],
            'š': ['5'],
            'č': ['(']
        };
        
        // Generovat varianty s částečnou substitucí
        for (const [char, replacements] of Object.entries(leetReplacements)) {
            if (word.includes(char)) {
                for (const replacement of replacements) {
                    variants.add(word.replace(new RegExp(char, 'g'), replacement));
                }
            }
        }
        
        return Array.from(variants);
    }

    /**
     * Escapuje string pro použití v regex patternu
     */
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Vytvoří regex pattern pro slovo s podporou mezer a teček mezi písmeny
     * Omezuje mezery mezi písmeny - max 1-2 mezery/tečky mezi písmeny
     */
    function createFlexiblePattern(word) {
        if (!word || word.length === 0) return null;
        
        // Escapovat celé slovo
        const escaped = escapeRegex(word);
        
        // Pro krátká slova použít jednoduchý pattern s word boundaries
        if (word.length <= 3) {
            try {
                return new RegExp('\\b' + escaped + '\\b', 'i');
            } catch (e) {
                console.warn('Chyba při vytváření regex pro:', word, e);
                return null;
            }
        }
        
        // Pro delší slova vytvořit pattern s možnými mezerami mezi písmeny
        // Escapovat každé písmeno zvlášť
        const escapedChars = word.split('').map(char => escapeRegex(char));
        const flexiblePattern = escapedChars.join('[\\s\\.\\-]{0,2}');
        
        // Vytvořit pattern s word boundaries
        try {
            return new RegExp('(?:^|\\s)' + flexiblePattern + '(?:\\s|$)', 'i');
        } catch (e) {
            console.warn('Chyba při vytváření flexibilního regex pro:', word, e);
            // Fallback na jednoduchý pattern
            try {
                return new RegExp('\\b' + escaped + '\\b', 'i');
            } catch (e2) {
                console.warn('Chyba i v fallback patternu pro:', word, e2);
                return null;
            }
        }
    }

    /**
     * Zkontroluje, zda text obsahuje zakázané slovo
     */
    function containsBannedWord(text) {
        if (!text || typeof text !== 'string') return false;
        
        const normalized = normalizeText(text);
        
        // Kontrola každého zakázaného slova
        for (const bannedWord of BANNED_WORDS) {
            const normalizedBanned = normalizeText(bannedWord);
            
            // Přímá kontrola - hledat jako celé slovo (s word boundaries)
            try {
                const escapedBanned = escapeRegex(normalizedBanned);
                const directPattern = new RegExp('\\b' + escapedBanned + '\\b', 'i');
                if (directPattern.test(normalized)) {
                    return { found: true, word: bannedWord };
                }
            } catch (e) {
                console.warn('Chyba při vytváření přímého patternu pro:', bannedWord, e);
            }
            
            // Kontrola s flexibilním patternem (mezery, tečky) - pouze pro delší slova
            if (normalizedBanned.length > 3) {
                const flexiblePattern = createFlexiblePattern(normalizedBanned);
                if (flexiblePattern) {
                    try {
                        if (flexiblePattern.test(normalized)) {
                            return { found: true, word: bannedWord };
                        }
                    } catch (e) {
                        console.warn('Chyba při testování flexibilního patternu pro:', bannedWord, e);
                    }
                }
            }
            
            // Kontrola leetspeak variant
            const leetVariants = generateLeetVariants(normalizedBanned);
            for (const variant of leetVariants) {
                // Přímá kontrola varianty
                try {
                    const escapedVariant = escapeRegex(variant);
                    const variantDirectPattern = new RegExp('\\b' + escapedVariant + '\\b', 'i');
                    if (variantDirectPattern.test(normalized)) {
                        return { found: true, word: bannedWord };
                    }
                } catch (e) {
                    console.warn('Chyba při testování varianty:', variant, e);
                    continue;
                }
                
                // Flexibilní pattern pouze pro delší varianty
                if (variant.length > 3) {
                    const variantPattern = createFlexiblePattern(variant);
                    if (variantPattern) {
                        try {
                            if (variantPattern.test(normalized)) {
                                return { found: true, word: bannedWord };
                            }
                        } catch (e) {
                            console.warn('Chyba při testování flexibilního patternu varianty:', variant, e);
                        }
                    }
                }
            }
        }
        
        return { found: false };
    }

    /**
     * Zkontroluje text a vrátí výsledek s detaily
     */
    function checkText(text) {
        if (!text || typeof text !== 'string') {
            return {
                isClean: true,
                bannedWords: []
            };
        }
        
        const result = containsBannedWord(text);
        
        if (result.found) {
            return {
                isClean: false,
                bannedWords: [result.word],
                message: `Text obsahuje nevhodný obsah: "${result.word}"`
            };
        }
        
        return {
            isClean: true,
            bannedWords: []
        };
    }

    /**
     * Zkontroluje více textových polí najednou
     */
    function checkMultipleTexts(texts) {
        const results = {
            isClean: true,
            bannedWords: [],
            fields: {}
        };
        
        for (const [field, text] of Object.entries(texts)) {
            const check = checkText(text);
            results.fields[field] = check;
            
            if (!check.isClean) {
                results.isClean = false;
                results.bannedWords.push(...check.bannedWords);
            }
        }
        
        return results;
    }

    // Export do globálního scope
    window.ProfanityFilter = {
        check: checkText,
        checkMultiple: checkMultipleTexts,
        containsBannedWord: containsBannedWord
    };

    console.log('✅ Profanity filter načten');
})();

