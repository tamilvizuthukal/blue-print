<div align="center">

# 📋 தமிழ் விழுதுகள் — Exam Blueprint Maker

**தமிழ் பாடம் கற்பிக்கும் ஆசிரியர்களுக்காக உருவாக்கப்பட்ட தேர்வு வரைவு மேலாண்மை மென்பொருள்**

*A full-stack Tamil-language Exam Blueprint Management System for Tamil subject teachers*

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

---

## 📖 திட்டம் பற்றி (About the Project)

**தமிழ் விழுதுகள்** என்பது கேரள மாநில பள்ளிகளில் தமிழ் பாடம் கற்பிக்கும் ஆசிரியர்களுக்கான ஒரு முழுமையான டிஜிட்டல் கருவி. இது தேர்வு வரைவுகளை (Blueprint) திட்டமிட, நிர்வகிக்க, மற்றும் PDF/DOCX வடிவில் ஏற்றுமதி செய்ய உதவுகிறது.

This is a full-stack web application designed for **Tamil language teachers in Kerala schools** to plan, manage, and export exam blueprints (வரைவுகள்) with detailed question mapping, cognitive process tagging, and rich report generation.

### ✨ முக்கிய அம்சங்கள் (Key Features)

| அம்சம் (Feature) | விவரம் (Description) |
|---|---|
| 📐 **Blueprint Matrix** | Interactive grid to map questions to units, sub-units, cognitive levels, and difficulty |
| 📄 **PDF Export** | Puppeteer-powered high-fidelity PDF generation with Tamil font support |
| 📝 **DOCX Export** | Question paper export as Microsoft Word documents |
| 🔍 **AI Spell Check** | Gemini-powered Tamil spell checker via a secure backend proxy |
| 👥 **Multi-user Auth** | JWT-based login with Role-based access (Admin / Teacher) |
| 🔒 **Blueprint Sharing** | Share blueprints with other teachers; Admin can lock/hide blueprints |
| 📊 **Reports** | Three report types: Blueprint Summary, Subject-wise Analysis, Unit-wise Weightage |
| 🖊️ **Rich Text Editor** | TipTap-based editor with Tamil font support for question content |
| 🎓 **Discourse (சொற்பொழிவு)** | Manage rubric-scored discourse questions with cognitive tagging |
| ⚙️ **Admin Portal** | Full admin dashboard: user management, curriculum config, question paper types |
| 📱 **Live User Tracking** | Real-time heartbeat system to track active users |

---

## 🏗️ தொழில்நுட்ப அமைப்பு (Tech Stack)

### Frontend
- **React 19** + **TypeScript 5.8** (Vite build)
- **TailwindCSS 4** for styling
- **TipTap** rich text editor with table, underline, color, font-family extensions
- **Lucide React** for icons
- **SweetAlert2** for dialogs
- **jsPDF / html2canvas** for client-side PDF rendering
- **docx + file-saver** for DOCX export

### Backend
- **Node.js** + **Express 4**
- **MongoDB** (Atlas) + **Mongoose 8**
- **JSON Web Tokens (JWT)** for authentication
- **bcryptjs** for password hashing
- **Puppeteer** (local) / **@sparticuz/chromium** (Vercel) for server-side PDF rendering
- **Gemini 1.5 Flash API** for AI spell checking

### Deployment
- **Vercel** (Frontend static build + Serverless API functions)
- **MongoDB Atlas** as cloud database

---

## 📁 திட்ட கட்டமைப்பு (Project Structure)

