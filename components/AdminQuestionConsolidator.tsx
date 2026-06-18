import React, { useEffect, useMemo, useState, useRef } from 'react';
import Swal from 'sweetalert2';
import { Check, Copy, FileText, Save, Loader2, RefreshCw, Download, FileDown, Printer } from 'lucide-react';
import { getBlueprints, getQuestionPaperTypes, saveBlueprint, getUsers } from '../services/db';
import { sanitizeHtml } from '../services/security';
import { Blueprint, QuestionPaperType, User } from '../types';
import PaginatedA4Editor from './PaginatedA4Editor';

const AdminQuestionConsolidator = () => {
    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
    const [paperTypes, setPaperTypes] = useState<QuestionPaperType[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
    const [copied, setCopied] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [workingText, setWorkingText] = useState('');

    const formatText = (text: string) => {
        if (!text) return '';
        return text.split('\n').map(line => {
            const tabbedLine = line.replace(/\t/g, '    ');
            if (!tabbedLine.trim()) return '';
            return tabbedLine.replace(/([A-Za-z0-9\-\:\(\)\.\,\|]+)/g, '<span style="font-family: \'Times New Roman\', serif;">$1</span>');
        }).join('<br/>');
    };

    const formatQuestionFonts = (html: string) => {
        if (!html) return '';
        if (typeof document === 'undefined') return html;
        try {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            const walk = (node: Node) => {
                if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).style.fontFamily?.includes('Times New Roman')) {
                    return;
                }
                
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent || '';
                    const regex = /([A-Za-z0-9\-\:\(\)\.\,\|]+)/g;
                    if (regex.test(text)) {
                        const span = document.createElement('span');
                        span.innerHTML = text.replace(regex, '<span style="font-family: \'Times New Roman\', serif;">$1</span>');
                        node.parentNode?.replaceChild(span, node);
                    }
                } else {
                    const children = Array.from(node.childNodes);
                    children.forEach(walk);
                }
            };
            
            walk(temp);
            return temp.innerHTML;
        } catch (e) {
            console.error("Error formatting question fonts:", e);
            return html;
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        const formattedHtml = formatText(text);
        document.execCommand('insertHTML', false, formattedHtml);
    };

    const refreshData = async () => {
        setIsRefreshing(true);
        try {
            const [bps, pts, allUsers] = await Promise.all([
                getBlueprints('all'), 
                getQuestionPaperTypes(),
                getUsers()
            ]);
            const filtered = (bps || []).filter(bp => bp.isConfirmed || bp.isAdminAssigned);
            const uniqueMap = new Map();
            filtered.forEach(bp => {
                const key = `${bp.classLevel}-${bp.subject}-${bp.setId || 'Set A'}-${bp.examTerm}-${bp.academicYear || getCurrentAcademicYear()}`;
                if (!uniqueMap.has(key) || (bp.isConfirmed && !uniqueMap.get(key).isConfirmed)) {
                    uniqueMap.set(key, bp);
                }
            });
            setBlueprints(Array.from(uniqueMap.values()));
            setPaperTypes(pts || []);
            setUsers(allUsers || []);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => { refreshData(); }, []);

    const userMap = useMemo(() => {
        const map: Record<string, string> = {};
        users.forEach(u => {
            map[u.id] = u.name;
        });
        return map;
    }, [users]);

    const selectedBlueprint = useMemo(() => blueprints.find(bp => bp.id === selectedBlueprintId), [blueprints, selectedBlueprintId]);
    const selectedPaperType = useMemo(() => paperTypes.find(t => t.id === selectedBlueprint?.questionPaperTypeId), [paperTypes, selectedBlueprint]);

    const formatMark = (m: number) => {
        const s = m.toString();
        if (s.endsWith('.5')) {
            const whole = s.split('.')[0];
            return whole === '0' ? '½' : `${whole}½`;
        }
        return s;
    };

    const toRoman = (num: number) => {
        const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        return roman[num - 1] || num.toString();
    };

    const generateHeaderHTML = (bp: Blueprint) => {
        const setLetter = (bp.setId || 'A').replace(/SET\s+/i, '').trim().charAt(0).toUpperCase();
        const subject = bp.subject.includes('BT') ? 'BT' : 'AT';
        const codeMap: Record<string, string> = {
            '10-AT': 'T 1002', '10-BT': 'T 1012', '9-AT': 'T 902', '9-BT': 'T 912', '8-AT': 'T 802', '8-BT': 'T 812'
        };
        const paperCode = codeMap[`${bp.classLevel}-${subject}`] || `T${bp.classLevel}${subject === 'AT' ? '02' : '12'}`;

        const year = (bp.academicYear || getCurrentAcademicYear()).replace(/^(\d{4})-(\d{2,4})$/, (_, start, end) => `${start}-${String(end).slice(-2)}`);

        let termHeading = `முதல்பருவத் தொகுத்தறி மதிப்பீடு ${year}`;
        if (bp.examTerm === 'Second Term Summative') termHeading = `இரண்டாம் பருவத் தொகுத்தறி மதிப்பீடு ${year}`;
        if (bp.examTerm === 'Third Term Summative') termHeading = `இறுதிப் பருவத் தொகுத்தறி மதிப்பீடு ${year}`;

        const subjectTitle = bp.subject.includes('AT')
            ? { tamil: 'தமிழ் முதல் தாள்', eng: 'Tamil Language Paper I (AT)' }
            : { tamil: 'தமிழ் இரண்டாம் தாள்', eng: 'Tamil Language Paper II (BT)' };

        return `<div style="margin-bottom: 20px; font-family: 'TAU-Paalai', serif; line-height: 1.2; text-align: center; color: #000;">
    <div style="position: relative; display: flex; justify-content: center; align-items: center; padding: 5px 0;">
        <div style="position: absolute; left: 0; top: 50%; transform: translateY(-50%);">
            <div style="border: 1px solid black; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.4em; font-family: Arial, sans-serif;">
                ${setLetter}
            </div>
        </div>
        <h1 style="font-weight: bold; font-size: 1.5em; margin: 0; letter-spacing: 0.5px;">சமக்ர சிக்ஷா கேரளம்</h1>
        <div style="position: absolute; right: 0; top: 50%; transform: translateY(-50%);">
            <div style="border: 1px solid black; padding: 5px 15px; font-size: 0.9em; font-weight: bold; font-family: Arial, sans-serif; min-width: 60px;">
                ${paperCode}
            </div>
        </div>
    </div>
    <div style="margin-top: 15px;">
        <h2 style="font-size: 1.2em; font-weight: bold; margin: 0;">${termHeading}</h2>
        <h2 style="font-size: 1.2em; font-weight: bold; margin: 8px 0 0 0;">${subjectTitle.tamil}</h2>
        <h3 style="font-size: 1.1em; font-weight: bold; margin: 5px 0 0 0; font-family: 'Times New Roman', serif;">${subjectTitle.eng}</h3>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: flex-end; font-weight: bold; margin-top: 20px; font-size: 1em; text-align: left;">
        <div style="line-height: 1.6;">நேரம்: 90 நிமிடம்<br/>சிந்தனை நேரம் : 15 நிமிடம்</div>
        <div style="text-align: right; line-height: 1.6;">வகுப்பு: ${bp.classLevel}<br/>மதிப்பெண்: ${formatMark(bp.totalMarks)}</div>
    </div>
    <div style="border-bottom: 1px solid black; margin-top: 15px;"></div>
    <div style="padding: 15px 0 5px 0; font-family: 'TAU-Paalai', serif; font-size: 1em; line-height: 1.6; text-align: left;">
        <div style="font-weight: bold; margin-bottom: 5px;">குறிப்புகள்:</div>
        <div style="margin-left: 10px;">
            <div style="display: flex; gap: 10px; margin-bottom: 3px;"><span>-</span><span>முதல் 15 நிமிடம் சிந்தனை நேரமாகும்.</span></div>
            <div style="display: flex; gap: 10px; margin-bottom: 3px;"><span>-</span><span>வினாக்களை வாசித்து விடைகளை வரிசைப்படுத்த இந்த நேரத்தைப் பயன்படுத்தலாம்.</span></div>
            <div style="display: flex; gap: 10px; margin-bottom: 3px;"><span>-</span><span>வினாக்களையும் குறிப்புகளையும் நன்கு வாசித்துப் புரிந்து விடையளிக்கவும்.</span></div>
            <div style="display: flex; gap: 10px; margin-bottom: 3px;"><span>-</span><span>விடையளிக்கும்போது மதிப்பெண், நேரம் போன்றவற்றை கவனித்து செயல்படவும்.</span></div>
        </div>
    </div>
    <div style="border-bottom: 1px solid black; margin-bottom: 20px;"></div>
    </div>`;
    };

    const buildFullQuestionPaperHTML = (bp: Blueprint, pt: QuestionPaperType | undefined): string => {
        const header = generateHeaderHTML(bp);
        const bpItems = bp.items || [];

        let questionContent = '';
        let qGlobalNo = 1;

        if (pt && pt.sections && pt.sections.length > 0) {
            const sectionIndexMap = new Map(pt.sections.map((section, idx) => [section.id, idx]));
            const orderedItems = [...bpItems].sort((a, b) => {
                const aIdx = a.sectionId ? sectionIndexMap.get(a.sectionId) ?? 999 : 999;
                const bIdx = b.sectionId ? sectionIndexMap.get(b.sectionId) ?? 999 : 999;
                if (aIdx !== bIdx) return aIdx - bIdx;
                return bpItems.indexOf(a) - bpItems.indexOf(b);
            });

            pt.sections.forEach((section, sIdx) => {
                const sectionItems = orderedItems.filter(item => item.sectionId === section.id);
                if (sectionItems.length === 0) return;

                const qStart = qGlobalNo;
                const qEnd = qGlobalNo + sectionItems.length - 1;
                const rangeStr = qStart === qEnd ? `${qStart} ஆவது வினாவிற்கு` : `${qStart} முதல் ${qEnd} வரையுள்ள`;
                const roman = toRoman(sIdx + 1);

                let baseInstruction = (section.instruction || '').trim();
                let cleanInstruction = baseInstruction
                    .replace(/\(\s*\d+(\.5)?\s*மதிப்பெண்\s*வீதம்\s*\)/g, '')
                    .replace(/\(\s*\d+\s*[xX*]\s*\d+(\.5)?\s*=\s*\d+(\.5)?\s*\)/g, '')
                    .trim();

                const isFormatted = /^[IVX]+\./.test(cleanInstruction) || /\d+\s*முதல்\s*\d+/.test(cleanInstruction);

                const marksTotal = section.count * section.marks;
                const marksRateStr = `(${formatMark(section.marks)} மதிப்பெண் வீதம்)`;
                const marksTotalStr = `(${section.count} x ${formatMark(section.marks)} = ${formatMark(marksTotal)})`;

                const mainText = isFormatted 
                    ? `${cleanInstruction} ${marksRateStr}` 
                    : `${roman}. ${rangeStr} ${cleanInstruction} ${marksRateStr}`;

                questionContent += `<div style="font-family: 'TAU-Paalai', serif; font-size: 1em; font-weight: bold; margin-top: 25px; margin-bottom: 15px; text-align: justify; line-height: 1.6; page-break-inside: avoid; break-inside: avoid; overflow: hidden; clear: both;">
                    <span>${formatQuestionFonts(mainText)}</span>
                    <span style="float: right; margin-left: 15px; white-space: nowrap;">${formatQuestionFonts(marksTotalStr)}</span>
                </div>`;

                sectionItems.forEach((item) => {
                    const hasChoice = !!item.hasInternalChoice;
                    const questionText = formatQuestionFonts(item.questionText || '(Question not entered)');
                    const questionTextB = formatQuestionFonts(item.questionTextB || '(Question not entered)');

                    questionContent += `<div style="font-family: 'TAU-Paalai', serif; font-size: 1em; line-height: 1.8; text-align: justify; margin-bottom: 15px; padding-left: 10px; page-break-inside: avoid; break-inside: avoid;">`;
                    if (hasChoice) {
                        questionContent += `<div style="font-weight: bold; margin-bottom: 8px;">${formatQuestionFonts(`${qGlobalNo}.`)} ஏதேனும் ஒன்றிற்கு விடையளிக்கவும்.</div>`;
                        questionContent += `<div style="display: flex; gap: 15px; margin-bottom: 8px;"><div style="min-width: 30px; font-weight: bold;">${formatQuestionFonts('அ)')}</div><div style="flex: 1;">${questionText}</div></div>`;
                        questionContent += `<div style="text-align: center; font-weight: bold; margin: 10px 0;">(அல்லது)</div>`;
                        questionContent += `<div style="display: flex; gap: 15px;"><div style="min-width: 30px; font-weight: bold;">${formatQuestionFonts('ஆ)')}</div><div style="flex: 1;">${questionTextB}</div></div>`;
                    } else {
                        questionContent += `<div style="display: flex; gap: 15px;"><div style="min-width: 30px; font-weight: bold;">${formatQuestionFonts(`${qGlobalNo}.`)}</div><div style="flex: 1;">${questionText}</div></div>`;
                    }
                    questionContent += `</div>`;
                    qGlobalNo++;
                });
            });

            const matchedIds = new Set(
                pt.sections.flatMap(s => bpItems.filter(i => i.sectionId === s.id).map(i => i.id))
            );
            const unmatched = bpItems.filter(i => !matchedIds.has(i.id));
            if (unmatched.length > 0) {
                questionContent += `<div style="font-family: 'TAU-Paalai', serif; font-size: 1em; font-weight: bold; margin-top: 25px; margin-bottom: 15px; page-break-inside: avoid; break-inside: avoid;">மேலும் வினாக்கள்</div>`;
                unmatched.forEach(item => {
                    const questionText = formatQuestionFonts(item.questionText || '(Question not entered)');
                    questionContent += `<div style="font-family: 'TAU-Paalai', serif; font-size: 1em; line-height: 1.8; text-align: justify; margin-bottom: 12px; padding-left: 20px; page-break-inside: avoid; break-inside: avoid;"><div style="display: flex; gap: 10px;"><div style="min-width: 25px; font-weight: bold;">${formatQuestionFonts(`${qGlobalNo}.`)}</div><div style="flex: 1;">${questionText}</div></div></div>`;
                    qGlobalNo++;
                });
            }
        } else {
            bpItems.forEach(item => {
                const hasChoice = !!item.hasInternalChoice;
                const questionText = formatQuestionFonts(item.questionText || '(Question not entered)');
                const questionTextB = formatQuestionFonts(item.questionTextB || '(Question not entered)');
                questionContent += `<div style="font-family: 'TAU-Paalai', serif; font-size: 1em; line-height: 1.8; text-align: justify; margin-bottom: 12px; padding-left: 20px; page-break-inside: avoid; break-inside: avoid;">`;
                if (hasChoice) {
                    questionContent += `<div style="font-weight: bold; margin-bottom: 5px;">${formatQuestionFonts(`${qGlobalNo}.`)} ஏதேனும் ஒன்றிற்கு விடையளிக்கவும்.</div>`;
                    questionContent += `<div style="display: flex; gap: 10px; margin-bottom: 5px;"><div style="min-width: 25px;">${formatQuestionFonts('அ)')}</div><div style="flex: 1;">${questionText}</div></div>`;
                    questionContent += `<div style="text-align: center; font-weight: bold; margin: 8px 0; font-style: italic;">(அல்லது)</div>`;
                    questionContent += `<div style="display: flex; gap: 10px;"><div style="min-width: 25px;">${formatQuestionFonts('ஆ)')}</div><div style="flex: 1;">${questionTextB}</div></div>`;
                } else {
                    questionContent += `<div style="display: flex; gap: 10px;"><div style="min-width: 25px; font-weight: bold;">${formatQuestionFonts(`${qGlobalNo}.`)}</div><div style="flex: 1;">${questionText}</div></div>`;
                }
                questionContent += `</div>`;
                qGlobalNo++;
            });
        }

        return header + questionContent;
    };

    useEffect(() => {
        if (selectedBlueprint) {
            setWorkingText(buildFullQuestionPaperHTML(selectedBlueprint, selectedPaperType));
        }
    }, [selectedBlueprint, selectedPaperType]);

    const handleGenerateContent = () => {
        if (!selectedBlueprint) return;
        const fullHTML = buildFullQuestionPaperHTML(selectedBlueprint, selectedPaperType);
        setWorkingText(fullHTML);
    };

    const handleCopy = async () => {
        const temp = document.createElement('div');
        temp.innerHTML = workingText;
        const text = temp.innerText || temp.textContent || '';
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadWord = (html: string) => {
        if (!selectedBlueprint) return;
        const setLetter = (selectedBlueprint.setId || 'A').replace(/SET\s+/i, '').trim().charAt(0).toUpperCase();
        const filename = `QuestionPaper_${selectedBlueprint.classLevel}_${selectedBlueprint.subject}_Set_${setLetter}.doc`;

        // Wrap and download
        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
              <head>
              <title>${selectedBlueprint.subject} Question Paper</title>
              <!--[if gte mso 9]>
              <xml>
              <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
              </w:WordDocument>
              </xml>
              <![endif]-->
              <style>
              @page {
                  size: A4;
                  margin: 1.5cm 1.5cm 2.0cm 1.5cm;
              }
              body {
                  font-family: 'TAU-Paalai', 'Times New Roman', serif;
                  font-size: 12pt;
                  line-height: 1.6;
              }
              p { margin: 0 0 10px 0; }
              table { border-collapse: collapse; width: 100%; }
              td, th { border: 1px solid black; padding: 6px; }
              </style>
              </head>
              <body>
              <div>
              ${html}
              </div>
              </body>
              </html>`;

        const blob = new Blob(['\ufeff' + header], {
            type: 'application/msword'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Swal.fire("Exported", "Word document downloaded successfully!", "success");
    };

    const handleSaveFromEditor = async (html: string) => {
        if (!selectedBlueprint) return;
        setIsSaving(true);
        try {
            const sanitizedHtml = sanitizeHtml(html);
            const updated = { ...selectedBlueprint, massViewHeader: sanitizedHtml };
            await saveBlueprint(updated);
            setWorkingText(sanitizedHtml);
            Swal.fire("Saved", "Changes saved to database!", "success");
        } catch (e) {
            Swal.fire("Error", "Save failed", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="relative border-sky-100 bg-white p-4 flex flex-col h-full space-y-4">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 no-print">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg">
                            <FileText size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Mass View</h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGenerateContent}
                            disabled={!selectedBlueprint}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all disabled:opacity-50 shadow-md"
                        >
                            <RefreshCw size={18} />
                            Reset Layout
                        </button>
                        
                        <button
                            onClick={handleCopy}
                            disabled={!workingText}
                            className={`inline-flex h-9 px-4 items-center justify-center rounded-xl font-bold transition-all ${copied ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm'} text-sm`}
                        >
                            {copied ? <Check size={18} className="mr-2" /> : <Copy size={18} className="mr-2" />}
                            {copied ? 'Copied' : 'Copy Text'}
                        </button>
                        
                        <button
                            onClick={() => handleDownloadWord(workingText)}
                            disabled={!selectedBlueprint || !workingText}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md"
                        >
                            <FileDown size={18} />
                            Word
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Question Paper:</span>
                    <select
                        value={selectedBlueprintId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedBlueprintId(e.target.value)}
                        className="flex-1 max-w-2xl px-4 py-2.5 border border-sky-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 bg-gray-50 text-sm font-bold text-slate-700 shadow-sm"
                    >
                        <option value="">Select Exam to Load...</option>
                        {blueprints.map(bp => (
                            <option key={bp.id} value={bp.id}>
                                Class {bp.classLevel} . {bp.subject} . {bp.setId?.replace(/SET\s+/i, '').replace(/Set\s+/i, '') || 'A'} . {bp.academicYear || getCurrentAcademicYear()} ({userMap[bp.ownerId || ''] || 'Unknown'})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 relative flex flex-col min-h-0 rounded-xl overflow-hidden border border-sky-50">
                {!selectedBlueprintId ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-sky-100 rounded-3xl bg-sky-50/30 m-8">
                        <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                            <FileText size={40} className="text-sky-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Select an exam to view</h3>
                        <p className="text-slate-500 text-sm mt-1">Full question paper will be loaded into the A4 editor.</p>
                    </div>
                ) : (
                    <PaginatedA4Editor 
                        initialHtml={workingText}
                        onSave={handleSaveFromEditor}
                        title={`Class ${selectedBlueprint?.classLevel} ${selectedBlueprint?.subject} - Set ${selectedBlueprint?.setId || 'A'}`}
                    />
                )}
            </div>

        </div>
    );
};

function getCurrentAcademicYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export default AdminQuestionConsolidator;
