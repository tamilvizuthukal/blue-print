import React, { useState, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    Blueprint,
    Curriculum,
    BlueprintItem,
    QuestionPaperType,
    Discourse
} from '@/types';
import {
    ChevronLeft,
    RefreshCw,
    CheckCircle,
    Save,
    List,
    Settings,
    FileText
} from 'lucide-react';
import { BlueprintMatrix } from './BlueprintMatrix';
import { QuestionEntryForm } from './QuestionEntryForm';
import { ReportsView } from './ReportsView';
import { SummaryTable } from './SummaryTable';

interface UniversalBlueprintViewProps {
    blueprint: Blueprint;
    curriculum: Curriculum;
    paperType?: QuestionPaperType;
    discourses?: Discourse[];
    onBack: () => void;
    onUpdateItemField: (id: string, field: keyof BlueprintItem, val: any) => void;
    onMoveItem: (itemId: string, newUnitId: string, newSectionId: string, newSubUnitId?: string) => void;
    onSave: () => Promise<void>;
    onRegenerate: () => void;
    onConfirm: () => Promise<void>;
    onConfirmQuestions?: () => Promise<void> | void;
    onConfirmAnswerKey?: () => Promise<void> | void;
    onConfirmReport?: (reportId: string) => Promise<void> | void;
    onDownloadPDF: (type: string) => void;
    onDownloadWord: (type: string) => void;
    onUpdateReportSettings?: (settings: Blueprint['reportSettings'], perReport?: Blueprint['perReportSettings']) => void;
    onSaveSettings?: () => Promise<void>;
    isSaving?: boolean;
    isAdmin?: boolean;
    isWebmaster?: boolean;
}