```
blueprint V1/
├── components/             # React UI components
│   ├── AdminPortal.tsx       # Admin main portal layout
│   ├── AdminDashboard.tsx    # Dashboard with live user stats
│   ├── AdminUserManager.tsx  # Create/edit/block users
│   ├── AdminCurriculumManager.tsx  # Manage units & sub-units
│   ├── AdminPaperTypeManager.tsx   # Configure question paper types
│   ├── AdminExamConfigManager.tsx  # Unit weightage settings
│   ├── AdminDiscourseManager.tsx   # Discourse (rubric) management
│   ├── AdminAssignmentManager.tsx  # Assign blueprints to teachers
│   ├── AdminQuestionPaperManager.tsx # Consolidated Q-paper editor
│   ├── AdminQuestionConsolidator.tsx # Multi-blueprint consolidation
│   ├── BlueprintMatrix.tsx   # Core blueprint grid editor
│   ├── UserDashboard.tsx     # Teacher's main workspace
│   ├── UserProfile.tsx       # Teacher profile & bank details
│   ├── AnswerKeyView.tsx     # Answer key generation
│   ├── ReportsView.tsx       # Report tabs (Report 1, 2, 3)
│   ├── PrintView.tsx         # Puppeteer-targeted print layout
│   ├── SettingsManager.tsx   # Per-blueprint print settings
│   ├── SimpleRichTextEditor.tsx  # TipTap Tamil editor
│   ├── BlueprintSharingModal.tsx # Share blueprint with teachers
│   └── Login.tsx             # Authentication screen
│
├── server/
│   ├── index.js              # Express server, all API routes
│   └── models.js             # Mongoose schema definitions
│
├── services/
│   ├── db.ts                 # Frontend API client (auth, CRUD)
│   ├── docExport.ts          # DOCX export logic
│   ├── massViewExport.ts     # Mass view PDF export
│   ├── spellCheck.ts         # Tamil AI spell check client
│   └── security.ts           # Input sanitization utilities
│
├── api/
│   └── [...path].js          # Vercel serverless function adapter
│
├── types.ts                  # All TypeScript types and enums
├── constants.ts              # App-wide constants
├── App.tsx                   # Root component, auth routing
└── vercel.json               # Vercel deployment config
```

---

## 🚀 உள்ளூர் இயக்கம் (Running Locally)

### தேவைப்படுபவை (Prerequisites)

- **Node.js** v18 அல்லது மேல் (v18 or above)
- **MongoDB Atlas** கணக்கு (or local MongoDB instance)
- **Gemini API Key** (AI spell check-க்கு / for AI spell check)

### நிறுவல் படிகள் (Installation Steps)

**1. Repository clone செய்யவும்:**
```bash
git clone https://github.com/dsavio83/Exam-Blueprint-Maker.git
cd Exam-Blueprint-Maker
```

**2. Dependencies நிறுவவும்:**
```bash
npm install
```

**3. Environment variables அமைக்கவும்:**

Root `.env` கோப்பு உருவாக்கவும்:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/<dbname>
JWT_SECRET=your_strong_random_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
```

`server/.env` கோப்பு உருவாக்கவும் (same content):
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/<dbname>
JWT_SECRET=your_strong_random_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5001
```

**4. Frontend + Backend ஒரே நேரத்தில் இயக்கவும்:**
```bash
npm run dev:all
```

அல்லது தனித்தனியாக (or separately):
```bash
# Terminal 1 - Frontend (Vite dev server on port 3000)
npm run dev

# Terminal 2 - Backend (Express on port 5001)
npm run backend
```

**5. Browser-ல் திறக்கவும்:** `http://localhost:3000`

---

## 🌐 Vercel-ல் Deploy செய்வது (Deploying to Vercel)

