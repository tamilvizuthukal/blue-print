bash

cat << 'PYEOF' > /tmp/generate_report_v2.py
from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

doc = Document()

# ── Page setup ────────────────────────────────────────────────────────────────
section = doc.sections[0]
section.page_width    = Inches(8.5)
section.page_height   = Inches(11)
section.left_margin   = Inches(0.9)
section.right_margin  = Inches(0.9)
section.top_margin    = Inches(0.9)
section.bottom_margin = Inches(0.9)

# ── Colors ───────────────────────────────────────────────────────────────────
BLUE   = RGBColor(0x1D, 0x4E, 0xD8)
INDIGO = RGBColor(0x43, 0x38, 0xCA)
DARK   = RGBColor(0x1E, 0x29, 0x3B)
GRAY   = RGBColor(0x64, 0x74, 0x8B)
GREEN  = RGBColor(0x05, 0x96, 0x69)
RED    = RGBColor(0xDC, 0x26, 0x26)
AMBER  = RGBColor(0xB4, 0x5D, 0x09)
PURPLE = RGBColor(0x7C, 0x3A, 0xED)
CYAN   = RGBColor(0x06, 0x7A, 0x9A)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)

def shd(cell, hex_color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    s = OxmlElement('w:shd')
    s.set(qn('w:val'), 'clear')
    s.set(qn('w:color'), 'auto')
    s.set(qn('w:fill'), hex_color)
    tcPr.append(s)

def divider(doc, color='CBD5E1'):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after  = Pt(1)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    b = OxmlElement('w:bottom')
    b.set(qn('w:val'), 'single')
    b.set(qn('w:sz'), '6')
    b.set(qn('w:space'), '1')
    b.set(qn('w:color'), color)
    pBdr.append(b)
    pPr.append(pBdr)

def h1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after  = Pt(4)
    r = p.add_run(text)
    r.font.size  = Pt(16)
    r.font.bold  = True
    r.font.color.rgb = BLUE
    # underline divider
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    b = OxmlElement('w:bottom')
    b.set(qn('w:val'), 'single')
    b.set(qn('w:sz'), '4')
    b.set(qn('w:space'), '1')
    b.set(qn('w:color'), '1D4ED8')
    pBdr.append(b)
    pPr.append(pBdr)
    return p

def h2(doc, text, color=DARK):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after  = Pt(3)
    r = p.add_run(text)
    r.font.size  = Pt(12)
    r.font.bold  = True
    r.font.color.rgb = color
    return p

def h3(doc, text, color=DARK):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after  = Pt(2)
    r = p.add_run(text)
    r.font.size  = Pt(10.5)
    r.font.bold  = True
    r.font.color.rgb = color
    return p

def para(doc, text, bold=False, color=DARK, size=9.5, sa=4, sb=0, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(sb)
    p.paragraph_format.space_after  = Pt(sa)
    r = p.add_run(text)
    r.font.size   = Pt(size)
    r.font.bold   = bold
    r.font.italic = italic
    r.font.color.rgb = color
    return p

def bullet(doc, text, color=DARK, size=9.5, indent=0, bold=False):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent  = Inches(0.25 + indent * 0.2)
    p.paragraph_format.space_after  = Pt(2)
    r = p.add_run(text)
    r.font.size  = Pt(size)
    r.font.color.rgb = color
    r.font.bold  = bold
    return p

def mixed_bullet(doc, label, text, label_color=BLUE, text_color=DARK, size=9.5):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Inches(0.25)
    p.paragraph_format.space_after = Pt(2)
    r1 = p.add_run(label + " ")
    r1.font.size  = Pt(size)
    r1.font.bold  = True
    r1.font.color.rgb = label_color
    r2 = p.add_run(text)
    r2.font.size  = Pt(size)
    r2.font.color.rgb = text_color
    return p

def make_table(doc, headers, rows, header_hex="1E293B", col_widths=None):
    tbl = doc.add_table(rows=1, cols=len(headers))
    tbl.style = 'Table Grid'
    for i, h in enumerate(headers):
        c = tbl.rows[0].cells[i]
        c.text = h
        shd(c, header_hex)
        for p in c.paragraphs:
            for r in p.runs:
                r.font.color.rgb = WHITE
                r.font.bold = True
                r.font.size = Pt(8.5)
    for row_data in rows:
        row = tbl.add_row().cells
        for i, val in enumerate(row_data):
            if isinstance(val, tuple):
                text, color, bold = val
            else:
                text, color, bold = val, DARK, False
            row[i].text = text
            for p in row[i].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(8.5)
                    r.font.color.rgb = color
                    r.font.bold = bold
    return tbl

def status_row(doc, icon, label, desc, color):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.left_indent = Inches(0.2)
    r1 = p.add_run(f"{icon} {label}: ")
    r1.font.bold = True
    r1.font.size = Pt(9.5)
    r1.font.color.rgb = color
    r2 = p.add_run(desc)
    r2.font.size = Pt(9.5)
    r2.font.color.rgb = DARK
    return p

# ═══════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════════════════
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(36)
r = p.add_run("VIJAYASREE PALAKKAD")
r.font.size = Pt(28); r.font.bold = True; r.font.color.rgb = BLUE

p2 = doc.add_paragraph()
p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
r2 = p2.add_run("Result Analysis Dashboard — Comprehensive Technical Audit")
r2.font.size = Pt(13); r2.font.color.rgb = GRAY

p3 = doc.add_paragraph()
p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
r3 = p3.add_run("വിജയശ്രീ പാലക്കാട്  •  Version 2.0  •  " + datetime.date.today().strftime('%d %B %Y'))
r3.font.size = Pt(9.5); r3.font.color.rgb = GRAY; r3.font.italic = True

doc.add_paragraph()
divider(doc, '1D4ED8')
doc.add_paragraph()

# Quick Index
h2(doc, "📋 Report Sections", INDIGO)
index_items = [
    "1. Project Overview & Technology Stack",
    "2. User Roles & Permission Analysis  ← SCHOOL role issues highlighted",
    "3. SCHOOL User — Missing Features & Complete Fix Guide",
    "4. Page-by-Page Deep Analysis (All Roles)",
    "5. PDF / Print Functionality Audit",
    "6. Database Schema Analysis",
    "7. Security Analysis",
    "8. UI/UX Best Practice Suggestions",
    "9. High-Quality Feature Enhancements",
    "10. Analysis Report Improvements",
    "11. Priority Fix Roadmap",
]
for item in index_items:
    bullet(doc, item, INDIGO)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 1 — PROJECT OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "1. Project Overview & Technology Stack")

para(doc,
    "Vijayasree Palakkad is a full-stack educational result-analysis and data-management platform "
    "for schools in Palakkad district, Kerala. It provides exam management, student marks entry, "
    "result analytics, PDF report generation, and broadcast alerting — all behind a role-based access system.",
    size=9.5, sa=6)

make_table(doc,
    ["Layer", "Technology", "Notes"],
    [
        [("Frontend", DARK, True), ("React 18 + TypeScript + Vite", DARK, False), ("TanStack Query, React Router v6", DARK, False)],
        [("Styling", DARK, True), ("Tailwind CSS v4 + Inter Font", DARK, False), ("Custom dark-mode via .dark class", DARK, False)],
        [("State", DARK, True), ("React Context (Auth) + TanStack Query", DARK, False), ("localStorage for theme cache", DARK, False)],
        [("PDF", DARK, True), ("jsPDF + html2canvas", DARK, False), ("Client-side; known CORS limitations", AMBER, False)],
        [("Backend DB", DARK, True), ("MongoDB + Mongoose ODM", DARK, False), ("15 collections, rich schema design", DARK, False)],
        [("Auth", DARK, True), ("JWT + Refresh Token + bcryptjs", DARK, False), ("Login lockout, password history", DARK, False)],
        [("Files", DARK, True), ("Cloudinary CDN", DARK, False), ("Resources, School PDFs", DARK, False)],
        [("Alerts", DARK, True), ("react-hot-toast", DARK, False), ("+ Custom Bell notification system", DARK, False)],
    ],
    col_widths=[1.2, 2.5, 2.8]
)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 2 — ROLES & PERMISSIONS
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "2. User Roles & Permission Analysis")

