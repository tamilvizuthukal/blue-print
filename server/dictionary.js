const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let dbPath = path.join(__dirname, 'tamil_dictionary.db');
let db;

// Vercel Serverless environment compatibility (makes the database writeable in /tmp)
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  const tempDbPath = path.join('/tmp', 'tamil_dictionary.db');
  try {
    if (!fs.existsSync(tempDbPath)) {
      console.log(`Setting up SQLite database in writeable path: ${tempDbPath}`);
      if (fs.existsSync(dbPath)) {
        console.log(`Copying pre-built database from ${dbPath} to ${tempDbPath}`);
        fs.copyFileSync(dbPath, tempDbPath);
      } else {
        console.log('No pre-built SQLite database found in server. A new database will be initialized in /tmp');
      }
    } else {
      console.log(`Reusing existing SQLite database in: ${tempDbPath}`);
    }
    dbPath = tempDbPath;
  } catch (err) {
    console.error('Failed to setup SQLite database in Vercel /tmp directory:', err.message);
  }
}

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

function initDb() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite:', err.message);
        return reject(err);
      }
      console.log('Connected to SQLite Tamil Dictionary database.');
      
      // Create table
      db.run(`
        CREATE TABLE IF NOT EXISTS dictionary (
          word TEXT PRIMARY KEY,
          is_custom INTEGER DEFAULT 0
        )
      `, (err) => {
        if (err) {
          console.error('Failed to create SQLite table:', err.message);
          return reject(err);
        }
        resolve();
      });
    });
  });
}

// Extract Tamil words from any text string
function extractTamilWords(text) {
  if (!text) return [];
  // Remove HTML
  const cleanText = text.replace(/<[^>]*>/g, ' ');
  // Match only Tamil Unicode characters U+0B80 to U+0BFF
  const matches = cleanText.match(/[\u0B80-\u0BFF]+/g);
  if (!matches) return [];
  return matches
    .map(w => w.trim())
    .filter(w => w.length > 1);
}

