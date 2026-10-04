const path = require('path');
const fs = require('fs');

// Suffixes for basic Tamil stemming/stripping to avoid false positive spelling errors
const TAMIL_SUFFIXES = [
  'களோடு', 'களுடன்', 'களை', 'களால்', 'களுக்கு', 'களின்', 'களில்', 'களது',
  'ங்கள்', 'க்கள்', 'கள்',
  'ைவிட', 'ைப்பற்றி', 'ைப்போல',
  'ாகவோ', 'ாவது', 'ானவை', 'ானவன்', 'ானவள்', 'ானவர்', 'ானதை', 'ாகிய',
  'ையே', 'ோடிருந்து', 'ோடு', 'டன்', 'உடன்', 'ஆல்', 'இல்', 'இடம்', 'இருந்து',
  'க்கு', 'க்காக', 'ின்', 'து', 'உடைய', 'ஐ', 'துவரை', 'வரை',
  'உம்', 'ஏ', 'ஓ', 'தான்', 'மட்டும்', 'கூட'
];

// In-memory caches for fast, synchronous lookups
const dictionarySet = new Set();
const customWordsSet = new Set();

// System Words in-memory caches
// correctGrammarWordsSet: இலக்கணப் பிழையாக காட்டக்கூடாத வார்த்தைகள்
// alertWordsSet: ஆரஞ்சு நிறத்தில் காட்டவேண்டிய வார்த்தைகள்
const correctGrammarWordsSet = new Set();
const alertWordsSet = new Set();
let customSandhiRulesCache = [];
const verifiedWordsCache = new Set();
const customSandhiWordsSet = new Set();

let isDbInitialized = false;
let isSeeding = false;
let dbInitPromise = null;

// Standard words from grammar checker rules
const ssol = "கடைசி,சின்ன,வேண்டா,ஏற்று,எல்லா,அந்த,எந்த,இந்த,அப்படி,அங்கு,எங்கு,இங்கு,ஆங்கு,ஈங்கு,யாங்கு,இப்படி,எப்படி,ஈண்டு,ஆண்டு,யாண்டு,எத்துணை,அத்துணை,இத்துணை,தனி,என,முன்னர்,பின்னர்,அரை,பாதி,இன்றி,அன்றி,மற்றை,சிறப்பு,நடு,புது,பொது,பசு,திரு,முழு,விழு,என்னை,நம்மை,எம்மை,உன்னை,நின்னை,உம்மை,உங்களை,தன்னை,தம்மை,தங்களை,அவளை,அவனை,இவரை,அவரை,அதனை,இதனை,எதனை,அவற்றை,இவற்றை,எவற்றை,என்பதை,அதை,இதை,எதை,தமிழை,வில்லை,பொருத்து,எனக்கு,எனக்காக,நமக்காக,எமக்காக,உனக்கு,நினக்கு,உனக்காக,நினைக்காக,உமக்கு,உங்களுக்கு,உமக்காக,உங்களுக்காக,தனக்கு,தனக்காக,தமக்கு,தமக்காக,தங்களுக்கு,அவற்கு,அவட்கு,அவர்க்கு,தங்களுக்காக,அதற்கு,இதற்கு,எதற்கு,அவற்றிற்கு,இவற்றிற்கு,எவற்றிற்கு,நிறைய,குறைய,முக்கிய,அடுத்த,சரிவர,அதிக,வாக்கிய,ஐக்கிய,இலக்கிய,ஆரோக்கிய,பாக்கிய,அற்று".split(",");
const nsol = "நன்கு,கடந்து,நடந்து,தொடர்ந்து,வரை,நேற்று,வெகு,இனி,நல்ல,கரிய,அரிய,பழைய,இனிய,இளைய,மூத்த,அங்க,அங்கே,இங்க,இங்கே,ஏதோ,நீங்க,இவரு,நீ,உங்களது,இவரது,அவரது,எனது,உனது,நினது,தமது,தனது,அது,எது,இது,உது,நமது,எமது,உமது,ஏது,ஏன்,யாது,அவை,எவை,இவை,யாவை,அத்தனை,எத்தனை,இத்தனை,அவ்வளவு,எவ்வளவு,இவ்வளவு,இத்தகைய,அத்தகைய,எத்தகைய,எது,என்பது,பண்டு,முந்து,அன்று,நாளை,இன்று,என்று,அன்றைய,நேற்றைய,நாளைய,இன்றைய,என்றைய,முந்தைய,பிந்தைய,அவ்வாறு,இவ்வாறு,எவ்வாறு,ஒன்று,இரண்டு,மூன்று,நான்கு,ஐந்து,ஆறு,ஏழு,ஒன்பது,நூறு,ஒரு,ஓர்,இரு,அறு,எழு,பல,சில,என்ன,சிறு,முது,மறு,என்ற,புகழ்,கண்டு,செய்து,சரியான,என்றோ,அன்ன,ஒரே,இல்லாத,செல்லாத,காணாத,ஓடாத,அம்மா,அப்பா,தம்பி,தங்கை,அக்கா,அண்ணன்,அண்ணா,தாத்தா,பாட்டி,தோழி,நண்பர்,மனைவி,தந்தை,மாமா,என்னோடு,தன்னொடு,அல்லது,அல்லாது,அல்ல,இதோ,அதோ,மேதகு,மாண்புமிகு,டாக்டர்,பலர்,சிலர்,சும்மா,முதலிய,சரி,பிற,அக்கறை,நன்றி,முடியாது,ஆகிய,இரவு,தவறு,உங்க,சிறந்த".split(",");
const nvarusol = "சரியா,பாணம்,குரு,சார்".split(",");
const cssol = "தெரு,அணு,வரி".split(",");
const nvaru = "தெய்வ,தேசிய,பாணி,சுவாமி,சக்தி,தினம்".split(",");
const extraWords = [
  'வணக்கம்', 'மாணவர்', 'ஆசிரியர்', 'பள்ளி', 'வகுப்பு', 'புத்தகம்', 'பாடம்', 'தேர்வு', 
  'கேள்வி', 'பதில்', 'விடை', 'வினா', 'தமிழ்', 'ஆங்கிலம்', 'கணிதம்', 'அறிவியல்', 
  'சமூகவியல்', 'மதிப்பெண்', 'காலம்', 'நேரம்', 'நாள்', 'வாரம்', 'மாதம்', 'வருடம்', 
  'நாடு', 'நகரம்', 'கிராமம்', 'மக்கள்', 'அரசு', 'கல்வி', 'பயிற்சி', 'பயன்', 'வாழ்த்து'
];

