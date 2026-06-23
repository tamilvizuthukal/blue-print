import React, { useState, useEffect } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Image, Table as TableIcon, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import StructuredAnswerEditor from './StructuredAnswerEditor';
import { UniversalAnswerBuilder, convertAnswerBlocksToHtml, convertHtmlToAnswerBlocks, parseDisplayMark } from './UniversalAnswerBuilder';

const getInitialBlocks = (
    answerBlocks: any[] | undefined,
    answerText: string | undefined,
    structuredAnswers: any[] | undefined,
    enableInputAnswer: boolean | undefined
): any[] => {
    if (answerBlocks && answerBlocks.length > 0) {
        return answerBlocks;
    }
    
    // If structuredAnswers has data, convert it to blocks
    if (structuredAnswers && structuredAnswers.length > 0) {
        return structuredAnswers.map(sa => {
            const id = Math.random().toString(36).substr(2, 9);
            const rawAns = sa.answer || '';
            const rawMark = sa.mark || '';
            const marksNum = parseDisplayMark(rawMark);
            
            // Determine block type by checking if answer starts with common list indicators
            let type = 'paragraph';
            let content = rawAns;
            let bulletSymbol = '▪';
            
            const trimmedAns = rawAns.trim();
            if (trimmedAns.startsWith('•') || trimmedAns.startsWith('▪') || trimmedAns.startsWith('➢') || trimmedAns.startsWith('➔')) {
                type = 'bullet';
                bulletSymbol = trimmedAns.charAt(0);
                content = trimmedAns.substring(1).trim();
            } else if (/^\d+\./.test(trimmedAns)) {
                type = 'numbered';
                content = trimmedAns.replace(/^\d+\./, '').trim();
            }
            
            return {
                id,
                type,
                content,
                bulletSymbol: type === 'bullet' ? bulletSymbol : undefined,
                marks: marksNum
            };
        });
    }
    
    if (answerText) {
        return convertHtmlToAnswerBlocks(answerText, "Type your content here...");
    }
    
    return [];
};
import { Discourse, DiscourseScores, BlueprintItem, Unit, SubUnit, AnswerMark, ItemFormat } from '../types';
import { generateAIAnswer as generateAIAnswerAPI } from '../services/db';

