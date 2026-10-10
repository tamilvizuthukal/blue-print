const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(process.cwd(), '.env');
const serverEnvPath = path.join(__dirname, '.env');
if (fs.existsSync(serverEnvPath)) {
  require('dotenv').config({ path: serverEnvPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const {
  User, Curriculum, ExamConfig, Blueprint, PaperType,
  Discourse, SystemSettings, SharedBlueprint, AppSettings,
  GrammarRule, GrammarSettings
} = require('./models');

const EMAIL_PATTERN = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*@[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*\.[A-Za-z]{2,}$/;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Middleware to verify JWT
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required', message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT Verification failed:', err.message);
    res.status(401).json({ 
      error: 'Invalid or expired token', 
      message: err.message,
      suggestion: 'Please log out and log in again to refresh your session.'
    });
  }
};

// Middleware to verify Admin role
const adminAuth = (req, res, next) => {
  if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'WEBMASTER')) {
    next();
  } else {
    res.status(403).json({ 
      error: 'Access denied', 
      message: 'This action requires administrative privileges.' 
    });
  }
};

// Middleware to verify Webmaster role
const webmasterAuth = (req, res, next) => {
  if (req.user && req.user.role === 'WEBMASTER') {
    next();
  } else {
    res.status(403).json({ 
      error: 'Access denied', 
      message: 'This action requires webmaster privileges.' 
    });
  }
};

// AI Routes (Prioritized at the very top)
const aiRouter = express.Router();

const callOllama = async (prompt, jsonMode = false, temperature = 0.2) => {
  let settings = null;
  try {
    settings = await AppSettings.findOne().lean();
  } catch (err) {
    console.error('Error fetching AppSettings from DB:', err);
  }
  const endpoint = (settings?.ollamaEndpoint || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = settings?.ollamaModel || 'gemma3:12b';
  
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const body = {
    model: model,
    prompt: prompt,
    stream: false,
    options: {
      temperature: temperature
    }
  };
  
  if (jsonMode) {
    body.format = 'json';
  }
  
  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Ollama request failed with status ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  return data.response;
};

const handleAiError = (err, res) => {
  console.error('AI operation failed:', err);
  if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed')) {
    return res.status(503).json({
      error: 'Ollama Connection Failed',
      message: 'லோக்கல் ஓலாமா (Ollama) சேவை இயங்கவில்லை. தயவுசெய்து உங்கள் கணினியில் ஓலாமாவைத் துவக்கி, gemma3:12b மாடல் நிறுவப்பட்டுள்ளதா என்பதை உறுதிப்படுத்தவும்.'
    });
  }
  res.status(500).json({ error: 'AI Operation failed', message: err.message || String(err) });
};

aiRouter.post('/spell-check', async (req, res, next) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const prompt = `
You are an expert Tamil proofreader. Analyze the given Tamil text for spelling mistakes, grammar issues, and uncertain phrases.

Rules:
- Focus on Tamil language spelling and grammar.
- Return JSON only.
- Use type = "spelling" for spelling mistakes.
- Use type = "grammar" for grammar / phrasing issues that are clearly fixable.
- Use type = "uncertain" when you are not fully sure and the phrase should be manually reviewed.
- Keep source as the exact word or phrase from the input.
- suggestion must be a concrete corrected replacement.
- confidence must be one of: high, medium, low.
- explanation must be short and specific.
- Return at most 25 issues.

JSON schema:
{
  "issues": [
    {
      "source": "exact text from input",
      "suggestion": "replacement",
      "type": "spelling|grammar|uncertain",
      "confidence": "high|medium|low",
      "explanation": "short reason"
    }
  ]
}

Input text:
${text}
`;

    const responseText = await callOllama(prompt, true, 0.2);
    try {
      const parsed = JSON.parse(responseText);
      res.json(parsed);
    } catch (e) {
      console.error('Failed to parse Ollama JSON response:', responseText);
      res.status(500).json({ error: 'Invalid JSON response from local model', raw: responseText });
    }
  } catch (err) {
    handleAiError(err, res);
  }
});

aiRouter.post('/generate-answer', auth, async (req, res, next) => {
  const { question, marks, promptTemplate } = req.body;
  if (!question) return res.status(400).json({ error: 'Question text is required' });

  try {
    let constraints = '';
    if (marks !== undefined) {
      const m = Number(marks);
      if (m === 2) {
        constraints = '- விடையை 1 அல்லது 2 வரிகளுக்குள் (1 or 2 lines) மிகச் சுருக்கமாக எழுதவும்.';
      } else if (m === 3) {
        constraints = '- விடையை 2 அல்லது 3 வரிகளுக்குள் (2 or 3 lines) சுருக்கமாக எழுதவும்.';
      } else if (m === 1) {
        constraints = '- விடையை ஒரு வார்த்தை அல்லது ஒரு வாக்கியத்தில் (1 word or 1 line) எழுதவும்.';
      } else {
        constraints = `- விடையை இந்த வினாவின் ${m} மதிப்பெண்களுக்குத் தகுந்தவாறு விரிவாக எழுதவும்.`;
      }
    }

    let prompt = '';
    if (promptTemplate && promptTemplate.trim()) {
      prompt = `நீ ஒரு தமிழ் மொழி ஆசிரியர். உனக்கு வழங்கப்பட்டுள்ள "விடை வடிவமைப்பு குறிப்பு/விதிமுறை" (Discourse Prompt)-க்கு முழு முன்னுரிமை கொடுத்து, அதை முதன்மை விதியாகக் கொண்டு விடையளிக்க வேண்டும்.

விடை வடிவமைப்பு குறிப்பு/விதிமுறை:
${promptTemplate.trim()}

விதிக்கப்பட்டுள்ள கட்டுப்பாடுகள்:
- விடைகள் அனைத்தும் தமிழ் மொழியில் மட்டுமே இருக்க வேண்டும். ஆங்கிலம் அல்லது பிற மொழிகளை முற்றிலும் தவிர்க்கவும். ஆங்கில மொழிபெயர்ப்போ, விளக்கக்குறிப்புகளோ இருக்கக்கூடாது.
- தேவையற்ற விளக்கம், முன்னுரை, அல்லது "Answer:", "விடை:" போன்ற வார்த்தைகளைச் சேர்க்கக்கூடாது. நேரடி விடையை மட்டுமே எழுதவும்.
${constraints ? `- வினாவிற்கான மதிப்பெண் கட்டுப்பாடுகள்: ${constraints.replace('- ', '')}` : ''}

வினா:
${question}
`;
    } else {
      prompt = `You are an expert teacher. Provide a concise, accurate, and professional answer for the following question.

RULES:
- Strictly output the answer in Tamil language only. Do NOT include English translation, notes, or explanations in any other language under any circumstance.
- Provide ONLY the direct answer content.
- Do NOT include any preamble like "The answer is...", "Answer:", or "Based on your question...".
- Do NOT include the original question text.
- Do NOT include phrases like "Answer generated by AI".
- Return the response as a single string of plain text or simple HTML (using <p> or <ul> tags if needed).
${constraints}

Question:
${question}
`;
    }

    const answer = await callOllama(prompt, false, 0.3);
    res.json({ answer: answer.trim() });
  } catch (err) {
    handleAiError(err, res);
  }
});

aiRouter.post('/improve-text', async (req, res, next) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const prompt = `
Make it sound professional, clear, and elegant in Tamil.

Rules:
- Return ONLY the improved text.
- Do NOT include any preamble (like "Here is the improved text:", "Explanation:", etc.).
- Do NOT alter any HTML tags (e.g. <b>, <i>, <u>, <table>, <img>, <ul>, etc.) if they are present. Keep the HTML tags exactly in their original positions.
- Maintain the original meaning. Do not add external facts.

Tamil Text to improve:
${text}
`;

    const improvedText = await callOllama(prompt, false, 0.3);
    res.json({ improvedText: improvedText.trim() });
  } catch (err) {
    handleAiError(err, res);
  }
});