// Lazy database initialization to prevent blocking imports on Vercel
async function ensureDbInitialized() {
  if (isDbInitialized) return;
  if (dbInitPromise) return dbInitPromise;
  
  dbInitPromise = (async () => {
    await initDb();
    isDbInitialized = true;
    // Trigger background seeding of words from database models asynchronously
    seedDictionary().catch(err => console.error('Dictionary background seeding failed:', err.message));
  })();
  
  return dbInitPromise;
}

async function initDb() {
  console.log('Initializing Tamil Dictionary cache...');
  dictionarySet.clear();
  customWordsSet.clear();

  // Load static standard words into memory
  ssol.forEach(w => dictionarySet.add(w.trim()));
  nsol.forEach(w => dictionarySet.add(w.trim()));
  nvarusol.forEach(w => dictionarySet.add(w.trim()));
  cssol.forEach(w => dictionarySet.add(w.trim()));
  nvaru.forEach(w => dictionarySet.add(w.trim()));
  extraWords.forEach(w => dictionarySet.add(w.trim()));

  const { DictionaryWord, SystemWord } = require('./models');

  try {
    // If MongoDB doesn't have standard words yet (clean install), seed them once
    const totalInDb = await DictionaryWord.countDocuments();
    if (totalInDb === 0) {
      console.log('Seeding standard Tamil words to MongoDB for search/management...');
      const bulkOps = Array.from(dictionarySet).map(w => ({
        updateOne: {
          filter: { word: w },
          update: { word: w, isCustom: 0 },
          upsert: true
        }
      }));
      if (bulkOps.length > 0) {
        await DictionaryWord.bulkWrite(bulkOps);
      }
      console.log(`Standard ${bulkOps.length} words seeded to MongoDB successfully.`);
    }

    // Load only standard words (isCustom: 0) from MongoDB to cache to keep memory usage low
    const standardDbWords = await DictionaryWord.find({ isCustom: 0 }).lean();
    console.log(`Loading ${standardDbWords.length} standard words from MongoDB to memory cache...`);
    
    for (const r of standardDbWords) {
      dictionarySet.add(r.word);
    }

    console.log(`Tamil Dictionary cache loaded with ${dictionarySet.size} total words.`);
  } catch (err) {
    console.error('Failed to load words from MongoDB to cache:', err.message);
  }

  // Load system words (correct_grammar & alert) into in-memory caches
  try {
    const { SystemWord } = require('./models');
    const allSystemWords = await SystemWord.find({}).lean();
    correctGrammarWordsSet.clear();
    alertWordsSet.clear();
    for (const sw of allSystemWords) {
      if (sw.type === 'correct_grammar') {
        correctGrammarWordsSet.add(sw.word);
      } else if (sw.type === 'alert') {
        alertWordsSet.add(sw.word);
      }
    }
    console.log(`System Words cache: ${correctGrammarWordsSet.size} correct_grammar, ${alertWordsSet.size} alert words loaded.`);
  } catch (err) {
    console.error('Failed to load system words from MongoDB to cache:', err.message);
  }

  // Load custom sandhi rules into cache
  try {
    const { CustomSandhiRule } = require('./models');
    customSandhiRulesCache = await CustomSandhiRule.find({}).lean();
    console.log(`Custom Sandhi Rules cache: ${customSandhiRulesCache.length} rules loaded.`);
    customSandhiWordsSet.clear();
    for (const rule of customSandhiRulesCache) {
      customSandhiWordsSet.add(rule.precedingWord);
      customSandhiWordsSet.add(rule.succeedingWord);
    }
  } catch (err) {
    console.error('Failed to load custom sandhi rules from MongoDB to cache:', err.message);
  }
}

