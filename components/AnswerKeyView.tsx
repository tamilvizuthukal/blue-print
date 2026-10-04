import React from 'react';
import { FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { Blueprint, BlueprintItem, Curriculum, Unit, Discourse, ReportSettings } from '../types';
import { getTermTamilMap, sortBlueprintItems } from '../utils/reportCalculations';

interface AnswerKeyViewProps {
    blueprint: Blueprint;
    curriculum: Curriculum | null;
    discourses?: Discourse[];
    settings?: ReportSettings;
    isExportMode?: boolean;
    onConfirmAnswerKey?: () => void;
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

const parseAnswerText = (text: string) => {
    if (!text) return { prefix: '', content: '' };
    
    // 1. Check for standard bullets
    const bulletRegex = /^(\s*)([•▪➢➔✔★❖✅])(\s*)([\s\S]*)/;
    const bulletMatch = text.match(bulletRegex);
    if (bulletMatch) {
        return {
            prefix: bulletMatch[2],
            content: (bulletMatch[3] || '') + bulletMatch[4]
        };
    }
    
    // 2. Check for numberings like 'அ)', '1)', 'a)', '(அ)', '[1]', '1.', 'அ.'
    const numberRegex = /^(\s*)((?:[(\[]?[அ-ஹ\u0B80-\u0BFF\w\d]+[)\]]|\b[அ-ஹ\u0B80-\u0BFF\w\d]+\.))(\s*)([\s\S]*)/;
    const numberMatch = text.match(numberRegex);
    if (numberMatch) {
        return {
            prefix: numberMatch[2],
            content: (numberMatch[3] || '') + numberMatch[4]
        };
    }
    
    return {
        prefix: '',
        content: text
    };
};

const normalizeAnswerHtml = (html?: string) => {
    if (!html) return '';
    
    // Strip 'M' suffix from marks (e.g. 0.5M -> 0.5)
    let cleaned = html.replace(/(\d+(?:\.\d+)?)M\b/g, '$1');
    
    // Replace &nbsp;
    cleaned = cleaned.replace(/&nbsp;/g, ' ');
    
    // Replace 0.5, .5, 1/2, and X.5 with ½ and X½ respectively, avoiding HTML tags/attributes
    return cleaned.replace(/(<[^>]+>)|((?:[1-9]\d*|0)?(?:\.5|1\/2)(?![0-9]))/g, (match, tag, scoreMatch) => {
        if (tag) return tag; // Return HTML tag unmodified
        if (scoreMatch === '0.5' || scoreMatch === '.5' || scoreMatch === '1/2') return '½';
        return scoreMatch.replace(/\.5|1\/2/, '½');
    });
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
    return `${prefix}-${base}`;
};

const getSubjectTitle = (blueprint: Blueprint) => {
    if (blueprint.subject.includes('AT'))
        return { tamil: 'தமிழ் முதல் தாள்', eng: 'Tamil First Language Paper I (AT)' };
    return { tamil: 'தமிழ் இரண்டாம் தாள்', eng: 'Tamil First Language Paper II (BT)' };
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

const renderTimesNewRomanNumbers = (text: string) =>
    text.split(/(\d+(?:-\d+)*)/g).map((part, index) =>
        /^\d/.test(part)
            ? <span key={index} style={{ fontFamily: "'Times New Roman', serif" }}>{part}</span>
            : part
    );

const wrapTimesNewRomanNumbers = (text: string) =>
    text.replace(/(\d+(?:-\d+)*)/g, '<span style="font-family:\'Times New Roman\',serif;">$1</span>');

const buildItemAnswerHtml = (
    item: BlueprintItem,
    discourses: Discourse[],
    isOptionB = false
): string => {
    const enableInput = isOptionB ? item.enableInputAnswerB : item.enableInputAnswer;
    const structured = isOptionB ? item.structuredAnswersB : item.structuredAnswers;
    const writeContent = isOptionB ? item.answerTextB : item.answerText;
    const discourseId = isOptionB ? item.discourseIdB : item.discourseId;

    const parts: string[] = [];

    // 1. Answer Content (which includes headings, paragraphs, bullets, images, marks if generated by UniversalAnswerBuilder)
    if (writeContent && writeContent.trim()) {
        parts.push(`<div class="write-content-section">${writeContent}</div>`);
    } else {
        // Fallback for old blueprints that only had structuredAnswers
        const structured = isOptionB ? item.structuredAnswersB : item.structuredAnswers;
        if (enableInput && structured && structured.length > 0) {
            const sHtml = `<div class="structured-container">` +
                structured.map(v => {
                    const { prefix, content } = parseAnswerText(v.answer);
                    if (prefix) {
                        return `<div class="structured-item" style="padding-left: 0px;"><span class="rubric-point" style="display:flex;align-items:flex-start;width:100%;"><span style="flex-shrink:0;white-space:pre;text-align:left;font-family:'Times New Roman','TAU-Paalai',serif;width:24px;">${prefix}</span><span style="flex-grow:1;padding-left:0px;">${content}</span></span><strong class="rubric-mark english-font">${v.mark}</strong></div>`;
                    } else {
                        return `<div class="structured-item"><span class="rubric-point">${v.answer}</span><strong class="rubric-mark english-font">${v.mark}</strong></div>`;
                    }
                }).join('') +
                `</div>`;
            parts.push(sHtml);
        }
    }

    // 2. Discourse
    if (discourseId && discourses.length > 0) {
        const d = discourses.find(x => x.id === discourseId);
        if (d) {
            let dHtml = `
                <div class="discourse-template" style="margin-left: 0px; margin-top: 8px; margin-bottom: 8px; width: 100%;">
                    <div class="discourse-title" style="margin-left: 0px; font-weight: bold; font-family: 'TAU-Paalai', serif !important;">${d.name}</div>
                    <table class="discourse-indicators-table" style="width: calc(100% - 48px); border: none !important; border-collapse: collapse; margin-left: 48px; margin-top: 4px;">
                        <tbody>
                            ${(d.rubrics || []).map(r => `
                                <tr style="border: none;">
                                    <td class="tamil-font" style="border: none; padding: 2px 0; text-align: left; font-family: 'Times New Roman', 'TAU-Paalai', serif !important; line-height: 1.3;">${r.point}</td>
                                    <td class="english-font" style="border: none; padding: 2px 0; text-align: right; font-weight: bold; font-family: 'Times New Roman', serif !important; padding-right: 8px !important; line-height: 1.3;">${fmtMarksStr(r.marks)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            parts.push(dHtml);
        }
    }

    if (parts.length === 0) return '';
    return normalizeAnswerHtml(parts.join('<div class="sep-line"></div>'));
};

const buildFurtherInfoHtml = (text?: string): string => {
    if (!text) return '';
    
    // Clean up legacy Discourse tables that were accidentally saved into Further Info
    if (text.includes('<table') && text.includes('border-collapse: collapse; border: 1px solid black;')) {
        text = text.replace(/<table[\s\S]*?<\/table>/gi, '');
        if (!text.trim()) return '';
    }

    const hasTags = /<[a-z][\s\S]*>/i.test(text);
    if (hasTags) return text;
    return text.split('\n').map(line => wrapEnglishAndNumbers(line)).join('<br />');
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared CSS string  (embedded in both HTML view <style> and the PDF HTML doc)
// ─────────────────────────────────────────────────────────────────────────────

const sharedStyles = (FST: string, FSE: string, fontFamily = 'TAU-Paalai', fontFamilyEnglish = 'Times New Roman') => `
.tamil-font {
    font-family: '${fontFamily}', serif !important;
    font-size: ${FST};
    line-height: 1.05;
}
.tamil-heading-font {
    font-family: 'TAU-Urai', serif !important;
    font-weight: 700;
}
.english-font {
    font-family: '${fontFamilyEnglish}', serif !important;
    font-size: ${FSE};
}
.answer-key-content {
    width: 100%;
    font-family: '${fontFamilyEnglish}', '${fontFamily}', serif !important;
}
.answer-key-content p { margin: 0 0 0.1rem 0; }
.rubric-mark {
    font-weight: bold;
    min-width: 1.5rem;
    text-align: right;
    color: #000;
    line-height: 1.4;
    margin-left: auto;
    display: inline-block;
    padding-right: 8px;
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
.rubric-container, .structured-container {
    width: 100%;
    margin-top: 4px;
}
.rubric-item, .structured-item {
    display: flex !important;
    align-items: flex-start !important;
    gap: 0.4rem !important;
    padding: 0.05rem 0 !important;
    width: 100%;
}
.rubric-point {
    flex: 1;
    line-height: 1.3;
    font-family: 'Times New Roman', 'TAU-Paalai', serif !important;
}

/* Overrides for legacy inline styles saved in answerText */
.answer-bullet-row {
    margin-left: 0px !important;
    margin-top: 0.35rem !important;
    margin-bottom: 0.35rem !important;
    column-gap: 0.2rem !important;
    line-height: 1.45 !important;
}
.answer-bullet-symbol {
    width: 24px !important;
    min-width: 24px !important;
    font-family: 'Segoe UI Symbol', 'Noto Sans Symbols 2', 'Arial Unicode MS', 'Times New Roman', serif !important;
    font-size: 1em !important;
    line-height: 1.45 !important;
}
.answer-key-content table, 
.answer-key-content td, 
.answer-key-content th,
.answer-key-content tr {
    border: none !important;
}

/* Standard lists inside user answers (SimpleRichTextEditor output) */
.answer-key-content ul {
    list-style-position: outside !important;
    padding-left: 1.5rem !important;
    margin: 0.4rem 0 !important;
}
.answer-key-content ul li {
    display: list-item !important;
    list-style-type: disc !important;
    padding: 0.1rem 0 !important;
}
.answer-key-content ul.custom-bullet-list {
    list-style-position: outside !important;
    padding-left: 1.5rem !important;
    margin: 0.4rem 0 !important;
}
.answer-key-content ul.custom-bullet-list li {
    display: list-item !important;
    list-style-type: inherit !important;
    padding: 0.1rem 0 !important;
}
.answer-key-content ol {
    list-style-position: outside !important;
    padding-left: 1.5rem !important;
    margin: 0.4rem 0 !important;
}
.answer-key-content ol li {
    display: list-item !important;
    list-style-type: decimal !important;
    padding: 0.1rem 0 !important;
}
.discourse-template {
    margin-left: 0px;
    margin-top: 8px;
    margin-bottom: 8px;
    width: 100%;
}
.discourse-title {
    margin-left: 0px;
    font-weight: bold;
    font-size: 1.12em !important;
    line-height: 1.35 !important;
    margin-bottom: 0.2rem !important;
}
.further-information-content {
    font-size: calc(${FSE} - 1pt) !important;
    line-height: 1.35 !important;
}
.discourse-indicators-table {
    width: 100%;
    border: none !important;
    border-collapse: collapse !important;
    margin-left: 8px !important;
    margin-top: 4px !important;
}
.discourse-indicators-table tr, .discourse-indicators-table td {
    border: none !important;
    padding: 2px 0 !important;
}
.discourse-indicators-table td:first-child {
    text-align: left !important;
}
.discourse-indicators-table td:last-child {
    text-align: right !important;
    font-weight: bold !important;
    padding-right: 4px !important;
}
.discourse-details { margin-left: 1.5rem; }
.rubric-point { flex-grow: 1; line-height: 1.3; font-family: 'Times New Roman', 'TAU-Paalai', serif !important; }
.sep-line { margin: 2px 0; }
.qno-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.3; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// React HTML-view component
// ─────────────────────────────────────────────────────────────────────────────

const AnswerKeyView = ({ blueprint, curriculum, discourses = [], settings, isExportMode = false, onConfirmAnswerKey }: AnswerKeyViewProps) => {
    if (!blueprint) return null;
    const activeSettings = (settings || { orientation: 'p', paperSize: 'A4', fontSizeTamil: 14, fontSizeEnglish: 11 }) as any;

    const isLandscape = activeSettings.orientation === 'l';
    const paperSize = activeSettings.paperSize || 'A4';
    const FST = activeSettings.fontSizeTamil ? `${activeSettings.fontSizeTamil}pt` : '14pt';
    const FSE = activeSettings.fontSizeEnglish ? `${activeSettings.fontSizeEnglish}pt` : (activeSettings.fontSizeBody ? `${activeSettings.fontSizeBody}pt` : '11pt');

    const containerWidth = paperSize === 'Legal'
        ? (isLandscape ? '355.6mm' : '215.9mm')
        : (isLandscape ? '297mm' : '210mm');

    const isAnswerOptionFilled = (item: BlueprintItem, isB: boolean) => {
        const prefix = isB ? 'B' : '';
        const text = item[`answerText${prefix}` as keyof BlueprintItem] as string;
        const discId = item[`discourseId${prefix}` as keyof BlueprintItem] as string;
        const struct = item[`structuredAnswers${prefix}` as keyof BlueprintItem] as any[];
        const blocks = item[`answerBlocks${prefix}` as keyof BlueprintItem] as any[];
        const hasText = !!text && (/<img\b/i.test(text) || text.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() !== '');
        const hasStructuredAnswers = !!struct?.some(v => !!v?.answer?.trim());
        const hasAnswerBlocks = !!blocks?.some(block =>
            !!block?.imageUrl ||
            !!block?.tableRows?.some((row: unknown[]) => row.some(cell => String(cell ?? '').trim())) ||
            !!block?.content?.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
        );

        // Existing blueprints may have valid answer content while their legacy
        // enable flags are unset. Validate the actual answer instead of treating
        // those records as blank. Further Information is optional.
        return hasText || !!discId?.trim() || hasStructuredAnswers || hasAnswerBlocks;
    };

    const answerValidationErrors = React.useMemo(() => {
        const errors: string[] = [];
        let missingCount = 0;
        blueprint.items.forEach(item => {
            if (!isAnswerOptionFilled(item, false)) missingCount++;
            if (item.hasInternalChoice && !isAnswerOptionFilled(item, true)) missingCount++;
        });
        if (missingCount > 0) {
            errors.push(`${missingCount} வினாக்களுக்கான விடைகள் இன்னும் முழுமையாக பூர்த்தி செய்யப்படவில்லை.`);
        }
        return errors;
    }, [blueprint.items]);

    const isAnswerConfirmable = answerValidationErrors.length === 0;

    const sortedItems = React.useMemo(() =>
        sortBlueprintItems(blueprint.items, curriculum),
        [blueprint.items, curriculum]
    );

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
                    style={{ fontFamily: isTamil ? `'TAU-Paalai',serif` : `'Times New Roman',serif` }}>
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
            <div style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 10px', gap: '8px' }}>
                <div style={{
                    background: '#000000',
                    color: '#ffffff',
                    padding: '7px 13px',
                    borderRadius: '2px',
                    fontSize: '18pt',
                    fontWeight: 'bold',
                    fontFamily: "'Times New Roman', serif",
                    flexShrink: 0,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    alignSelf: 'flex-start',
                    marginTop: '2px',
                }}>
                    {setLetter}
                </div>

                <div style={{ flex: 1, textAlign: 'center', lineHeight: '1.5' }}>
                    <h1 style={{ margin: 0, fontFamily: "'TAU-Urai', serif", fontSize: '25pt', lineHeight: 1.2, fontWeight: 'bold' }}>
                        சமக்ர சிக்ஷா கேரளம்
                    </h1>
                    <h2 style={{ margin: 0, fontFamily: "'TAU-Paalai', serif", fontSize: '19pt', lineHeight: 1.25, fontWeight: 'bold' }}>
                        {renderTimesNewRomanNumbers(examTitle)}
                    </h2>
                    <h4 style={{ margin: 0, fontFamily: "'Times New Roman', serif", fontSize: '13pt', lineHeight: 1.25, fontWeight: 'bold' }}>
                        {subjectEnglish}
                    </h4>
                    <h4 style={{ margin: 0, fontFamily: "'TAU-Paalai', serif", fontSize: '13pt', lineHeight: 1.25, fontWeight: 'bold' }}>
                        {subjectTamil} (<span style={{ fontFamily: "'Times New Roman', serif" }}>{subjectCode}</span>)
                    </h4>
                </div>

                <div style={{
                    background: '#000000',
                    color: '#ffffff',
                    padding: '7px 13px',
                    borderRadius: '2px',
                    fontSize: '13pt',
                    fontWeight: 'bold',
                    fontFamily: "'Times New Roman', serif",
                    flexShrink: 0,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    alignSelf: 'flex-start',
                    marginTop: '2px',
                }}>
                    {paperCodeGI}
                </div>
            </div>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 10px',
                fontFamily: "'TAU-Paalai', serif",
                fontSize: '11pt',
            }}>
                <div style={{ fontWeight: 'bold' }}>
                    <div>நேரம்: <span className="english-font">90</span> நிமிடம்</div>
                    <div>சிந்தனை நேரம்: <span className="english-font">15</span> நிமிடம்</div>
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
                borderTop: '1px solid #000000',
                borderBottom: '1px solid #000000',
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
            {!isExportMode && (
                <div className="mb-6 p-4 rounded-2xl border transition-all no-print bg-white shadow-sm max-w-[210mm] mx-auto w-full">
                    {blueprint.isAnswerKeyConfirmed ? (
                        <div className="flex items-center justify-between bg-emerald-50 border-emerald-200 p-4 rounded-xl text-emerald-800">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
                                <div>
                                    <h4 className="font-bold text-sm">Answer Key Confirmed</h4>
                                    <p className="text-xs opacity-90 mt-0.5">Answer key has been confirmed successfully.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border ${isAnswerConfirmable ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                            <div className="flex items-start gap-3">
                                {isAnswerConfirmable ? (
                                    <CheckCircle2 className="text-blue-500 shrink-0 mt-0.5" size={24} />
                                ) : (
                                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={24} />
                                )}
                                <div>
                                    <h4 className="font-bold text-sm">
                                        {isAnswerConfirmable 
                                            ? 'Ready to Confirm' 
                                            : 'Pending Confirmation'
                                        }
                                    </h4>
                                    {answerValidationErrors.length > 0 ? (
                                        <ul className="text-xs list-disc list-inside mt-1 space-y-0.5 opacity-90">
                                            {answerValidationErrors.map((err, idx) => (
                                                <li key={idx}>{err}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs opacity-90 mt-0.5">All answers have been filled out correctly.</p>
                                    )}
                                </div>
                            </div>
                            {isAnswerConfirmable && onConfirmAnswerKey && (
                                <button
                                    onClick={async () => {
                                        const res = await Swal.fire({
                                            title: 'Are you sure?',
                                            text: 'Once confirmed, you will not be able to edit the answer key. Do you want to proceed?',
                                            icon: 'warning',
                                            showCancelButton: true,
                                            confirmButtonColor: '#2563eb',
                                            cancelButtonColor: '#64748b',
                                            confirmButtonText: 'ஆம், உறுதிசெய்',
                                            cancelButtonText: 'ரத்து செய்'
                                        });
                                        if (res.isConfirmed) {
                                            onConfirmAnswerKey();
                                        }
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-100 flex items-center gap-1.5 shrink-0 self-start md:self-center cursor-pointer border-0"
                                >
                                    <CheckCircle2 size={14} /> Confirm Answer Key
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
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
                            <th className="border border-black p-2 font-bold w-[59%] text-center english-font">Answer / Value Points</th>
                            <th className="border border-black p-2 font-bold w-[25%] text-center english-font">Further Information</th>
                        </tr>
                    </thead>
                    {allRowsJsx}
                </table>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                ${sharedStyles(FST, FSE, activeSettings.fontFamily, activeSettings.fontFamilyEnglish)}
                
                /* Dynamic font size overrides for HTML view */
                .ak-view-root,
                .ak-view-root table,
                .ak-view-root th,
                .ak-view-root td,
                .ak-view-root div,
                .ak-view-root span,
                .ak-view-root p {
                    font-size: ${FSE};
                }
                .ak-view-root .tamil-font {
                    font-size: ${FST} !important;
                    font-family: '${activeSettings.fontFamily || 'TAU-Paalai'}', serif !important;
                }
                .ak-view-root .english-font {
                    font-size: ${FSE} !important;
                    font-family: '${activeSettings.fontFamilyEnglish || 'Times New Roman'}', serif !important;
                }
                .ak-view-root .further-information-content {
                    font-size: calc(${FSE} - 1pt) !important;
                    line-height: 1.35 !important;
                }
                .ak-view-root .discourse-title {
                    font-size: calc(${FST} + 1pt) !important;
                    line-height: 1.35 !important;
                }
                .ak-view-root .text-sm,
                .ak-view-root .text-xs,
                .ak-view-root td,
                .ak-view-root th,
                .ak-view-root div {
                    font-size: ${FSE} !important;
                }

                @media screen {
                    .ak-view-root {
                        background-color: #f3f4f6;
                    }
                }

                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 20mm 15mm 18mm 15mm;
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
                    font-family: 'TAU-Paalai', serif !important;
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
    const s = (settings || { orientation: 'p', paperSize: 'A4', fontSizeTamil: 14, fontSizeEnglish: 11 }) as any;
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

    const sortedItems = sortBlueprintItems(blueprint.items, curriculum);

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
  <div style="display:flex;align-items:flex-start;padding:8px 10px;gap:8px;">
    <div style="background:#000000;color:#ffffff;border-radius:2px;padding:6px 12px;
                font-size:18pt;font-weight:bold;font-family:'Times New Roman',serif;
                flex-shrink:0;text-align:center;white-space:nowrap;display:inline-block;align-self:flex-start;margin-top:2px;">
      ${setLetter}
    </div>
    <div style="flex:1;text-align:center;line-height:1.5;">
      <h1 style="margin:0;font-family:'TAU-Urai',serif;font-size:25pt;line-height:1.2;font-weight:bold;">
        சமக்ர சிக்ஷா கேரளம்
      </h1>
      <h2 style="margin:0;font-family:'TAU-Paalai',serif;font-size:19pt;line-height:1.25;font-weight:bold;">
        ${wrapTimesNewRomanNumbers(examTitle)}
      </h2>
      <h4 style="margin:0;font-family:'Times New Roman',serif;font-size:13pt;line-height:1.25;font-weight:bold;">
        ${subjectEnglish}
      </h4>
      <h4 style="margin:0;font-family:'TAU-Paalai',serif;font-size:13pt;line-height:1.25;font-weight:bold;">
        ${subjectTamil} (<span style="font-family:'Times New Roman',serif;">${subjectCode}</span>)
      </h4>
    </div>
    <div style="background:#000000;color:#ffffff;border-radius:2px;padding:7px 13px;
                font-size:13pt;font-weight:bold;font-family:'Times New Roman',serif;
                flex-shrink:0;white-space:nowrap;text-align:center;display:inline-block;align-self:flex-start;margin-top:2px;">
      ${paperCodeGI}
    </div>
  </div>

  <!-- Row 2: Time / Class -->
  <div style="display:flex;justify-content:space-between;padding:10px 10px;
              font-family:'TAU-Paalai',serif;font-size:11pt;">
    <div style="font-weight:bold;">
      <div>நேரம்: <span style="font-family:'Times New Roman',serif;">90</span> நிமிடம்</div>
      <div>சிந்தனை நேரம்: <span style="font-family:'Times New Roman',serif;">15</span> நிமிடம்</div>
    </div>
    <div style="text-align:right;font-weight:bold;">
      <div>வகுப்பு: <span style="font-family:'Times New Roman',serif;">${blueprint.classLevel}</span></div>
      <div>மதிப்பெண்: <span style="font-family:'Times New Roman',serif;">${fmtMarksStr(blueprint.totalMarks)}</span></div>
    </div>
  </div>

  <!-- Row 3: Section title -->
  <div style="text-align:center;font-family:'Times New Roman',serif;font-size:11pt;
              font-weight:bold;letter-spacing:2px;padding:8px 0;border-top:1px solid #000000;border-bottom:1px solid #000000;">
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
          <th style="border:1px solid #000;padding:4px;width:59%;text-align:center;font-family:'Times New Roman',serif;font-size:${FSE};font-weight:normal;">Answer / Value Points</th>
          <th style="border:1px solid #000;padding:4px;width:25%;text-align:center;font-family:'Times New Roman',serif;font-size:${FSE};font-weight:normal;">Further Information</th>
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
                : `<span style="color:#000;font-style:italic;font-size:11px;">(விடை சேர்க்கப்படவில்லை)</span>`;

        const furtherCell = (html: string) =>
            html ? `<div class="further-information-content tamil-font" style="font-family:'TAU-Paalai',serif;white-space:pre-wrap;">${html}</div>` : '';

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
      margin: 20mm 15mm 18mm 15mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: #fff;
      color: #000;
    }
    body {
      font-family: 'Times New Roman', 'TAU-Paalai', serif;
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
    ${sharedStyles(FST, FSE, s.fontFamily, s.fontFamilyEnglish)}

    /* Dynamic font size overrides for PDF export */
    .pdf-page,
    .pdf-page table,
    .pdf-page th,
    .pdf-page td,
    .pdf-page div,
    .pdf-page span,
    .pdf-page p {
        font-size: ${FSE};
    }
    .pdf-page .tamil-font {
        font-size: ${FST} !important;
        font-family: '${s.fontFamily || 'TAU-Paalai'}', serif !important;
    }
    .pdf-page .english-font {
        font-size: ${FSE} !important;
        font-family: '${s.fontFamilyEnglish || 'Times New Roman'}', serif !important;
    }
    .pdf-page .further-information-content {
        font-size: calc(${FSE} - 1pt) !important;
        line-height: 1.35 !important;
    }
    .pdf-page .discourse-title {
        font-size: calc(${FST} + 1pt) !important;
        line-height: 1.35 !important;
    }
    .pdf-page td,
    .pdf-page th,
    .pdf-page div {
        font-size: ${FSE} !important;
    }

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
