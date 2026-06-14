import React from 'react';
import { FileText } from 'lucide-react';
import { Blueprint, BlueprintItem, Curriculum, Unit, Discourse, ReportSettings } from '../types';
import { getTermTamilMap } from '../utils/reportCalculations';

interface AnswerKeyViewProps {
    blueprint: Blueprint;
    curriculum: Curriculum | null;
    discourses?: Discourse[];
    settings?: ReportSettings;
    isExportMode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared pure helpers  (used by both the React view and the HTML-string generator)
// ─────────────────────────────────────────────────────────────────────────────

const fmtMarksStr = (marks: number): string => {
    const s = marks.toString();
    if (s.endsWith('.5')) {
        const whole = s.split('.')[0];
        return whole === '0' ? '½' : `${whole}½`;
    }
    return s;
};

const wrapEnglishAndNumbers = (value: string) =>
    value.replace(/([A-Za-z0-9][A-Za-z0-9\s/().:&-]*)/g, '<span class="english-font">$1</span>');

const normalizeAnswerHtml = (html?: string) => {
    if (!html) return '';
    return html
        .replace(/&nbsp;/g, ' ')
        .replace(/(\d+)\.5/g, '$1½')
        .replace(/(^|[^0-9])0\.5/g, '$1½')
        .replace(/(\d+(?:\.\d+)?)M\b/g, '$1');
};

const getAcademicYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month <= 4 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
};

const getPaperCode = (blueprint: Blueprint, isAnswerKey = true): string => {
    const subject = blueprint.subject.includes('BT') ? 'BT' : 'AT';
    const prefix = isAnswerKey ? 'GI' : 'T';
    const codeMap: Record<string, string> = {
        '8-AT': '802',  '8-BT': '812',
        '9-AT': '902',  '9-BT': '912',
        '10-AT': '1002', '10-BT': '1012'
    };
    const base = codeMap[`${blueprint.classLevel}-${subject}`] || `${blueprint.classLevel}${subject === 'AT' ? '02' : '12'}`;
    return `${prefix}${base}`;
};

const getSubjectTitle = (blueprint: Blueprint) => {
    if (blueprint.subject.includes('AT'))
        return { tamil: 'தமிழ் முதல் தாள்', eng: 'Tamil Language Paper I (AT)' };
    return { tamil: 'தமிழ் இரண்டாம் தாள்', eng: 'Tamil Language Paper II (BT)' };
};

const getTermHeading = (blueprint: Blueprint, academicYear: string): string => {
    const year = academicYear.replace(/^(\d{4})-(\d{2,4})$/, (_, s, e) => `${s}-${String(e).slice(-2)}`);
    switch (blueprint.examTerm) {
        case 'First Term Summative': return `முதல்பருவத் தொகுத்தறி மதிப்பீடு ${year}`;
        case 'Second Term Summative': return `இரண்டாம் பருவத் தொகுத்தறி மதிப்பீடு ${year}`;
        case 'Third Term Summative': return `இறுதிப் பருவத் தொகுத்தறி மதிப்பீடு ${year}`;
        default: return `முதல்பருவத் தொகுத்தறி மதிப்பீடு ${year}`;
    }
};