// Seed the database with words from the grammar checker and MongoDB
async function seedDictionary() {
  // Check if already seeded
  const count = await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM dictionary', (err, row) => {
      resolve(row ? row.count : 0);
    });
  });

  if (count > 0) {
    console.log(`Dictionary already has ${count} words. Skipping initial seed.`);
    return;
  }

  console.log('Seeding Tamil dictionary from grammar checker lists...');
  const seedWords = new Set();

  // Words from grammar rules
  const ssol = "கடைசி,சின்ன,வேண்டா,ஏற்று,எல்லா,அந்த,எந்த,இந்த,அப்படி,அங்கு,எங்கு,இங்கு,ஆங்கு,ஈங்கு,யாங்கு,இப்படி,எப்படி,ஈண்டு,ஆண்டு,யாண்டு,எத்துணை,அத்துணை,இத்துணை,தனி,என,முன்னர்,பின்னர்,அரை,பாதி,இன்றி,அன்றி,மற்றை,சிறப்பு,நடு,புது,பொது,பசு,திரு,முழு,விழு,என்னை,நம்மை,எம்மை,உன்னை,நின்னை,உம்மை,உங்களை,தன்னை,தம்மை,தங்களை,அவளை,அவனை,இவரை,அவரை,அதனை,இதனை,எதனை,அவற்றை,இவற்றை,எவற்றை,என்பதை,அதை,இதை,எதை,தமிழை,வில்லை,பொருத்து,எனக்கு,எனக்காக,நமக்காக,எமக்காக,உனக்கு,நினக்கு,உனக்காக,நினைக்காக,உமக்கு,உங்களுக்கு,உமக்காக,உங்களுக்காக,தனக்கு,தனக்காக,தமக்கு,தமக்காக,தங்களுக்கு,அவற்கு,அவட்கு,அவர்க்கு,தங்களுக்காக,அதற்கு,இதற்கு,எதற்கு,அவற்றிற்கு,இவற்றிற்கு,எவற்றிற்கு,நிறைய,குறைய,முக்கிய,அடுத்த,சரிவர,அதிக,வாக்கிய,ஐக்கிய,இலக்கிய,ஆரோக்கிய,பாக்கிய,அற்று".split(",");
  const nsol = "நன்கு,கடந்து,நடந்து,தொடர்ந்து,வரை,நேற்று,வெகு,இனி,நல்ல,கரிய,அரிய,பழைய,இனிய,இளைய,மூத்த,அங்க,அங்கே,இங்க,இங்கே,ஏதோ,நீங்க,இவரு,நீ,உங்களது,இவரது,அவரது,எனது,உனது,நினது,தமது,தனது,அது,எது,இது,உது,நமது,எமது,உமது,ஏது,ஏன்,யாது,அவை,எவை,இவை,யாவை,அத்தனை,எத்தனை,இத்தனை,அவ்வளவு,எவ்வளவு,இவ்வளவு,இத்தகைய,அத்தகைய,எத்தகைய,எது,என்பது,பண்டு,முந்து,அன்று,நாளை,இன்று,என்று,அன்றைய,நேற்றைய,நாளைய,இன்றைய,என்றைய,முந்தைய,பிந்தைய,அவ்வாறு,இவ்வாறு,எவ்வாறு,ஒன்று,இரண்டு,மூன்று,நான்கு,ஐந்து,ஆறு,ஏழு,ஒன்பது,நூறு,ஒரு,ஓர்,இரு,அறு,எழு,பல,சில,என்ன,சிறு,முது,மறு,என்ற,புகழ்,கண்டு,செய்து,சரியான,என்றோ,அன்ன,ஒரே,இல்லாத,செல்லாத,காணாத,ஓடாத,அம்மா,அப்பா,தம்பி,தங்கை,அக்கா,அண்ணன்,அண்ணா,தாத்தா,பாட்டி,தோழி,நண்பர்,மனைவி,தந்தை,மாமா,என்னோடு,தன்னொடு,அல்லது,அல்லாது,அல்ல,இதோ,அதோ,மேதகு,மாண்புமிகு,டாக்டர்,பலர்,சிலர்,சும்மா,முதலிய,சரி,பிற,அக்கறை,நன்றி,முடியாது,ஆகிய,இரவு,தவறு,உங்க,சிறந்த".split(",");
  const nvarusol = "சரியா,பாணம்,குரு,சார்".split(",");
  const cssol = "தெரு,அணு,வரி".split(",");
  const nvaru = "தெய்வ,தேசிய,பாணி,சுவாமி,சக்தி,தினம்".split(",");

  ssol.forEach(w => seedWords.add(w.trim()));
  nsol.forEach(w => seedWords.add(w.trim()));
  nvarusol.forEach(w => seedWords.add(w.trim()));
  cssol.forEach(w => seedWords.add(w.trim()));
  nvaru.forEach(w => seedWords.add(w.trim()));

  // Add standard common words
  const extraWords = [
    'வணக்கம்', 'மாணவர்', 'ஆசிரியர்', 'பள்ளி', 'வகுப்பு', 'புத்தகம்', 'பாடம்', 'தேர்வு', 
    'கேள்வி', 'பதில்', 'விடை', 'வினா', 'தமிழ்', 'ஆங்கிலம்', 'கணிதம்', 'அறிவியல்', 
    'சமூகவியல்', 'மதிப்பெண்', 'காலம்', 'நேரம்', 'நாள்', 'வாரம்', 'மாதம்', 'வருடம்', 
    'நாடு', 'நகரம்', 'கிராமம்', 'மக்கள்', 'அரசு', 'கல்வி', 'பயிற்சி', 'பயன்', 'வாழ்த்து'
  ];
  extraWords.forEach(w => seedWords.add(w));

  // Seed from MongoDB if models are available (will run when server connects)
  try {
    const { Curriculum, Blueprint } = require('./models');
    
    // Extract words from Curriculum
    const curricula = await Curriculum.find({}).lean();
    for (const c of curricula) {
      if (c.subject) extractTamilWords(c.subject).forEach(w => seedWords.add(w));
      if (c.units) {
        for (const u of c.units) {
          if (u.name) extractTamilWords(u.name).forEach(w => seedWords.add(w));
          if (u.learningOutcomes) extractTamilWords(u.learningOutcomes).forEach(w => seedWords.add(w));
          if (u.subUnits) {
            u.subUnits.forEach(su => {
              if (su.name) extractTamilWords(su.name).forEach(w => seedWords.add(w));
            });
          }
        }
      }
    }

    // Extract words from Blueprints (questions/answers)
    const blueprints = await Blueprint.find({}).lean();
    for (const bp of blueprints) {
      if (bp.subject) extractTamilWords(bp.subject).forEach(w => seedWords.add(w));
      if (bp.items) {
        for (const item of bp.items) {
          if (item.questionText) extractTamilWords(item.questionText).forEach(w => seedWords.add(w));
          if (item.questionTextB) extractTamilWords(item.questionTextB).forEach(w => seedWords.add(w));
          if (item.answerText) extractTamilWords(item.answerText).forEach(w => seedWords.add(w));
          if (item.answerTextB) extractTamilWords(item.answerTextB).forEach(w => seedWords.add(w));
          if (item.furtherInfo) extractTamilWords(item.furtherInfo).forEach(w => seedWords.add(w));
          if (item.furtherInfoB) extractTamilWords(item.furtherInfoB).forEach(w => seedWords.add(w));
        }
      }
    }
  } catch (mongoErr) {
    console.warn('Could not extract words from MongoDB models (maybe not connected yet or empty). Proceeding with standard seeds.', mongoErr.message);
  }

  // Insert in batch
  const wordsArray = Array.from(seedWords).filter(w => w.length > 1);
  console.log(`Starting seeding of ${wordsArray.length} words to SQLite...`);
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare('INSERT OR IGNORE INTO dictionary (word, is_custom) VALUES (?, 0)');
    for (const w of wordsArray) {
      stmt.run(w);
    }
    stmt.finalize();
    db.run('COMMIT', (err) => {
      if (err) {
        console.error('Failed to commit transaction:', err.message);
      } else {
        db.get('SELECT COUNT(*) as count FROM dictionary', (err, row) => {
          console.log(`Seeding complete. SQLite dictionary now has ${row ? row.count : 0} words.`);
        });
      }
    });
  });
}