para(doc, "Four roles exist in the system. The sidebar menus are role-aware. However, React Router routes have "
    "NO allowedRoles guards applied — only isAuthenticated is checked. This means any authenticated user can "
    "access any page by typing the URL directly.", size=9.5, sa=6)

h2(doc, "2.1 Complete Role Access Matrix")
make_table(doc,
    ["Page / Feature", "WEBMASTER", "DIET", "DEO", "SCHOOL"],
    [
        [("Dashboard Home", DARK, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True)],
        [("Advanced Analysis", DARK, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True), ("✔ District scope", AMBER, True), ("✘ Not needed", RED, False)],
        [("PDF Analysis Report", DARK, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True), ("✔ Scoped", AMBER, True), ("✔ School scope", GREEN, True)],
        [("Find School by Result", DARK, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True), ("✘ Not needed", RED, False)],
        [("Resources Hub", DARK, True), ("✔ Upload+View", GREEN, True), ("✔ View only", AMBER, True), ("✔ View only", AMBER, True), ("✔ View only", GREEN, True)],
        [("Data Management", DARK, True), ("✔ Full CRUD", GREEN, True), ("✘ Should hide", RED, True), ("✔ District only", AMBER, True), ("✘ No access", RED, False)],
        [("Broadcast Alerts", DARK, True), ("✔ Exclusive", GREEN, True), ("✘ Hidden (no guard)", RED, True), ("✘ Hidden (no guard)", RED, True), ("✘ No access", RED, False)],
        [("Exam Management", DARK, True), ("✔ Full", GREEN, True), ("✘ Hidden (no guard)", RED, True), ("✘ Hidden (no guard)", RED, True), ("✘ No access", RED, False)],
        [("Student Management", DARK, True), ("✔ Full", GREEN, True), ("✘ No guard", RED, True), ("✔ District scope", AMBER, True), ("✔ Own school", GREEN, True)],
        [("Marks Entry", DARK, True), ("✘ N/A", GRAY, False), ("✘ N/A", GRAY, False), ("✘ N/A", GRAY, False), ("✔ Own school", GREEN, True)],
        [("Exam Config", DARK, True), ("✔ Admin", GREEN, True), ("✘ N/A", GRAY, False), ("✘ N/A", GRAY, False), ("✔ Own config", GREEN, True)],
        [("Notifications", DARK, True), ("✘ N/A", GRAY, False), ("✘ N/A", GRAY, False), ("✘ N/A", GRAY, False), ("✔ Own alerts", GREEN, True)],
        [("Reports", DARK, True), ("✔ View", GREEN, True), ("✔ View", GREEN, True), ("✔ View", GREEN, True), ("✔ Own school", GREEN, True)],
        [("Settings", DARK, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True), ("✔ Full", GREEN, True)],
    ],
    header_hex="1D4ED8"
)
doc.add_paragraph()

h2(doc, "2.2 Critical Missing Route Guards", RED)
para(doc, "The following routes must have allowedRoles added to their <Route> element in App.tsx immediately:", bold=True, color=RED)
make_table(doc,
    ["Route Path", "Current", "Required Fix"],
    [
        [("/dashboard/alerts", RED, True), ("No guard — ANY user can access", RED, False), ('allowedRoles={["WEBMASTER"]}', GREEN, True)],
        [("/dashboard/exams", RED, True), ("No guard — ANY user can access", RED, False), ('allowedRoles={["WEBMASTER"]}', GREEN, True)],
        [("/dashboard/management", AMBER, True), ("No guard", AMBER, False), ('allowedRoles={["WEBMASTER","DEO"]}', GREEN, True)],
        [("/dashboard/students-manage", AMBER, True), ("No guard", AMBER, False), ('allowedRoles={["WEBMASTER","DEO","SCHOOL"]}', GREEN, True)],
        [("/dashboard/marks", AMBER, True), ("No guard", AMBER, False), ('allowedRoles={["SCHOOL"]}', GREEN, True)],
        [("/dashboard/exam-config", AMBER, True), ("No guard", AMBER, False), ('allowedRoles={["SCHOOL","WEBMASTER"]}', GREEN, True)],
        [("/dashboard/notifications", AMBER, True), ("No guard", AMBER, False), ('allowedRoles={["SCHOOL"]}', GREEN, True)],
        [("/dashboard/reports", AMBER, True), ("No guard", AMBER, False), ('allowedRoles={["SCHOOL","WEBMASTER","DEO","DIET"]}', GREEN, True)],
    ],
    header_hex="DC2626"
)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 3 — SCHOOL USER MISSING FEATURES
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "3. SCHOOL User — Missing Features & Complete Fix Guide")

para(doc,
    "This is the most important finding. Two pages exist in App.tsx routes and have fully implemented "
    "components, but they are COMPLETELY MISSING from the SCHOOL user's sidebar menu in DashboardLayout.tsx. "
    "School users have no way to navigate to these pages unless they manually type the URL.",
    bold=True, color=RED, sa=6)

h2(doc, "3.1 Missing SCHOOL Sidebar Items", RED)

make_table(doc,
    ["Missing Page", "Route Path", "Component File", "What It Does", "Impact"],
    [
        [
            ("Exam Configuration", RED, True),
            ("/dashboard/exam-config", DARK, False),
            ("SchoolExamConfigPage", DARK, False),
            ("School sets up mark groups per subject for their exam", DARK, False),
            ("Schools CANNOT configure their mark groups — marks entry will fail or use wrong config", RED, True)
        ],
        [
            ("Notifications", RED, True),
            ("/dashboard/notifications", DARK, False),
            ("SchoolNotificationsPage", DARK, False),
            ("Full list of all broadcast alerts for this school", DARK, False),
            ("Schools see only the bell badge — cannot view full notification history", AMBER, True)
        ],
    ],
    header_hex="DC2626"
)
doc.add_paragraph()