const buildItemAnswerHtml = (
    item: BlueprintItem,
    discourses: Discourse[],
    isOptionB = false
): string => {
    const enableInput = isOptionB ? item.enableInputAnswerB : item.enableInputAnswer;
    const structured = isOptionB ? item.structuredAnswersB : item.structuredAnswers;
    const writeContent = isOptionB ? item.answerTextB : item.answerText;
    const enableWrite = isOptionB ? item.enableWriteContentB : item.enableWriteContent;
    const enableDiscourse = isOptionB ? item.enableDiscourseB : item.enableDiscourse;
    const discourseId = isOptionB ? item.discourseIdB : item.discourseId;

    const parts: string[] = [];

    if (enableWrite && writeContent && writeContent.trim()) {
        const plain = writeContent.replace(/<[^>]*>/g, '').trim();
        if (plain.length > 0 || writeContent.includes('<img'))
            parts.push(`<div class="write-content-section">${writeContent}</div>`);
    }

    if (enableDiscourse && discourseId && discourses.length > 0) {
        const d = discourses.find(x => x.id === discourseId);
        if (d) {
            let dHtml = `<p><b>${d.name}</b></p><div class="discourse-details">`;
            const norm = (d.description || '').trim();
            const dedup = norm.toLowerCase().startsWith(d.name.trim().toLowerCase())
                ? norm.slice(d.name.trim().length).trim().replace(/^[:\-–]\s*/, '')
                : norm;
            if (dedup) dHtml += `<p>${dedup}</p>`;
            if (d.rubrics && d.rubrics.length > 0) {
                dHtml += `<ul class="rubric-list">`;
                d.rubrics.forEach(r => {
                    dHtml += `<li><span class="rubric-point">${r.point}</span><strong class="rubric-mark english-font">${fmtMarksStr(r.marks)}</strong></li>`;
                });
                dHtml += `</ul>`;
            }
            dHtml += `</div>`;
            parts.push(dHtml);
        }
    }

    if (enableInput && structured && structured.length > 0) {
        const sHtml = `<ul class="rubric-list">` +
            structured.map(v => `<li><span class="rubric-point">${v.answer}</span><strong class="rubric-mark english-font">${v.mark}</strong></li>`).join('') +
            `</ul>`;
        parts.push(sHtml);
    }

    if (parts.length === 0) return '';
    return normalizeAnswerHtml(parts.join('<div class="sep-line"></div>'));
};