1. [Vercel](https://vercel.com)-ல் உள்நுழைந்து, இந்த repository import செய்யவும்
2. **Environment Variables** பகுதியில் `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY` சேர்க்கவும்
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. Deploy!

> **குறிப்பு:** Vercel deployment-ல் Puppeteer `@sparticuz/chromium` ஐ தானாக பயன்படுத்தும். PDF export-க்கு `api/[...path].js` வழியாக serverless function சேவை செய்யும்.

---

## 🔑 API Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/login` | ❌ | User login → returns JWT token |
| `GET` | `/api/profile` | ✅ | Get logged-in user profile |
| `PUT` | `/api/profile` | ✅ | Update user profile |
| `GET` | `/api/init` | ❌ | Load curriculum, paper types, settings |
| `GET` | `/api/blueprints/:userId` | ✅ | Get user's blueprints |
| `POST` | `/api/blueprints` | ✅ | Save/update a blueprint |
| `DELETE` | `/api/blueprints/:id` | ✅ | Delete a blueprint |
| `GET` | `/api/blueprints/all` | 🔐 Admin | Get all blueprints |
| `POST` | `/api/share` | ✅ | Share blueprint with another user |
| `POST` | `/api/export/pdf` | ✅ | Generate PDF via Puppeteer |
| `POST` | `/api/generate-pdf` | ✅ | Generate PDF from raw HTML |
| `POST` | `/api/ai/spell-check` | ✅ | Tamil spell check via Gemini |
| `GET` | `/api/live-users` | 🔐 Admin | List active users (last 5 min) |
| `POST` | `/api/heartbeat` | ✅ | Update user's last active time |
| `GET` | `/api/health` | ❌ | Server + DB health check |

**Legend:** ❌ No auth required | ✅ JWT required | 🔐 Admin JWT required

---

## 👤 பயனர் வகைகள் (User Roles)

### 🧑‍💼 Admin (நிர்வாகி)
- Manage all users (create, block, delete)
- Configure curriculum (units, sub-units)
- Set up question paper types and exam weightages
- View and manage all teachers' blueprints
- Assign blueprints and lock/hide them
- Consolidate multiple blueprints into a master question paper

### 👩‍🏫 Teacher (ஆசிரியர்)
- Create and manage personal exam blueprints
- Enter question text, answer text with Tamil rich text editor
- Map questions to cognitive processes and difficulty levels
- Generate PDF/DOCX reports
- Share blueprints with colleagues
- AI-powered Tamil spell check

---

## 📚 திட்டம் பற்றிய விவரங்கள் (Domain Details)

இந்த மென்பொருள் **கேரள மாநிலம்** பள்ளிகளுக்காக வடிவமைக்கப்பட்டுள்ளது:

- **வகுப்புகள்:** 8, 9, 10, SSLC
- **பாடங்கள்:** Tamil AT (A Group), Tamil BT (B Group)
- **தேர்வு காலங்கள்:** முதல், இரண்டாம், மூன்றாம் Term Summative
- **அறிவாற்றல் நிலைகள்:** Basic, Average, Profound
- **சிந்தனை திறன்கள்:** Conceptual Clarity, Application Skill, Computational Thinking, Analytical Thinking, Critical Thinking, Creative Thinking, Values/Attitudes
- **கேள்வி வடிவங்கள்:** SR1 (MCI), SR2 (MI), CRS1 (VSA), CRS2 (SA), CRL (E)

---

## 🔒 பாதுகாப்பு (Security)

- JWT tokens with 24-hour expiry
- bcryptjs password hashing (salt rounds: 10)
- NoSQL injection protection middleware (strips `$` and `.` keys)
- Admin role verification middleware on all sensitive routes
- Gemini API key proxied through backend (never exposed to frontend)
- Blueprint ownership enforcement (users can only modify their own blueprints)

---

## 🛠️ NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `vite` | Start Vite frontend dev server |
| `npm run backend` | `nodemon server/index.js` | Start backend with hot-reload |
| `npm run dev:all` | `concurrently` | Start both frontend and backend |
| `npm run server` | `node server/index.js` | Start backend (no hot-reload) |
| `npm run build` | `vite build` | Build frontend for production |
| `npm run preview` | `vite preview` | Preview production build |

---

## 🤝 பங்களிப்பு (Contributing)

Pull requests வரவேற்கிறோம். பெரிய மாற்றங்களுக்கு முன்பு ஒரு issue திறந்து விவாதிக்கவும்.

---

## 📜 License

This project is private and intended for educational use by Tamil language teachers in Kerala schools.

---

<div align="center">

**தமிழ் மொழிக்கு 💙 — Built with love for Tamil language education**

</div>