const UniversalBlueprintView: React.FC<UniversalBlueprintViewProps> = ({
    blueprint,
    curriculum,
    paperType,
    discourses = [],
    isAdmin,
    isWebmaster = false,
    onBack,
    onUpdateItemField,
    onMoveItem,
    onSave,
    onRegenerate,
    onConfirm,
    onConfirmQuestions,
    onConfirmAnswerKey,
    onConfirmReport,
    onDownloadPDF,
    onDownloadWord,
    onUpdateReportSettings,
    onSaveSettings,
    isSaving = false
}) => {
    const [showQuestions, setShowQuestions] = useState(false);
    const [showReports, setShowReports] = useState(false);
    const [activeEntryCategory, setActiveEntryCategory] = useState<'question' | 'answer'>('question');
    const [collapseQuestionTabs, setCollapseQuestionTabs] = useState(true);

    useEffect(() => {
        if (!blueprint) return;
        
        const isTextEmpty = (html?: string) => {
            if (!html) return true;
            if (html.includes('<img')) return false;
            const clean = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            return clean === '';
        };

        const hasQuestionStarted = blueprint.items.some(item => 
            (item.questionText && !isTextEmpty(item.questionText)) ||
            (item.hasInternalChoice && item.questionTextB && !isTextEmpty(item.questionTextB))
        );

        const hasAnswerStarted = blueprint.items.some(item => 
            (item.answerText && !isTextEmpty(item.answerText)) ||
            (item.hasInternalChoice && item.answerTextB && !isTextEmpty(item.answerTextB)) ||
            item.discourseId || 
            item.discourseIdB || 
            (item.structuredAnswers && item.structuredAnswers.length > 0) ||
            (item.structuredAnswersB && item.structuredAnswersB.length > 0) ||
            (item.furtherInfo && item.furtherInfo.trim() !== '') ||
            (item.furtherInfoB && item.furtherInfoB.trim() !== '')
        );

        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4500,
            timerProgressBar: true
        });

        // 1. Question Paper Alert
        let qIcon: 'success' | 'warning' | 'error' = 'error';
        let qText = '';
        if (blueprint.isQuestionConfirmed) {
            qIcon = 'success';
            qText = 'Question Paper Confirmed';
        } else if (hasQuestionStarted) {
            qIcon = 'warning';
            qText = 'Question Paper Pending';
        } else {
            qIcon = 'error';
            qText = 'Question Paper Not Started Yet! Please start quickly.';
        }

        // 2. Answer Key Alert
        let aIcon: 'success' | 'warning' | 'error' = 'error';
        let aText = '';
        if (blueprint.isAnswerKeyConfirmed) {
            aIcon = 'success';
            aText = 'Answer Key Confirmed';
        } else if (hasAnswerStarted) {
            aIcon = 'warning';
            aText = 'Answer Key Pending';
        } else {
            aIcon = 'error';
            aText = 'Answer Key Not Started Yet! Please start quickly.';
        }

        // Trigger toasts
        Toast.fire({
            icon: qIcon,
            title: qText,
            background: qIcon === 'success' ? '#f0fdf4' : qIcon === 'warning' ? '#fffbeb' : '#fef2f2',
            color: qIcon === 'success' ? '#166534' : qIcon === 'warning' ? '#92400e' : '#991b1b',
        });

        const timer = setTimeout(() => {
            Toast.fire({
                icon: aIcon,
                title: aText,
                background: aIcon === 'success' ? '#f0fdf4' : aIcon === 'warning' ? '#fffbeb' : '#fef2f2',
                color: aIcon === 'success' ? '#166534' : aIcon === 'warning' ? '#92400e' : '#991b1b',
            });
        }, 800);

        return () => clearTimeout(timer);
    }, [blueprint.id, blueprint.isQuestionConfirmed, blueprint.isAnswerKeyConfirmed]);

    const activeMode = showReports
        ? 'Reports'
        : showQuestions
            ? 'Questions'
            : 'Matrix';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-2 no-print">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                    title="Back to List"
                    id="btn-back-to-list"
                >
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">
                        {blueprint.questionPaperTypeName}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-secondary">
                        <span>
                            {blueprint.subject} • Class {blueprint.classLevel} • {blueprint.examTerm} • {blueprint.setId}
                        </span>
                        {blueprint.isConfirmed && (
                            <CheckCircle size={14} className="text-emerald-500 animate-fade-in" />
                        )}
                    </div>
                </div>
            </div>

            {/* Navigation & Controls - Simplified */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md py-3 px-4 border-b flex flex-col md:flex-row justify-between items-center no-print shadow-md gap-4 rounded-2xl mb-6">
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    <div className="flex bg-gray-100/80 p-1 rounded-xl border border-gray-200 shadow-inner">
                        <button
                            onClick={() => { setShowQuestions(false); setShowReports(false); }}
                            className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-6 py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase tracking-widest transition-all duration-300 ${activeMode === 'Matrix' ? 'bg-white text-blue-700 shadow-md ring-1 ring-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                        >
                            <List size={14} className="flex-shrink-0" /> <span className="hidden sm:inline">1. </span>Matrix
                        </button>
                        {(blueprint.isConfirmed || isAdmin) && (
                            <button
                                onClick={() => { setShowQuestions(true); setShowReports(false); }}
                                className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-6 py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase tracking-widest transition-all duration-300 ${activeMode === 'Questions' ? 'bg-white text-blue-700 shadow-md ring-1 ring-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                            >
                                <Settings size={14} className="flex-shrink-0" /> <span className="hidden sm:inline">2. </span>Questions
                            </button>
                        )}
                        {blueprint.isConfirmed && (
                                <button
                                    onClick={() => { setShowReports(true); setShowQuestions(false); }}
                                    className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-6 py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase tracking-widest transition-all duration-300 ${activeMode === 'Reports' ? 'bg-white text-blue-700 shadow-md ring-1 ring-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                                >
                                    <FileText size={14} className="flex-shrink-0" /> <span className="hidden sm:inline">3. </span>Reports
                                </button>
                        )}
                    </div>

                    {(blueprint.isConfirmed || isAdmin) && activeMode === 'Questions' && (
                        <div className="flex items-center gap-3 bg-gray-100/80 p-1.5 rounded-xl border border-gray-200 shadow-inner">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 pl-1.5">Category:</span>
                            <div className="flex gap-2">
                                <label className="flex items-center gap-1.5 font-bold text-xs text-gray-700 cursor-pointer select-none px-2.5 py-1.5 rounded-lg hover:bg-white/50 transition-all">
                                    <input 
                                        type="radio" 
                                        name="category_selection" 
                                        checked={activeEntryCategory === 'question'} 
                                        onChange={() => setActiveEntryCategory('question')}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                    />
                                    <span>Question</span>
                                </label>
                                <label className="flex items-center gap-1.5 font-bold text-xs text-gray-700 cursor-pointer select-none px-2.5 py-1.5 rounded-lg hover:bg-white/50 transition-all">
                                    <input 
                                        type="radio" 
                                        name="category_selection" 
                                        checked={activeEntryCategory === 'answer'} 
                                        onChange={() => setActiveEntryCategory('answer')}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                    />
                                    <span>Answer</span>
                                </label>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={collapseQuestionTabs}
                                onClick={() => setCollapseQuestionTabs(value => !value)}
                                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${collapseQuestionTabs ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-300'}`}
                                title={collapseQuestionTabs ? 'வினாக்களை தனித்தனி tab-களில் காட்டுகிறது' : 'குழுவின் அனைத்து வினாக்களையும் தொடர்ந்து காட்டுகிறது'}
                            >
                                <span className={`relative h-4 w-7 rounded-full transition-colors ${collapseQuestionTabs ? 'bg-indigo-300' : 'bg-slate-300'}`}>
                                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${collapseQuestionTabs ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                </span>
                                Collapse Tabs {collapseQuestionTabs ? 'On' : 'Off'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${activeMode === 'Reports' ? 'p-0 border-none bg-transparent shadow-none' : activeMode === 'Questions' ? 'p-0' : activeMode === 'Matrix' ? 'sm:p-6 p-1 border-none sm:border-solid shadow-sm sm:shadow-md' : 'p-6'}`}>
                {activeMode === 'Matrix' && (
                    <BlueprintMatrix
                        blueprint={blueprint}
                        curriculum={curriculum}
                        onUpdateItem={onUpdateItemField}
                        onMoveItem={onMoveItem}
                        paperType={paperType!}
                        isAdmin={isAdmin}
                        readOnly={blueprint.isConfirmed && !isAdmin}
                        onRegenerate={onRegenerate}
                        onConfirm={onConfirm}
                        onSave={onSave}
                        isSaving={isSaving}
                    />
                )}

                {activeMode === 'Questions' && (blueprint.isConfirmed || isAdmin) && (
                    <QuestionEntryForm
                        blueprint={blueprint}
                        onUpdateItem={onUpdateItemField}
                        onSave={onSave}
                        isSaving={isSaving}
                        paperType={paperType}
                        isAdmin={isAdmin}
                        onConfirmQuestions={onConfirmQuestions}
                        onConfirmAnswerKey={onConfirmAnswerKey}
                        collapseQuestionTabs={collapseQuestionTabs}
                        activeEntryCategory={activeEntryCategory}
                        onChangeEntryCategory={setActiveEntryCategory}
                    />
                )}

                {activeMode === 'Reports' && (
                    <ReportsView
                        blueprint={blueprint}
                        curriculum={curriculum}
                        discourses={discourses}
                        paperType={paperType}
                        onDownloadPDF={onDownloadPDF}
                        onDownloadWord={onDownloadWord}
                        isAdmin={isAdmin}
                        isWebmaster={isWebmaster}
                        confirmedReports={blueprint.confirmedReports}
                        onConfirmReport={onConfirmReport}
                        onMoveItem={onMoveItem}
                        onUpdateItemField={onUpdateItemField}
                        onUpdateReportSettings={onUpdateReportSettings}
                        onSaveSettings={onSaveSettings}
                        onConfirmAnswerKey={onConfirmAnswerKey}
                    />
                )}
            </div>
        </div>
    );
};

export default UniversalBlueprintView;