// Extract Tamil words from any text string
function extractTamilWords(text) {
  if (!text) return [];
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, ' ');
  // Match only Tamil Unicode characters U+0B80 to U+0BFF
  const matches = cleanText.match(/[\u0B80-\u0BFF]+/g);
  if (!matches) return [];
  return matches
    .map(w => w.trim())
    .filter(w => w.length > 1);
}

// Seed the database with words extracted from Curriculum and Blueprints in MongoDB
async function seedDictionary() {
  if (isSeeding) return;
  isSeeding = true;
  console.log('Extracting new Tamil words from Curriculum/Blueprints to seed...');
  
  const { Curriculum, Blueprint, DictionaryWord } = require('./models');
  const extractedWords = new Set();

  try {
    // Extract words from Curriculum
    const curricula = await Curriculum.find({}).lean();
    for (const c of curricula) {
      if (c.subject) extractTamilWords(c.subject).forEach(w => extractedWords.add(w));
      if (c.units) {
        for (const u of c.units) {
          if (u.name) extractTamilWords(u.name).forEach(w => extractedWords.add(w));
          if (u.learningOutcomes) extractTamilWords(u.learningOutcomes).forEach(w => extractedWords.add(w));
          if (u.subUnits) {
            u.subUnits.forEach(su => {
              if (su.name) extractTamilWords(su.name).forEach(w => extractedWords.add(w));
            });
          }
        }
      }
    }

    // Extract words from Blueprints (questions/answers)
    const blueprints = await Blueprint.find({}).lean();
    for (const bp of blueprints) {
      if (bp.subject) extractTamilWords(bp.subject).forEach(w => extractedWords.add(w));
      if (bp.items) {
        for (const item of bp.items) {
          if (item.questionText) extractTamilWords(item.questionText).forEach(w => extractedWords.add(w));
          if (item.questionTextB) extractTamilWords(item.questionTextB).forEach(w => extractedWords.add(w));
          if (item.answerText) extractTamilWords(item.answerText).forEach(w => extractedWords.add(w));
          if (item.answerTextB) extractTamilWords(item.answerTextB).forEach(w => extractedWords.add(w));
          if (item.furtherInfo) extractTamilWords(item.furtherInfo).forEach(w => extractedWords.add(w));
          if (item.furtherInfoB) extractTamilWords(item.furtherInfoB).forEach(w => extractedWords.add(w));
        }
      }
    }
  } catch (mongoErr) {
    console.warn('Could not extract words from MongoDB models (maybe not connected yet or empty). Skipping background seed.', mongoErr.message);
    isSeeding = false;
    return;
  }

  // Filter only new words that are not in the dictionarySet cache
  const wordsToInsert = Array.from(extractedWords).filter(w => w.length > 1 && !dictionarySet.has(w));
  if (wordsToInsert.length > 0) {
    console.log(`Seeding ${wordsToInsert.length} new words from Curriculum/Blueprints to MongoDB...`);
    try {
      const bulkOps = wordsToInsert.map(w => ({
        updateOne: {
          filter: { word: w },
          update: { word: w, isCustom: 0 },
          upsert: true
        }
      }));
      await DictionaryWord.bulkWrite(bulkOps);
      
      // Update cache
      for (const w of wordsToInsert) {
        dictionarySet.add(w);
      }
      console.log(`Seeding complete. Added ${wordsToInsert.length} new words to MongoDB and cache.`);
    } catch (err) {
      console.error('Failed to seed extracted words to MongoDB:', err.message);
    }
  } else {
    console.log('No new words to seed from database models.');
  }
  isSeeding = false;
}

// Simple stemmer to strip suffix and see if the root is in the database (pure in-memory)
function checkWordVariation(w) {
  if (dictionarySet.has(w)) return true;

  const matchedSuffixes = TAMIL_SUFFIXES.filter(suffix => w.endsWith(suffix) && w.length > suffix.length + 1);
  if (matchedSuffixes.length > 0) {
    for (const suffix of matchedSuffixes) {
      const root = w.slice(0, -suffix.length);
      if (dictionarySet.has(root) || dictionarySet.has(root + 'ம்')) {
        return true;
      }
    }
  }
  return false;
}

function checkWordInDb(word) {
  if (checkWordVariation(word)) return true;

  const lastChar = word.slice(-1);
  if (['க்', 'ச்', 'த்', 'ப்'].includes(lastChar) && word.length > 2) {
    const stripped = word.slice(0, -1);
    return checkWordVariation(stripped);
  }
  return false;
}

function getWordCandidateRoots(w) {
  const candidates = new Set();
  candidates.add(w);

  // Suffix matching
  const matchedSuffixes = TAMIL_SUFFIXES.filter(suffix => w.endsWith(suffix) && w.length > suffix.length + 1);
  for (const suffix of matchedSuffixes) {
    const root = w.slice(0, -suffix.length);
    candidates.add(root);
    candidates.add(root + 'ம்');
  }

  // Trailing consonant stripping for the word and its variations
  const currentCandidates = Array.from(candidates);
  for (const cand of currentCandidates) {
    const lastChar = cand.slice(-1);
    if (['க்', 'ச்', 'த்', 'ப்'].includes(lastChar) && cand.length > 2) {
      candidates.add(cand.slice(0, -1));
    }
  }

  return Array.from(candidates);
}