aiRouter.post('/conceptual-check', async (req, res, next) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const prompt = `
You are an expert Tamil language teacher, proofreader, and exam quality auditor. The input text is a Tamil Exam Question Paper (வினாத்தாள்). 

Analyze the provided Tamil text to identify:
1. Conceptual/Content errors (கருத்துப்பிழைகள்):
   - Check for actual logical mistakes in the question design or options.
   - For multiple-choice options (e.g., "அ", "ஆ", "இ", "ஈ"), check for duplicate/redundant pairings like "ii) - உம் ii) - உம்" (which repeats "ii)" twice instead of pairing it with another option).
   - Check for spelling mistakes (எழுத்துப்பிழைகள்) in the questions or choices.
   - Check for structural ambiguity in the question text that makes it hard for students to understand.
   - Check if a "Match the following" pairing is accidentally matched correctly directly when it should be scrambled, or has logical errors.

CRITICAL RULES FOR EXAM QUESTIONS:
- Do NOT fill in blank spaces or dashes (e.g., "________" or "_____") with answers. These are intentional blanks for students.
- Do NOT "correct" intentionally mismatched definitions or pairs (e.g., "ஆ) ஓடை - ஊரார் உண்பதற்கு"). This is a question where students need to identify the correct or incorrect pair. Do NOT change it to the correct definition (like "ஆ) ஓடை - சிறிய ஆறு") as that ruins the test.
- Only suggest changes for actual typos, option duplicates, spelling errors, or question framing improvements.
- The "suggestion" field MUST contain the corrected/improved replacement text. It MUST NOT be identical to the "original" field.
- The "explanation" field must be written in clear Tamil, explaining why the change is needed.
- Respond ONLY with a JSON object containing an array of suggestions under the key "suggestions".

JSON Schema format:
{
  "suggestions": [
    {
      "original": "the exact original incorrect or sub-optimal text snippet from input",
      "suggestion": "the corrected or improved version in Tamil (MUST be different from original)",
      "type": "கருத்துப்பிழை" or "வாக்கிய மேம்பாடு",
      "explanation": "Tamil explanation of why this change is suggested"
    }
  ]
}

Tamil Text to analyze:
${text}
`;

    const responseText = await callOllama(prompt, true, 0.3);
    try {
      const parsed = JSON.parse(responseText);
      res.json(parsed);
    } catch (e) {
      console.error('Failed to parse Ollama JSON response for conceptual-check:', responseText);
      res.status(500).json({ error: 'Invalid JSON response from local model', raw: responseText });
    }
  } catch (err) {
    handleAiError(err, res);
  }
});


app.use('/ai', aiRouter);
app.use('/api/ai', aiRouter);

const { 
  initDb, 
  seedDictionary, 
  checkSpellingOfText, 
  addWordToDictionary,
  getWords,
  updateWordInDictionary,
  deleteWordFromDictionary,
  importWordsToDictionary,
  analyzeDataset,
  bulkInsertWords,
  getSpellingSuggestions,
  // System Words
  getSystemWords,
  addSystemWord,
  deleteSystemWord,
  updateSystemWord,
  getSystemWordsSnapshot,
  // Custom Sandhi Overrides
  getCustomSandhiRules,
  addCustomSandhiRule,
  updateCustomSandhiRule,
  deleteCustomSandhiRule
} = require('./dictionary');


app.post(['/dictionary/check', '/api/dictionary/check'], async (req, res, next) => {
  try {
    const { text } = req.body;
    const misspelled = await checkSpellingOfText(text);
    res.json({ misspelled });
  } catch (error) {
    next(error);
  }
});