h2(doc, "3.2 The Exact Fix — DashboardLayout.tsx", GREEN)
para(doc, "Open components/layout/DashboardLayout.tsx and find the SCHOOL menu array. Replace it with:", bold=True, color=DARK)

code_p = doc.add_paragraph()
code_p.paragraph_format.left_indent = Inches(0.3)
code_p.paragraph_format.space_after = Pt(4)
code_run = code_p.add_run(
    "SCHOOL: [\n"
    "  { label: 'Dashboard',          path: '/dashboard',                    icon: LayoutDashboard },\n"
    "  { label: 'Notifications',      path: '/dashboard/notifications',      icon: Bell },           // ← ADD THIS\n"
    "  { label: 'Student Management', path: '/dashboard/students-manage',    icon: Users },\n"
    "  { label: 'Exam Config',        path: '/dashboard/exam-config',        icon: Settings2 },      // ← ADD THIS\n"
    "  { label: 'Marks Entry',        path: '/dashboard/marks',              icon: FileEdit },\n"
    "  { label: 'Reports',            path: '/dashboard/reports',            icon: FileBarChart },\n"
    "  { label: 'PDF Analysis Report',path: '/dashboard/pdf-report',         icon: FileText },\n"
    "  { label: 'Resources Hub',      path: '/dashboard/resources',          icon: FolderOpen },\n"
    "],"
)
code_run.font.size = Pt(8)
code_run.font.name = "Courier New"
code_run.font.color.rgb = RGBColor(0x1E, 0x40, 0xAF)

h2(doc, "3.3 Icons Already Imported", GREEN)
para(doc, "Good news — both required icons are already imported at the top of DashboardLayout.tsx:", color=DARK)
bullet(doc, "Bell — already imported (used in notification bell button)", GREEN)
bullet(doc, "Settings2 — already imported (used in header user menu)", GREEN)
para(doc, "No new import statements needed. Just add the two menu items shown above.", bold=True, color=GREEN)

h2(doc, "3.4 Complete SCHOOL User Page Inventory", DARK)
para(doc, "After the fix, SCHOOL users will have access to all 8 pages:", color=DARK)
make_table(doc,
    ["#", "Page", "Route", "Status After Fix", "Purpose"],
    [
        [("1", DARK, False), ("Dashboard", DARK, True), ("/dashboard", DARK, False), ("✔ Works", GREEN, True), ("KPI summary, exam status, alert banner", DARK, False)],
        [("2", DARK, False), ("Notifications", RED, True), ("/dashboard/notifications", RED, False), ("✔ Fixed (was missing)", GREEN, True), ("View all broadcast alerts", DARK, False)],
        [("3", DARK, False), ("Student Management", DARK, True), ("/dashboard/students-manage", DARK, False), ("✔ Works", GREEN, True), ("Enroll, edit, transfer students", DARK, False)],
        [("4", DARK, False), ("Exam Config", RED, True), ("/dashboard/exam-config", RED, False), ("✔ Fixed (was missing)", GREEN, True), ("Set mark groups per subject", DARK, False)],
        [("5", DARK, False), ("Marks Entry", DARK, True), ("/dashboard/marks", DARK, False), ("✔ Works", GREEN, True), ("Enter/edit student marks", DARK, False)],
        [("6", DARK, False), ("Reports", DARK, True), ("/dashboard/reports", DARK, False), ("✔ Works", GREEN, True), ("Summary & detailed reports", DARK, False)],
        [("7", DARK, False), ("PDF Analysis Report", DARK, True), ("/dashboard/pdf-report", DARK, False), ("✔ Works", GREEN, True), ("Generate school PDF", DARK, False)],
        [("8", DARK, False), ("Resources Hub", DARK, True), ("/dashboard/resources", DARK, False), ("✔ Works", GREEN, True), ("Download study materials", DARK, False)],
    ],
    header_hex="059669"
)
doc.add_paragraph()

h2(doc, "3.5 Recommended SCHOOL Sidebar Order & Workflow Logic", CYAN)
para(doc, "The sidebar order should reflect the school user's natural workflow:", color=DARK)
bullet(doc, "1st — Notifications: Schools must first check alerts before doing anything else", CYAN, bold=True)
bullet(doc, "2nd — Exam Config: Must be configured BEFORE marks entry can begin", CYAN, bold=True)
bullet(doc, "3rd — Student Management: Set up student roster", CYAN)
bullet(doc, "4th — Marks Entry: The primary daily task", CYAN)
bullet(doc, "5th — Reports: View results after marks are entered", CYAN)
bullet(doc, "6th — PDF Report: Export final report", CYAN)
bullet(doc, "7th — Resources Hub: Reference materials", CYAN)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 4 — PAGE-BY-PAGE ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "4. Page-by-Page Deep Analysis")