// Simple stemmer to strip suffix and see if the root is in the database
function checkWordInDb(word) {
  return new Promise((resolve) => {
    // Helper function to check a word variation against the DB with suffix stripping
    const checkWordVariation = (w) => {
      return new Promise((resVal) => {
        db.get('SELECT word FROM dictionary WHERE word = ?', [w], (err, row) => {
          if (row) {
            return resVal(true);
          }
          
          let matchedSuffixes = TAMIL_SUFFIXES.filter(suffix => w.endsWith(suffix) && w.length > suffix.length + 1);
          if (matchedSuffixes.length === 0) {
            return resVal(false);
          }
          
          let foundSuffix = false;
          let checkCount = 0;
          for (const suffix of matchedSuffixes) {
            const root = w.slice(0, -suffix.length);
            db.get('SELECT word FROM dictionary WHERE word = ? OR word = ?', [root, root + 'ம்'], (err, subRow) => {
              checkCount++;
              if (subRow) {
                foundSuffix = true;
              }
              if (foundSuffix || checkCount === matchedSuffixes.length) {
                resVal(foundSuffix);
              }
            });
          }
        });
      });
    };

    // 1. Check the word as is (with normal suffix stripping)
    checkWordVariation(word).then((isValid) => {
      if (isValid) {
        return resolve(true);
      }
      
      // 2. If not valid, check if it has a trailing sandhi letter (க், ச், த், ப்)
      const lastChar = word.slice(-1);
      if (['க்', 'ச்', 'த்', 'ப்'].includes(lastChar) && word.length > 2) {
        const stripped = word.slice(0, -1);
        checkWordVariation(stripped).then((isStrippedValid) => {
          resolve(isStrippedValid);
        });
      } else {
        resolve(false);
      }
    });
  });
}

// Public API
async function checkSpellingOfText(text) {
  const words = extractTamilWords(text);
  if (words.length === 0) return [];

  const spellingErrors = [];
  for (const word of words) {
    const isValid = await checkWordInDb(word);
    if (!isValid) {
      spellingErrors.push(word);
    }
  }
  // Return unique spelling errors
  return [...new Set(spellingErrors)];
}

function addWordToDictionary(word, isCustom = 1) {
  return new Promise((resolve, reject) => {
    if (!word || typeof word !== 'string') return reject(new Error('Invalid word'));
    // Keep only Tamil Unicode characters, stripping punctuation, symbols, numbers, and spacing
    const cleanWord = (word.match(/[\u0B80-\u0BFF]+/g) || []).join('').trim();
    if (cleanWord.length <= 1) return reject(new Error('Word too short'));

    db.run(
      'INSERT OR IGNORE INTO dictionary (word, is_custom) VALUES (?, ?)',
      [cleanWord, isCustom ? 1 : 0],
      function (err) {
        if (err) return reject(err);
        console.log(`Added word to dictionary: "${cleanWord}" (isCustom: ${isCustom})`);
        resolve({ word: cleanWord, added: this.changes > 0 });
      }
    );
  });
}