const buildFurtherInfoHtml = (text?: string): string => {
    if (!text) return '';
    const hasTags = /<[a-z][\s\S]*>/i.test(text);
    if (hasTags) return text.replace(/\n/g, '<br />');
    return text.split('\n').map(line => wrapEnglishAndNumbers(line)).join('<br />');
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared CSS string  (embedded in both HTML view <style> and the PDF HTML doc)
// ─────────────────────────────────────────────────────────────────────────────

const sharedStyles = (FST: string, FSE: string) => `
.tamil-font {
    font-family: 'TAU-Paalai', 'Noto Serif', serif;
    font-size: ${FST};
    line-height: 1.05;
}
.tamil-heading-font {
    font-family: 'TAU-Paalai', 'TAU-Urai Bold', 'TAU-Urai', serif;
    font-weight: 700;
}
.english-font {
    font-family: 'Times New Roman', 'Times', serif;
}
.answer-key-content {
    width: 100%;
    font-family: 'Times New Roman', 'TAU-Paalai', serif;
}
.answer-key-content p { margin: 0 0 0.1rem 0; }
.rubric-mark {
    font-weight: bold;
    min-width: 1.5rem;
    text-align: right;
    color: #000;
    line-height: 1.4;
    margin-left: 6px;
    display: inline-block;
}
.mark-indicator {
    float: right;
    min-width: 18px;
    text-align: right;
    font-weight: bold;
    margin-left: 4px;
    display: inline-block;
    font-family: 'Times New Roman', serif;
    line-height: 1.1;
    color: #000;
}
.rubric-list, .answer-key-content ul {
    list-style: none !important;
    padding-left: 1.25rem !important;
    margin: 0 !important;
    width: 100%;
}
.rubric-list li, .answer-key-content ul li {
    display: flex !important;
    align-items: flex-start !important;
    gap: 0.4rem !important;
    padding: 0.02rem 0 !important;
    width: 100%;
    list-style: none !important;
}
.rubric-list li::before, .answer-key-content ul li::before { content: none !important; display: none !important; }
.discourse-details { margin-left: 1.5rem; }
.rubric-point { flex-grow: 1; line-height: 1.3; font-family: 'TAU-Paalai', serif; }
.sep-line { border-top: 1px dashed rgba(0,0,0,0.2); margin: 4px 0; }
.qno-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.3; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// React HTML-view component
// ─────────────────────────────────────────────────────────────────────────────

const AnswerKeyView = ({ blueprint, curriculum, discourses = [], settings, isExportMode = false }: AnswerKeyViewProps) => {
    if (!blueprint) return null;
    const activeSettings = settings || { orientation: 'p', paperSize: 'A4', fontSizeTamil: 14, fontSizeEnglish: 11 };

    const isLandscape = activeSettings.orientation === 'l';
    const paperSize = activeSettings.paperSize || 'A4';
    const FST = activeSettings.fontSizeTamil ? `${activeSettings.fontSizeTamil}pt` : '14pt';
    const FSE = activeSettings.fontSizeEnglish ? `${activeSettings.fontSizeEnglish}pt` : (activeSettings.fontSizeBody ? `${activeSettings.fontSizeBody}pt` : '11pt');

    const containerWidth = paperSize === 'Legal'
        ? (isLandscape ? '355.6mm' : '215.9mm')
        : (isLandscape ? '297mm' : '210mm');

    // ── unit order map ──────────────────────────────────────────────────────
    const unitOrderMap = React.useMemo(() => {
        const map = new Map<string, number>();
        curriculum?.units.forEach((u: Unit) => map.set(u.id, u.unitNumber));
        return map;
    }, [curriculum]);

    const sortedItems = React.useMemo(() =>
        [...blueprint.items].sort((a, b) => {
            if (a.marksPerQuestion !== b.marksPerQuestion) return a.marksPerQuestion - b.marksPerQuestion;
            return (unitOrderMap.get(a.unitId) || 999) - (unitOrderMap.get(b.unitId) || 999);
        }), [blueprint.items, unitOrderMap]);

    // ── React-specific formatters ───────────────────────────────────────────
    const formatMarks = (marks: number) => (
        <span className="english-font" style={{ fontFamily: "'Times New Roman', serif" }}>
            {fmtMarksStr(marks)}
        </span>
    );



    const renderMixedText = (text: string | undefined | null) => {
        if (!text) return '-';
        const segments = text.toString().split(/([அ-ஹ\u0B80-\u0BFF]+)/);
        return segments.map((seg, i) => {
            if (!seg) return null;
            const isTamil = /[அ-ஹ\u0B80-\u0BFF]/.test(seg);
            return (
                <span key={i}
                    className={isTamil ? 'tamil-font' : 'english-font'}
                    style={{ fontFamily: isTamil ? `'TAU-Paalai','Latha',serif` : `'Times New Roman',serif` }}>
                    {seg}
                </span>
            );
        });
    };

    const renderFurtherInfo = (text?: string) => {
        if (!text) return null;
        const html = buildFurtherInfoHtml(text);
        return <div className="tamil-font leading-normal whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const renderItemAnswerJsx = (item: BlueprintItem, isOptionB = false) => {
        const html = buildItemAnswerHtml(item, discourses, isOptionB);
        if (!html) return <span className="text-gray-400 italic text-xs">(விடை சேர்க்கப்படவில்லை)</span>;
        return <div className="answer-key-content tamil-font leading-normal" style={{ fontSize: FST }} dangerouslySetInnerHTML={{ __html: html }} />;
    };

    // ── Derived values ──────────────────────────────────────────────────────
    const academicYear = blueprint.academicYear || getAcademicYear();
    const paperCodeGI = getPaperCode(blueprint, true);
    const paperCodeT = getPaperCode(blueprint, false);
    const subjectTitle = getSubjectTitle(blueprint);
    const termHeading = getTermHeading(blueprint, academicYear);
    const setLetter = (blueprint.setId || 'A').replace(/SET\s+/i, '').trim().charAt(0).toUpperCase();

    // ── Header ─────────────────────────────────────────────────────────────
    const termMap = getTermTamilMap();
    const examTitle = termMap[blueprint.examTerm]
        ? `${termMap[blueprint.examTerm]} ${blueprint.academicYear || ''}`
        : `${blueprint.examTerm} ${blueprint.academicYear || ''}`;

    const isAT = blueprint.subject.includes('AT');
    const subjectEnglish = isAT ? "First Language Paper I" : "First Language Paper II";
    const subjectTamil = isAT ? "தமிழ் முதல் தாள்" : "தமிழ் இரண்டாம் தாள்";
    const subjectCode = isAT ? "AT" : "BT";

    const Header = () => (
        <div style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginBottom: '20px', color: '#000' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', gap: '8px' }}>
                <div style={{
                    border: '1.5px solid #000',
                    minWidth: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16pt',
                    fontWeight: 'bold',
                    fontFamily: "'Times New Roman', serif",
                    flexShrink: 0,
                }}>
                    {setLetter}
                </div>

                <div style={{ flex: 1, textAlign: 'center', lineHeight: '1.5' }}>
                    <div style={{ fontFamily: "'TAU-Paalai', 'Latha', serif", fontSize: '15pt', fontWeight: 'bold' }}>
                        சமக்ர சிக்ஷா கேரளம்
                    </div>
                    <div style={{ fontFamily: "'TAU-Paalai', 'Latha', serif", fontSize: '12pt' }}>
                        {examTitle}
                    </div>
                    <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '11pt', fontWeight: 'bold' }}>
                        {subjectEnglish}
                    </div>
                    <div style={{ fontFamily: "'TAU-Paalai', 'Latha', serif", fontSize: '11pt' }}>
                        {subjectTamil} ({subjectCode})
                    </div>
                </div>

                <div style={{
                    border: '1.5px solid #000',
                    minWidth: '70px',
                    padding: '4px 8px',
                    textAlign: 'center',
                    fontSize: '11pt',
                    fontWeight: 'bold',
                    fontFamily: "'Times New Roman', serif",
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                }}>
                    {paperCodeGI}
                </div>
            </div>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 10px',
                fontFamily: "'TAU-Paalai', 'Latha', serif",
                fontSize: '11pt',
            }}>
                <div style={{ fontWeight: 'bold' }}>
                    <div>நேரம்: 90 நிமிடம்</div>
                    <div>சிந்தனை நேரம்: 15 நிமிடம்</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    <div>வகுப்பு: <span className="english-font">{blueprint.classLevel}</span></div>
                    <div>மதிப்பெண்: {formatMarks(blueprint.totalMarks)}</div>
                </div>
            </div>

            <div style={{
                textAlign: 'center',
                fontFamily: "'Times New Roman', serif",
                fontSize: '11pt',
                fontWeight: 'bold',
                letterSpacing: '2px',
                padding: '10px 0',
                borderTop: '1.5px solid #000',
                borderBottom: '1.5px solid #000',
            }}>
                ANSWER KEY &amp; SCORING INDICATORS
            </div>
        </div>
    );

    // ── Q.No cell ── number on first line, (அ)/(ஆ) on second line ──────────
    const QNoCell = ({ num, suffix }: { num: number; suffix?: string }) => (
        <td className="border border-black p-1 text-center font-bold text-sm" style={{ verticalAlign: 'middle' }}>
            <div className="qno-cell">
                <span className="english-font">{num}</span>
                {suffix && <span className="tamil-font" style={{ fontSize: '10px' }}>{suffix}</span>}
            </div>
        </td>
    );

    // ── Table rows ──────────────────────────────────────────────────────────
    const allRowsJsx = sortedItems.map((item, index) => (
        <tbody
            key={item.id}
            className={item.marksPerQuestion <= 2 ? 'avoid-break' : 'allow-break'}
            style={item.marksPerQuestion <= 2 ? { pageBreakInside: 'avoid', breakInside: 'avoid' } : { pageBreakInside: 'auto', breakInside: 'auto' }}
        >
            {!item.hasInternalChoice ? (
                <tr className="text-black">
                    <QNoCell num={index + 1} />
                    <td className="border border-black p-1 text-center font-bold english-font text-sm">{formatMarks(item.marksPerQuestion)}</td>
                    <td className="border border-black p-1 text-left">
                        {renderItemAnswerJsx(item)}
                    </td>
                    <td className="border border-black p-1 align-top text-black text-sm">
                        {item.enableFurtherInfo && renderFurtherInfo(item.furtherInfo)}
                    </td>
                </tr>
            ) : (
                <>
                    <tr className="text-black">
                        <QNoCell num={index + 1} suffix="(அ)" />
                        <td className="border border-black p-1 text-center font-bold english-font text-sm">{formatMarks(item.marksPerQuestion)}</td>
                        <td className="border border-black p-1 text-left">
                            {renderItemAnswerJsx(item)}
                        </td>
                        <td className="border border-black p-1 align-top text-black text-sm">
                            {item.enableFurtherInfo && renderFurtherInfo(item.furtherInfo)}
                        </td>
                    </tr>
                    <tr className="text-black">
                        <QNoCell num={index + 1} suffix="(ஆ)" />
                        <td className="border border-black p-1 text-center font-bold english-font text-sm">{formatMarks(item.marksPerQuestion)}</td>
                        <td className="border border-black p-1 text-left">
                            {renderItemAnswerJsx(item, true)}
                        </td>
                        <td className="border border-black p-1 align-top text-black text-sm">
                            {item.enableFurtherInfoB && renderFurtherInfo(item.furtherInfoB)}
                        </td>
                    </tr>
                </>
            )}
        </tbody>
    ));

    // ── Main render ─────────────────────────────────────────────────────────
    return (
        <div className="w-full bg-gray-100 min-h-screen py-4 md:py-8 overflow-x-auto ak-view-root" data-paper-code={paperCodeGI}>
            <div
                className={`mx-auto bg-white shadow-2xl transition-all duration-300 relative ak-paper-container ${isLandscape ? 'landscape' : 'portrait'}`}
                style={{
                    width: containerWidth,
                    minHeight: isLandscape ? '210mm' : '297mm',
                    boxSizing: 'border-box',
                    padding: '15mm',
                }}
            >
                <Header />

                <table className="w-full border-collapse border border-black table-fixed ak-main-table">
                    <thead>
                        <tr className="bg-gray-100 text-black print:bg-gray-100" style={{ fontSize: FSE }}>
                            <th className="border border-black p-2 font-bold w-[8%] text-center english-font">Q. No</th>
                            <th className="border border-black p-2 font-bold w-[8%] text-center english-font">Score</th>
                            <th className="border border-black p-2 font-bold w-[49%] text-center english-font">Answer / Value Points</th>
                            <th className="border border-black p-2 font-bold w-[35%] text-center english-font">Further Information</th>
                        </tr>
                    </thead>
                    {allRowsJsx}
                </table>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                ${sharedStyles(FST, FSE)}
                
                @media screen {
                    .ak-view-root {
                        background-color: #f3f4f6;
                    }
                }

                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 15mm 15mm 22mm 15mm;
                        @bottom-left {
                            content: "${paperCodeGI}";
                            font-family: 'Times New Roman', serif;
                            font-size: 10pt;
                            font-weight: bold;
                            color: #000;
                        }
                        @bottom-center {
                            content: counter(page);
                            font-family: 'Times New Roman', serif;
                            font-size: 10pt;
                            color: #000;
                        }
                        @bottom-right {
                            content: "${paperCodeGI}";
                            font-family: 'Times New Roman', serif;
                            font-size: 10pt;
                            font-weight: bold;
                            color: #000;
                        }
                    }
                    body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .ak-view-root {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        overflow: visible !important;
                    }
                    .ak-paper-container {
                        width: 100% !important;
                        min-height: 0 !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                    }
                    .ak-main-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    tbody {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    tbody.allow-break {
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    /* Hide any Edit Blueprint header/icon outside the answer key paper */
                    .ak-view-root ~ * ,
                    [class*="edit-blueprint"],
                    [class*="blueprint-header"],
                    [data-print-hide="true"] {
                        display: none !important;
                    }
                    .ak-hdr {
                        page-break-after: avoid !important;
                    }
                }

                .ak-main-table td {
                    vertical-align: top;
                }
                .ak-main-table th {
                    vertical-align: middle;
                }
                
                /* Ensure Tamil fonts are properly loaded/applied */
                .tamil-font {
                    font-family: 'TAU-Paalai', 'Latha', sans-serif !important;
                }
            ` }} />
        </div>
    );
};

