import React, { useEffect, useMemo, useState, useRef } from 'react';
import Swal from 'sweetalert2';
import { Check, Copy, FileText, Save, Loader2, RefreshCw, Download } from 'lucide-react';
import { getBlueprints, getQuestionPaperTypes, saveBlueprint } from '../services/db';
import { sanitizeHtml } from '../services/security';
import { Blueprint, QuestionPaperType } from '../types';

const AdminQuestionConsolidator = () => {
    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
    const [paperTypes, setPaperTypes] = useState<QuestionPaperType[]>([]);
    const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
    const [copied, setCopied] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [workingText, setWorkingText] = useState('');

    const editorRef = useRef<HTMLDivElement>(null);

    const formatText = (text: string) => {
        if (!text) return '';
        return text.split('\n').map(line => {
            const tabbedLine = line.replace(/\t/g, '    ');
            if (!tabbedLine.trim()) return '';
            return tabbedLine.replace(/([A-Za-z0-9\-\:\(\)\.\,\|]+)/g, '<span style="font-family: \'Times New Roman\', serif;">$1</span>');
        }).join('<br/>');
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        const formattedHtml = formatText(text);
        document.execCommand('insertHTML', false, formattedHtml);
        if (editorRef.current) {
            setWorkingText(editorRef.current.innerHTML);
        }
    };

    const refreshData = async () => {
        setIsRefreshing(true);
        try {
            const [bps, pts] = await Promise.all([getBlueprints('all'), getQuestionPaperTypes()]);
            const filtered = (bps || []).filter(bp => bp.isConfirmed || bp.isAdminAssigned);
            const uniqueMap = new Map();
            filtered.forEach(bp => {
                const key = `${bp.classLevel}-${bp.subject}-${bp.setId || 'Set A'}-${bp.examTerm}-${bp.academicYear || '2026-27'}`;
                if (!uniqueMap.has(key) || (bp.isConfirmed && !uniqueMap.get(key).isConfirmed)) {
                    uniqueMap.set(key, bp);
                }
            });
            setBlueprints(Array.from(uniqueMap.values()));
            setPaperTypes(pts || []);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => { refreshData(); }, []);

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

        const year = (bp.academicYear || '2026-27').replace(/^(\d{4})-(\d{2,4})$/, (_, start, end) => `${start}-${String(end).slice(-2)}`);

        let termHeading = `முதல்பருவத் தொகுத்தறி மதிப்பீடு ${year}`;
        if (bp.examTerm === 'Second Term Summative') termHeading = `இரண்டாம் பருவத் தொகுத்தறி மதிப்பீடு ${year}`;
        if (bp.examTerm === 'Third Term Summative') termHeading = `இறுதிப் பருவத் தொகுத்தறி மதிப்பீடு ${year}`;

        const subjectTitle = bp.subject.includes('AT')
            ? { tamil: 'தமிழ் முதல் தாள்', eng: 'Tamil Language Paper I (AT)' }
            : { tamil: 'தமிழ் இரண்டாம் தாள்', eng: 'Tamil Language Paper II (BT)' };

        return `<div style="margin-bottom: 20px; font-family: 'TAU-Paalai', serif; line-height: 1.5; text-align: center;">
    <div style="position: relative; display: flex; justify-content: center; align-items: center; padding: 10px 0;">
        <div style="position: absolute; left: 0; top: 50%; transform: translateY(-50%);">
            <div style="border: 2px solid black; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px; font-family: Arial, sans-serif;">
                ${setLetter}
            </div>
        </div>
        <h1 style="font-weight: bold; font-size: 22px; margin: 0; line-height: 1.2; letter-spacing: 0.5px;">சமக்ர சிக்ஷா கேரளம்</h1>
        <div style="position: absolute; right: 0; top: 50%; transform: translateY(-50%);">
            <div style="background: black; color: white; padding: 6px 18px; font-size: 14px; font-weight: bold; font-family: Arial, sans-serif; border: 2px solid black;">
                ${paperCode}
            </div>
        </div>
    </div>
    <div style="margin-top: 10px;">
        <h2 style="font-size: 16px; font-weight: bold; margin: 0;">${termHeading}</h2>
        <h2 style="font-size: 16px; font-weight: bold; margin: 5px 0 0 0;">${subjectTitle.tamil}</h2>
        <h3 style="font-size: 14px; font-weight: bold; margin: 5px 0 0 0;">${subjectTitle.eng}</h3>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: flex-end; font-weight: bold; margin-top: 15px; font-size: 11pt; text-align: left;">
        <div style="line-height: 1.4;">நேரம்: 90 நிமிடம்<br/>சிந்தனை நேரம் : 15 நிமிடம்</div>
        <div style="text-align: right; line-height: 1.4;">வகுப்பு: ${bp.classLevel}<br/>மதிப்பெண்: ${formatMark(bp.totalMarks)}</div>
    </div>
    </div>
    <div style="border-top: 1px solid black; border-bottom: 1px solid black; padding: 10px 0; margin-bottom: 20px; font-family: 'TAU-Paalai', serif; font-size: 11pt; font-weight: bold; line-height: 1.5; text-align: left;">
    <div style="margin-bottom: 5px;">குறிப்புகள்:</div>
    <div style="margin-left: 20px; font-weight: normal;">
        - முதல் 15 நிமிடம் சிந்தனை நேரமாகும்.<br/>
        - வினாக்களை வாசித்து விடைகளை வரிசைப்படுத்த இந்த நேரத்தைப் பயன்படுத்தலாம்.<br/>
        - வினாக்களையும் குறிப்புகளையும் நன்கு வாசித்துப் புரிந்து விடையளிக்கவும்.<br/>
        - விடையளிக்கும்போது மதிப்பெண், நேரம் போன்றவற்றை கவனித்து செயல்படவும்.
    </div>
    </div>`;
    };

    const buildFullQuestionPaperHTML = (bp: Blueprint, pt: QuestionPaperType | undefined): string => {
        // Always regenerate header fresh — never use massViewHeader as the "header" portion
        // (massViewHeader stores the full paper and would cause duplication if reused here)
        const header = generateHeaderHTML(bp);
        const bpItems = bp.items || [];

        let questionContent = '<div style="margin-top: 10px; font-family: \'TAU-Paalai\', serif; font-size: 12pt; text-align: justify; line-height: 1.6;">';
        let qGlobalNo = 1;

        if (pt && pt.sections && pt.sections.length > 0) {
            // Preferred path: order items by section, then render grouped by section
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
                const isFormatted = /^[IVX]+\./.test(baseInstruction) || /\d+\s*முதல்\s*\d+/.test(baseInstruction);

                if (isFormatted) {
                    questionContent += `<div style="font-weight: bold; margin-top: 25px; margin-bottom: 15px;">${baseInstruction}</div>`;
                } else {
                    questionContent += `<div style="font-weight: bold; margin-top: 25px; margin-bottom: 15px;">${roman}. ${rangeStr} ${baseInstruction} (${formatMark(section.marks)} மதிப்பெண் வீதம்) (${section.count} x ${formatMark(section.marks)} = ${formatMark(section.count * section.marks)})</div>`;
                }

                sectionItems.forEach((item) => {
                    const hasChoice = !!item.hasInternalChoice;
                    questionContent += `<div style="margin-bottom: 12px; padding-left: 20px;">`;
                    if (hasChoice) {
                        questionContent += `<div style="font-weight: bold; margin-bottom: 5px;">${qGlobalNo}. ஏதேனும் ஒன்றிற்கு விடையளிக்கவும்.</div>`;
                        questionContent += `<div style="display: flex; gap: 10px; margin-bottom: 5px;"><div style="min-width: 25px;">அ)</div><div style="flex: 1;">${item.questionText || '(Question not entered)'}</div></div>`;
                        questionContent += `<div style="text-align: center; font-weight: bold; margin: 8px 0; font-style: italic;">(அல்லது)</div>`;
                        questionContent += `<div style="display: flex; gap: 10px;"><div style="min-width: 25px;">ஆ)</div><div style="flex: 1;">${item.questionTextB || '(Question not entered)'}</div></div>`;
                    } else {
                        questionContent += `<div style="display: flex; gap: 10px;"><div style="min-width: 25px; font-weight: bold;">${qGlobalNo}.</div><div style="flex: 1;">${item.questionText || '(Question not entered)'}</div></div>`;
                    }
                    questionContent += `</div>`;
                    qGlobalNo++;
                });
            });

            // Fallback: render items that had no matching sectionId
            const matchedIds = new Set(
                pt.sections.flatMap(s => bpItems.filter(i => i.sectionId === s.id).map(i => i.id))
            );
            const unmatched = bpItems.filter(i => !matchedIds.has(i.id));
            if (unmatched.length > 0) {
                questionContent += `<div style="font-weight: bold; margin-top: 25px; margin-bottom: 15px;">மேலும் வினாக்கள்</div>`;
                unmatched.forEach(item => {
                    questionContent += `<div style="margin-bottom: 12px; padding-left: 20px;"><div style="display: flex; gap: 10px;"><div style="min-width: 25px; font-weight: bold;">${qGlobalNo}.</div><div style="flex: 1;">${item.questionText || '(Question not entered)'}</div></div></div>`;
                    qGlobalNo++;
                });
            }
        } else {
            // Fallback path: no paper type — just list all items sequentially
            bpItems.forEach(item => {
                const hasChoice = !!item.hasInternalChoice;
                questionContent += `<div style="margin-bottom: 12px; padding-left: 20px;">`;
                if (hasChoice) {
                    questionContent += `<div style="font-weight: bold; margin-bottom: 5px;">${qGlobalNo}. ஏதேனும் ஒன்றிற்கு விடையளிக்கவும்.</div>`;
                    questionContent += `<div style="display: flex; gap: 10px; margin-bottom: 5px;"><div style="min-width: 25px;">அ)</div><div style="flex: 1;">${item.questionText || '(Question not entered)'}</div></div>`;
                    questionContent += `<div style="text-align: center; font-weight: bold; margin: 8px 0; font-style: italic;">(அல்லது)</div>`;
                    questionContent += `<div style="display: flex; gap: 10px;"><div style="min-width: 25px;">ஆ)</div><div style="flex: 1;">${item.questionTextB || '(Question not entered)'}</div></div>`;
                } else {
                    questionContent += `<div style="display: flex; gap: 10px;"><div style="min-width: 25px; font-weight: bold;">${qGlobalNo}.</div><div style="flex: 1;">${item.questionText || '(Question not entered)'}</div></div>`;
                }
                questionContent += `</div>`;
                qGlobalNo++;
            });
        }

        questionContent += '</div>';
        return header + questionContent;
    };

    useEffect(() => {
        // Load question paper whenever a blueprint is selected,
        // regardless of whether a matching paperType is found
        if (selectedBlueprint) {
            setWorkingText(buildFullQuestionPaperHTML(selectedBlueprint, selectedPaperType));
        }
    }, [selectedBlueprint, selectedPaperType]);

    const handleGenerateContent = () => {
        if (!selectedBlueprint) return;
        const fullHTML = buildFullQuestionPaperHTML(selectedBlueprint, selectedPaperType);
        setWorkingText(fullHTML);
    };

    const handleSave = async () => {
        if (!selectedBlueprint || !editorRef.current) return;
        setIsSaving(true);
        try {
            const html = editorRef.current.innerHTML;
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

    const handleCopy = async () => {
        if (!editorRef.current) return;
        const text = editorRef.current.innerText;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadWord = () => {
        if (!editorRef.current || !selectedBlueprint) return;
        const htmlContent = editorRef.current.innerHTML;
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
              ${htmlContent}
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

    return (
        <div className="relative border-sky-100 bg-white p-4 flex flex-col h-full space-y-4">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-4">
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
                            Load
                        </button>
                        <button onClick={handleSave} disabled={!selectedBlueprint || isSaving} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md">
                            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={handleCopy}
                            disabled={!workingText}
                            className={`inline-flex h-9 px-4 items-center justify-center rounded-xl font-bold transition-all ${copied ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm'} text-sm`}
                        >
                            {copied ? <Check size={18} className="mr-2" /> : <Copy size={18} className="mr-2" />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button
                            onClick={handleDownloadWord}
                            disabled={!selectedBlueprint || !workingText}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md"
                        >
                            <Download size={18} />
                            Export
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
                                Class {bp.classLevel} . {bp.subject} . {bp.setId?.replace(/SET\s+/i, '').replace(/Set\s+/i, '') || 'A'} . {bp.academicYear || '2026-27'}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 relative flex flex-col min-h-0 bg-slate-50/50 rounded-xl overflow-hidden border border-sky-50 shadow-inner">
                {!selectedBlueprintId ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-sky-100 rounded-3xl bg-sky-50/30 m-8">
                        <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                            <FileText size={40} className="text-sky-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Select an exam to view</h3>
                        <p className="text-slate-500 text-sm mt-1">Full question paper will be loaded into the editor below.</p>
                    </div>
                ) : (
                    <div className="relative w-full h-full bg-white p-12 overflow-auto">
                        <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning={true}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(workingText) }}
                            onBlur={(e) => setWorkingText(e.currentTarget.innerHTML)}
                            onPaste={handlePaste}
                            className="w-full min-h-full focus:outline-none print:p-0"
                            style={{
                                fontFamily: "'TAU-Paalai', serif",
                                fontSize: '14pt',
                                lineHeight: '1.6',
                                color: '#000'
                            }}
                        ></div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default AdminQuestionConsolidator;