pages = [
    {
        "num": "4.1",
        "name": "Login Page (/login)  — PUBLIC",
        "status": "✔ Functional",
        "sc": GREEN,
        "strengths": [
            "Public route, no auth required. Scrolling image animation (login-image-scroll CSS) adds visual polish.",
            "Redirects authenticated users away to /dashboard automatically.",
            "bcryptjs + loginAttempts + lockedUntil in DB provides solid brute-force protection.",
        ],
        "issues": [
            "No UI feedback for lockout countdown — user sees a generic error even when account is locked.",
            "No 'show/hide password' toggle — basic UX expectation.",
            "No 'Forgot Password' flow — even if backend doesn't support it yet, UI placeholder is needed.",
        ],
        "fix": [
            "On 401 response with lockedUntil timestamp, display: 'Account locked. Try again in X minutes.'",
            "Add eye icon toggle to password field.",
            "Add disabled 'Forgot Password?' link with 'Contact administrator' tooltip.",
        ],
    },
    {
        "num": "4.2",
        "name": "Dashboard Home (/dashboard)  — ALL ROLES",
        "status": "✔ Functional",
        "sc": GREEN,
        "strengths": [
            "Alert banner appears for SCHOOL role when active alerts exist.",
            "PageTransition animation applied consistently.",
            "Quiet-float animation on elements adds modern feel.",
        ],
        "issues": [
            "Breadcrumb uses pathname.split('/').pop() — 'advanced-analysis' shows as 'advanced analysis' (hyphen stripped, case not fixed).",
            "Dashboard likely shows same KPIs for all roles — DEO should see only their district data.",
            "No exam selector on dashboard — always shows latest exam data without context.",
        ],
        "fix": [
            "Create a PATH_TITLES map: { 'advanced-analysis': 'Advanced Analysis', 'exam-config': 'Exam Config', ... } and use it in header.",
            "Pass user.districtId to all dashboard API calls for DEO role.",
            "Add an active exam indicator/badge on the dashboard.",
        ],
    },
    {
        "num": "4.3",
        "name": "Advanced Analysis (/dashboard/advanced-analysis)  — WEBMASTER/DIET/DEO",
        "status": "⚠ Needs Route Guard",
        "sc": AMBER,
        "strengths": ["Rich chart-based analysis page. Data filtering by edu-district and school type."],
        "issues": [
            "No allowedRoles guard — SCHOOL users can access via URL.",
            "DEO scope enforcement must be verified at API level.",
        ],
        "fix": [
            'Add allowedRoles={["WEBMASTER","DIET","DEO"]} to this route in App.tsx.',
        ],
    },
    {
        "num": "4.4",
        "name": "PDF Analysis Report (/dashboard/pdf-report)  — ALL ROLES",
        "status": "⚠ Partially Working",
        "sc": AMBER,
        "strengths": [
            "4 report levels: DISTRICT, EDUCATIONAL, SCHOOL, SUBJECT — comprehensive.",
            "School picker pre-fills for SCHOOL role using user.schoolId.",
            "Loading and generating states handled (isLoadingData, isGeneratingPdf).",
        ],
        "issues": [
            "html2canvas may produce blank output on cross-origin images (Cloudinary logo, Google Fonts).",
            "DEO users see ALL schools in the school picker — not scoped to their district.",
            "SCHOOL role can switch reportLevel to DISTRICT and view all-district data — no lock.",
            "Large reports freeze the browser UI thread during PDF generation.",
            "No page numbers or generation metadata in the PDF output.",
        ],
        "fix": [
            "Add { useCORS: true } to html2canvas call. Encode logo as base64 in assets.",
            "For DEO role: fetch /management/schools?districtId=${user.districtId} instead of all schools.",
            "For SCHOOL role: disable the report level selector, lock it to SCHOOL/SUBJECT.",
            "Add a 'Generating PDF...' full-screen overlay with progress.",
            "Inject page number footer in jsPDF after addImage().",
        ],
    },
    {
        "num": "4.5",
        "name": "Data Management (/dashboard/management)  — WEBMASTER/DEO",
        "status": "🔴 Critical — No Route Guard",
        "sc": RED,
        "strengths": ["Manages core master data: districts, edu-districts, subjects, schools, users."],
        "issues": [
            "No allowedRoles guard — DIET and SCHOOL can access.",
            "DEO likely sees all districts in dropdowns rather than their own only.",
        ],
        "fix": [
            'Add allowedRoles={["WEBMASTER","DEO"]} to this route.',
            "Filter school list by districtId for DEO role in the data management UI.",
        ],
    },
    {
        "num": "4.6",
        "name": "Exam Management (/dashboard/exams)  — WEBMASTER ONLY",
        "status": "🔴 Critical — No Route Guard",
        "sc": RED,
        "strengths": ["Rich exam schema: status, marksEntryMode, includeCEMarks, hasMarkGroups, confirmedSchools."],
        "issues": [
            "MOST CRITICAL: No route guard. Any authenticated user can create/edit/delete exams.",
        ],
        "fix": [
            'Immediately add allowedRoles={["WEBMASTER"]} to this route.',
            "Backend API must also reject non-WEBMASTER requests independently.",
        ],
    },
    {
        "num": "4.7",
        "name": "Student Management (/dashboard/students-manage)  — WEBMASTER/DEO/SCHOOL",
        "status": "⚠ Needs Guard",
        "sc": AMBER,
        "strengths": [
            "Rich student data model: scribe flag, lettersStatus, readingStatus, writingStatus, DOB, caste.",
            "Compound unique index prevents duplicates.",
        ],
        "issues": [
            "No route guard — DIET users can access student PII (caste, religion, mobile).",
            "SCHOOL users should only see their own school's students — API must enforce schoolId filter.",
        ],
        "fix": [
            'Add allowedRoles={["WEBMASTER","DEO","SCHOOL"]} guard.',
            "Ensure API filters by schoolId when role === SCHOOL.",
            "Consider masking sensitive PII (religion, caste) from DEO role in the UI.",
        ],
    },
    {
        "num": "4.8",
        "name": "Exam Configuration (/dashboard/exam-config)  — SCHOOL (+ WEBMASTER)",
        "status": "🔴 MISSING from SCHOOL sidebar",
        "sc": RED,
        "strengths": [
            "SchoolExamConfig schema is well-designed with compound unique index (schoolId + examId).",
            "Allows schools to customise mark groups per subject — flexible design.",
        ],
        "issues": [
            "THIS PAGE IS NOT IN THE SCHOOL SIDEBAR. Schools cannot navigate to it.",
            "No route guard — any authenticated user can access /dashboard/exam-config.",
        ],
        "fix": [
            "Add to SCHOOL sidebar: { label: 'Exam Config', path: '/dashboard/exam-config', icon: Settings2 }",
            'Add allowedRoles={["SCHOOL","WEBMASTER"]} guard to this route.',
            "Position it BEFORE Marks Entry in the sidebar — it must be configured first.",
        ],
    },
    {
        "num": "4.9",
        "name": "Marks Entry (/dashboard/marks)  — SCHOOL ONLY",
        "status": "✔ Functional (but needs guard)",
        "sc": AMBER,
        "strengths": [
            "Supports marks, grades, CE marks, mark groups — comprehensive entry system.",
            "Compound unique index on (studentId, examId, subjectId) prevents duplicates.",
            "lock and finalLocked flags support submission workflow.",
            "Tracks enteredBy user ID and source (manual/ai).",
        ],
        "issues": [
            "No route guard — admin users can access /dashboard/marks.",
            "If Exam Config is not done first, mark groups will be empty or wrong.",
            "The 'ai' source for marks has no UI documentation or explanation.",
        ],
        "fix": [
            'Add allowedRoles={["SCHOOL"]} guard.',
            "Add a warning banner: 'Please complete Exam Configuration before entering marks.' if no config exists.",
            "Show lock status clearly with a banner when marks are finalLocked.",
            "Document the AI marks entry workflow or remove the enum value if unused.",
        ],
    },
    {
        "num": "4.10",
        "name": "Broadcast Alerts (/dashboard/alerts)  — WEBMASTER ONLY",
        "status": "🔴 Critical — No Route Guard",
        "sc": RED,
        "strengths": [
            "Supports ALL / UNCONFIRMED / SPECIFIC targeting — good design.",
            "UNCONFIRMED target auto-identifies schools that haven't confirmed their exam data.",
        ],
        "issues": [
            "NO route guard — any authenticated user can send broadcast alerts to all schools.",
            "A compromised DEO/DIET account could spam all schools with false alerts.",
        ],
        "fix": [
            'Immediately add allowedRoles={["WEBMASTER"]} guard.',
            "Backend API must also enforce WEBMASTER-only for POST/PUT/DELETE on /alerts.",
        ],
    },
    {
        "num": "4.11",
        "name": "School Notifications (/dashboard/notifications)  — SCHOOL ONLY",
        "status": "🔴 MISSING from SCHOOL sidebar",
        "sc": RED,
        "strengths": [
            "Bell icon in header correctly shows badge count and popup preview.",
            "Clicking notification in popup navigates to /dashboard/notifications.",
        ],
        "issues": [
            "THIS PAGE IS NOT IN THE SCHOOL SIDEBAR. Schools rely on the popup only.",
            "No route guard on the notifications page.",
            "There is no way for a school user to mark notifications as read.",
        ],
        "fix": [
            "Add to SCHOOL sidebar: { label: 'Notifications', path: '/dashboard/notifications', icon: Bell }",
            "Position it FIRST in the school sidebar — highest priority for schools.",
            "Add a 'Mark all as read' action on the notifications page.",
            'Add allowedRoles={["SCHOOL"]} guard.',
        ],
    },
    {
        "num": "4.12",
        "name": "Resources Hub (/dashboard/resources)  — ALL ROLES",
        "status": "✔ Functional",
        "sc": GREEN,
        "strengths": [
            "Cloudinary-backed file storage with downloadCount tracking.",
            "Filterable by subject, medium, class, category.",
            "expiresAt field allows time-limited resources.",
        ],
        "issues": [
            "Upload button visibility should be role-gated — only WEBMASTER should upload.",
            "No TTL index on expiresAt — expired resources remain in DB indefinitely.",
        ],
        "fix": [
            "Conditionally render upload button: {user.role === 'WEBMASTER' && <UploadButton />}",
            "Add MongoDB TTL index: ResourceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })",
        ],
    },
    {
        "num": "4.13",
        "name": "Reports Page (/dashboard/reports)  — SCHOOL (+ Admins)",
        "status": "✔ Functional",
        "sc": GREEN,
        "strengths": ["Summary and detailed school reports. School-focused feature."],
        "issues": [
            "No route guard — all roles can access.",
            "Admins accessing school reports should be filtered by their scope.",
        ],
        "fix": ['Add allowedRoles — or ensure API returns appropriate data per role.'],
    },
    {
        "num": "4.14",
        "name": "State Results Page (/results)  — PUBLIC (No Login)",
        "status": "✔ Functional",
        "sc": GREEN,
        "strengths": [
            "Correctly excluded from ProtectedRoute wrapper.",
            "Public-facing district-level result summary.",
        ],
        "issues": [
            "Must verify that the /results API endpoint does NOT return individual student names, marks, or school-internal data.",
        ],
        "fix": ["Add API-level response filtering to return only aggregated statistics on this public endpoint."],
    },
    {
        "num": "4.15",
        "name": "Settings Page (/dashboard/settings)  — ALL ROLES",
        "status": "✔ Functional",
        "sc": GREEN,
        "strengths": [
            "Theme stored in localStorage for instant load (no FOUC).",
            "API /preferences call syncs theme server-side.",
            "Dark mode CSS is comprehensive — 80+ selectors covering all components.",
        ],
        "issues": [
            "PreferenceSchema uses key: 'global' — preferences are shared across all users, not per-user.",
            "One user changing theme could theoretically affect all users if server preference overwrites localStorage.",
        ],
        "fix": [
            "Add userId field to PreferenceSchema. Query/update by userId, not global key.",
            "API: GET /preferences → filter by req.user.id instead of key: 'global'.",
        ],
    },
]