export default AnswerKeyView;

// =============================================================================
// PDF HTML GENERATOR  –  Use this with Puppeteer for pixel-perfect PDF export
// =============================================================================

export const generateAnswerKeyPdfHtml = (
    blueprint: Blueprint,
    curriculum: Curriculum | null,
    discourses: Discourse[] = [],
    settings?: ReportSettings
): string => {
    // ── settings ────────────────────────────────────────────────────────────
    const s = settings || { orientation: 'p', paperSize: 'A4', fontSizeTamil: 14, fontSizeEnglish: 11 };
    const isLandscape = s.orientation === 'l';
    const paperSize = s.paperSize || 'A4';
    const FST = s.fontSizeTamil ? `${s.fontSizeTamil}pt` : '14pt';
    const FSE = s.fontSizeEnglish ? `${s.fontSizeEnglish}pt` : (s.fontSizeBody ? `${s.fontSizeBody}pt` : '11pt');

    const pageWidth = paperSize === 'Legal'
        ? (isLandscape ? '355.6mm' : '215.9mm')
        : (isLandscape ? '297mm' : '210mm');
    const pageHeight = paperSize === 'Legal'
        ? (isLandscape ? '215.9mm' : '355.6mm')
        : (isLandscape ? '210mm' : '297mm');

    // ── unit order map ───────────────────────────────────────────────────────
    const unitOrderMap = new Map<string, number>();
    curriculum?.units.forEach((u: Unit) => unitOrderMap.set(u.id, u.unitNumber));

    const sortedItems = [...blueprint.items].sort((a, b) => {
        if (a.marksPerQuestion !== b.marksPerQuestion) return a.marksPerQuestion - b.marksPerQuestion;
        return (unitOrderMap.get(a.unitId) || 999) - (unitOrderMap.get(b.unitId) || 999);
    });

    // ── derived values ───────────────────────────────────────────────────────
    const academicYear = blueprint.academicYear || getAcademicYear();
    const paperCodeGI = getPaperCode(blueprint, true);
    const paperCodeT = getPaperCode(blueprint, false);
    const subjectTitle = getSubjectTitle(blueprint);
    const termHeading = getTermHeading(blueprint, academicYear);
    const setLetter = (blueprint.setId || 'A').replace(/SET\s+/i, '').trim().charAt(0).toUpperCase();

    // ── header HTML ──────────────────────────────────────────────────────────
    const termMap: Record<string, string> = {
        'First Term Summative': 'முதல் பருவ தொகுத்தறி மதிப்பீடு',
        'Second Term Summative': 'இரண்டாம் பருவ தொகுத்தறி மதிப்பீடு',
        'Third Term Summative': 'மூன்றாம் பருவ தொகுத்தறி மதிப்பீடு',
        'First Term Formative': 'முதல் பருவ உருவாக்க மதிப்பீடு',
        'Second Term Formative': 'இரண்டாம் பருவ உருவாக்க மதிப்பீடு',
        'Annual Examination': 'ஆண்டு இறுதித் தேர்வு',
    };
    const examTitle = `${termMap[blueprint.examTerm] ?? blueprint.examTerm} ${blueprint.academicYear || ''}`;

    const isAT = blueprint.subject.includes('AT');
    const subjectEnglish = isAT ? "First Language Paper I" : "First Language Paper II";
    const subjectTamil = isAT ? "தமிழ் முதல் தாள்" : "தமிழ் இரண்டாம் தாள்";
    const subjectCode = isAT ? "AT" : "BT";

    const headerHtml = `
<div style="page-break-inside:avoid;break-inside:avoid;border:1px solid #000;margin-bottom:20px;color:#000;">

  <!-- Row 1: Set | Title | PaperCode -->
  <div style="display:flex;align-items:center;padding:8px 10px;gap:8px;">
    <div style="border:1.5px solid #000;min-width:40px;height:40px;display:flex;
                align-items:center;justify-content:center;font-size:16pt;
                font-weight:bold;font-family:'Times New Roman',serif;flex-shrink:0;">
      ${setLetter}
    </div>
    <div style="flex:1;text-align:center;line-height:1.5;">
      <div style="font-family:'TAU-Paalai','Latha',serif;font-size:15pt;font-weight:bold;">
        சமக்ர சிக்ஷா கேரளம்
      </div>
      <div style="font-family:'TAU-Paalai','Latha',serif;font-size:12pt;">
        ${examTitle}
      </div>
      <div style="font-family:'Times New Roman',serif;font-size:11pt;font-weight:bold;">
        ${subjectEnglish}
      </div>
      <div style="font-family:'TAU-Paalai','Latha',serif;font-size:11pt;">
        ${subjectTamil} (${subjectCode})
      </div>
    </div>
    <div style="border:1.5px solid #000;min-width:70px;padding:4px 8px;text-align:center;
                font-size:11pt;font-weight:bold;font-family:'Times New Roman',serif;
                flex-shrink:0;white-space:nowrap;">
      ${paperCodeGI}
    </div>
  </div>

  <!-- Row 2: Time / Class -->
  <div style="display:flex;justify-content:space-between;padding:10px 10px;
              font-family:'TAU-Paalai','Latha',serif;font-size:11pt;">
    <div style="font-weight:bold;">
      <div>நேரம்: 90 நிமிடம்</div>
      <div>சிந்தனை நேரம்: 15 நிமிடம்</div>
    </div>
    <div style="text-align:right;font-weight:bold;">
      <div>வகுப்பு: <span style="font-family:'Times New Roman',serif;">${blueprint.classLevel}</span></div>
      <div>மதிப்பெண்: <span style="font-family:'Times New Roman',serif;">${fmtMarksStr(blueprint.totalMarks)}</span></div>
    </div>
  </div>

  <!-- Row 3: Section title -->
  <div style="text-align:center;font-family:'Times New Roman',serif;font-size:11pt;
              font-weight:bold;letter-spacing:2px;padding:8px 0;border-top:1.5px solid #000;border-bottom:1.5px solid #000;">
    ANSWER KEY &amp; SCORING INDICATORS
  </div>

</div>
`;

    // ── table header ─────────────────────────────────────────────────────────
    const tableHeaderHtml = `
      <thead>
        <tr style="background:#f9fafb;color:#000;font-size:${FSE};">
          <th style="border:1px solid #000;padding:4px;width:8%;text-align:center;font-family:'Times New Roman',serif;font-size:${FSE};font-weight:normal;">Q. No</th>
          <th style="border:1px solid #000;padding:4px;width:8%;text-align:center;font-family:'Times New Roman',serif;font-size:${FSE};font-weight:normal;">Score</th>
          <th style="border:1px solid #000;padding:4px;width:49%;text-align:center;font-family:'Times New Roman',serif;font-size:${FSE};font-weight:normal;">Answer / Value Points</th>
          <th style="border:1px solid #000;padding:4px;width:35%;text-align:center;font-family:'Times New Roman',serif;font-size:${FSE};font-weight:normal;">Further Information</th>
        </tr>
      </thead>`;

    // ── Q.No cell builder ─────────────────────────────────────────────────────
    const qNoTd = (num: number, suffix?: string) => `
      <td style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;font-size:13px;vertical-align:middle;">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.3;">
          <span style="font-family:'Times New Roman',serif;">${num}</span>
          ${suffix ? `<span style="font-family:'TAU-Paalai',serif;font-size:10px;">${suffix}</span>` : ''}
        </div>
      </td>`;

    // ── table rows ────────────────────────────────────────────────────────────
    const rowsHtml = sortedItems.map((item, index) => {
        const ansA = buildItemAnswerHtml(item, discourses, false);
        const ansB = buildItemAnswerHtml(item, discourses, true);
        const furtherA = buildFurtherInfoHtml(item.furtherInfo);
        const furtherB = buildFurtherInfoHtml(item.furtherInfoB);

        const ansCell = (html: string) =>
            html
                ? `<div class="answer-key-content" style="font-family:'TAU-Paalai','Times New Roman',serif;font-size:${FST};line-height:1.3;">${html}</div>`
                : `<span style="color:#9ca3af;font-style:italic;font-size:11px;">(விடை சேர்க்கப்படவில்லை)</span>`;

        const furtherCell = (html: string) =>
            html ? `<div style="font-family:'TAU-Paalai',serif;font-size:${FST};white-space:pre-wrap;line-height:1.3;">${html}</div>` : '';

        const tbodyClass = item.marksPerQuestion <= 2
            ? ' class="avoid-break"'
            : ' class="allow-break"';

        if (!item.hasInternalChoice) {
            return `
              <tbody${tbodyClass}>
                <tr style="color:#000;min-height:30px;">
                  ${qNoTd(index + 1)}
                  <td style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;font-family:'Times New Roman',serif;font-size:13px;">${fmtMarksStr(item.marksPerQuestion)}</td>
                  <td style="border:1px solid #000;padding:4px;text-align:left;">${ansCell(ansA)}</td>
                  <td style="border:1px solid #000;padding:4px;vertical-align:top;font-size:13px;">${furtherCell(item.enableFurtherInfo ? furtherA : '')}</td>
                </tr>
              </tbody>`;
        }

        return `
          <tbody${tbodyClass}>
            <tr style="color:#000;min-height:30px;">
              ${qNoTd(index + 1, '(அ)')}
              <td style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;font-family:'Times New Roman',serif;font-size:13px;">${fmtMarksStr(item.marksPerQuestion)}</td>
              <td style="border:1px solid #000;padding:4px;text-align:left;">${ansCell(ansA)}</td>
              <td style="border:1px solid #000;padding:4px;vertical-align:top;font-size:13px;">${furtherCell(item.enableFurtherInfo ? furtherA : '')}</td>
            </tr>
            <tr style="color:#000;min-height:30px;">
              ${qNoTd(index + 1, '(ஆ)')}
              <td style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;font-family:'Times New Roman',serif;font-size:13px;">${fmtMarksStr(item.marksPerQuestion)}</td>
              <td style="border:1px solid #000;padding:4px;text-align:left;">${ansCell(ansB)}</td>
              <td style="border:1px solid #000;padding:4px;vertical-align:top;font-size:13px;">${furtherCell(item.enableFurtherInfoB ? furtherB : '')}</td>
            </tr>
          </tbody>`;
    }).join('');

    // ── complete HTML document ────────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="ta">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Answer Key – ${blueprint.subject}</title>
  <style>
    /* ── Page layout ── */
    @page {
      size: ${pageWidth} ${pageHeight};
      margin: 15mm 15mm 22mm 15mm;
      @bottom-left {
        content: "${paperCodeGI}";
        font-family: 'Times New Roman', serif;
        font-size: 10pt;
        font-weight: bold;
        color: #000;
      }
      @bottom-center {
        content: counter(page) " / " counter(pages);
        font-family: 'Times New Roman', serif;
        font-size: 10pt;
        color: #000;
      }
      @bottom-right {
        content: "${paperCodeGI}";
        font-family: 'Times New Roman', serif;
        font-size: 10pt;
        font-weight: bold;
        color: #000;
      }
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: #fff;
      color: #000;
    }
    body {
      font-family: 'TAU-Paalai', 'Times New Roman', serif;
      font-size: ${FST};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Page break control ── */
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    /* Allow long rows (3+ mark questions) to break across pages naturally */
    tbody.allow-break {
      page-break-inside: auto;
      break-inside: auto;
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    /* ── Shared component styles ── */
    ${sharedStyles(FST, FSE)}

    /* ── Answer content ── */
    .answer-key-content p { margin: 0 0 2px 0; }

    /* ── Print footer via Puppeteer displayHeaderFooter ──
       CSS @page @bottom-* rules above handle WeasyPrint/paged.js.
       For Puppeteer, use displayHeaderFooter:true with footerTemplate containing
       pageNumber and totalPages spans, plus paperCode on left and right.
       Set margin.bottom to '22mm' to accommodate the footer height.
    */
  </style>
</head>
<body>
  <div class="pdf-page" style="position:relative; min-height:${pageHeight}; padding-bottom:20mm;" data-paper-code="${paperCodeGI}">
    ${headerHtml}
    <table>
      ${tableHeaderHtml}
      ${rowsHtml}
    </table>
  </div>
</body>
</html>`;
};