// Public API
async function checkSpellingOfText(text) {
  await ensureDbInitialized();
  const words = extractTamilWords(text);
  if (words.length === 0) return [];

  // Get unique list of words to check
  const uniqueWords = [...new Set(words)];
  
  // Find which words are already resolved in-memory
  const unresolvedWords = [];
  for (const word of uniqueWords) {
    const candidates = getWordCandidateRoots(word);
    const isValid = candidates.some(cand => dictionarySet.has(cand) || verifiedWordsCache.has(cand) || customSandhiWordsSet.has(cand));
    if (!isValid) {
      unresolvedWords.push(word);
    }
  }

  // If there are unresolved words, query MongoDB in bulk
  if (unresolvedWords.length > 0) {
    // Generate all candidates for unresolved words
    const allCandidatesList = [];
    const uniqueCandidatesSet = new Set();
    
    for (const word of unresolvedWords) {
      const candidates = getWordCandidateRoots(word);
      for (const cand of candidates) {
        if (!uniqueCandidatesSet.has(cand)) {
          uniqueCandidatesSet.add(cand);
          allCandidatesList.push(cand);
        }
      }
    }

    try {
      const { DictionaryWord } = require('./models');
      // Query candidate roots from DB in bulk
      const foundDbDocs = await DictionaryWord.find({ word: { $in: allCandidatesList } }).select('word').lean();
      
      // Clear cache if it grows too large to prevent memory leak
      if (verifiedWordsCache.size > 100000) {
        verifiedWordsCache.clear();
      }

      // Add found words to the verifiedWordsCache
      for (const doc of foundDbDocs) {
        verifiedWordsCache.add(doc.word);
      }
    } catch (err) {
      console.error('Spelling check DB query failed:', err.message);
    }
  }

  // Now determine the final spelling errors
  const spellingErrors = [];
  for (const word of words) {
    const candidates = getWordCandidateRoots(word);
    const isValid = candidates.some(cand => dictionarySet.has(cand) || verifiedWordsCache.has(cand) || customSandhiWordsSet.has(cand));
    if (!isValid) {
      spellingErrors.push(word);
    }
  }

  return [...new Set(spellingErrors)];
}