app.get(['/dictionary/suggest', '/api/dictionary/suggest'], async (req, res, next) => {
  try {
    const { word } = req.query;
    const suggestions = await getSpellingSuggestions(word);
    res.json({ suggestions });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post(['/dictionary/add', '/api/dictionary/add'], async (req, res, next) => {
  try {
    const { word } = req.body;
    const result = await addWordToDictionary(word, 1);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get(['/dictionary', '/api/dictionary'], auth, adminAuth, async (req, res, next) => {
  try {
    const { query, isCustom, page = 1, limit = 100, matchCase, matchWholeWord, useRegex } = req.query;
    const result = await getWords({ 
      query, 
      isCustom, 
      page, 
      limit,
      matchCase: matchCase === 'true' || matchCase === true,
      matchWholeWord: matchWholeWord === 'true' || matchWholeWord === true,
      useRegex: useRegex === 'true' || useRegex === true
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.put(['/dictionary', '/api/dictionary'], auth, adminAuth, async (req, res, next) => {
  try {
    const { oldWord, newWord, isCustom } = req.body;
    const result = await updateWordInDictionary(oldWord, newWord, isCustom);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete(['/dictionary', '/api/dictionary'], auth, adminAuth, async (req, res, next) => {
  try {
    const { word } = req.body;
    const targetWord = word || req.query.word;
    const result = await deleteWordFromDictionary(targetWord);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post(['/dictionary/import', '/api/dictionary/import'], auth, adminAuth, async (req, res, next) => {
  try {
    const { words, isCustom } = req.body;
    const result = await importWordsToDictionary(words, isCustom !== undefined ? isCustom : 1);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post(['/dictionary/analyze-dataset', '/api/dictionary/analyze-dataset'], auth, adminAuth, async (req, res, next) => {
  try {
    const { text } = req.body;
    const result = await analyzeDataset(text);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post(['/dictionary/bulk-add', '/api/dictionary/bulk-add'], auth, adminAuth, async (req, res, next) => {
  try {
    const { words, isCustom } = req.body;
    const result = await bulkInsertWords(words, isCustom !== undefined ? isCustom : 1);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- System Words Routes (correct_grammar & alert) ---
// GET snapshot (no auth needed — used by grammar editor on load)
app.get(['/system-words/snapshot', '/api/system-words/snapshot', '/system-words/check', '/api/system-words/check'], async (req, res, next) => {
  try {
    const snapshot = await getSystemWordsSnapshot();
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

// GET all system words (admin only)
app.get(['/system-words', '/api/system-words'], auth, adminAuth, async (req, res, next) => {
  try {
    const { type, query, page, limit } = req.query;
    const result = await getSystemWords({ type, query, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST add system word (admin only)
app.post(['/system-words/add', '/api/system-words/add'], auth, adminAuth, async (req, res, next) => {
  try {
    const { word, type, note } = req.body;
    const addedBy = req.user?.username || req.user?.name || 'admin';
    const result = await addSystemWord(word, type, addedBy, note || '');
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update system word (admin only)
app.put(['/system-words', '/api/system-words'], auth, adminAuth, async (req, res, next) => {
  try {
    const { oldWord, newWord, type, note } = req.body;
    const result = await updateSystemWord(oldWord, newWord, type, note || '');
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// --- Custom Sandhi Rules Overrides Routes (admin only) ---
app.get(['/custom-sandhi-rules', '/api/custom-sandhi-rules'], auth, adminAuth, async (req, res, next) => {
  try {
    const rules = await getCustomSandhiRules();
    res.json(rules);
  } catch (error) {
    next(error);
  }
});

app.post(['/custom-sandhi-rules', '/api/custom-sandhi-rules'], auth, adminAuth, async (req, res, next) => {
  try {
    const { precedingWord, succeedingWord, behavior, reason } = req.body;
    const rule = await addCustomSandhiRule(precedingWord, succeedingWord, behavior, reason);
    res.json({ success: true, rule });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put(['/custom-sandhi-rules/:id', '/api/custom-sandhi-rules/:id'], auth, adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { precedingWord, succeedingWord, behavior, reason } = req.body;
    const rule = await updateCustomSandhiRule(id, precedingWord, succeedingWord, behavior, reason);
    res.json({ success: true, rule });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete(['/custom-sandhi-rules/:id', '/api/custom-sandhi-rules/:id'], auth, adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await deleteCustomSandhiRule(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// NoSQL Injection Protection Middleware
const sanitize = (obj) => {
  if (obj instanceof Object) {
    for (const key in obj) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else if (obj[key] instanceof Object) {
        sanitize(obj[key]);
      }
    }
  }
  return obj;
};

app.use((req, res, next) => {
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
});

// URL Normalization Middleware
app.use((req, res, next) => {
  const oldUrl = req.url;
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  if (oldUrl !== req.url) {
    console.log(`URL Normalized: ${oldUrl} -> ${req.url}`);
  }
  next();
});

// URL Normalization Middleware
app.use((req, res, next) => {
  const oldUrl = req.url;
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  if (oldUrl !== req.url) {
    console.log(`URL Normalized: ${oldUrl} -> ${req.url}`);
  }
  next();
});

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_only';

if (JWT_SECRET === 'dev_secret_only' && process.env.NODE_ENV === 'production') {
  console.error('CRITICAL ERROR: JWT_SECRET not set in production!');
  process.exit(1);
} else if (JWT_SECRET === 'dev_secret_only') {
  console.warn('WARNING: Using fallback JWT_SECRET. Session tokens may be insecure or invalid after restart.');
} else {
  console.log('JWT_SECRET loaded from environment.');
}

const seedGrammarRules = async () => {
  try {
    const rulesCount = await GrammarRule.countDocuments();
    if (rulesCount > 0) {
      console.log('Grammar rules already seeded.');
      return;
    }

    const initialRules = [
      // 1. சந்திப்பிழை (sandhi)
      { id: 'rule_1', category: 'sandhi', ruleCode: 'vallinam_miguthal', ruleName: 'வல்லினம் மிகுதல்', description: 'வல்லினம் மிகும் இடங்களில் ஒற்றெழுத்து (க், ச், த், ப்) மிகுதல் விதியின் சரிபார்ப்பு.', isEnabled: true, priority: 1 },
      { id: 'rule_2', category: 'sandhi', ruleCode: 'vallinam_migaamai', ruleName: 'வல்லினம் மிகாமை', description: 'வல்லினம் மிகா இடங்களில் ஒற்றெழுத்துக்கள் வராமல் தவிர்த்தல் விதியின் சரிபார்ப்பு.', isEnabled: true, priority: 2 },
      { id: 'rule_3', category: 'sandhi', ruleCode: 'uyir_sandhi', ruleName: 'உயிர் சந்தி', description: 'உயிரெழுத்துக்கள் இணையும் புணர்ச்சி விதிகள்.', isEnabled: true, priority: 3 },
      { id: 'rule_4', category: 'sandhi', ruleCode: 'mey_sandhi', ruleName: 'மெய் சந்தி', description: 'மெய்யெழுத்துக்கள் சந்திக்கும் புணர்ச்சி விதிகள்.', isEnabled: true, priority: 4 },
      { id: 'rule_5', category: 'sandhi', ruleCode: 'kutriyabugaram', ruleName: 'குற்றியலுகரம்', description: 'குற்றியலுகரப் புணர்ச்சி விதிகள்.', isEnabled: true, priority: 5 },
      { id: 'rule_6', category: 'sandhi', ruleCode: 'kutriyabigaram', ruleName: 'குற்றியலிகரம்', description: 'குற்றியலிகரப் புணர்ச்சி விதிகள்.', isEnabled: true, priority: 6 },
      { id: 'rule_7', category: 'sandhi', ruleCode: 'udambadumey', ruleName: 'உடம்படுமெய்', description: 'உடம்படுமெய் தோன்றும் விதிகள்.', isEnabled: true, priority: 7 },
      { id: 'rule_8', category: 'sandhi', ruleCode: 'ezhuthu_inaippu_vidhigal', ruleName: 'எழுத்து இணைப்பு விதிகள்', description: 'பொதுவான எழுத்து இணைப்பு விதிகள்.', isEnabled: true, priority: 8 },

      // 2. ஒருமை / பன்மை (singular_plural)
      { id: 'rule_9', category: 'singular_plural', ruleCode: 'singular_to_plural', ruleName: 'ஒருமை → பன்மை சரிபார்ப்பு', description: 'ஒருமை மற்றும் பன்மை எழுத்துக்கள் மற்றும் சொற்களின் சரிபார்ப்பு.', isEnabled: true, priority: 9 },
      { id: 'rule_10', category: 'singular_plural', ruleCode: 'plural_to_singular', ruleName: 'பன்மை → ஒருமை பொருத்தம்', description: 'பன்மை மற்றும் ஒருமை பொருத்தம் சரிபார்த்தல்.', isEnabled: true, priority: 10 },
      { id: 'rule_11', category: 'singular_plural', ruleCode: 'verb_agreement', ruleName: 'வினைச்சொல் பொருத்தம்', description: 'ஒருமை/பன்மைக்கேற்ப வினைச்சொல் முடிவின் பொருத்தம் சரிபார்த்தல்.', isEnabled: true, priority: 11 },
      { id: 'rule_12', category: 'singular_plural', ruleCode: 'subject_predicate', ruleName: 'எழுவாய் - பயனிலை பொருத்தம்', description: 'எழுவாய்க்கும் பயனிலைக்கும் இடையே உள்ள எண் பொருத்தம் சரிபார்த்தல்.', isEnabled: true, priority: 12 },

      // 3. திணை (class)
      { id: 'rule_13', category: 'class', ruleCode: 'uyarthinai', ruleName: 'உயர்திணை', description: 'உயர்திணை (மனிதர்கள், தேவர்கள்) எழுவாய் மற்றும் வினைமுற்று பொருத்தம்.', isEnabled: true, priority: 13 },
      { id: 'rule_14', category: 'class', ruleCode: 'ahrinai', ruleName: 'அஃறிணை', description: 'அஃறிணை (விலங்குகள், பொருட்கள்) எழுவாய் மற்றும் வினைமுற்று பொருத்தம்.', isEnabled: true, priority: 14 },
      { id: 'rule_15', category: 'class', ruleCode: 'thinai_porutham', ruleName: 'திணை பொருத்தம்', description: 'எழுவாய்க்கும் பயனிலைக்கும் இடையே உள்ள திணைப் பொருத்தம்.', isEnabled: true, priority: 15 },
      { id: 'rule_16', category: 'class', ruleCode: 'thinai_verb_agreement', ruleName: 'திணை அடிப்படையிலான வினைச்சொல் பொருத்தம்', description: 'திணையை அடிப்படையாகக் கொண்ட வினைச்சொல் விகுதிகள்.', isEnabled: true, priority: 16 },

      // 4. பால்வகை (gender)
      { id: 'rule_17', category: 'gender', ruleCode: 'aanpaal', ruleName: 'ஆண்பால்', description: 'ஆண்பால் எழுவாய் மற்றும் வினைமுற்று பொருத்தம் (வந்தான்).', isEnabled: true, priority: 17 },
      { id: 'rule_18', category: 'gender', ruleCode: 'penpaal', ruleName: 'பெண்பால்', description: 'பெண்பால் எழுவாய் மற்றும் வினைமுற்று பொருத்தம் (வந்தாள்).', isEnabled: true, priority: 18 },
      { id: 'rule_19', category: 'gender', ruleCode: 'palarpaal', ruleName: 'பலர்பால்', description: 'பலர்பால் எழுவாய் மற்றும் வினைமுற்று பொருத்தம் (வந்தார்கள், வந்தனர்).', isEnabled: true, priority: 19 },
      { id: 'rule_20', category: 'gender', ruleCode: 'ondranpaal', ruleName: 'ஒன்றன்பால்', description: 'அஃறிணை ஒருமைப் பொருத்தம் (வந்தது).', isEnabled: true, priority: 20 },
      { id: 'rule_21', category: 'gender', ruleCode: 'palavinpaal', ruleName: 'பலவின்பால்', description: 'அஃறிணைப் பன்மைப் பொருத்தம் (வந்தன).', isEnabled: true, priority: 21 },

      // 5. காலவகை (tense)
      { id: 'rule_22', category: 'tense', ruleCode: 'iranthakaalam', ruleName: 'இறந்தகாலம்', description: 'இறந்தகால வினைகள் சரிபார்ப்பு.', isEnabled: true, priority: 22 },
      { id: 'rule_23', category: 'tense', ruleCode: 'nikazhkaalam', ruleName: 'நிகழ்காலம்', description: 'நிகழ்கால வினைகள் சரிபார்ப்பு.', isEnabled: true, priority: 23 },
      { id: 'rule_24', category: 'tense', ruleCode: 'ethirkaalam', ruleName: 'எதிர்காலம்', description: 'எதிர்கால வினைகள் சரிபார்ப்பு.', isEnabled: true, priority: 24 },
      { id: 'rule_25', category: 'tense', ruleCode: 'kaalaporutham', ruleName: 'காலப்பொருத்தம்', description: 'வாக்கியத்தில் காலங்களுக்கிடையேயான பொருத்தம்.', isEnabled: true, priority: 25 },

      // 6. வேற்றுமை உருபுகள் (case_suffixes)
      { id: 'rule_26', category: 'case_suffixes', ruleCode: 'case_1', ruleName: 'முதல் வேற்றுமை', description: 'எழுவாய் வேற்றுமை பயன்பாடு.', isEnabled: true, priority: 26 },
      { id: 'rule_27', category: 'case_suffixes', ruleCode: 'case_2', ruleName: 'இரண்டாம் வேற்றுமை', description: 'ஐ உருபு பயன்பாடு மற்றும் பொருத்தம்.', isEnabled: true, priority: 27 },
      { id: 'rule_28', category: 'case_suffixes', ruleCode: 'case_3', ruleName: 'மூன்றாம் வேற்றுமை', description: 'ஆல், ஆன், ஒடு, ஓடு உருபு பயன்பாடு.', isEnabled: true, priority: 28 },
      { id: 'rule_29', category: 'case_suffixes', ruleCode: 'case_4', ruleName: 'நான்காம் வேற்றுமை', description: 'கு உருபு பயன்பாடு மற்றும் புணர்ச்சி.', isEnabled: true, priority: 29 },
      { id: 'rule_30', category: 'case_suffixes', ruleCode: 'case_5', ruleName: 'ஐந்தாம் வேற்றுமை', description: 'இல், இன் உருபு பயன்பாடு.', isEnabled: true, priority: 30 },
      { id: 'rule_31', category: 'case_suffixes', ruleCode: 'case_6', ruleName: 'ஆறாம் வேற்றுமை', description: 'அது, ஆது, அ உருபு பயன்பாடு.', isEnabled: true, priority: 31 },
      { id: 'rule_32', category: 'case_suffixes', ruleCode: 'case_7', ruleName: 'ஏழாம் வேற்றுமை', description: 'கண் மற்றும் பிற இட உருபுகள்.', isEnabled: true, priority: 32 },
      { id: 'rule_33', category: 'case_suffixes', ruleCode: 'case_8', ruleName: 'எட்டாம் வேற்றுமை', description: 'விளி வேற்றுமை பயன்பாடு.', isEnabled: true, priority: 33 },

      // 7. வினைமுற்று (finite_verb)
      { id: 'rule_34', category: 'finite_verb', ruleCode: 'therinilai_vinaimutru', ruleName: 'தெரிநிலை வினைமுற்று', description: 'தெரிநிலை வினைமுற்று விதிகள்.', isEnabled: true, priority: 34 },
      { id: 'rule_35', category: 'finite_verb', ruleCode: 'kurippu_vinaimutru', ruleName: 'குறிப்பு வினைமுற்று', description: 'குறிப்பு வினைமுற்று விதிகள்.', isEnabled: true, priority: 35 },
      { id: 'rule_36', category: 'finite_verb', ruleCode: 'peyardhecham', ruleName: 'பெயரெச்சம்', description: 'பெயரெச்சப் புணர்ச்சி மற்றும் பயன்பாடு.', isEnabled: true, priority: 36 },
      { id: 'rule_37', category: 'finite_verb', ruleCode: 'vinaiyecham', ruleName: 'வினையெச்சம்', description: 'வினையெச்சப் புணர்ச்சி மற்றும் பயன்பாடு.', isEnabled: true, priority: 37 },

      // 8. இடைச்சொற்கள் (particle)
      { id: 'rule_38', category: 'particle', ruleCode: 'inaippuchorkal', ruleName: 'இணைப்புச்சொற்கள்', description: 'எனவே, ஆகையால், ஆனால் போன்ற இணைப்புச் சொற்களின் இலக்கணப் பயன்பாடு.', isEnabled: true, priority: 38 },
      { id: 'rule_39', category: 'particle', ruleCode: 'idaichol_payanpaadu', ruleName: 'இடைச்சொல் பயன்பாடு', description: 'ஏ, ஓ, தான் போன்ற இடைச்சொற்களின் புணர்ச்சி விதிகள்.', isEnabled: true, priority: 39 },

      // 9. பொதுவான இலக்கணப் பிழைகள் (general)
      { id: 'rule_40', category: 'general', ruleCode: 'general_error_1', ruleName: 'அவன் வந்தார்கள்', description: 'ஆண்பால் எழுவாய்க்குப் பின் பன்மை வினைமுற்று வரும் பிழை.', isEnabled: true, priority: 40 },
      { id: 'rule_41', category: 'general', ruleCode: 'general_error_2', ruleName: 'அவர்கள் வந்தான்', description: 'பலர்பால் எழுவாய்க்குப் பின் ஒருமை வினைமுற்று வரும் பிழை.', isEnabled: true, priority: 41 },
      { id: 'rule_42', category: 'general', ruleCode: 'general_error_3', ruleName: 'அது சென்றார்கள்', description: 'அஃறிணை ஒருமை எழுவாய்க்குப் பின் உயர்திணை பன்மை வினைமுற்று வரும் பிழை.', isEnabled: true, priority: 42 },
      { id: 'rule_43', category: 'general', ruleCode: 'general_error_4', ruleName: 'மாணவர்கள் வந்தான்', description: 'உயர்திணை பன்மை எழுவாய்க்குப் பின் ஒருமை வினைமுற்று வரும் பிழை.', isEnabled: true, priority: 43 }
    ];

    await GrammarRule.insertMany(initialRules);
    console.log('Successfully seeded grammar rules!');
  } catch (err) {
    console.error('Error seeding grammar rules:', err);
  }
};

const initGrammarSettings = async () => {
  try {
    const settings = await GrammarSettings.findOne();
    if (!settings) {
      await GrammarSettings.create({
        globalEnabled: true,
        categoryStates: {
          sandhi: true,
          singular_plural: true,
          class: true,
          gender: true,
          tense: true,
          case_suffixes: true,
          finite_verb: true,
          particle: true,
          general: true
        }
      });
      console.log('Successfully initialized grammar settings!');
    } else {
      console.log('Grammar settings already initialized.');
    }
  } catch (err) {
    console.error('Error initializing grammar settings:', err);
  }
};

// MongoDB Connection
let cachedConnection = null;
const connectDb = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) return cachedConnection;
  if (!MONGO_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // 10s timeout
      bufferCommands: true,
    });
    cachedConnection = conn;
    console.log('Connected to MongoDB successfully');
    
    // Seed and initialize grammar configuration
    await seedGrammarRules();
    await initGrammarSettings();
    
    return conn;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
};

// Database Connection Middleware
app.use(async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) return next();
    await connectDb();
    next();
  } catch (err) {
    res.status(503).json({ 
      error: 'Database connection failed', 
      message: err.message,
      suggestion: 'Check if your MongoDB Atlas IP whitelist allows connections from your current location.'
    });
  }
});

const getBrowser = async () => {
  if (process.env.VERCEL) {
    // Set AWS environment variables programmatically based on actual Node.js version
    const nodeVersion = process.version.match(/^v(\d+)\./)?.[1];
    if (nodeVersion) {
      process.env.AWS_LAMBDA_JS_RUNTIME = `nodejs${nodeVersion}.x`;
      process.env.AWS_EXECUTION_ENV = `AWS_Lambda_nodejs${nodeVersion}.x`;
    } else {
      process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs20.x';
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x';
    }

    // Cache-coherency fix: if /tmp/chromium exists but the corresponding library directory is missing,
    // delete /tmp/chromium to force @sparticuz/chromium-min to download and extract a fresh copy.
    const targetLibDir = nodeVersion && (nodeVersion === '20' || nodeVersion === '22') ? '/tmp/al2023' : '/tmp/al2';
    if (fs.existsSync('/tmp/chromium') && !fs.existsSync(targetLibDir)) {
      try {
        fs.unlinkSync('/tmp/chromium');
      } catch (err) {
        console.error('Failed to clean up stale cached chromium:', err);
      }
    }

    const chromium = require('@sparticuz/chromium-min');
    const puppeteer = require('puppeteer-core');
    // Required for Vercel's Lambda environment (libnss3 workaround)
    chromium.setGraphicsMode = false;

    // Resolve the executable path
    const executablePath = await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar');

    // Manually inflate both library sets (al2 and al2023) if present using the package's built-in extractor
    try {
      const lambdafs = require('@sparticuz/chromium-min/build/lambdafs').default;
      const packDir = '/tmp/chromium-pack';
      const al2Br = path.join(packDir, 'al2.tar.br');
      const al2023Br = path.join(packDir, 'al2023.tar.br');

      if (fs.existsSync(al2Br)) {
        await lambdafs.inflate(al2Br);
      }
      if (fs.existsSync(al2023Br)) {
        await lambdafs.inflate(al2023Br);
      }
    } catch (e) {
      console.error('Manual shared library inflation failed:', e);
    }

    // Set LD_LIBRARY_PATH so Chromium can find its bundled shared libraries (like libnss3.so, libnspr4.so)
    const execDir = path.dirname(executablePath);
    const al2023Lib = path.join(execDir, 'al2023', 'lib');
    const al2Lib = path.join(execDir, 'al2', 'lib');

    const currentLdPath = process.env.LD_LIBRARY_PATH || '';
    const currentPaths = currentLdPath.split(':').filter(Boolean);
    const newPaths = [];
    
    if (!currentPaths.includes(al2023Lib)) newPaths.push(al2023Lib);
    if (!currentPaths.includes(al2Lib)) newPaths.push(al2Lib);
    if (!currentPaths.includes(execDir)) newPaths.push(execDir);
    
    process.env.LD_LIBRARY_PATH = [...newPaths, ...currentPaths].join(':');

    return await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    });
  }
  // Local development: dynamically require puppeteer to prevent Vercel NFT bundling
  const localPuppeteerName = 'puppeteer';
  const puppeteer = require(localPuppeteerName);
  return await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
};

const resolveRequestOrigin = (req, fallbackBaseUrl) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const requestHost = forwardedHost || req.headers.host;

  // Local Development Detection
  const isLocal = requestHost?.includes('localhost') || requestHost?.includes('127.0.0.1');

  if (isLocal) {
    // In dev mode, we MUST use the Vite port (usually 3000). 
    // If the frontend passed its origin, trust it above all else for localhost.
    if (fallbackBaseUrl && (fallbackBaseUrl.includes('localhost') || fallbackBaseUrl.includes('127.0.0.1'))) {
      const origin = fallbackBaseUrl.replace(/\/$/, '');
      console.log('PDF Export: Using provided localhost origin:', origin);
      return origin;
    }
    // Fallback to standard Vite port if headers suggest localhost but no baseUrl provided
    console.log('PDF Export: Detected localhost, defaulting to http://localhost:3000');
    return 'http://localhost:3000';
  }

  // Production / Vercel Detection
  // Prioritize the frontend's baseUrl if it is a valid non-local URL
  if (fallbackBaseUrl && !isLocal) {
    const origin = fallbackBaseUrl.replace(/\/$/, '');
    console.log('PDF Export: Using provided frontend baseUrl:', origin);
    return origin;
  }

  if (vercelUrl && !isLocal) {
    return vercelUrl.replace(/\/$/, '');
  }

  if (requestHost) {
    const protocol = String(forwardedProto || 'https');
    const resolved = `${protocol}://${requestHost}`.replace(/\/$/, '');
    console.log('PDF Export: Resolved origin from host header:', resolved);
    return resolved;
  }

  const finalOrigin = (fallbackBaseUrl || vercelUrl || 'http://localhost:3000').replace(/\/$/, '');
  console.log('PDF Export: Using final fallback origin:', finalOrigin);
  return finalOrigin;
};

const normalizeBlueprint = (blueprint) => {
  if (!blueprint) return null;
  const obj = blueprint.toObject ? blueprint.toObject() : blueprint;
  return {
    ...obj,
    id: String(obj.id || obj._id || '')
  };
};

// 1. Auth Routes
app.post('/login', async (req, res, next) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    // Return the full user object except password
    const userJson = user.toJSON();
    delete userJson.password;
    res.json({ token, user: userJson });
  } catch (err) { next(err); }
});

app.get('/profile', auth, async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

app.put('/profile', auth, async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.id;
    delete updateData.password;
    delete updateData.username;
    delete updateData.role;

    // Normalize + validate the school email before it reaches the database
    if ('emailSchool' in updateData) {
      const schoolEmail = typeof updateData.emailSchool === 'string'
        ? updateData.emailSchool.trim().toLowerCase()
        : '';
      if (schoolEmail && !EMAIL_PATTERN.test(schoolEmail)) {
        return res.status(400).json({ error: 'Invalid school email format', field: 'emailSchool' });
      }
      updateData.emailSchool = schoolEmail;
    }

    // Try finding by id (explicit field) then by _id as fallback
    let user = await User.findOneAndUpdate({ id: req.user.id }, updateData, { new: true });
    if (!user) {
      user = await User.findOneAndUpdate({ _id: req.user.id }, updateData, { new: true });
    }
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// 2. Data Management Routes
app.get('/init', async (req, res, next) => {
  try {
    console.log('API /init called');
    const [curriculums, questionPaperTypes, examConfigs, discourses, systemSettings, appSettingsDoc] = await Promise.all([
      Curriculum.find().lean(),
      PaperType.find().lean(),
      ExamConfig.find().lean(),
      Discourse.find().lean(),
      SystemSettings.findOne().lean(),
      AppSettings.findOne().lean()
    ]);
    const appSettings = appSettingsDoc || { academicYear: '2026-27' };
    res.json({ 
      curriculums: curriculums || [], 
      questionPaperTypes: questionPaperTypes || [], 
      examConfigs: examConfigs || [], 
      discourses: discourses || [], 
      systemSettings: systemSettings || { cognitiveProcesses: [], knowledgeLevels: [], itemFormats: [] },
      appSettings: { academicYear: appSettings.academicYear }
    });
  } catch (err) { next(err); }
});

app.get('/curriculums', auth, async (req, res, next) => {
  try {
    const currs = await Curriculum.find().lean();
    res.json(currs);
  } catch (err) { next(err); }
});

app.post('/curriculums', auth, adminAuth, async (req, res, next) => {
  try {
    await Curriculum.findOneAndUpdate({ classLevel: req.body.classLevel, subject: req.body.subject }, req.body, { upsert: true });
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.get('/paper-types', auth, async (req, res, next) => {
  try {
    const types = await PaperType.find().lean();
    res.json(types);
  } catch (err) { next(err); }
});

app.post('/paper-types', auth, adminAuth, async (req, res, next) => {
  try {
    const { types } = req.body;
    for (const t of types) {
      await PaperType.findOneAndUpdate({ id: t.id }, t, { upsert: true });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.get('/exam-configs', auth, async (req, res, next) => {
  try {
    const configs = await ExamConfig.find().lean();
    res.json(configs);
  } catch (err) { next(err); }
});

app.post('/exam-configs', auth, adminAuth, async (req, res, next) => {
  try {
    const { configs } = req.body;
    for (const c of configs) {
      await ExamConfig.findOneAndUpdate({ id: c.id }, c, { upsert: true });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.get('/discourses', auth, async (req, res, next) => {
  try {
    const discs = await Discourse.find().lean();
    res.json(discs);
  } catch (err) { next(err); }
});

app.post('/discourses', auth, adminAuth, async (req, res, next) => {
  try {
    const { discourses } = req.body;
    for (const d of discourses) {
      await Discourse.findOneAndUpdate({ id: d.id }, d, { upsert: true });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.get('/settings', auth, async (req, res, next) => {
  try {
    const s = await SystemSettings.findOne().lean();
    res.json(s);
  } catch (err) { next(err); }
});

app.post('/settings', auth, adminAuth, async (req, res, next) => {
  try {
    await SystemSettings.findOneAndUpdate({}, req.body, { upsert: true });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Public settings endpoint for unauthenticated clients
app.get(['/public-settings', '/api/public-settings'], async (req, res, next) => {
  try {
    const settings = await AppSettings.findOne().lean();
    res.json({ enablePublicSpellCheck: settings ? settings.enablePublicSpellCheck !== false : true });
  } catch (err) { next(err); }
});

// AppSettings Routes (restricted to Admins for both reading and writing)
app.get('/admin/app-settings', auth, webmasterAuth, async (req, res, next) => {
  try {
    let settings = await AppSettings.findOne().lean();
    if (!settings) {
      settings = await AppSettings.create({ geminiApiKey: '', academicYear: '2026-27', enablePublicSpellCheck: true });
      settings = settings.toObject();
    }
    res.json(settings);
  } catch (err) { next(err); }
});

app.post('/admin/app-settings', auth, webmasterAuth, async (req, res, next) => {
  try {
    const { ollamaEndpoint, ollamaModel, academicYear, enablePublicSpellCheck } = req.body;
    const settings = await AppSettings.findOneAndUpdate(
      {},
      { ollamaEndpoint, ollamaModel, academicYear, enablePublicSpellCheck },
      { upsert: true, new: true }
    );
    res.json({ success: true, settings });
  } catch (err) { next(err); }
});

// --- Grammar Rules Routes ---
app.get(['/grammar-rules', '/api/grammar-rules'], async (req, res, next) => {
  try {
    const [rules, settings] = await Promise.all([
      GrammarRule.find().sort({ priority: 1 }).lean(),
      GrammarSettings.findOne().lean()
    ]);
    res.json({
      globalEnabled: settings?.globalEnabled ?? true,
      categoryStates: settings?.categoryStates ?? {},
      rules: rules || []
    });
  } catch (err) { next(err); }
});

app.patch(['/grammar-rules/global', '/api/grammar-rules/global'], auth, adminAuth, async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const settings = await GrammarSettings.findOneAndUpdate(
      {},
      { globalEnabled: enabled },
      { new: true, upsert: true }
    );
    res.json({ success: true, globalEnabled: settings.globalEnabled });
  } catch (err) { next(err); }
});

app.patch(['/grammar-rules/category/:categoryCode', '/api/grammar-rules/category/:categoryCode'], auth, adminAuth, async (req, res, next) => {
  try {
    const { categoryCode } = req.params;
    const { enabled } = req.body;
    
    let settings = await GrammarSettings.findOne();
    if (!settings) {
      settings = await GrammarSettings.create({
        globalEnabled: true,
        categoryStates: {}
      });
    }
    
    const categoryStates = settings.categoryStates || {};
    categoryStates[categoryCode] = enabled;
    
    settings.categoryStates = categoryStates;
    settings.markModified('categoryStates');
    await settings.save();
    
    res.json({ success: true, categoryStates: settings.categoryStates });
  } catch (err) { next(err); }
});

app.patch(['/grammar-rules/:id', '/api/grammar-rules/:id'], auth, adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    const rule = await GrammarRule.findOneAndUpdate(
      { id },
      { isEnabled: enabled },
      { new: true }
    );
    if (!rule) return res.status(404).json({ error: 'Grammar rule not found' });
    
    res.json({ success: true, rule });
  } catch (err) { next(err); }
});

// 3. User Management
app.get('/users', auth, adminAuth, async (req, res, next) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (err) { next(err); }
});

app.post('/users', auth, adminAuth, async (req, res, next) => {
  try {
    const { users } = req.body;
    for (const u of users) {
      if (u.password && !u.password.startsWith('$2')) {
        u.password = await bcrypt.hash(u.password, 10);
      }
      await User.findOneAndUpdate({ id: u.id }, u, { upsert: true });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.delete('/users', auth, adminAuth, async (req, res, next) => {
  try {
    await User.findOneAndDelete({ id: req.query.id });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// 3.5 Database Management (Export / Import)
app.get('/admin/export-db', auth, adminAuth, async (req, res, next) => {
  const { type } = req.query;
  try {
    if (type === 'users') {
      const users = await User.find().lean();
      return res.json({ type: 'users', users });
    } else if (type === 'blueprints') {
      const blueprints = await Blueprint.find().lean();
      const sharedBlueprints = await SharedBlueprint.find().lean();
      return res.json({ type: 'blueprints', blueprints, sharedBlueprints });
    } else if (type === 'all') {
      const [
        users, curriculums, examConfigs, blueprints,
        paperTypes, discourses, systemSettings, sharedBlueprints, appSettings
      ] = await Promise.all([
        User.find().lean(),
        Curriculum.find().lean(),
        ExamConfig.find().lean(),
        Blueprint.find().lean(),
        PaperType.find().lean(),
        Discourse.find().lean(),
        SystemSettings.find().lean(),
        SharedBlueprint.find().lean(),
        AppSettings.find().lean()
      ]);
      return res.json({
        type: 'all',
        users,
        curriculums,
        examConfigs,
        blueprints,
        paperTypes,
        discourses,
        systemSettings,
        sharedBlueprints,
        appSettings
      });
    } else {
      return res.status(400).json({ error: 'Invalid export type. Must be users, blueprints, or all.' });
    }
  } catch (err) {
    next(err);
  }
});

app.post('/admin/import-db', auth, adminAuth, async (req, res, next) => {
  const { type, data } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'No data provided for import.' });
  }

  try {
    const summary = {};

    const importUsers = async (usersList) => {
      if (!usersList) return 0;
      const list = Array.isArray(usersList) ? usersList : [usersList];
      let count = 0;
      for (const u of list) {
        if (!u.id) continue;
        if (u.password && !u.password.startsWith('$2')) {
          u.password = await bcrypt.hash(u.password, 10);
        }
        const updateData = { ...u };
        delete updateData._id;
        await User.findOneAndUpdate({ id: u.id }, updateData, { upsert: true });
        count++;
      }
      return count;
    };

    const importBlueprints = async (bpsList) => {
      if (!bpsList) return 0;
      const list = Array.isArray(bpsList) ? bpsList : [bpsList];
      let count = 0;
      for (const bp of list) {
        if (!bp.id) continue;
        const updateData = { ...bp };
        delete updateData._id;
        await Blueprint.findOneAndUpdate({ id: bp.id }, updateData, { upsert: true });
        count++;
      }
      return count;
    };

    const importSharedBlueprints = async (sharesList) => {
      if (!sharesList) return 0;
      const list = Array.isArray(sharesList) ? sharesList : [sharesList];
      let count = 0;
      for (const sb of list) {
        if (!sb.id) continue;
        const updateData = { ...sb };
        delete updateData._id;
        await SharedBlueprint.findOneAndUpdate({ id: sb.id }, updateData, { upsert: true });
        count++;
      }
      return count;
    };

    if (type === 'users') {
      summary.users = await importUsers(data.users || data);
    } else if (type === 'blueprints') {
      summary.blueprints = await importBlueprints(data.blueprints || data);
      if (data.sharedBlueprints) {
        summary.sharedBlueprints = await importSharedBlueprints(data.sharedBlueprints);
      }
    } else if (type === 'all') {
      if (data.users) summary.users = await importUsers(data.users);
      if (data.blueprints) summary.blueprints = await importBlueprints(data.blueprints);
      if (data.sharedBlueprints) summary.sharedBlueprints = await importSharedBlueprints(data.sharedBlueprints);

      if (data.curriculums) {
        const list = Array.isArray(data.curriculums) ? data.curriculums : [data.curriculums];
        summary.curriculums = 0;
        for (const c of list) {
          const updateData = { ...c };
          delete updateData._id;
          if (c.classLevel && c.subject) {
            await Curriculum.findOneAndUpdate({ classLevel: c.classLevel, subject: c.subject }, updateData, { upsert: true });
            summary.curriculums++;
          }
        }
      }

      if (data.examConfigs) {
        const list = Array.isArray(data.examConfigs) ? data.examConfigs : [data.examConfigs];
        summary.examConfigs = 0;
        for (const ec of list) {
          if (!ec.id) continue;
          const updateData = { ...ec };
          delete updateData._id;
          await ExamConfig.findOneAndUpdate({ id: ec.id }, updateData, { upsert: true });
          summary.examConfigs++;
        }
      }

      if (data.paperTypes) {
        const list = Array.isArray(data.paperTypes) ? data.paperTypes : [data.paperTypes];
        summary.paperTypes = 0;
        for (const pt of list) {
          if (!pt.id) continue;
          const updateData = { ...pt };
          delete updateData._id;
          await PaperType.findOneAndUpdate({ id: pt.id }, updateData, { upsert: true });
          summary.paperTypes++;
        }
      }

      if (data.discourses) {
        const list = Array.isArray(data.discourses) ? data.discourses : [data.discourses];
        summary.discourses = 0;
        for (const d of list) {
          if (!d.id) continue;
          const updateData = { ...d };
          delete updateData._id;
          await Discourse.findOneAndUpdate({ id: d.id }, updateData, { upsert: true });
          summary.discourses++;
        }
      }

      const importSingleDoc = async (model, docOrArray) => {
        if (!docOrArray) return 0;
        const doc = Array.isArray(docOrArray) ? docOrArray[0] : docOrArray;
        if (!doc) return 0;
        const updateData = { ...doc };
        delete updateData._id;
        await model.findOneAndUpdate({}, updateData, { upsert: true });
        return 1;
      };

      if (data.systemSettings) {
        summary.systemSettings = await importSingleDoc(SystemSettings, data.systemSettings);
      }
      if (data.appSettings) {
        summary.appSettings = await importSingleDoc(AppSettings, data.appSettings);
      }
    } else {
      return res.status(400).json({ error: 'Invalid import type.' });
    }

    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
});

// 4. Blueprints
app.get('/blueprints/all', auth, adminAuth, async (req, res, next) => {
  try {
    const bps = await Blueprint.find().lean();
    res.json(bps.map(normalizeBlueprint));
  } catch (err) { next(err); }
});

app.get('/blueprints/single/:id', auth, async (req, res, next) => {
  try {
    const bp = await Blueprint.findOne({ id: req.params.id }).lean();
    if (!bp) return res.status(404).json({ error: 'Blueprint not found' });
    
    // Authorization Check: Owner or Shared
    const isOwner = bp.ownerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'WEBMASTER';
    const shared = await SharedBlueprint.findOne({ blueprintId: req.params.id, sharedWithUserId: req.user.id }).lean();
    
    if (!isOwner && !isAdmin && !shared) {
      return res.status(403).json({ error: 'Access denied', message: 'You do not have permission to view this blueprint.' });
    }
    
    res.json(normalizeBlueprint(bp));
  } catch (err) { next(err); }
});

app.get('/blueprints/:userId', auth, async (req, res, next) => {
  try {
    // Authorization: Can only list your own unless admin
    if (req.params.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied', message: 'You can only view your own blueprints.' });
    }

    const { type } = req.query;
    if (type === 'shared') {
      const shares = await SharedBlueprint.find({ sharedWithUserId: req.params.userId }).lean();
      const bpIds = shares.map(s => s.blueprintId);
      const bps = await Blueprint.find({ id: { $in: bpIds } }).lean();
      return res.json(bps.map(normalizeBlueprint));
    }
    const bps = await Blueprint.find({ ownerId: req.params.userId }).lean();
    res.json(bps.map(normalizeBlueprint));
  } catch (err) { next(err); }
});

app.post('/blueprints', auth, async (req, res, next) => {
  try {
    const id = req.body.id;
    if (!id) return res.status(400).json({ error: 'Blueprint ID is required' });

    const existing = await Blueprint.findOne({ id }).lean();
    if (existing && existing.ownerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'WEBMASTER') {
      return res.status(403).json({ error: 'Access denied', message: 'You cannot modify a blueprint you do not own.' });
    }

    const bpData = { ...req.body };

    if (existing) {
      // Always preserve the original ownerId on updates (never allow re-assignment via save)
      bpData.ownerId = existing.ownerId;
    } else if ((req.user.role === 'ADMIN' || req.user.role === 'WEBMASTER') && req.body.isAdminAssigned && req.body.ownerId) {
      // Admin assigning a blueprint to a specific teacher: trust the ownerId from the body
      bpData.ownerId = req.body.ownerId;
    } else {
      // Default: new blueprint created by the requesting user themselves
      bpData.ownerId = req.user.id;
    }

    bpData.updatedAt = new Date().toISOString();

    const bp = await Blueprint.findOneAndUpdate({ id }, bpData, { upsert: true, new: true });
    res.json(normalizeBlueprint(bp));
  } catch (err) { next(err); }
});


app.delete('/blueprints/:id', auth, async (req, res, next) => {
  try {
    await Blueprint.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// 5. Sharing
app.post('/share', auth, async (req, res, next) => {
  try {
    const s = new SharedBlueprint(req.body);
    await s.save();
    res.json(s);
  } catch (err) { next(err); }
});

app.delete('/share/:blueprintId/:userId', auth, async (req, res, next) => {
  try {
    await SharedBlueprint.findOneAndDelete({ blueprintId: req.params.blueprintId, sharedWithUserId: req.params.userId });
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.get('/share/:blueprintId', auth, async (req, res, next) => {
  try {
    const shares = await SharedBlueprint.find({ blueprintId: req.params.blueprintId }).lean();
    const userIds = shares.map(s => s.sharedWithUserId);
    const users = await User.find({ id: { $in: userIds } }).lean();
    res.json(users);
  } catch (err) { next(err); }
});

// 6. System
app.get('/health', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.json({ status: dbReady ? 'ok' : 'error', database: dbReady ? 'connected' : 'disconnected', time: new Date() });
});

app.get('/ping', (req, res) => res.json({ message: 'pong', dbStatus: mongoose.connection.readyState }));

app.post('/heartbeat', auth, async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(400).json({ error: 'Invalid token', message: 'User ID missing from token' });
    }
    
    const user = await User.findOneAndUpdate(
      { id: req.user.id }, 
      { lastActive: new Date() },
      { new: true }
    );
    
    if (!user) {
      console.warn(`Heartbeat: User not found for ID ${req.user.id}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true });
  } catch (err) { 
    console.error(`Heartbeat failed for user ${req.user?.id}:`, err.message);
    next(err); 
  }
});

app.get('/live-users', auth, adminAuth, async (req, res, next) => {
  try {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const users = await User.find({ lastActive: { $gt: fiveMinsAgo } }).lean();
    res.json(users);
  } catch (err) { next(err); }
});

// 7. Export
app.post('/generate-pdf', auth, async (req, res, next) => {
  const { html, orientation = 'portrait', filename = 'report.pdf', paperCode = '', canonicalPaper = false } = req.body;
  if (!html) return res.status(400).json({ error: '`html` field is required' });

  let browser = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    // Inject Base64 Fonts to guarantee rendering
    try {
      const getFontBase64 = (fontName) => {
        const fontPath = path.join(__dirname, '..', 'public', 'fonts', fontName);
        if (fs.existsSync(fontPath)) return fs.readFileSync(fontPath).toString('base64');
        return null;
      };
      const tauPaalai = getFontBase64('TAU-Paalai.ttf');
      const tauPaalaiBold = getFontBase64('TAU-Paalai Bold.ttf');
      const tauUrai = getFontBase64('TAU-Urai.ttf');
      const tauUraiBold = getFontBase64('TAU-Urai Bold.ttf');
      const tauMarutham = getFontBase64('TAU-Marutham.ttf'); // Just in case

      let fontCss = '';
      if (tauPaalai) fontCss += `@font-face { font-family: 'TAU-Paalai'; src: url(data:font/ttf;base64,${tauPaalai}) format('truetype'); font-weight: normal; font-style: normal; }\n`;
      if (tauPaalaiBold) fontCss += `@font-face { font-family: 'TAU-Paalai'; src: url(data:font/ttf;base64,${tauPaalaiBold}) format('truetype'); font-weight: bold; font-style: normal; }\n`;
      if (tauUrai) fontCss += `@font-face { font-family: 'TAU-Urai'; src: url(data:font/ttf;base64,${tauUrai}) format('truetype'); font-weight: normal; font-style: normal; }\n`;
      if (tauUraiBold) fontCss += `@font-face { font-family: 'TAU-Urai'; src: url(data:font/ttf;base64,${tauUraiBold}) format('truetype'); font-weight: bold; font-style: normal; }\n`;
      if (tauMarutham) fontCss += `@font-face { font-family: 'TAU-Marutham'; src: url(data:font/ttf;base64,${tauMarutham}) format('truetype'); font-weight: normal; font-style: normal; }\n`;

      if (fontCss) {
        html = html.replace('</head>', `<style>${fontCss}</style></head>`);
      }
    } catch (e) {
      console.error('Failed to inject base64 fonts:', e);
    }

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');

    // Run layout engine validation: hide divider if it falls onto a new page alone
    await page.evaluate(() => {
      const divider = document.querySelector('.last-page-decoration');
      if (divider) {
        const rect = divider.getBoundingClientRect();
        const pageHeight = 1123;
        const topOffsetOnPage = rect.top % pageHeight;
        if (topOffsetOnPage < 120) {
          divider.style.display = 'none';
        }
      }
      
      // Remove fake print headers to rely strictly on Puppeteer headerTemplate
      document.querySelectorAll('.print-header, .header-cover').forEach(el => el.remove());
    });

    // Inject print-critical CSS including Font Fallback and spacing
    if (!canonicalPaper) await page.addStyleTag({
      content: `
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0 !important; padding: 0 !important; background: white !important; }
        table { border-collapse: collapse !important; width: 100% !important; }
        td, th { border: 1px solid black !important; box-sizing: border-box; }
        .no-print, .print-header, .print-footer, .header-cover { display: none !important; }
        
        /* Font Fallbacks and Mixed-Font Rule */
        body, html, p, span, div, td, th {
          font-family: 'Times New Roman', 'TAU-Paalai', 'Segoe UI Symbol', 'Noto Sans Symbols', sans-serif;
        }
        h1, h2, h3, h4, .tamil-heading {
          font-family: 'Times New Roman Bold', 'Times New Roman', 'TAU-Urai', 'Segoe UI Symbol', 'Noto Sans Symbols', sans-serif;
          font-weight: bold !important;
        }
        
        /* Force TAU-Paalai for question body and notes; keep header unchanged */
        .pdf-question-block, .pdf-choice-block, .pdf-notes-box {
          font-family: 'TAU-Paalai', 'Times New Roman', serif !important;
        }
        
        /* Question Block Integrity */
        .question-block, tr, tbody, .avoid-break {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        /* Widow/Orphan Control */
        p, li, div, h1, h2, h3, h4, td, th {
          orphans: 3 !important;
          widows: 3 !important;
        }
        
        /* Divider lines: 1px Solid #000000 */
        hr, .divider, .border-bottom, .border-top, .print-header-divider, .print-footer-divider {
          border-top: 1px solid #000000 !important;
          border-bottom: none !important;
          border-left: none !important;
          border-right: none !important;
          height: 0 !important;
        }
        
        /* Page Layout and Margins */
        @page {
          margin: 20mm 15mm 18mm 15mm;
        }
        .print-content, .pdf-page:first-of-type, .report-page:first-of-type {
          height: auto !important;
        }
      `
    });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: !canonicalPaper && orientation === 'landscape',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: !canonicalPaper,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width: 100%; font-size: 9pt; font-family: 'Times New Roman', serif; padding: 0 15mm; box-sizing: border-box; overflow: hidden; height: 12mm; display: flex; flex-direction: column; justify-content: flex-start; color: #000;">
          <div style="border-top: 1px solid #000000; width: 100%; margin-bottom: 4px;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${paperCode}</span>
            <span style="white-space: nowrap;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        </div>
      `
    });

    const safeName = filename.replace(/[^\w\-. ]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(Buffer.from(pdf));
  } catch (err) {
    next(err);
  } finally {
    if (browser) await browser.close();
  }
});

app.post('/export/pdf', auth, async (req, res, next) => {
  const { id, baseUrl, tab, mode, settings: sessionSettings, title } = req.body;
  const origin = resolveRequestOrigin(req, baseUrl);
  console.log(`PDF Export: id=${id}, origin=${origin}, baseUrl=${baseUrl}, tab=${tab}`);
  
  // Temporary Debugging for Vercel Chromium environment
  console.log('--- CHROMIUM DEBUGGING INFO ---');
  console.log('AWS_LAMBDA_JS_RUNTIME:', process.env.AWS_LAMBDA_JS_RUNTIME);
  console.log('LD_LIBRARY_PATH:', process.env.LD_LIBRARY_PATH);
  try {
    const fs = require('fs');
    if (fs.existsSync('/tmp')) {
      console.log('/tmp contents:', fs.readdirSync('/tmp'));
    }
    if (fs.existsSync('/tmp/al2023')) {
      console.log('/tmp/al2023 contents:', fs.readdirSync('/tmp/al2023'));
      if (fs.existsSync('/tmp/al2023/lib')) {
        console.log('/tmp/al2023/lib contents:', fs.readdirSync('/tmp/al2023/lib'));
      }
    }
  } catch (e) {
    console.log('Debug logging failed:', e.message);
  }
  console.log('--------------------------------');
  
  let browser = null;
  try {
    const bp = await Blueprint.findOne({ id }).lean();
    if (!bp) return res.status(404).json({ error: 'Blueprint not found' });
    
    browser = await getBrowser();
    const page = await browser.newPage();
    
    // Log console messages and errors from the page
    page.on('console', msg => console.log(`[PUPPETEER CONSOLE]: ${msg.text()}`));
    page.on('pageerror', err => console.error(`[PUPPETEER PAGEERROR]: ${err.message}`));

    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    // Inject localStorage before any frontend code runs on the target page
    await page.evaluateOnNewDocument((t, s, bid) => {
      if (t) {
        localStorage.setItem('blueprint_token', t);
        localStorage.setItem('currentUser', JSON.stringify({ id: 'puppeteer', role: 'ADMIN' }));
      }
      if (s) {
        Object.entries(s).forEach(([tabId, val]) => {
          localStorage.setItem(`bp_settings_${bid}_${tabId}`, JSON.stringify(val));
        });
      }
    }, token, sessionSettings, id);
    
    const targetTab = tab || 'report1';
    let tabSettings = {};
    if (sessionSettings && sessionSettings[targetTab]) {
      tabSettings = sessionSettings[targetTab];
    } else if (bp.perReportSettings && bp.perReportSettings[targetTab]) {
      tabSettings = bp.perReportSettings[targetTab];
    }
    
    const globalSettings = bp.reportSettings || {};
    const isLandscapeDefault = (targetTab === 'report2' || targetTab === 'report3');
    const orientation = tabSettings.orientation || globalSettings.orientation || (isLandscapeDefault ? 'l' : 'p');
    const isLandscape = orientation === 'l';
    const paperSize = tabSettings.paperSize || globalSettings.paperSize || 'A4';

    // Extract paper code for footer - GI prefix for Answer Key, T prefix for others
    const subject = bp.subject.includes('BT') ? 'BT' : 'AT';
    const codeMap = { '8-AT': '802', '8-BT': '812', '9-AT': '902', '9-BT': '912', '10-AT': '1002', '10-BT': '1012' };
    const baseCode = codeMap[`${bp.classLevel}-${subject}`] || `${bp.classLevel}${subject === 'AT' ? '02' : '12'}`;
    const paperCode = targetTab === 'answerkey' ? `GI-${baseCode}` : `T-${baseCode}`;

    const query = new URLSearchParams({ tab: targetTab, mode: mode || 'admin', exportMode: 'true' });
    const printUrl = `${origin}/print-view/${id}?${query.toString()}`;
    console.log(`[Individual PDF] Navigating to: ${printUrl}`);

    // Set viewport for accurate rendering
    await page.setViewport({
      width: isLandscape ? 1123 : 794,
      height: isLandscape ? 794 : 1123,
      deviceScaleFactor: 2
    });

    // Navigate to actual print page
    await page.goto(printUrl, { waitUntil: 'networkidle2', timeout: 90000 });
    
    // Wait for actual content to render
    try {
      console.log(`[Individual PDF] Waiting for '.print-root' for ${id}...`);
      await page.waitForSelector('.print-root', { timeout: 45000 });
      // Wait for fonts (Tamil + English) to fully load
      await page.evaluateHandle('document.fonts.ready');
      // Extra delay for React hydration, font rendering, and layout shifts
      await new Promise(r => setTimeout(r, 3500));

      // Run layout engine validation: hide divider if it falls onto a new page alone
      await page.evaluate(() => {
        const divider = document.querySelector('.last-page-decoration');
        if (divider) {
          const rect = divider.getBoundingClientRect();
          const pageHeight = 1123;
          const topOffsetOnPage = rect.top % pageHeight;
          if (topOffsetOnPage < 120) {
            divider.style.display = 'none';
          }
        }
      });
    } catch (e) {
      const screenshotPath = path.join(process.cwd(), `error_pdf_${id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const content = await page.content();
      throw new Error(`Timeout waiting for '.print-root'. URL: ${printUrl}. Screenshot: ${screenshotPath}. HTML Start: ${content.substring(0, 1000)}`);
    }

    // Inject print-critical CSS including Font Fallback and spacing
    await page.addStyleTag({
      content: `
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0 !important; padding: 0 !important; background: white !important; }
        table { border-collapse: collapse !important; width: 100% !important; }
        td, th { border: 1px solid black !important; box-sizing: border-box; }
        .no-print, .print-header, .print-footer, .header-cover { display: none !important; }
        
        /* Font Fallbacks and Mixed-Font Rule */
        body, html, p, span, div, td, th {
          font-family: 'Times New Roman', 'TAU-Paalai', 'Segoe UI Symbol', 'Noto Sans Symbols', sans-serif;
        }
        h1, h2, h3, h4, .tamil-heading {
          font-family: 'Times New Roman Bold', 'Times New Roman', 'TAU-Urai', 'Segoe UI Symbol', 'Noto Sans Symbols', sans-serif;
          font-weight: bold !important;
        }
        
        /* Force TAU-Paalai for question body and notes; keep header unchanged */
        .pdf-question-block, .pdf-choice-block, .pdf-notes-box {
          font-family: 'TAU-Paalai', 'Times New Roman', serif !important;
        }
        
        /* Question Block Integrity */
        .question-block, tr, tbody, .avoid-break {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        /* Widow/Orphan Control */
        p, li, div, h1, h2, h3, h4, td, th {
          orphans: 3 !important;
          widows: 3 !important;
        }
        
        /* Divider lines: 1px Solid #000000 */
        hr, .divider, .border-bottom, .border-top, .print-header-divider, .print-footer-divider {
          border-top: 1px solid #000000 !important;
          border-bottom: none !important;
          border-left: none !important;
          border-right: none !important;
          height: 0 !important;
        }
        
        /* Safe Print Area spacing */
        .report-page, .pdf-page {
          padding-top: 5mm !important;
          padding-bottom: 5mm !important;
        }

        /* Page Layout and Margins */
        @page {
          margin: 15mm 15mm 20mm 18mm;
        }


      `
    });

    if (title) {
      await page.evaluate(t => { document.title = t; }, title);
    }

    const pdfBuffer = await page.pdf({
      format: paperSize === 'Legal' ? 'Legal' : 'A4',
      landscape: isLandscape,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: `<span></span>`,
      footerTemplate: `
        <div style="width: 100%; font-size: 10pt; font-family: 'Times New Roman', serif; padding: 0 15mm 0 18mm; box-sizing: border-box; overflow: hidden; height: 12mm; display: flex; flex-direction: column; justify-content: flex-start; color: #000;">
          <div style="border-top: 1px solid #000000; width: 100%; margin-bottom: 4px;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${paperCode}</span>
            <span style="white-space: nowrap;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        </div>
      `
    });
    
    res.contentType('application/pdf');
    res.send(Buffer.from(pdfBuffer));
  } catch (err) { 
    next(err); 
  } finally {
    if (browser) await browser.close();
  }
});

app.post('/export/save-merged-pdf', auth, async (req, res, next) => {
  try {
    const { pdfBase64, folderName, fileName } = req.body;
    if (!pdfBase64 || !folderName || !fileName) {
      return res.status(400).json({ error: 'Missing pdfBase64, folderName, or fileName' });
    }

    if (process.env.VERCEL) {
      // On Vercel serverless environment, local filesystem writing is restricted and temporary.
      // The browser client will trigger the download directly anyway, so we skip local filesystem writes.
      console.log(`Vercel deployment: Skipped local file write for merged PDF [${fileName}]`);
      return res.json({ success: true, path: '[Saved via Browser Download]' });
    }

    const os = require('os');
    const homeDocs = path.join(os.homedir(), 'Documents');
    const examDir = path.join(homeDocs, folderName);

    // Create directory if not exists
    if (!fs.existsSync(examDir)) {
      fs.mkdirSync(examDir, { recursive: true });
    }

    const targetPath = path.join(examDir, fileName);
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    fs.writeFileSync(targetPath, pdfBuffer);

    console.log(`Saved merged PDF to: ${targetPath}`);
    res.json({ success: true, path: targetPath });
  } catch (error) {
    next(error);
  }
});


// Static and Catch-all
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Catch-all Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
  });
});

app.get(/.*/, (req, res) => {
  const indexPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  const rootIndexPath = path.join(__dirname, '../index.html');
  if (fs.existsSync(rootIndexPath)) return res.sendFile(rootIndexPath);
  res.status(404).send('Not Found');
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
  connectDb().then(() => {
    initDb().catch(err => console.error('Initial dictionary cache loading failed:', err.message));
  }).catch(err => console.error('Initial DB connection failed:', err.message));
}