function getWords({ query, isCustom, page = 1, limit = 100, matchCase = false, matchWholeWord = false, useRegex = false }) {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT word, is_custom FROM dictionary WHERE 1=1';
    const params = [];
    if (isCustom !== undefined && isCustom !== '') {
      sql += ' AND is_custom = ?';
      params.push(Number(isCustom));
    }
    
    // Retrieve all matches to filter them in JS (due to SQLite REGEXP/casing limitations)
    db.all(sql + ' ORDER BY word ASC', params, (err, rows) => {
      if (err) return reject(err);

      let filteredRows = rows;
      if (query) {
        try {
          if (useRegex) {
            const flags = matchCase ? '' : 'i';
            let pattern = query;
            if (matchWholeWord) {
              pattern = `^${pattern}$`;
            }
            const regex = new RegExp(pattern, flags);
            filteredRows = rows.filter(r => regex.test(r.word));
          } else {
            const q = matchCase ? query : query.toLowerCase();
            filteredRows = rows.filter(r => {
              const word = matchCase ? r.word : r.word.toLowerCase();
              if (matchWholeWord) {
                return word === q;
              } else {
                return word.includes(q);
              }
            });
          }
        } catch (regexErr) {
          // If regex is invalid, return empty list
          filteredRows = [];
        }
      }

      const total = filteredRows.length;
      let paginatedRows = filteredRows;
      if (limit > 0) {
        const offset = (Number(page) - 1) * Number(limit);
        paginatedRows = filteredRows.slice(offset, offset + Number(limit));
      }

      resolve({
        words: paginatedRows.map(r => ({ word: r.word, isCustom: r.is_custom === 1 })),
        total,
        page: Number(page),
        limit: Number(limit)
      });
    });
  });
}

function updateWordInDictionary(oldWord, newWord, isCustom = 1) {
  return new Promise((resolve, reject) => {
    if (!newWord || typeof newWord !== 'string') return reject(new Error('Invalid new word'));
    const cleanNewWord = (newWord.match(/[\u0B80-\u0BFF]+/g) || []).join('').trim();
    if (cleanNewWord.length <= 1) return reject(new Error('Word too short'));

    db.run(
      'UPDATE dictionary SET word = ?, is_custom = ? WHERE word = ?',
      [cleanNewWord, isCustom ? 1 : 0, oldWord],
      function (err) {
        if (err) return reject(err);
        resolve({ word: cleanNewWord, updated: this.changes > 0 });
      }
    );
  });
}

function deleteWordFromDictionary(word) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM dictionary WHERE word = ?', [word], function (err) {
      if (err) return reject(err);
      resolve({ success: true, deleted: this.changes > 0 });
    });
  });
}

function importWordsToDictionary(words, isCustom = 1) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(words)) return reject(new Error('Words must be an array'));
    
    // 1. Clean words to keep only valid Tamil characters
    const cleaned = words
      .map(w => (w || '').toString().match(/[\u0B80-\u0BFF]+/g) || [])
      .map(arr => arr.join('').trim())
      .filter(w => w.length > 1);

    // 2. Remove duplicate words from the input itself
    const uniqueInputWords = [...new Set(cleaned)];

    if (uniqueInputWords.length === 0) {
      return resolve({ success: true, count: 0, skipped: words.length });
    }

    // 3. Fetch existing words to prevent inserting duplicates
    db.all('SELECT word FROM dictionary', [], (err, rows) => {
      if (err) return reject(err);
      
      const existingWords = new Set(rows.map(r => r.word));
      
      // 4. Filter out words that already exist
      const wordsToInsert = uniqueInputWords.filter(w => !existingWords.has(w));
      const alreadyExistCount = uniqueInputWords.length - wordsToInsert.length;
      const invalidOrDuplicateInputCount = words.length - uniqueInputWords.length;
      const totalSkipped = alreadyExistCount + invalidOrDuplicateInputCount;
      
      if (wordsToInsert.length === 0) {
        return resolve({ 
          success: true, 
          count: 0, 
          skipped: totalSkipped 
        });
      }

      // 5. Insert only the truly new words in a transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare('INSERT OR IGNORE INTO dictionary (word, is_custom) VALUES (?, ?)');
        for (const w of wordsToInsert) {
          stmt.run(w, isCustom ? 1 : 0);
        }
        stmt.finalize();
        db.run('COMMIT', function(err) {
          if (err) return reject(err);
          resolve({ 
            success: true, 
            count: wordsToInsert.length, 
            skipped: totalSkipped
          });
        });
      });
    });
  });
}

module.exports = {
  initDb,
  seedDictionary,
  checkSpellingOfText,
  addWordToDictionary,
  extractTamilWords,
  getWords,
  updateWordInDictionary,
  deleteWordFromDictionary,
  importWordsToDictionary
};