for page in pages:
    h2(doc, f"{page['num']}  {page['name']}", page['sc'])
    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(3)
    sr = sp.add_run(f"Status: {page['status']}")
    sr.bold = True; sr.font.size = Pt(9); sr.font.color.rgb = page['sc']

    if page['strengths']:
        h3(doc, "✔ Strengths", GREEN)
        for g in page['strengths']:
            bullet(doc, g, GREEN)

    if page['issues']:
        h3(doc, "✘ Issues", RED)
        for iss in page['issues']:
            bullet(doc, iss, RED)

    if page['fix']:
        h3(doc, "→ Recommended Fix", BLUE)
        for f in page['fix']:
            bullet(doc, f, BLUE)

    divider(doc)

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 5 — PDF AUDIT
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "5. PDF / Print Functionality Audit")

h2(doc, "5.1 How It Works Currently")
para(doc, "PdfReportGeneratorModal renders a hidden <div ref={reportRef}> with the report HTML, then calls "
    "html2canvas(reportRef.current) to capture it as a canvas image, then embeds it in jsPDF. This is "
    "client-side PDF generation — no server involvement.", size=9.5)

h2(doc, "5.2 Issues Found", RED)
pdf_issues = [
    ("Cross-origin images", "Cloudinary-hosted images and Google Fonts may be blocked by browser CORS policy → blank areas in PDF", RED),
    ("Canvas size limit", "Mobile browsers cap canvas at ~4096×4096 px — large reports will be truncated", AMBER),
    ("Page break handling", "html2canvas captures ONE image — jsPDF doesn't auto-paginate, so content after first page is cut", RED),
    ("UI thread blocking", "Large canvas operations freeze the browser tab — no Web Worker used", AMBER),
    ("SCHOOL role lock", "SCHOOL users can switch report level to DISTRICT — shows all-district data to school HM", RED),
    ("DEO scope", "School picker shows ALL schools regardless of DEO's districtId", AMBER),
    ("No PDF metadata", "Generated PDFs have no title, author, page numbers, or generation date in metadata", GRAY),
]
make_table(doc,
    ["Issue", "Description", "Severity"],
    [[(i, DARK, True), (d, c, False), ("HIGH" if c==RED else ("MED" if c==AMBER else "LOW"), c, True)] for i, d, c in pdf_issues],
    header_hex="DC2626"
)

h2(doc, "5.3 Recommended Fixes", BLUE)
pdf_fixes = [
    "Add { useCORS: true, allowTaint: false } to html2canvas() options call",
    "Import logo as base64 data URI — never as an external URL for PDF capture",
    "Implement multi-page PDF: split report into sections, capture each separately, call pdf.addPage() between them",
    "Add a full-screen overlay ('Generating PDF, please wait...') during generation to prevent UI interaction",
    "Lock reportLevel to SCHOOL/SUBJECT for SCHOOL role users in the modal UI",
    "Fetch schools with ?districtId=X filter for DEO role",
    "Set PDF metadata: pdf.setProperties({ title, author, creator, creationDate })",
    "Long-term: Move to server-side PDF using Puppeteer — eliminates all CORS and canvas-size issues",
]
for f in pdf_fixes:
    bullet(doc, f, BLUE)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 6 — DB ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "6. Database Schema Analysis")

