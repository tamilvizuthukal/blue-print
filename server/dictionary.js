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
let isDbInitialized = false;
let isSeeding = false;

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
  await initDb();
  isDbInitialized = true;
  
  // Trigger background seeding of words from database models asynchronously
  seedDictionary().catch(err => console.error('Dictionary background seeding failed:', err.message));
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

  const { DictionaryWord } = require('./models');

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

    // Load all custom and standard words from MongoDB
    const allDbWords = await DictionaryWord.find({}).lean();
    console.log(`Loading ${allDbWords.length} words from MongoDB to memory cache...`);
    
    for (const r of allDbWords) {
      dictionarySet.add(r.word);
      if (r.isCustom === 1) {
        customWordsSet.add(r.word);
      }
    }

    console.log(`Tamil Dictionary cache loaded with ${dictionarySet.size} total words.`);
  } catch (err) {
    console.error('Failed to load words from MongoDB to cache:', err.message);
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

// Public API
async function checkSpellingOfText(text) {
  await ensureDbInitialized();
  const words = extractTamilWords(text);
  if (words.length === 0) return [];

  const spellingErrors = [];
  for (const word of words) {
    const isValid = checkWordInDb(word);
    if (!isValid) {
      spellingErrors.push(word);
    }
  }
  // Return unique spelling errors
  return [...new Set(spellingErrors)];
}

async function addWordToDictionary(word, isCustom = 1) {
  await ensureDbInitialized();
  if (!word || typeof word !== 'string') throw new Error('Invalid word');
  
  const cleanWord = (word.match(/[\u0B80-\u0BFF]+/g) || []).join('').trim();
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

async function getWords({ query, isCustom, page = 1, limit = 100, matchCase = false, matchWholeWord = false, useRegex = false }) {
  await ensureDbInitialized();
  const { DictionaryWord } = require('./models');
  
  const filter = {};
  if (isCustom !== undefined && isCustom !== '') {
    filter.isCustom = Number(isCustom);
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
  const cleanNewWord = (newWord.match(/[\u0B80-\u0BFF]+/g) || []).join('').trim();
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
    .map(arr => arr.join('').trim())
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

module.exports = {
  initDb: () => ensureDbInitialized(),
  seedDictionary: () => Promise.resolve(), // Executed automatically inside ensureDbInitialized
  checkSpellingOfText,
  addWordToDictionary,
  extractTamilWords,
  getWords,
  updateWordInDictionary,
  deleteWordFromDictionary,
  importWordsToDictionary
};