export const QuestionRow = ({ item, index, qNumber, onUpdateItem, availableDiscourses, systemSettings, curriculum, section, sectionItems, isAdmin, activeEntryCategory, onChangeEntryCategory }: any) => {
    const [localActiveTab, setLocalActiveTab] = useState<'question' | 'answer'>('question');
    const activeTab = activeEntryCategory || localActiveTab;

    const setActiveTab = (tab: 'question' | 'answer') => {
        if (onChangeEntryCategory) {
            onChangeEntryCategory(tab);
        } else {
            setLocalActiveTab(tab);
        }
    };

    useEffect(() => {
        setLocalActiveTab('question');
    }, [item.id]);
    const [questionMode, setQuestionMode] = useState<'content' | 'structured'>(
        (item.structuredQuestions && item.structuredQuestions.length > 0) ? 'structured' : 'content'
    );
    const [questionModeB, setQuestionModeB] = useState<'content' | 'structured'>(
        (item.structuredQuestionsB && item.structuredQuestionsB.length > 0) ? 'structured' : 'content'
    );
    const [answerMode, setAnswerMode] = useState<'content' | 'discourse' | 'ai' | 'structured'>(
        (item.structuredAnswers && item.structuredAnswers.length > 0) ? 'structured' : 'content'
    );
    const [answerModeB, setAnswerModeB] = useState<'content' | 'discourse' | 'ai' | 'structured'>(
        (item.structuredAnswersB && item.structuredAnswersB.length > 0) ? 'structured' : 'content'
    );
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedDiscourseId, setSelectedDiscourseId] = useState<string>(item.discourseId || '');
    const [selectedDiscourseIdB, setSelectedDiscourseIdB] = useState<string>(item.discourseIdB || '');

    // Helpers for Unit selection
    const selectedUnit = curriculum?.units.find((u: Unit) => u.id === item.unitId);
    const availableSubUnits = selectedUnit?.subUnits || [];

    const sectionOptionCount = section?.optionCount || 0;
    const currentSectionOptionUsage = sectionItems?.filter((si: any) => si.hasInternalChoice).length || 0;

    // Limits based on mark rules: 1 & 2 marks have no option.
    const isMarkRestricted = item.marksPerQuestion <= 2;
    // Can't enable if we hit the limit, UNLESS it's already enabled
    const isLimitReached = !item.hasInternalChoice && currentSectionOptionUsage >= sectionOptionCount;
    const canToggleOption = !isMarkRestricted && (item.hasInternalChoice || !isLimitReached);

    const formatMarks = (marks: number) => {
        const s = marks.toString();
        if (s.endsWith('.5')) {
            const whole = s.split('.')[0];
            return whole === '0' ? '½' : `${whole}½`;
        }
        return s;
    };

    const handleGenerateAIAnswer = async (isOptionB: boolean) => {
        const sourceField = isOptionB ? 'questionTextB' : 'questionText';
        const targetBlocksField = isOptionB ? 'answerBlocksB' : 'answerBlocks';
        const targetTextField = isOptionB ? 'answerTextB' : 'answerText';
        const targetWriteContentField = isOptionB ? 'enableWriteContentB' : 'enableWriteContent';
        const promptTemplateField = isOptionB ? 'answerPromptB' : 'answerPrompt';

        const questionText = item[sourceField] || '';
        const cleanQuestionText = questionText.replace(/<[^>]*>/g, '').trim();

        if (!cleanQuestionText) {
            Swal.fire({
                title: "வினா இல்லை",
                text: "வினா இன்புட்டில் உள்ளடக்கத்தை முதலில் உள்ளிடவும். (Please enter question content first.)",
                icon: "warning",
                confirmButtonColor: "#4f46e5",
                confirmButtonText: "சரி"
            });
            return;
        }

        // Check if there are already blocks
        const existingBlocks = item[targetBlocksField] || [];
        const existingText = item[targetTextField] || '';
        if (existingBlocks.length > 0 || existingText.trim()) {
            const confirm = await Swal.fire({
                title: "பதிலை மீண்டும் உருவாக்கவா?",
                text: "ஏற்கனவே உள்ள விடைகள் நீக்கப்பட்டு புதிய விடை உருவாக்கப்படும். தொடரலாமா?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#ef4444",
                cancelButtonColor: "#6b7280",
                confirmButtonText: "ஆம், உருவாக்கு",
                cancelButtonText: "ரத்து செய்"
            });
            if (!confirm.isConfirmed) return;
        }

        setIsGenerating(true);

        Swal.fire({
            title: 'AI விடையை உருவாக்குகிறது...',
            html: `
                <div class="flex flex-col items-center justify-center gap-3 py-4">
                    <div class="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                    <p class="text-gray-500 font-bold text-sm">மதிப்பெண்களுக்கு ஏற்ப விடையை அமைக்கிறது...</p>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const marks = item.marksPerQuestion;
            const promptTemplate = item[promptTemplateField] || '';
            const answer = await generateAIAnswerAPI(cleanQuestionText, marks, promptTemplate);
            Swal.close();

            if (!answer) {
                Swal.fire({
                    title: "தோல்வி",
                    text: "பதில் உருவாக்கப்படவில்லை. லோக்கல் மாடல் இயங்குகிறதா என சரிபார்க்கவும்.",
                    icon: "error",
                    confirmButtonColor: "#ef4444",
                    confirmButtonText: "சரி"
                });
                return;
            }

            // Convert generated answer to blocks
            const blocks = convertHtmlToAnswerBlocks(answer, "Type your content here...");
            onUpdateItem(item.id, targetBlocksField, blocks);
            onUpdateItem(item.id, targetWriteContentField, true);
            onUpdateItem(item.id, targetTextField, convertAnswerBlocksToHtml(blocks));

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'விடை வெற்றிகரமாக உருவாக்கப்பட்டது.',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (error) {
            console.error('AI Generation failed:', error);
            Swal.fire({
                title: "தோல்வி",
                text: "விடை உருவாக்கத்தில் சிக்கல் ஏற்பட்டது. லோக்கல் மாடல் இயங்குகிறதா என சரிபார்க்கவும்.",
                icon: "error",
                confirmButtonColor: "#ef4444",
                confirmButtonText: "சரி"
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const applyDiscourse = (discourseId: string, targetField: 'answerText' | 'answerTextB') => {
        const d = availableDiscourses.find((x: Discourse) => x.id === discourseId);
        if (d) {
            // Apply Cognitive Process if present in Discourse (only for main/A option or global)
            if (d.cognitiveProcess && targetField === 'answerText') {
                onUpdateItem(item.id, 'cognitiveProcess', d.cognitiveProcess);
            }

            // Save the discourse ID to the item for persistence
            // This is used by AnswerKeyView to render the standard rubric details
            if (targetField === "answerText") {
                onUpdateItem(item.id, "discourseId", discourseId);
            } else {
                onUpdateItem(item.id, "discourseIdB", discourseId);
            }
        }
    };

    const handleFormatChange = (val: string) => {
        const marks = item.marksPerQuestion;
        const normalizedVal = val.toUpperCase();
        
        const isSR1 = normalizedVal.includes('SR1') || normalizedVal.includes('MCI');
        const isSR2 = normalizedVal.includes('SR2') || normalizedVal.includes('MI');
        const isCRS1 = normalizedVal.includes('CRS1') || normalizedVal.includes('VSA');
        const isCRS2 = normalizedVal.includes('CRS2') || normalizedVal.includes('SA');

        if (marks === 1 || marks === 2) {
            if (!isSR1 && !isSR2 && !isCRS1) {
                Swal.fire({
                    title: 'பொருந்தாது!',
                    text: `${marks} மதிப்பெண் பிரிவுக்கு MCI (SR1), MI (SR2), VSA (CRS1) மட்டுமே பொருந்தும்.`,
                    icon: 'error',
                    confirmButtonColor: '#4f46e5',
                    confirmButtonText: 'சரி'
                });
                return;
            }
        } else if (marks === 3 || marks === 4) {
            if (!isSR1 && !isSR2 && !isCRS1 && !isCRS2) {
                Swal.fire({
                    title: 'பொருந்தாது!',
                    text: `${marks} மதிப்பெண் பிரிவுக்கு MCI (SR1), MI (SR2), VSA (CRS1), SA (CRS2) மட்டுமே பொருந்தும்.`,
                    icon: 'error',
                    confirmButtonColor: '#4f46e5',
                    confirmButtonText: 'சரி'
                });
                return;
            }
        } else if (marks >= 5) {
            if (isSR1 || isSR2 || isCRS1 || isCRS2) {
                Swal.fire({
                    title: 'பொருந்தாது!',
                    text: `${marks} மதிப்பெண் பிரிவுக்கு இந்த Item Format பொருந்தாது. CRL (Essay) இந்த பிரிவுக்கு பொருத்தமானது.`,
                    icon: 'warning',
                    confirmButtonColor: '#4f46e5',
                    confirmButtonText: 'சரி'
                });
                return;
            }
        }

        onUpdateItem(item.id, 'itemFormat', val);
    };

    return (
        <div className="border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
            {/* Header / Metadata Row */}
            <div className="bg-gray-50 p-2 md:p-3 border-b flex flex-col md:flex-row gap-3 md:gap-4 items-start md:items-center justify-between rounded-t-lg">
                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-2">
                        <span className="h-8 px-2.5 min-w-[2rem] rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {qNumber || `Q${index + 1}`}
                        </span>
                        <div className="flex flex-col md:flex-row md:items-center gap-0 md:gap-2">
                            <span className="font-bold text-gray-700 text-xs md:text-sm">
                                {formatMarks(item.marksPerQuestion)} Mark{item.marksPerQuestion > 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>

                    {/* Internal Choice Toggle - Mobile Compact */}
                    <div className="flex items-center gap-2 pl-3 border-l md:border-l-0 md:pl-0">
                        <span className="hidden sm:inline english-font font-bold text-gray-500 uppercase tracking-widest text-[9px]">Internal Choice</span>
                        <button
                            onClick={() => {
                                if (canToggleOption) {
                                    const nextValue = !item.hasInternalChoice;
                                    onUpdateItem(item.id, 'hasInternalChoice', nextValue);
                                    if (nextValue) {
                                        if (!item.knowledgeLevelB) onUpdateItem(item.id, 'knowledgeLevelB', item.knowledgeLevel);
                                        if (!item.cognitiveProcessB) onUpdateItem(item.id, 'cognitiveProcessB', item.cognitiveProcess);
                                        if (!item.itemFormatB) onUpdateItem(item.id, 'itemFormatB', item.itemFormat);
                                    }
                                }
                            }}
                            disabled={!canToggleOption}
                            className={`w-9 h-4.5 md:w-10 md:h-5 rounded-full p-1 transition-all ${item.hasInternalChoice ? 'bg-blue-600' : 'bg-gray-300'} ${!canToggleOption ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105'}`}
                            title={isMarkRestricted ? "No option for 1 or 2 marks" : "Enable Internal Choice"}
                        >
                            <div className={`w-2.5 h-2.5 md:w-3 md:h-3 bg-white rounded-full transition-transform ${item.hasInternalChoice ? 'translate-x-4.5 md:translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex flex-wrap gap-1.5 md:gap-2 items-center w-full md:w-auto">
                    {curriculum && (
                        <>
                            <div className="flex flex-col col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-bold text-gray-400 uppercase md:hidden px-1">Unit</label>
                                <select
                                    className="border-2 border-slate-100 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-900 bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all outline-none w-full md:max-w-[150px]"
                                    value={item.unitId}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                        onUpdateItem(item.id, 'unitId', e.target.value);
                                        const newUnit = curriculum.units.find((u: Unit) => u.id === e.target.value);
                                        onUpdateItem(item.id, 'subUnitId', newUnit?.subUnits[0]?.id || '');
                                    }}
                                    disabled={!isAdmin}
                                >
                                    {curriculum.units.map((u: Unit) => <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-bold text-gray-400 uppercase md:hidden px-1">Sub-Unit</label>
                                <select
                                    className="border-2 border-slate-100 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-900 bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all outline-none w-full md:max-w-[150px]"
                                    value={item.subUnitId}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateItem(item.id, 'subUnitId', e.target.value)}
                                    disabled={!isAdmin || !item.unitId || availableSubUnits.length === 0}
                                >
                                    {availableSubUnits.length === 0 && <option value="">No Subunits</option>}
                                    {availableSubUnits.map((s: SubUnit) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold text-gray-400 uppercase md:hidden px-1">Level</label>
                        <select
                            className="border-2 border-slate-100 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-900 bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all outline-none w-full"
                            value={item.knowledgeLevel}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateItem(item.id, 'knowledgeLevel', e.target.value)}
                        >
                            {systemSettings.knowledgeLevels.map((k: any) => <option key={k.code} value={k.name}>{k.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold text-gray-400 uppercase md:hidden px-1">Process</label>
                        <select
                            className="border-2 border-slate-100 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-900 bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all outline-none w-full"
                            value={item.cognitiveProcess}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateItem(item.id, 'cognitiveProcess', e.target.value)}
                        >
                            {systemSettings.cognitiveProcesses.map((c: any) => <option key={c.code} value={c.description}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold text-gray-400 uppercase md:hidden px-1">Format</label>
                        <select
                            className="border-2 border-slate-100 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-900 bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all outline-none w-full"
                            value={item.itemFormat}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFormatChange(e.target.value)}
                        >
                            {systemSettings.itemFormats
                                .filter((f: any) => {
                                    const code = f.code.toUpperCase();
                                    const marks = item.marksPerQuestion;
                                    if (marks === 1) return ['SR1', 'SR2', 'CRS1'].includes(code);
                                    if (marks === 2) return ['SR1', 'SR2', 'CRS1'].includes(code);
                                    if (marks === 3 || marks === 4) return ['SR1', 'SR2', 'CRS1', 'CRS2'].includes(code);
                                    if (marks >= 5) return !['SR1', 'SR2', 'CRS1', 'CRS2'].includes(code);
                                    return true;
                                })
                                .map((f: any) => <option key={f.code} value={f.name}>{f.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold text-gray-400 uppercase md:hidden px-1">Time</label>
                        <div className="flex items-center gap-1 border-2 border-slate-100 rounded-lg px-2 py-1 bg-white focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                            <input
                                type="number"
                                className="w-12 text-[11px] font-bold text-gray-900 outline-none bg-transparent text-center"
                                value={item.time || ''}
                                onChange={(e) => onUpdateItem(item.id, 'time', parseInt(e.target.value) || 0)}
                                placeholder="Min"
                                min="0"
                            />
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Min</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-3 md:p-4">
                {/* Tabs */}
                <div className="flex border-b mb-4">
                    <button
                        onClick={() => setActiveTab('question')}
                        className={`px-4 py-2 text-sm font-bold mr-1 rounded-t-lg transition-colors ${activeTab === 'question' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Question
                    </button>
                    <button
                        onClick={() => setActiveTab('answer')}
                        className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'answer' ? 'bg-green-50 text-green-700 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Answer
                    </button>
                </div>

                {/* Tab Content */}
                <div className="min-h-[150px]">
                    {activeTab === 'question' && (
                        <div className="animate-fade-in space-y-6">
                            {/* Option A (Default) */}
                            <div>
                                {item.hasInternalChoice && <div className="tamil-font font-bold text-red-600 mb-1">ஏதேனும் ஒன்றிற்கு விடையளிக்கவும்</div>}
                                {item.hasInternalChoice && <div className="tamil-font font-bold text-blue-600 mb-1">(அ) வினா</div>}
                                
                                {questionMode === 'content' ? (
                                    <SimpleRichTextEditor
                                        value={item.questionText}
                                        onChange={(val: string) => onUpdateItem(item.id, 'questionText', val)}
                                        placeholder="Type the question content here..."
                                        onToggleStructured={() => setQuestionMode('structured')}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-t border-t border-x px-4">
                                            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Structured Question Mode</span>
                                            <button onClick={() => setQuestionMode('content')} className="text-[10px] font-bold text-blue-700 hover:underline">Switch to Plain Text</button>
                                        </div>
                                        <StructuredAnswerEditor
                                            value={item.structuredQuestions || []}
                                            label="Question Point"
                                            placeholder="Enter question point..."
                                            onChange={(val: AnswerMark[]) => {
                                                onUpdateItem(item.id, 'structuredQuestions', val as any);
                                                const html = `<ul class="rubric-list">${val.map(v => `<li><span class="rubric-point">${v.answer}</span><strong class="rubric-mark">${v.mark}</strong></li>`).join('')}</ul>`;
                                                onUpdateItem(item.id, 'questionText', html);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {item.hasInternalChoice && (
                                <div className="tamil-font font-bold text-purple-600 flex items-center gap-2">
                                    <span className="bg-purple-600 text-white px-1.5 py-0.5 rounded text-[10px]">அல்லது</span>
                                </div>
                            )}

                            {/* Option B (If Enabled) */}
                            {item.hasInternalChoice && (
                                <div className="border-t pt-1 bg-purple-50/20 p-2 md:p-4 rounded-lg border border-purple-100">
                                    <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                                        <div className="flex items-center gap-4">
                                            <div className="tamil-font font-bold text-blue-600 mb-1"> (ஆ) வினா </div>
                                            
                                            <div className="flex gap-2">
                                                <select
                                                    className="border rounded px-2 py-0.5 text-[10px] bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                                    value={item.knowledgeLevelB || item.knowledgeLevel}
                                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateItem(item.id, 'knowledgeLevelB', e.target.value)}
                                                >
                                                    {systemSettings.knowledgeLevels.map((k: any) => <option key={k.code} value={k.name}>{k.name}</option>)}
                                                </select>

                                                <select
                                                    className="border rounded px-2 py-0.5 text-[10px] bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                                    value={item.cognitiveProcessB || item.cognitiveProcess}
                                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateItem(item.id, 'cognitiveProcessB', e.target.value)}
                                                >
                                                    {systemSettings.cognitiveProcesses.map((c: any) => <option key={c.code} value={c.description}>{c.name}</option>)}
                                                </select>

                                                <select
                                                    className="border rounded px-2 py-0.5 text-[10px] bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                                    value={item.itemFormatB || item.itemFormat}
                                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateItem(item.id, 'itemFormatB', e.target.value)}
                                                >
                                                    {systemSettings.itemFormats
                                                        .filter((f: any) => {
                                                            const code = f.code.toUpperCase();
                                                            const marks = item.marksPerQuestion;
                                                            if (marks === 1) return ['SR1', 'SR2', 'CRS1'].includes(code);
                                                            if (marks === 2) return ['SR1', 'SR2', 'CRS1'].includes(code);
                                                            if (marks === 3 || marks === 4) return ['SR1', 'SR2', 'CRS1', 'CRS2'].includes(code);
                                                            if (marks >= 5) return !['SR1', 'SR2', 'CRS1', 'CRS2'].includes(code);
                                                            return true;
                                                        })
                                                        .map((f: any) => <option key={f.code} value={f.name}>{f.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {questionModeB === 'content' ? (
                                        <SimpleRichTextEditor
                                            value={item.questionTextB}
                                            onChange={(val: string) => onUpdateItem(item.id, 'questionTextB', val)}
                                            placeholder="Type the (ஆ) question content..."
                                            onToggleStructured={() => setQuestionModeB('structured')}
                                        />
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center bg-purple-50/50 p-2 rounded-t border-t border-x px-4">
                                                <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">Structured Question Mode (B)</span>
                                                <button onClick={() => setQuestionModeB('content')} className="text-[10px] font-bold text-purple-700 hover:underline">Switch to Plain Text</button>
                                            </div>
                                            <StructuredAnswerEditor
                                                value={item.structuredQuestionsB || []}
                                                label="Question Point"
                                                placeholder="Enter question point..."
                                                onChange={(val: AnswerMark[]) => {
                                                    onUpdateItem(item.id, 'structuredQuestionsB', val as any);
                                                    const html = `<ul class="rubric-list">${val.map(v => `<li><span class="rubric-point">${v.answer}</span><strong class="rubric-mark">${v.mark}</strong></li>`).join('')}</ul>`;
                                                    onUpdateItem(item.id, 'questionTextB', html);
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'answer' && (
                        <div className="animate-fade-in space-y-6">
                            {/* Option A Answer */}
                            <div className="space-y-4">
                                {item.hasInternalChoice && <div className="tamil-font font-bold text-blue-600">(அ) Answer Key</div>}

                                {/* Universal Answer Builder A */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center pr-1">
                                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest pl-1">Answer Key Content</h4>
                                        <button
                                            type="button"
                                            disabled={isGenerating}
                                            onClick={() => handleGenerateAIAnswer(false)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-[10px] shadow-sm transition-all cursor-pointer active:scale-95 font-sans"
                                        >
                                            {isGenerating ? <Loader2 className="animate-spin" size={10} /> : <Sparkles size={10} />}
                                            {isGenerating ? "உருவாக்குகிறது..." : "AI மூலம் விடையை உருவாக்கு (Generate Answer via AI)"}
                                        </button>
                                    </div>
                                    <UniversalAnswerBuilder
                                        key={`answer-key-a-${item.id}`}
                                        blocks={getInitialBlocks(item.answerBlocks, item.answerText, item.structuredAnswers, item.enableInputAnswer)}
                                        onChange={(blocks) => {
                                            onUpdateItem(item.id, 'answerBlocks', blocks);
                                            onUpdateItem(item.id, 'enableWriteContent', true);
                                            onUpdateItem(item.id, 'answerText', convertAnswerBlocksToHtml(blocks));
                                        }}
                                    />
                                </div>

                                {item.marksPerQuestion > 2 && (
                                    <div className="border rounded-xl p-4 bg-indigo-50/30 border-indigo-100 mb-4 mt-4 animate-slide-up">
                                        <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Select Discourse</h4>
                                        <select
                                            className="w-full border p-2 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                const id = e.target.value;
                                                setSelectedDiscourseId(id);
                                                onUpdateItem(item.id, 'discourseId', id);
                                                onUpdateItem(item.id, 'enableDiscourse', !!id);
                                                if (id) {
                                                    applyDiscourse(id, 'answerText');
                                                }
                                            }}
                                            value={item.discourseId || ''}
                                        >
                                            <option value="">-- No Discourse --</option>
                                            {availableDiscourses.map((d: Discourse) => (
                                                <option key={d.id} value={d.id}>{d.name} ({formatMarks(d.marks)} Marks)</option>
                                            ))}
                                        </select>

                                        {/* Discourse Render (Automatic Template) */}
                                        {item.discourseId && (
                                            <div className="mt-4 p-5 bg-white border border-indigo-100 rounded-xl shadow-[0_4px_20px_-5px_rgba(79,70,229,0.1)]">
                                                {(() => {
                                                    const d = availableDiscourses.find(x => x.id === item.discourseId);
                                                    if (!d) return null;
                                                    return (
                                                        <div>
                                                            <div className="text-base font-bold text-indigo-900 mb-2">{d.name}</div>
                                                            <div className="space-y-1">
                                                                {(d.rubrics || []).map((r: any, idx: number) => (
                                                                    <div key={idx} className="flex justify-between items-center text-xs text-gray-700 py-1 border-b border-gray-50 pl-2">
                                                                        <span>{r.point}</span>
                                                                        <span className="font-bold text-indigo-600">{formatMarks(r.marks)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Further Information A */}
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <label className="flex items-center gap-2 cursor-pointer group mb-2">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                            checked={!!item.enableFurtherInfo}
                                            onChange={(e) => onUpdateItem(item.id, 'enableFurtherInfo', e.target.checked)}
                                        />
                                        <span className="text-[11px] md:text-xs font-bold text-gray-700 group-hover:text-purple-600 transition-colors uppercase tracking-wider">Further Information</span>
                                    </label>
                                    
                                    {item.enableFurtherInfo && (
                                        <div className="space-y-2 animate-slide-up">
                                            <UniversalAnswerBuilder
                                                key={`further-info-a-${item.id}`}
                                                showMarks={false}
                                                blocks={item.furtherInfoBlocks && item.furtherInfoBlocks.length > 0 
                                                    ? item.furtherInfoBlocks 
                                                    : (item.furtherInfo ? convertHtmlToAnswerBlocks(item.furtherInfo, "Type your content here...") : [])}
                                                onChange={(blocks) => {
                                                    onUpdateItem(item.id, 'furtherInfoBlocks', blocks);
                                                    onUpdateItem(item.id, 'furtherInfo', convertAnswerBlocksToHtml(blocks));
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Option B Answer */}
                            {item.hasInternalChoice && (
                                <div className="space-y-4 pt-6 border-t font-sans mt-6">
                                    <div className="tamil-font font-bold text-purple-600">(ஆ) Answer Key (Option B)</div>

                                    {/* Universal Answer Builder B */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center pr-1">
                                            <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest pl-1">Answer Key Content (B)</h4>
                                            <button
                                                type="button"
                                                disabled={isGenerating}
                                                onClick={() => handleGenerateAIAnswer(true)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-[10px] shadow-sm transition-all cursor-pointer active:scale-95 font-sans"
                                            >
                                                {isGenerating ? <Loader2 className="animate-spin" size={10} /> : <Sparkles size={10} />}
                                                {isGenerating ? "உருவாக்குகிறது..." : "AI மூலம் (ஆ) விடையை உருவாக்கு (Generate Answer B)"}
                                            </button>
                                        </div>
                                        <UniversalAnswerBuilder
                                            key={`answer-key-b-${item.id}`}
                                            blocks={getInitialBlocks(item.answerBlocksB, item.answerTextB, item.structuredAnswersB, item.enableInputAnswerB)}
                                            onChange={(blocks) => {
                                                onUpdateItem(item.id, 'answerBlocksB', blocks);
                                                onUpdateItem(item.id, 'enableWriteContentB', true);
                                                onUpdateItem(item.id, 'answerTextB', convertAnswerBlocksToHtml(blocks));
                                            }}
                                        />
                                    </div>

                                    {item.marksPerQuestion > 2 && (
                                        <div className="border rounded-xl p-4 bg-purple-50/30 border-purple-100 mb-4 mt-4 animate-slide-up">
                                            <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3">Select Discourse (B)</h4>
                                            <select
                                                className="w-full border p-2 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-purple-100 outline-none"
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                    const id = e.target.value;
                                                    setSelectedDiscourseIdB(id);
                                                    onUpdateItem(item.id, 'discourseIdB', id);
                                                    onUpdateItem(item.id, 'enableDiscourseB', !!id);
                                                    if (id) {
                                                        applyDiscourse(id, 'answerTextB');
                                                    }
                                                }}
                                                value={item.discourseIdB || ''}
                                            >
                                                <option value="">-- No Discourse --</option>
                                                {availableDiscourses.map((d: Discourse) => (
                                                    <option key={d.id} value={d.id}>{d.name} ({formatMarks(d.marks)} Marks)</option>
                                                ))}
                                            </select>
                                            
                                            {/* Discourse Render (Automatic Template) B */}
                                            {item.discourseIdB && (
                                                <div className="mt-4 p-5 bg-white border border-purple-100 rounded-xl shadow-[0_4px_20px_-5px_rgba(147,51,234,0.1)]">
                                                    {(() => {
                                                        const d = availableDiscourses.find(x => x.id === item.discourseIdB);
                                                        if (!d) return null;
                                                        return (
                                                            <div>
                                                                <div className="text-base font-bold text-purple-900 mb-2">{d.name}</div>
                                                                <div className="space-y-1">
                                                                    {(d.rubrics || []).map((r: any, idx: number) => (
                                                                        <div key={idx} className="flex justify-between items-center text-xs text-gray-700 py-1 border-b border-gray-50 pl-2">
                                                                            <span>{r.point}</span>
                                                                            <span className="font-bold text-purple-600">{formatMarks(r.marks)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Further Information B */}
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <label className="flex items-center gap-2 cursor-pointer group mb-2">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                checked={!!item.enableFurtherInfoB}
                                                onChange={(e) => onUpdateItem(item.id, 'enableFurtherInfoB', e.target.checked)}
                                            />
                                            <span className="text-[11px] md:text-xs font-bold text-gray-700 group-hover:text-purple-600 transition-colors uppercase tracking-wider">Further Information (B)</span>
                                        </label>
                                        
                                        {item.enableFurtherInfoB && (
                                            <div className="space-y-2 animate-slide-up">
                                                <UniversalAnswerBuilder
                                                    key={`further-info-b-${item.id}`}
                                                    showMarks={false}
                                                    blocks={item.furtherInfoBlocksB && item.furtherInfoBlocksB.length > 0 
                                                        ? item.furtherInfoBlocksB 
                                                        : (item.furtherInfoB ? convertHtmlToAnswerBlocks(item.furtherInfoB, "Type your content here...") : [])}
                                                    onChange={(blocks) => {
                                                        onUpdateItem(item.id, 'furtherInfoBlocksB', blocks);
                                                        onUpdateItem(item.id, 'furtherInfoB', convertAnswerBlocksToHtml(blocks));
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuestionRow;