h2(doc, "6.1 Strengths", GREEN)
db_good = [
    "UserSchema: Enum-validated role field. Password history array prevents reuse. loginAttempts + lockedUntil provides brute-force lockout.",
    "MarkSchema: Compound unique index on (studentId, examId, subjectId) — prevents duplicate mark entries perfectly.",
    "ExamSchema: Highly flexible — marksEntryMode (marks/grades/both), includeCEMarks, hasMarkGroups, per-school confirmedSubjects map.",
    "AuditLogSchema: Present with performedBy, entityType, entityId, details — strong foundation for traceability.",
    "StudentSchema: Rich demographics with scribe flag, literacy status (lettersStatus, readingStatus, writingStatus).",
    "School + User share same 'users' collection — clean architecture, no duplication.",
    "Virtual aliases (displayName, code, eduId, principalName) — excellent frontend compatibility pattern.",
    "Cloudinary integration in ResourceSchema with downloadCount tracking and expiresAt support.",
]
for g in db_good:
    bullet(doc, g, GREEN)

h2(doc, "6.2 Issues & Improvements", AMBER)
db_issues = [
    ("PreferenceSchema", "Uses key: 'global' — NOT per-user. One user's theme change can affect all. Fix: add userId field.", RED),
    ("ResourceSchema", "expiresAt field exists but NO MongoDB TTL index set. Expired resources stay forever. Fix: add TTL index.", AMBER),
    ("ExamSchema", "confirmedSchools stored as Array used as Set — no uniqueness guarantee at DB level. Fix: use $addToSet in API.", AMBER),
    ("AdminMarkGroupConfig", "Unique index only on subjectId — cannot support different group configs per exam per subject. Fix: add examId to compound index.", AMBER),
    ("MarkSchema", "'source' enum includes 'ai' but no AI workflow is documented or visible in UI. Either implement or remove.", GRAY),
    ("StudentSchema", "No soft-delete deletedAt timestamp — 'Transferred' status exists but no history. Fix: add deletedAt + deletedBy.", GRAY),
    ("DistrictSchema", "No 'active' field — but EducationalDistrictSchema has one. Inconsistency. Fix: add active field to District.", GRAY),
    ("All schemas", "No createdBy field on most schemas (only AuditLog tracks performedBy). Consider adding createdBy/updatedBy to Exam, Student.", GRAY),
]
make_table(doc,
    ["Schema", "Issue & Fix", "Priority"],
    [[(s, DARK, True), (iss, c, False), ("HIGH" if c==RED else ("MED" if c==AMBER else "LOW"), c, True)] for s, iss, c in db_issues],
    header_hex="B45D09"
)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 7 — SECURITY
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "7. Security Analysis")

make_table(doc,
    ["Security Check", "Current State", "Rating", "Action Required"],
    [
        [("Route guards", DARK, True), ("allowedRoles exists but NEVER USED in App.tsx", RED, False), ("CRITICAL", RED, True), ("Add allowedRoles to all role-restricted routes immediately", RED, False)],
        [("Backend auth", DARK, True), ("JWT verified per request (assumed)", AMBER, False), ("VERIFY", AMBER, True), ("Ensure every API route checks req.user.role, not just isAuthenticated", AMBER, False)],
        [("Password hashing", DARK, True), ("bcryptjs with history storage", GREEN, False), ("GOOD", GREEN, True), ("Ensure salt rounds ≥ 12", DARK, False)],
        [("Brute-force", DARK, True), ("loginAttempts + lockedUntil in DB schema", GREEN, False), ("GOOD", GREEN, True), ("Verify backend enforces this before issuing tokens", DARK, False)],
        [("Refresh token", DARK, True), ("Stored in DB (refreshToken field in User)", AMBER, False), ("REVIEW", AMBER, True), ("Ensure stored as httpOnly cookie, not localStorage", AMBER, False)],
        [("Student PII", DARK, True), ("Caste, religion, mobile stored in plaintext", RED, False), ("RISK", RED, True), ("Restrict API access; consider field masking for DEO/DIET roles", RED, False)],
        [("Audit logs", DARK, True), ("AuditLogSchema exists in DB", AMBER, False), ("VERIFY", AMBER, True), ("Ensure all CRUD mutations actually write audit log entries", AMBER, False)],
        [("Public /results API", DARK, True), ("No auth — public endpoint", AMBER, False), ("VERIFY", AMBER, True), ("Ensure only aggregate data is returned, no student names/marks", AMBER, False)],
        [("Broadcast Alerts API", DARK, True), ("No route guard on frontend", RED, False), ("CRITICAL", RED, True), ("Add allowedRoles + backend role check on POST /alerts", RED, False)],
        [("CORS in PDF", DARK, True), ("html2canvas may fail silently", AMBER, False), ("MEDIUM", AMBER, True), ("Add useCORS:true option to html2canvas call", AMBER, False)],
    ],
    header_hex="1E293B"
)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 8 — UI/UX SUGGESTIONS
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "8. UI/UX Best Practice Suggestions")

h2(doc, "8.1 Sidebar & Navigation")
nav_items = [
    ("Active state indicator", "Current: full blue background. Enhancement: add a left border accent (border-l-4 border-blue-500) alongside the background for stronger visual hierarchy."),
    ("Collapsed sidebar icons", "When sidebar is collapsed (w-20), show tooltip on hover with the menu item name — currently no tooltip exists."),
    ("Section grouping", "Group sidebar items: ANALYSIS (Dashboard, Advanced Analysis, PDF Report, Find School), MANAGEMENT (Data Mgmt, Exams, Students), TOOLS (Alerts, Resources). Add small uppercase labels between groups."),
    ("Mobile bottom nav", "For SCHOOL role on mobile, consider a bottom tab bar (5 icons max) instead of a hamburger sidebar — school HMs often use phones."),
    ("Badge on Marks Entry", "Show a small badge on Marks Entry sidebar item indicating pending subjects: 'Marks Entry (3/10)' to show progress."),
    ("Notification badge on sidebar", "Move the notification count badge to the Notifications sidebar item, not just the header bell — more discoverable for school users."),
]
for label, desc in nav_items:
    mixed_bullet(doc, label + ":", desc, BLUE, DARK)

h2(doc, "8.2 Dashboard Layout")
dash_items = [
    ("Stats cards grid", "Use a 2×2 grid on desktop, 1-column on mobile. Current likely 4-column — too cramped on medium screens."),
    ("Trend indicators", "Add ▲/▼ percentage change vs previous exam to each KPI card (e.g. 'Pass Rate: 87.3% ▲ 2.1%')."),
    ("Last updated timestamp", "Show 'Data as of [exam name] — [date]' below the page title to orient users."),
    ("Quick actions bar", "Add a horizontal quick-actions strip below header: [Upload Marks] [Generate Report] [View Alerts] — role-specific shortcuts."),
    ("Empty state designs", "When no exam is active or no data is loaded, show an illustrated empty state instead of blank space."),
    ("Chart tooltips", "Ensure all charts (recharts) have descriptive tooltips with exact values on hover, not just axis labels."),
]
for label, desc in dash_items:
    mixed_bullet(doc, label + ":", desc, PURPLE, DARK)