async function addWordToDictionary(word, isCustom = 1) {
  await ensureDbInitialized();
  if (!word || typeof word !== 'string') throw new Error('Invalid word');
  
  const cleanWord = (word.match(/[\u0B80-\u0BFF]+/g) || []).join(' ').trim();
  if (cleanWord.length <= 1) throw new Error('Word too short');

  const { DictionaryWord } = require('./models');

  const doc = await DictionaryWord.findOneAndUpdate(
    { word: cleanWord },
    { word: cleanWord, isCustom },
    { upsert: true, new: true, rawResult: true }
  );

  const wasAdded = doc.lastErrorObject ? !doc.lastErrorObject.updatedExisting : true;

  // Add to cache
  dictionarySet.add(cleanWord);
  if (isCustom === 1) {
    customWordsSet.add(cleanWord);
  }

  console.log(`Added word to dictionary: "${cleanWord}" (isCustom: ${isCustom})`);
  return { word: cleanWord, added: wasAdded };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTamilLetterCount(word) {
  if (!word) return 0;
  const matches = word.match(/[\u0B80-\u0BFF][\u0BBE-\u0BCD\u0BD7]*/g);
  return matches ? matches.length : 0;
}

async function getWords({ query, isCustom, page = 1, limit = 100, matchCase = false, matchWholeWord = false, useRegex = false }) {
  await ensureDbInitialized();
  const { DictionaryWord } = require('./models');
  
  const filter = {};
  if (isCustom !== undefined && isCustom !== '') {
    filter.isCustom = Number(isCustom);
  }

  // Check if query contains Tamil letter count filter like *5 or *7 or *7+ or prefix*5
  const lengthMatch = query ? query.trim().match(/^(.*?)\*(\d+)([\+=])?$/) : null;

  if (lengthMatch) {
    const textPrefix = lengthMatch[1].trim();
    const reqLen = parseInt(lengthMatch[2], 10);
    const modifier = lengthMatch[3];
    
    // Default rule: for N >= 7, treat as N or more (7, 8, 9...); for N < 7, treat as exact N letters
    let isAtLeast = false;
    if (modifier === '+') {
      isAtLeast = true;
    } else if (modifier === '=') {
      isAtLeast = false;
    } else {
      isAtLeast = reqLen >= 7;
    }

    if (textPrefix) {
      const flags = matchCase ? '' : 'i';
      let pattern = escapeRegExp(textPrefix);
      filter.word = { $regex: pattern, $options: flags };
    }

    // Retrieve candidate records from DB
    const candidates = await DictionaryWord.find(filter).sort({ word: 1 }).lean();

    // Filter by Tamil letter count (grapheme clusters)
    const filteredRows = candidates.filter(r => {
      const len = getTamilLetterCount(r.word);
      return isAtLeast ? len >= reqLen : len === reqLen;
    });

    const total = filteredRows.length;
    const skip = (Number(page) - 1) * Number(limit);
    const pagedRows = filteredRows.slice(skip, skip + Number(limit));

    return {
      words: pagedRows.map(r => ({ word: r.word, isCustom: r.isCustom === 1 })),
      total,
      page: Number(page),
      limit: Number(limit)
    };
  }

  if (query) {
    let queryObj = {};
    if (useRegex) {
      const flags = matchCase ? '' : 'i';
      let pattern = query;
      if (matchWholeWord) {
        pattern = `^${pattern}$`;
      }
      queryObj = { $regex: pattern, $options: flags };
    } else {
      let pattern = escapeRegExp(query);
      if (matchWholeWord) {
        pattern = `^${pattern}$`;
      }
      const flags = matchCase ? '' : 'i';
      queryObj = { $regex: pattern, $options: flags };
    }
    filter.word = queryObj;
  }

  const total = await DictionaryWord.countDocuments(filter);
  const skip = (Number(page) - 1) * Number(limit);
  
  const rows = await DictionaryWord.find(filter)
    .sort({ word: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    words: rows.map(r => ({ word: r.word, isCustom: r.isCustom === 1 })),
    total,
    page: Number(page),
    limit: Number(limit)
  };
}

async function updateWordInDictionary(oldWord, newWord, isCustom = 1) {
  await ensureDbInitialized();
  if (!newWord || typeof newWord !== 'string') throw new Error('Invalid new word');
  const cleanNewWord = (newWord.match(/[\u0B80-\u0BFF]+/g) || []).join(' ').trim();
  if (cleanNewWord.length <= 1) throw new Error('Word too short');

  const { DictionaryWord } = require('./models');

  const doc = await DictionaryWord.findOneAndUpdate(
    { word: oldWord },
    { word: cleanNewWord, isCustom },
    { new: true }
  );

  if (doc) {
    // Update cache
    dictionarySet.delete(oldWord);
    dictionarySet.add(cleanNewWord);
    if (isCustom === 1) {
      customWordsSet.delete(oldWord);
      customWordsSet.add(cleanNewWord);
    }
    return { word: cleanNewWord, updated: true };
  }
  return { word: cleanNewWord, updated: false };
}

async function deleteWordFromDictionary(word) {
  await ensureDbInitialized();
  const { DictionaryWord } = require('./models');
  const res = await DictionaryWord.deleteOne({ word });
  
  if (res.deletedCount > 0) {
    dictionarySet.delete(word);
    customWordsSet.delete(word);
    return { success: true, deleted: true };
  }
  return { success: true, deleted: false };
}

async function importWordsToDictionary(words, isCustom = 1) {
  await ensureDbInitialized();
  if (!Array.isArray(words)) throw new Error('Words must be an array');
  
  const { DictionaryWord } = require('./models');

  // 1. Clean words to keep only valid Tamil characters
  const cleaned = words
    .map(w => (w || '').toString().match(/[\u0B80-\u0BFF]+/g) || [])
    .map(arr => arr.join(' ').trim())
    .filter(w => w.length > 1);

  // 2. Remove duplicate words from the input itself
  const uniqueInputWords = [...new Set(cleaned)];

  if (uniqueInputWords.length === 0) {
    return { success: true, count: 0, skipped: words.length };
  }

  // 3. Filter out words that already exist in our cache
  const wordsToInsert = uniqueInputWords.filter(w => !dictionarySet.has(w));
  const alreadyExistCount = uniqueInputWords.length - wordsToInsert.length;
  const invalidOrDuplicateInputCount = words.length - uniqueInputWords.length;
  const totalSkipped = alreadyExistCount + invalidOrDuplicateInputCount;

  if (wordsToInsert.length === 0) {
    return { 
      success: true, 
      count: 0, 
      skipped: totalSkipped 
    };
  }

  // 4. Insert into MongoDB
  const bulkOps = wordsToInsert.map(w => ({
    updateOne: {
      filter: { word: w },
      update: { word: w, isCustom },
      upsert: true
    }
  }));

  await DictionaryWord.bulkWrite(bulkOps);

  // 5. Update cache
  for (const w of wordsToInsert) {
    dictionarySet.add(w);
    if (isCustom === 1) {
      customWordsSet.add(w);
    }
  }

  return {
    success: true,
    count: wordsToInsert.length,
    skipped: totalSkipped
  };
}

const TAMIL_VOWELS = new Set([
  'அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ'
]);

async function analyzeDataset(text) {
  await ensureDbInitialized();
  if (!text) {
    return {
      totalExtractedCount: 0,
      uniqueCount: 0,
      matchCount: 0,
      unknownCount: 0,
      unknownWords: []
    };
  }
  
  // Step 1 - Text Processing
  // Normalize using NFC and remove invalid surrogate sequences
  let cleaned = text.normalize('NFC');
  cleaned = cleaned.replace(/[\uD800-\uDBFF][^\uDC00-\uDFFF]|[^\uD800-\uDBFF][\uDFFF]/g, '');
  
  // Replace HTML tags with spaces
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');
  
  // Replace control characters with spaces
  cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
  
  // Split by whitespace to extract raw tokens
  const rawTokens = cleaned.split(/\s+/);
  const extractedWords = [];
  
  // Regex to strip leading and trailing boundary symbols, punctuation, quotes, brackets
  const boundaryRegex = /^[.,;:?!'"“‘’()\[\]{}_\-/\\|*+=<>@#$%^&~]+|[.,;:?!'"“‘’()\[\]{}_\-/\\|*+=<>@#$%^&~]+$/g;

  for (let token of rawTokens) {
    token = token.trim();
    if (!token) continue;
    
    // Strip leading and trailing boundary punctuation
    let cleanWord = token;
    let prevLength;
    do {
      prevLength = cleanWord.length;
      cleanWord = cleanWord.replace(boundaryRegex, '');
    } while (cleanWord.length !== prevLength);

    if (!cleanWord) continue;

    // Filter words that contain apostrophes or any non-Tamil symbols/characters
    const hasNonTamilChars = /[^\u0B80-\u0BFF]/.test(cleanWord);
    if (hasNonTamilChars) {
      continue;
    }

    // Filter out Tamil numbers, digits, and symbols/abbreviations
    const hasTamilDigitsOrSymbols = /[\u0BE6-\u0BFA]/.test(cleanWord);
    if (hasTamilDigitsOrSymbols) {
      continue;
    }

    // Filter standalone independent vowels: அ, ஆ, இ, ஈ, உ, ஊ, எ, ஏ, ஐ, ஒ, ஓ, ஔ
    if (TAMIL_VOWELS.has(cleanWord)) {
      continue;
    }

    extractedWords.push(cleanWord);
  }
  
  const totalExtractedCount = extractedWords.length;
  
  // Step 3 - Duplicate Removal
  const uniqueWords = [...new Set(extractedWords)];
  const uniqueCount = uniqueWords.length;
  
  // Step 4 - Dictionary Validation
  // Compare every processed word against the Dictionary Database cache.
  const unknownWords = [];
  let matchCount = 0;
  
  for (const w of uniqueWords) {
    if (dictionarySet.has(w)) {
      matchCount++;
    } else {
      unknownWords.push(w);
    }
  }
  
  const unknownCount = unknownWords.length;
  
  return {
    totalExtractedCount,
    uniqueCount,
    matchCount,
    unknownCount,
    unknownWords
  };
}

async function bulkInsertWords(words, isCustom = 1) {
  await ensureDbInitialized();
  if (!Array.isArray(words)) throw new Error('Words must be an array');
  
  const { DictionaryWord } = require('./models');
  
  const selectedCount = words.length;
  let addedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  
  // 1. Normalize data: Unicode NFC normalization, space trimming
  const normalizedWords = [];
  for (const w of words) {
    const norm = (w || '').toString().normalize('NFC').trim();
    // Safe Insert: Skip invalid entries, Tamil symbols/numbers, and standalone vowels automatically
    const isValid = norm.length >= 1 && 
                    /^[\u0B80-\u0BFF]+$/.test(norm) && 
                    !/[\u0BE6-\u0BFA]/.test(norm) && 
                    !TAMIL_VOWELS.has(norm);
    if (!isValid) {
      failedCount++;
    } else {
      normalizedWords.push(norm);
    }
  }
    
  // 2. Duplicate checking in the input itself
  const uniqueInputWords = [...new Set(normalizedWords)];
  const inputDuplicatesCount = normalizedWords.length - uniqueInputWords.length;
  skippedCount += inputDuplicatesCount;
  
  if (uniqueInputWords.length === 0) {
    return {
      success: true,
      selectedCount,
      addedCount,
      skippedCount,
      failedCount
    };
  }
  
  // 3. Filter out words already existing in cache/database (Prevent Duplicates)
  const wordsToInsert = [];
  for (const w of uniqueInputWords) {
    if (dictionarySet.has(w)) {
      skippedCount++;
    } else {
      wordsToInsert.push(w);
    }
  }
  
  if (wordsToInsert.length === 0) {
    return {
      success: true,
      selectedCount,
      addedCount,
      skippedCount,
      failedCount
    };
  }
  
  // 4. Batch database operations: insert new words using bulkWrite
  try {
    const bulkOps = wordsToInsert.map(w => ({
      updateOne: {
        filter: { word: w },
        update: { word: w, isCustom },
        upsert: true
      }
    }));
    
    await DictionaryWord.bulkWrite(bulkOps);
    
    // Update cache
    for (const w of wordsToInsert) {
      dictionarySet.add(w);
      if (isCustom === 1) {
        customWordsSet.add(w);
      }
    }
    
    addedCount = wordsToInsert.length;
  } catch (err) {
    console.error('Failed to bulk insert words:', err);
    failedCount += wordsToInsert.length;
    return {
      success: false,
      error: err.message,
      selectedCount,
      addedCount: 0,
      skippedCount: selectedCount - failedCount,
      failedCount
    };
  }
  
  return {
    success: true,
    selectedCount,
    addedCount,
    skippedCount,
    failedCount
  };
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function getSimilarity(a, b) {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
}

function getTamilGrammaticalLength(w) {
  if (!w) return 0;
  // Strip combining vowel signs (U+0BBE to U+0BCC) and pulli (U+0BCD)
  const clean = w.replace(/[\u0BBE-\u0BCD]/g, '');
  return clean.length;
}

async function getSpellingSuggestions(word) {
  await ensureDbInitialized();
  if (!word) return [];
  const query = word.normalize('NFC').trim();
  if (query.length === 0) return [];

  const suggestions = new Set();

  const queryGrammarLen = getTamilGrammaticalLength(query);
  const queryFirstChar = query.charAt(0);

  // 1. Direct similarity check (80% match or higher)
  // Optimize by only checking words with length difference <= 3
  const queryLen = query.length;
  for (const dbWord of dictionarySet) {
    if (Math.abs(dbWord.length - queryLen) <= 3) {
      const sim = getSimilarity(query, dbWord);
      if (sim >= 0.8) {
        suggestions.add(dbWord);
      } 
      // Special rule for short words (2 Tamil letters grammatically):
      // If the query word is 2 letters, accept similarity >= 0.5 for database words that are also <= 2 letters
      else if (queryGrammarLen === 2 && getTamilGrammaticalLength(dbWord) <= 2) {
        if (sim >= 0.5) {
          suggestions.add(dbWord);
        }
      }
    }
  }

  // 2. Short words fallback: if suggestions are few, find other 2-letter words starting with the same consonant series
  if (queryGrammarLen === 2 && suggestions.size < 5) {
    for (const dbWord of dictionarySet) {
      if (suggestions.size >= 5) break;
      if (getTamilGrammaticalLength(dbWord) === 2 && dbWord.charAt(0) === queryFirstChar) {
        suggestions.add(dbWord);
      }
    }
  }

  // 3. Exact word variations check (stripping suffix, etc.)
  for (const suffix of TAMIL_SUFFIXES) {
    if (query.endsWith(suffix) && query.length > suffix.length + 1) {
      const root = query.slice(0, -suffix.length);
      if (dictionarySet.has(root)) {
        suggestions.add(root);
      }
      if (dictionarySet.has(root + 'ம்')) {
        suggestions.add(root + 'ம்');
      }
    }
  }

  // 4. Sandhi variations check
  const sandhiChars = ['க்', 'ச்', 'த்', 'ப்'];
  const lastChar = query.slice(-1);
  if (['க்', 'ச்', 'த்', 'ப்'].includes(lastChar) && query.length > 2) {
    const stripped = query.slice(0, -1);
    if (dictionarySet.has(stripped)) {
      suggestions.add(stripped);
    }
  }
  for (const sc of sandhiChars) {
    const candidate = query + sc;
    if (dictionarySet.has(candidate)) {
      suggestions.add(candidate);
    }
  }

  // Sort by similarity descending
  const result = Array.from(suggestions)
    .map(w => ({ word: w, similarity: getSimilarity(query, w) }))
    .sort((a, b) => b.similarity - a.similarity)
    .map(item => item.word)
    .slice(0, 5); // Limit to top 5 suggestions

  return result;
}

// ===================================================================
// System Words CRUD — correct_grammar & alert
// ===================================================================

/**
 * SystemWord-ஐ reload செய்யும் helper — add/delete/update-க்கு பிறகு cache refresh
 */
async function reloadSystemWordsCache() {
  try {
    const { SystemWord } = require('./models');
    const allSystemWords = await SystemWord.find({}).lean();
    correctGrammarWordsSet.clear();
    alertWordsSet.clear();
    for (const sw of allSystemWords) {
      if (sw.type === 'correct_grammar') {
        correctGrammarWordsSet.add(sw.word);
      } else if (sw.type === 'alert') {
        alertWordsSet.add(sw.word);
      }
    }
  } catch (err) {
    console.error('Failed to reload system words cache:', err.message);
  }
}

async function getSystemWords({ type, query, page = 1, limit = 100 } = {}) {
  const { SystemWord } = require('./models');
  const filter = {};
  if (type) filter.type = type;
  if (query) {
    filter.word = { $regex: escapeRegExp(query), $options: 'i' };
  }
  const total = await SystemWord.countDocuments(filter);
  const skip = (Number(page) - 1) * Number(limit);
  const rows = await SystemWord.find(filter)
    .sort({ type: 1, word: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();
  return {
    words: rows.map(r => ({ word: r.word, type: r.type, addedBy: r.addedBy, note: r.note })),
    total,
    page: Number(page),
    limit: Number(limit)
  };
}

async function addSystemWord(word, type, addedBy = 'admin', note = '') {
  if (!word || typeof word !== 'string') throw new Error('Invalid word');
  if (!['correct_grammar', 'alert'].includes(type)) throw new Error('Invalid type. Use correct_grammar or alert');

  const cleanWord = word.normalize('NFC').trim();
  if (!cleanWord) throw new Error('Word cannot be empty');

  const { SystemWord } = require('./models');
  const doc = await SystemWord.findOneAndUpdate(
    { word: cleanWord },
    { word: cleanWord, type, addedBy, note },
    { upsert: true, new: true, rawResult: true }
  );

  const wasAdded = doc.lastErrorObject ? !doc.lastErrorObject.updatedExisting : true;

  // Update in-memory cache
  if (type === 'correct_grammar') {
    correctGrammarWordsSet.add(cleanWord);
    alertWordsSet.delete(cleanWord);
  } else if (type === 'alert') {
    alertWordsSet.add(cleanWord);
    correctGrammarWordsSet.delete(cleanWord);
  }

  console.log(`System word added: "${cleanWord}" type=${type}`);
  return { word: cleanWord, type, added: wasAdded };
}

async function deleteSystemWord(word) {
  const { SystemWord } = require('./models');
  const res = await SystemWord.deleteOne({ word });

  if (res.deletedCount > 0) {
    correctGrammarWordsSet.delete(word);
    alertWordsSet.delete(word);
    return { success: true, deleted: true };
  }
  return { success: true, deleted: false };
}

async function updateSystemWord(oldWord, newWord, type, note = '') {
  if (!['correct_grammar', 'alert'].includes(type)) throw new Error('Invalid type');
  const cleanNewWord = (newWord || '').normalize('NFC').trim();
  if (!cleanNewWord) throw new Error('New word cannot be empty');

  const { SystemWord } = require('./models');
  const doc = await SystemWord.findOneAndUpdate(
    { word: oldWord },
    { word: cleanNewWord, type, note },
    { new: true }
  );

  if (doc) {
    // Update cache: remove old, add new
    correctGrammarWordsSet.delete(oldWord);
    alertWordsSet.delete(oldWord);
    if (type === 'correct_grammar') {
      correctGrammarWordsSet.add(cleanNewWord);
    } else {
      alertWordsSet.add(cleanNewWord);
    }
    return { word: cleanNewWord, type, updated: true };
  }
  return { word: cleanNewWord, type, updated: false };
}

/**
 * Frontend-க்கு system words-ஐ அனுப்ப: correctGrammarWords[] & alertWords[]
 */
async function getSystemWordsSnapshot() {
  await ensureDbInitialized();
  return {
    correctGrammarWords: Array.from(correctGrammarWordsSet),
    alertWords: Array.from(alertWordsSet),
    customSandhiRules: customSandhiRulesCache
  };
}

async function reloadCustomSandhiRulesCache() {
  try {
    const { CustomSandhiRule } = require('./models');
    customSandhiRulesCache = await CustomSandhiRule.find({}).lean();
    customSandhiWordsSet.clear();
    for (const rule of customSandhiRulesCache) {
      customSandhiWordsSet.add(rule.precedingWord);
      customSandhiWordsSet.add(rule.succeedingWord);
    }
  } catch (err) {
    console.error('Failed to reload custom sandhi rules cache:', err.message);
  }
}

async function getCustomSandhiRules() {
  await ensureDbInitialized();
  return customSandhiRulesCache;
}

async function addCustomSandhiRule(precedingWord, succeedingWord, behavior, reason) {
  await ensureDbInitialized();
  const cleanPreceding = (precedingWord || '').normalize('NFC').trim();
  const cleanSucceeding = (succeedingWord || '').normalize('NFC').trim();
  if (!cleanPreceding || !cleanSucceeding) {
    throw new Error('Preceding and succeeding words cannot be empty');
  }
  const { CustomSandhiRule } = require('./models');
  const doc = await CustomSandhiRule.findOneAndUpdate(
    { precedingWord: cleanPreceding, succeedingWord: cleanSucceeding },
    { precedingWord: cleanPreceding, succeedingWord: cleanSucceeding, behavior, reason: (reason || '').trim() },
    { upsert: true, new: true }
  ).lean();
  await reloadCustomSandhiRulesCache();
  return doc;
}

async function updateCustomSandhiRule(id, precedingWord, succeedingWord, behavior, reason) {
  await ensureDbInitialized();
  const cleanPreceding = (precedingWord || '').normalize('NFC').trim();
  const cleanSucceeding = (succeedingWord || '').normalize('NFC').trim();
  if (!cleanPreceding || !cleanSucceeding) {
    throw new Error('Preceding and succeeding words cannot be empty');
  }
  const { CustomSandhiRule } = require('./models');
  const doc = await CustomSandhiRule.findByIdAndUpdate(
    id,
    { precedingWord: cleanPreceding, succeedingWord: cleanSucceeding, behavior, reason: (reason || '').trim() },
    { new: true }
  ).lean();
  await reloadCustomSandhiRulesCache();
  return doc;
}

async function deleteCustomSandhiRule(id) {
  await ensureDbInitialized();
  const { CustomSandhiRule } = require('./models');
  const result = await CustomSandhiRule.findByIdAndDelete(id);
  await reloadCustomSandhiRulesCache();
  return { success: !!result };
}

module.exports = {
  initDb: () => ensureDbInitialized(),
  seedDictionary: () => Promise.resolve(), // Executed automatically inside ensureDbInitialized
  checkSpellingOfText,
  addWordToDictionary,
  extractTamilWords,
  getTamilLetterCount,
  getWords,
  updateWordInDictionary,
  deleteWordFromDictionary,
  importWordsToDictionary,
  analyzeDataset,
  bulkInsertWords,
  getSpellingSuggestions,
  // System Words exports
  getSystemWords,
  addSystemWord,
  deleteSystemWord,
  updateSystemWord,
  getSystemWordsSnapshot,
  reloadSystemWordsCache,
  // Custom Sandhi Overrides
  getCustomSandhiRules,
  addCustomSandhiRule,
  updateCustomSandhiRule,
  deleteCustomSandhiRule
};
