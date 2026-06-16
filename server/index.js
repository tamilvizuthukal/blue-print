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
  Discourse, SystemSettings, SharedBlueprint, AppSettings
} = require('./models');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  } else if (req.url === '/api') {
    req.url = '/';
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
    const chromium = require('@sparticuz/chromium');
    const puppeteer = require('puppeteer-core');
    // Required for Vercel's Lambda environment (libnss3 workaround)
    chromium.setGraphicsMode = false;
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
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  const puppeteer = require('puppeteer');
  return await puppeteer.launch({
    headless: 'new',
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
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ 
      error: 'Access denied', 
      message: 'This action requires administrative privileges.' 
    });
  }
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

// AppSettings Routes (restricted to Admins for both reading and writing)
app.get('/admin/app-settings', auth, adminAuth, async (req, res, next) => {
  try {
    let settings = await AppSettings.findOne().lean();
    if (!settings) {
      settings = await AppSettings.create({ geminiApiKey: '', academicYear: '2026-27' });
      settings = settings.toObject();
    }
    res.json(settings);
  } catch (err) { next(err); }
});

app.post('/admin/app-settings', auth, adminAuth, async (req, res, next) => {
  try {
    const { geminiApiKey, academicYear } = req.body;
    const settings = await AppSettings.findOneAndUpdate(
      {},
      { geminiApiKey, academicYear },
      { upsert: true, new: true }
    );
    res.json({ success: true, settings });
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
    const isAdmin = req.user.role === 'ADMIN';
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
    if (existing && existing.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied', message: 'You cannot modify a blueprint you do not own.' });
    }

    const bpData = { ...req.body };

    if (existing) {
      // Always preserve the original ownerId on updates (never allow re-assignment via save)
      bpData.ownerId = existing.ownerId;
    } else if (req.user.role === 'ADMIN' && req.body.isAdminAssigned && req.body.ownerId) {
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

// AI proxy route to protect GEMINI_API_KEY
app.post('/ai/spell-check', auth, async (req, res, next) => {
  const { text } = req.body;
  
  // Try loading from DB first
  let apiKey = '';
  try {
    const settings = await AppSettings.findOne().lean();
    if (settings && settings.geminiApiKey) {
      apiKey = settings.geminiApiKey;
    }
  } catch (err) {
    console.error('Error fetching geminiApiKey from DB:', err);
  }
  
  // Fallback to env variable
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  }
  
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server or in settings' });
  }

  try {
    const GEMINI_MODEL = 'gemini-1.5-flash';
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    // We reuse the prompt from the frontend spellCheck.ts
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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      return res.status(response.status).json(errorJson);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 7. Export
app.post('/generate-pdf', auth, async (req, res, next) => {
  const { html, orientation = 'portrait', filename = 'report.pdf' } = req.body;
  if (!html) return res.status(400).json({ error: '`html` field is required' });

  let browser = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');

    const pdf = await page.pdf({
      format: 'A4',
      landscape: orientation === 'landscape',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width: 100%; text-align: center; font-size: 9pt; font-family: 'Times New Roman', serif; border-top: 0.5px solid #999; padding-top: 2mm; margin: 0 15mm; color: #555;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>`
    });

    const safeName = filename.replace(/[^\w\-. ]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  } finally {
    if (browser) await browser.close();
  }
});

app.post('/export/pdf', auth, async (req, res, next) => {
  const { id, baseUrl, tab, mode, settings: sessionSettings } = req.body;
  const origin = resolveRequestOrigin(req, baseUrl);
  console.log(`PDF Export: id=${id}, origin=${origin}, baseUrl=${baseUrl}, tab=${tab}`);
  
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
    
    // Go to origin to set localStorage
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    await page.evaluate((t, s, bid) => {
      if (t) localStorage.setItem('blueprint_token', t);
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
    const paperCode = targetTab === 'answerkey' ? `GI${baseCode}` : `T${baseCode}`;

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
    } catch (e) {
      const screenshotPath = path.join(process.cwd(), `error_pdf_${id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const content = await page.content();
      throw new Error(`Timeout waiting for '.print-root'. URL: ${printUrl}. Screenshot: ${screenshotPath}. HTML Start: ${content.substring(0, 1000)}`);
    }

    // Inject print-critical CSS
    await page.addStyleTag({
      content: `
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0 !important; padding: 0 !important; background: white !important; }
        table { border-collapse: collapse !important; width: 100% !important; }
        td, th { border: 1px solid black !important; box-sizing: border-box; }
        .no-print { display: none !important; }
        .report-page { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; }
      `
    });

    const pdfBuffer = await page.pdf({
      format: paperSize === 'Legal' ? 'Legal' : 'A4',
      landscape: isLandscape,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width: 100%; font-size: 9pt; font-family: 'Times New Roman', serif; padding: 0 15mm; display: flex; justify-content: space-between; align-items: center; color: #555; border-top: 0.5px solid #999; margin-top: 2mm;">
          <div style="font-weight: bold;">${paperCode}</div>
          <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
          <div></div>
        </div>
      `
    });
    
    res.contentType('application/pdf');
    res.send(pdfBuffer);
  } catch (err) { 
    next(err); 
  } finally {
    if (browser) await browser.close();
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
  connectDb().catch(err => console.error('Initial DB connection failed:', err.message));
}