h2(doc, "8.3 Marks Entry UX")
marks_items = [
    ("Progress bar", "Show a per-subject completion progress bar at the top: 'Marks entered for 8/16 students in Mathematics'."),
    ("Auto-save", "Implement auto-save on blur for each marks input — school HMs should not lose data if they close the tab."),
    ("Keyboard navigation", "Allow Tab key to move between mark input cells in the table. This dramatically speeds up data entry."),
    ("Validation feedback", "Show inline validation: mark > maxMarks → red border + tooltip. Do not just show a toast after submit."),
    ("Grade preview", "Show the calculated grade next to the marks input in real-time as the user types (e.g. type '75' → show 'B+')."),
    ("Locked state UI", "When marks are finalLocked, grey out all inputs, show a lock icon, and display 'Final submission locked on [date]'."),
    ("Bulk import", "Add CSV/Excel import option for marks — reduce manual entry burden for large schools."),
]
for label, desc in marks_items:
    mixed_bullet(doc, label + ":", desc, CYAN, DARK)

h2(doc, "8.4 PDF Report Modal UX")
pdf_items = [
    ("Preview pane", "Show a live mini-preview of the report inside the modal before generating PDF — reduces surprises."),
    ("Step-by-step wizard", "Replace the single modal with a 3-step wizard: (1) Select Scope → (2) Choose Filters → (3) Preview & Download."),
    ("Progress indicator", "Show a multi-step progress bar during PDF generation: 'Fetching data... Rendering report... Creating PDF...'"),
    ("Download vs Print", "Offer both Download PDF and Print (window.print() with @media print CSS) options."),
    ("Report history", "Store last 5 generated PDF URLs in localStorage so user can re-download without regenerating."),
]
for label, desc in pdf_items:
    mixed_bullet(doc, label + ":", desc, AMBER, DARK)

h2(doc, "8.5 General UX Improvements")
general_items = [
    ("Breadcrumb navigation", "Replace the single page title in the header with a proper breadcrumb: Dashboard > Data Management > Schools."),
    ("Loading skeletons", "Replace spinner/loader with skeleton screens (animated grey bars) matching the actual page layout."),
    ("Confirmation dialogs", "For destructive actions (delete student, delete exam, send broadcast alert), use a typed-confirmation dialog: type the name to confirm."),
    ("Toast positioning", "Current: top-right. For mobile, bottom-center is more thumb-accessible and does not obscure navigation."),
    ("Empty search results", "When a table search returns 0 results, show an illustrated empty state with a 'Clear search' button."),
    ("Dark mode toggle", "Add the dark/light toggle to the header (not just Settings page) for quick access — a common user expectation."),
    ("Print CSS", "Add @media print CSS styles so that pages like Reports and Advanced Analysis print cleanly from the browser without opening the PDF modal."),
]
for label, desc in general_items:
    mixed_bullet(doc, label + ":", desc, DARK, DARK)

doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 9 — HIGH-QUALITY FEATURE SUGGESTIONS
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "9. High-Quality Feature Enhancement Suggestions")

features = [
    ("SCHOOL ROLE", [
        ("Marks Entry Workflow Progress Tracker", "A visual stepper showing the school's progress through the exam submission lifecycle: [Config Done ✔] → [Students Added ✔] → [Marks Entered 60%] → [Confirmed ✘]. Show this on the SCHOOL dashboard.", GREEN),
        ("Subject-wise Completion Dashboard", "A colour-coded grid showing each subject's marks entry status (Not Started / In Progress / Complete / Locked) for the active exam at a glance.", GREEN),
        ("Parent SMS/Notification Preview", "Allow school HMs to preview how result notifications will appear to parents before the results are published.", CYAN),
        ("Student Performance Comparison", "Show each student's current exam marks vs previous exam marks with a delta indicator in the marks entry table.", CYAN),
    ]),
    ("ADMIN ROLES (WEBMASTER/DEO/DIET)", [
        ("Exam Submission Status Board", "A real-time Kanban-style board showing each school's submission status: Not Started / Marks Entered / Confirmed / Locked. Clickable for drill-down.", BLUE),
        ("District Comparison Heatmap", "A visual heatmap of educational districts showing pass rates, with colour intensity representing performance — much faster to scan than a table.", INDIGO),
        ("Automated Alert Triggers", "Auto-send alerts to UNCONFIRMED schools N days before exam deadline without manual intervention. Add cron-job based reminders.", INDIGO),
        ("Bulk School User Management", "Upload a CSV to create/update multiple school user accounts at once — avoids manual creation for 100+ schools.", BLUE),
        ("Grade Distribution Chart", "Doughnut/pie chart showing A+/A/B+/B/C+/C/D/E distribution per subject across the district — currently may only show aggregate pass %.", BLUE),
    ]),
    ("ANALYSIS & REPORTS", [
        ("Year-on-Year Comparison Chart", "Line chart overlaying current vs previous academic year pass rates per subject. Currently no historical comparison is evident.", PURPLE),
        ("Subject Weakness Radar Chart", "Spider/radar chart per school showing relative performance across all 10 subjects — instantly shows subject strengths and weaknesses.", PURPLE),
        ("School Ranking Table with Filters", "Sortable, filterable table ranking all schools by overall pass %, A+ count, school type, and educational district — with CSV export.", PURPLE),
        ("Anomaly Detection Alerts", "Flag schools with unusually high/low marks entry numbers (e.g. >20% change from previous exam) for DEO review.", AMBER),
    ]),
    ("TECHNICAL ENHANCEMENTS", [
        ("Server-Side PDF Generation", "Move PDF to Puppeteer/Playwright on the backend. Returns a URL — eliminates CORS, canvas-size, and UI-freeze issues completely.", RED),
        ("Real-Time Dashboard Updates", "Add WebSocket or Server-Sent Events (SSE) for live updates to the exam submission status board without page refresh.", AMBER),
        ("Offline-First Marks Entry", "Implement IndexedDB caching for marks entry — school HMs with intermittent internet can enter marks offline and sync later.", CYAN),
        ("Audit Log Viewer", "Add a UI page for WEBMASTER to view AuditLog entries: who changed what, when. The schema exists but no UI is evident.", GREEN),
        ("API Rate Limiting UI Feedback", "If the backend rate-limits API calls, show a user-friendly 'Too many requests — please wait X seconds' message instead of a generic error.", GRAY),
    ]),
]

for role_label, feat_list in features:
    h2(doc, f"9.x {role_label}", DARK)
    for fname, fdesc, fcolor in feat_list:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.left_indent = Inches(0.2)
        r1 = p.add_run(f"◆ {fname}:  ")
        r1.font.bold = True; r1.font.size = Pt(9.5); r1.font.color.rgb = fcolor
        r2 = p.add_run(fdesc)
        r2.font.size = Pt(9.5); r2.font.color.rgb = DARK
    doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 10 — ANALYSIS REPORT IMPROVEMENTS
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "10. Analysis Report Improvements")

