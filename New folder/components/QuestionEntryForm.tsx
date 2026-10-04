import React, { useEffect, useState, useMemo } from 'react';
import { Edit2, Layers, Save, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Swal from 'sweetalert2';
import { Blueprint, BlueprintItem, QuestionPaperType, SystemSettings, Discourse, Curriculum } from '../types';
import { getSettings, getDiscourses, getCurriculum, getDB, initDB, filterCurriculumByTerm } from '../services/db';
import QuestionRow from './QuestionRow';
import { computeQuestionNumbersMap } from './BlueprintMatrix';
import { sortBlueprintItems } from '../utils/reportCalculations';


export const QuestionEntryForm = ({ 
    blueprint, 
    onUpdateItem, 
    paperType, 
    onSave, 
    isSaving, 
    isAdmin, 
    onConfirmQuestions,
    onConfirmAnswerKey,
    activeEntryCategory = 'question',
    onChangeEntryCategory
}: {
    blueprint: Blueprint,
    onUpdateItem: (id: string, field: keyof BlueprintItem | Partial<BlueprintItem>, val?: any) => void,
    paperType?: QuestionPaperType,
    onSave?: () => void,
    isSaving?: boolean,
    isAdmin?: boolean,
    onConfirmQuestions?: () => void,
    onConfirmAnswerKey?: () => void,
    activeEntryCategory?: 'question' | 'answer',
    onChangeEntryCategory?: (cat: 'question' | 'answer') => void
}) => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [discourses, setDiscourses] = useState<Discourse[]>([]);
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [localSaving, setLocalSaving] = useState(false);

    // ─── Answer Key Validation Helpers ─────────────────────────────────────
    const isAnswerOptionFilled = (item: BlueprintItem, isB: boolean) => {
        const prefix = isB ? 'B' : '';
        const enableWrite = item[`enableWriteContent${prefix}` as keyof BlueprintItem];
        const enableDisc = item[`enableDiscourse${prefix}` as keyof BlueprintItem];
        const enableInput = item[`enableInputAnswer${prefix}` as keyof BlueprintItem];
        const enableInfo = item[`enableFurtherInfo${prefix}` as keyof BlueprintItem];
        const text = item[`answerText${prefix}` as keyof BlueprintItem] as string;
        const discId = item[`discourseId${prefix}` as keyof BlueprintItem] as string;
        const struct = item[`structuredAnswers${prefix}` as keyof BlueprintItem] as any[];
        const info = item[`furtherInfo${prefix}` as keyof BlueprintItem] as string;
        
        if (!enableWrite && !enableDisc && !enableInput && !enableInfo) return false;
        
        if (enableWrite && (!text || text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '')) return false;
        if (enableDisc && !discId) return false;
        if (enableInput && (!struct || struct.length === 0 || struct.every(v => !v.answer || v.answer.trim() === ''))) return false;
        if (enableInfo && (!info || info.trim() === '')) return false;
        
        return true;
    };

    const answerValidationErrors = useMemo(() => {
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

    // ─── Real-time Time Validation ──────────────────────────────────────────
    const totalTime = useMemo(() => {
        return blueprint.items.reduce((sum, item) => sum + (item.time || 0), 0);
    }, [blueprint.items]);

    const isTimeInvalid = totalTime !== 90;

    const isTextEmpty = (html?: string) => {
        if (!html) return true;
        if (html.includes('<img')) return false;
        const clean = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        return clean === '';
    };

    const questionValidationErrors = useMemo(() => {
        const errors: string[] = [];
        // 1. Total time must be exactly 90
        if (totalTime !== 90) {
            errors.push(`மொத்த நேரம் 90 நிமிடங்களாக இருக்க வேண்டும் (தற்போதைய நேரம்: ${totalTime} நிமிடங்கள்).`);
        }
        
        // 2. Every question must be filled
        let missingCount = 0;
        blueprint.items.forEach((item, idx) => {
            if (isTextEmpty(item.questionText)) {
                missingCount++;
            }
            if (item.hasInternalChoice && isTextEmpty(item.questionTextB)) {
                missingCount++;
            }
        });
        
        if (missingCount > 0) {
            errors.push(`${missingCount} வினாக்களுக்கான உரை உள்ளீடுகள் விடுபட்டுள்ளன.`);
        }
        
        return errors;
    }, [blueprint.items, totalTime]);

    const isQuestionConfirmable = questionValidationErrors.length === 0;

    const handleLocalUpdate = (id: string, field: keyof BlueprintItem | Partial<BlueprintItem>, val?: any) => {
        setHasChanges(true);
        onUpdateItem(id, field, val);
    };
    const handleSave = async () => {
        if (!onSave) return;
        setLocalSaving(true);
        try {
            await onSave();
            setHasChanges(false);
        } finally {
            setTimeout(() => setLocalSaving(false), 1000);
        }
    };

    const isCurrentlySaving = isSaving || localSaving;
    const isReadyToSave = hasChanges || isCurrentlySaving;

    useEffect(() => {
        const load = async () => {
            const [settingsData, discourseData, curriculumData] = await Promise.all([
                getSettings(),
                getDiscourses(),
                getCurriculum(blueprint.classLevel, blueprint.subject)
            ]);
            const db = getDB() || await initDB();
            setSettings(settingsData);
            setDiscourses(discourseData || []);
            setCurriculum(filterCurriculumByTerm(db, curriculumData, blueprint.examTerm));
        };
        load();
    }, [blueprint.classLevel, blueprint.subject, blueprint.examTerm]);

    const sortedItems = useMemo(() =>
        sortBlueprintItems(blueprint.items, curriculum, paperType),
        [blueprint.items, curriculum, paperType]
    );

    const sections = useMemo(() =>
        [...(paperType?.sections || [])].sort((a, b) => a.marks - b.marks),
        [paperType]
    );

    const questionNumbersMap = useMemo(() =>
        computeQuestionNumbersMap(blueprint.items, sections, curriculum, paperType),
        [blueprint.items, sections, curriculum, paperType]
    );

    // Group questions by marksPerQuestion
    const groupedByMarks = useMemo(() => {
        const groups: Record<number, typeof sortedItems> = {};
        sortedItems.forEach(item => {
            const m = item.marksPerQuestion;
            if (!groups[m]) groups[m] = [];
            groups[m].push(item);
        });
        return groups;
    }, [sortedItems]);

    // Sorted array of unique marks
    const availableMarks = useMemo(() => {
        return Object.keys(groupedByMarks)
            .map(Number)
            .sort((a, b) => a - b);
    }, [groupedByMarks]);

    const [activeMark, setActiveMark] = useState<number | null>(null);
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

    // Auto-select first available mark tab and question
    useEffect(() => {
        if (availableMarks.length > 0) {
            const currentMark = activeMark === null || !availableMarks.includes(activeMark) 
                ? availableMarks[0] 
                : activeMark;
            
            if (activeMark !== currentMark) {
                setActiveMark(currentMark);
                // Reset active question for the new mark
                const items = groupedByMarks[currentMark] || [];
                if (items.length > 0) {
                    setActiveQuestionId(items[0].id);
                } else {
                    setActiveQuestionId(null);
                }
            } else {
                // Same mark, ensure the active question is valid
                const items = groupedByMarks[currentMark] || [];
                if (items.length > 0) {
                    if (!activeQuestionId || !items.some(it => it.id === activeQuestionId)) {
                        setActiveQuestionId(items[0].id);
                    }
                } else {
                    setActiveQuestionId(null);
                }
            }
        } else {
            setActiveMark(null);
            setActiveQuestionId(null);
        }
    }, [availableMarks, activeMark, groupedByMarks]);

    const activeItem = useMemo(() => {
        if (!activeQuestionId) return null;
        return sortedItems.find(it => it.id === activeQuestionId) || null;
    }, [activeQuestionId, sortedItems]);

    const activeSection = useMemo(() => {
        if (!activeItem) return null;
        return paperType?.sections.find(s => s.id === activeItem.sectionId) || null;
    }, [activeItem, paperType]);

    if (!settings) {
        return (
            <div className="bg-white p-6 rounded shadow mt-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                    <Edit2 size={24} className="text-blue-600" />
                    Question & Answer Entry
                </h2>
                <p className="text-sm text-gray-500">Loading question editor...</p>
            </div>
        );
    }

    // Helper to format mixed language text (Tamil in TAU-Paalai, English/Numbers in Times New Roman)
    const formatInstruction = (text: string) => {
        if (!text) return null;
        
        // Regex to identify English alphanumeric parts and punctuation commonly used with them
        const parts = text.split(/([a-zA-Z0-9.,()\-\/:#]+)/g);
        
        return parts.map((part, i) => {
            if (/^[a-zA-Z0-9.,()\-\/:#]+$/.test(part)) {
                return <span key={i} className="english-font" style={{ fontFamily: 'Times New Roman, serif' }}>{part}</span>;
            }
            return <span key={i} className="tamil-font">{part}</span>;
        });
    };

    return (
        <div className="bg-white p-6 rounded shadow mt-6 relative">
            {/* ── Time Validation Alert (Floating Top-Right) ── */}
            <div className={`fixed top-20 right-6 z-[60] transition-all duration-500 transform ${isTimeInvalid ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-xl border-2 backdrop-blur-md ${totalTime > 90 ? 'bg-rose-50/90 border-rose-200 text-rose-700' : 'bg-amber-50/90 border-amber-200 text-amber-700'}`}>
                    <div className={`p-1.5 rounded-full ${totalTime > 90 ? 'bg-rose-100' : 'bg-amber-100'}`}>
                        <Clock size={16} className="animate-pulse" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-wider leading-none">Time Limit: 90 Min</span>
                        <span className="text-sm font-bold">
                            Current: {totalTime} Min 
                            ({totalTime > 90 ? `+${totalTime - 90}` : `-${90 - totalTime}`})
                        </span>
                    </div>
                    <AlertTriangle size={18} className="ml-1 opacity-80" />
                </div>
            </div>

            {/* ── Time Success Alert (Briefly show when perfect) ── */}
            {!isTimeInvalid && totalTime === 90 && (
                 <div className="fixed top-20 right-6 z-[60] animate-bounce-in">
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-xl border-2 border-emerald-200 bg-emerald-50/90 text-emerald-700 backdrop-blur-md">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600">
                            <CheckCircle2 size={16} />
                        </div>
                        <span className="text-sm font-bold uppercase tracking-wide">Perfect 90 Minutes</span>
                    </div>
                 </div>
            )}

            <div className="flex justify-between items-center mb-6 border-b pb-2">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Edit2 size={24} className="text-blue-600" />
                    Question & Answer Entry
                </h2>
                <button
                    onClick={handleSave}
                    disabled={isCurrentlySaving || !hasChanges}
                    className={`fixed bottom-6 right-6 w-12 h-12 md:w-14 md:h-14 rounded-full transition-all shadow-2xl flex items-center justify-center group no-print z-[100] 
                        ${isCurrentlySaving 
                            ? 'bg-blue-600 text-white cursor-wait' 
                            : hasChanges
                                ? 'bg-green-600 text-white hover:bg-green-700 hover:scale-110 shadow-green-100 active:scale-95'
                                : 'bg-gray-400 text-white opacity-60 cursor-not-allowed'
                        }`}
                    title={isCurrentlySaving ? "Saving..." : hasChanges ? "Save All Changes" : "No changes to save"}
                >
                    {isCurrentlySaving ? (
                        <RefreshCw size={20} className="animate-spin" />
                    ) : (
                        <div className="relative">
                            <Save size={20} className={hasChanges ? "group-hover:rotate-12 transition-transform" : ""} />
                            {hasChanges && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </div>
                    )}
                </button>
            </div>

            {/* Confirmation Status Banner */}
            <div className="mb-6 p-4 rounded-2xl border transition-all no-print bg-white shadow-sm">
                {activeEntryCategory === 'question' ? (
                    blueprint.isQuestionConfirmed ? (
                        <div className="flex items-center justify-between bg-emerald-50 border-emerald-200 p-4 rounded-xl text-emerald-800">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
                                <div>
                                    <h4 className="font-bold text-sm">Question Paper Confirmed</h4>
                                    <p className="text-xs opacity-90 mt-0.5">The question paper has been confirmed successfully.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border ${isQuestionConfirmable ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                            <div className="flex items-start gap-3">
                                {isQuestionConfirmable ? (
                                    <CheckCircle2 className="text-blue-500 shrink-0 mt-0.5" size={24} />
                                ) : (
                                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={24} />
                                )}
                                <div>
                                    <h4 className="font-bold text-sm">
                                        {isQuestionConfirmable 
                                            ? 'Question Paper Ready to Confirm' 
                                            : 'Question Paper Pending Confirmation'
                                        }
                                    </h4>
                                    {questionValidationErrors.length > 0 ? (
                                        <ul className="text-xs list-disc list-inside mt-1 space-y-0.5 opacity-90">
                                            {questionValidationErrors.map((err, idx) => (
                                                <li key={idx}>{err}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs opacity-90 mt-0.5">All questions have been entered, and the total time is correctly set to 90 minutes.</p>
                                    )}
                                </div>
                            </div>
                            {isQuestionConfirmable && onConfirmQuestions && (
                                <button
                                    onClick={async () => {
                                        const res = await Swal.fire({
                                            title: 'Are you sure?',
                                            text: 'Once confirmed, you will not be able to edit the question paper. Do you want to proceed?',
                                            icon: 'warning',
                                            showCancelButton: true,
                                            confirmButtonColor: '#2563eb',
                                            cancelButtonColor: '#64748b',
                                            confirmButtonText: 'Yes, Confirm',
                                            cancelButtonText: 'Cancel'
                                        });
                                        if (res.isConfirmed) {
                                            onConfirmQuestions();
                                        }
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-100 flex items-center gap-1.5 shrink-0 self-start md:self-center cursor-pointer border-0"
                                >
                                    <CheckCircle2 size={14} /> Confirm Question Paper
                                </button>
                            )}
                        </div>
                    )
                ) : (
                    blueprint.isAnswerKeyConfirmed ? (
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
                                            confirmButtonText: 'Yes, Confirm',
                                            cancelButtonText: 'Cancel'
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
                    )
                )}
            </div>

            {/* Mark Grouping Tabs */}
            {availableMarks.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6 border-b pb-4 no-print">
                    {availableMarks.map(mark => {
                        const count = groupedByMarks[mark]?.length || 0;
                        const isActive = activeMark === mark;
                        
                        const formatMarkText = (m: number) => {
                            const s = m.toString();
                            if (s.endsWith('.5')) {
                                const whole = s.split('.')[0];
                                return whole === '0' ? '½' : `${whole}½`;
                            }
                            return s;
                        };

                        const markStr = formatMarkText(mark);

                        return (
                            <button
                                key={mark}
                                onClick={() => setActiveMark(mark)}
                                className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 border flex items-center gap-2 cursor-pointer
                                    ${isActive 
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100 scale-102' 
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                            >
                                <span className="english-font text-sm font-bold">
                                    {markStr} Mark
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Section Instruction */}
            {activeSection?.instruction && (
                <div className="mb-4 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg shadow-sm animate-fade-in group">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <div className="bg-amber-100 text-amber-700 p-1 rounded">
                                <Layers size={14} />
                            </div>
                            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">SECTION INSTRUCTION</div>
                        </div>
                    </div>
                    <p className="text-[14px] font-bold text-amber-900 leading-relaxed">
                        {formatInstruction(activeSection.instruction)}
                    </p>
                </div>
            )}

            {/* Question Number Tabs */}
            {activeMark !== null && (groupedByMarks[activeMark]?.length || 0) > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-6 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 no-print">
                    <div className="flex flex-wrap gap-1.5">
                        {(groupedByMarks[activeMark] || []).map((item) => {
                            const qNum = questionNumbersMap.get(item.id) || `Q`;
                            const isActive = item.id === activeQuestionId;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveQuestionId(item.id)}
                                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer border
                                        ${isActive 
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm scale-105 shadow-blue-100' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`}
                                >
                                    Q {qNum}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Active Question Editor */}
            {activeItem ? (
                <div className="animate-fade-in">
                    {(() => {
                        const itemDiscourses = discourses.filter(d =>
                            d.subject === blueprint.subject &&
                            d.marks === activeItem.marksPerQuestion
                        );
                        const originalIndex = sortedItems.findIndex(si => si.id === activeItem.id);

                        return (
                            <QuestionRow
                                key={activeItem.id}
                                item={activeItem}
                                index={originalIndex !== -1 ? originalIndex : 0}
                                qNumber={questionNumbersMap.get(activeItem.id)}
                                onUpdateItem={handleLocalUpdate}
                                availableDiscourses={itemDiscourses}
                                systemSettings={settings}
                                curriculum={curriculum}
                                section={activeSection}
                                sectionItems={sortedItems.filter(si => si.sectionId === activeItem.sectionId)}
                                isAdmin={isAdmin}
                                activeEntryCategory={activeEntryCategory}
                                onChangeEntryCategory={onChangeEntryCategory}
                            />
                        );
                    })()}
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500 italic">
                    No questions found.
                </div>
            )}
        </div>
    );
};

export default QuestionEntryForm;