para(doc, "The following improvements apply specifically to the PDF report and on-screen analysis pages:", size=9.5, sa=6)

h2(doc, "10.1 PDF Report Content Improvements")
pdf_content = [
    ("Executive Summary page", "First page of every PDF report should include: exam name, date range, total schools, total students, overall pass %, top 3 performing schools, and subject with highest failure rate."),
    ("School-level report card", "For SCHOOL-level PDFs: one page per subject showing grade distribution bar chart, question group analysis, and comparison to district average."),
    ("Signature/certification section", "Add a blank signature area at the bottom: 'Prepared by: _____ DEO/HM Signature _____ Date _____' for official use."),
    ("Watermark / classification", "Add a light diagonal watermark 'OFFICIAL — VIJAYASREE PALAKKAD' to PDFs to deter unofficial distribution."),
    ("Bilingual headers", "Kerala educational reports are typically bilingual (English + Malayalam). Add Malayalam labels (e.g. 'ഉത്തീർണ്ണ നിരക്ക്' for Pass Rate)."),
]
for label, desc in pdf_content:
    mixed_bullet(doc, label + ":", desc, PURPLE, DARK)

h2(doc, "10.2 On-Screen Analysis Improvements")
screen_analysis = [
    ("Filter persistence", "Remember the user's last filter selections (exam, district, school type) using localStorage — avoid re-selecting on every visit."),
    ("Export to Excel", "Add a 'Export to Excel' button on analysis tables using SheetJS — many education officers prefer Excel over PDF for further analysis."),
    ("Comparison mode", "Allow selecting 2 exams side-by-side for direct comparison in the Advanced Analysis page."),
    ("Print-friendly view", "Add a 'Print this page' button that uses @media print CSS to hide the sidebar and header for clean browser printing."),
    ("Data freshness indicator", "Show 'Last data update: [timestamp]' on every analysis page so users know if they are looking at fresh or stale data."),
    ("Drill-down breadcrumb", "The DrillDownPage should show a path: District > Educational District > School > Subject — each clickable to go back up."),
    ("Find School — save searches", "Allow saving search criteria as named presets (e.g. 'High Performers — LP Schools') for quick reuse."),
]
for label, desc in screen_analysis:
    mixed_bullet(doc, label + ":", desc, CYAN, DARK)

doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 11 — PRIORITY ROADMAP
# ═══════════════════════════════════════════════════════════════════════════
h1(doc, "11. Priority Fix Roadmap")

make_table(doc,
    ["Priority", "Fix", "File to Change", "Effort"],
    [
        [("🔴 P0", RED, True), ("Add 'Notifications' to SCHOOL sidebar", DARK, False), ("DashboardLayout.tsx", DARK, True), ("5 min", GREEN, False)],
        [("🔴 P0", RED, True), ("Add 'Exam Config' to SCHOOL sidebar", DARK, False), ("DashboardLayout.tsx", DARK, True), ("5 min", GREEN, False)],
        [("🔴 P0", RED, True), ("Add allowedRoles to /dashboard/alerts (WEBMASTER only)", DARK, False), ("App.tsx", DARK, True), ("2 min", GREEN, False)],
        [("🔴 P0", RED, True), ("Add allowedRoles to /dashboard/exams (WEBMASTER only)", DARK, False), ("App.tsx", DARK, True), ("2 min", GREEN, False)],
        [("🟡 P1", AMBER, True), ("Add allowedRoles to /dashboard/marks (SCHOOL only)", DARK, False), ("App.tsx", DARK, True), ("2 min", GREEN, False)],
        [("🟡 P1", AMBER, True), ("Add allowedRoles to /dashboard/exam-config", DARK, False), ("App.tsx", DARK, True), ("2 min", GREEN, False)],
        [("🟡 P1", AMBER, True), ("Add allowedRoles to /dashboard/notifications (SCHOOL)", DARK, False), ("App.tsx", DARK, True), ("2 min", GREEN, False)],
        [("🟡 P1", AMBER, True), ("Add allowedRoles to /dashboard/management", DARK, False), ("App.tsx", DARK, True), ("2 min", GREEN, False)],
        [("🟡 P1", AMBER, True), ("Scope school picker in PDF modal to DEO's district", DARK, False), ("PdfReportGeneratorModal.tsx", DARK, True), ("30 min", AMBER, False)],
        [("🟡 P1", AMBER, True), ("Lock PDF report level for SCHOOL role", DARK, False), ("PdfReportGeneratorModal.tsx", DARK, True), ("15 min", GREEN, False)],
        [("🟡 P1", AMBER, True), ("Add useCORS:true to html2canvas in PDF modal", DARK, False), ("PdfReportGeneratorModal.tsx", DARK, True), ("5 min", GREEN, False)],
        [("🔵 P2", BLUE, True), ("Fix PreferenceSchema to be per-user (add userId)", DARK, False), ("db.ts + API", DARK, True), ("2 hrs", AMBER, False)],
        [("🔵 P2", BLUE, True), ("Add TTL index on Resource.expiresAt", DARK, False), ("db.ts", DARK, True), ("10 min", GREEN, False)],
        [("🔵 P2", BLUE, True), ("Fix header breadcrumb with PATH_TITLES map", DARK, False), ("DashboardLayout.tsx", DARK, True), ("20 min", GREEN, False)],
        [("🔵 P2", BLUE, True), ("Add login lockout countdown UI", DARK, False), ("LoginPage.tsx", DARK, True), ("1 hr", AMBER, False)],
        [("⚪ P3", GRAY, True), ("Add dark mode toggle to header", DARK, False), ("DashboardLayout.tsx", DARK, True), ("30 min", GREEN, False)],
        [("⚪ P3", GRAY, True), ("Add sidebar section group labels", DARK, False), ("DashboardLayout.tsx", DARK, True), ("30 min", GREEN, False)],
        [("⚪ P3", GRAY, True), ("Add PDF page numbers and watermark", DARK, False), ("PdfReportGeneratorModal.tsx", DARK, True), ("1 hr", AMBER, False)],
        [("⚪ P3", GRAY, True), ("Add year-on-year comparison chart", DARK, False), ("AdvancedAnalysisPage.tsx", DARK, True), ("4 hrs", RED, False)],
    ],
    header_hex="1D4ED8"
)

doc.add_paragraph()
divider(doc, '1D4ED8')
para(doc,
    "Report generated by Claude (Anthropic) — Analysis based on: App.tsx, DashboardLayout.tsx, "
    "ProtectedRoute.tsx, PdfReportGeneratorModal.tsx, db.ts, index.css, main.tsx  "
    f"| Date: {datetime.date.today().strftime('%d %B %Y')}",
    color=GRAY, size=8, sa=2, sb=4, italic=True)

out = "/mnt/user-data/outputs/VijayasreePalakkad_AuditReport_v2.docx"
doc.save(out)
print("Saved:", out)
PYEOF
python /tmp/generate_report_v2.py