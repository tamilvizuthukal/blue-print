
import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import {
    LayoutDashboard, BookOpen, Settings, FileType, List, Users, Menu, X, LogOut, FileText, ChevronLeft, ChevronRight, Save, Download, ClipboardList, RefreshCw, CheckCircle, Sliders, Book
} from 'lucide-react';

import { User, Blueprint, ClassLevel, SubjectType, ExamTerm, BlueprintItem, Curriculum, QuestionPaperType, Discourse, KnowledgeLevel } from '../types';
import AdminDashboard from './AdminDashboard';
import AdminCurriculumManager from './AdminCurriculumManager';
import AdminExamConfigManager from './AdminExamConfigManager';
import AdminPaperTypeManager from './AdminPaperTypeManager';
import AdminUserManager from './AdminUserManager';
import AdminDiscourseManager from './AdminDiscourseManager';
import AdminQuestionPaperManager from './AdminQuestionPaperManager';
import AdminQuestionConsolidator from './AdminQuestionConsolidator';
import AdminAssignmentManager from './AdminAssignmentManager';
import AdminTeacherDetailsView from './AdminTeacherDetailsView';
import AdminAppSettingsManager from './AdminAppSettingsManager';
import AdminDictionaryManager from './AdminDictionaryManager';
import { getCurriculum, getQuestionPaperTypes, saveBlueprint, getDB, initDB, filterCurriculumByTerm, getDiscourses, getBlueprintById, generateBlueprintTemplate } from '../services/db';
import UniversalBlueprintView from './UniversalBlueprintView';
import { useExport } from '@/hooks/useExport';
import { ensureBlueprintItemsHaveQNo } from '../utils/reportCalculations';

const GraduationCap = ({ size, className }: { size: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
);

const AdminPortal = ({ user, onLogout }: { user: User, onLogout: () => void }) => {
    const { handleDownloadPDF: exportPDF, handleDownloadWord: exportWord } = useExport();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'curriculum' | 'config' | 'papertype' | 'users' | 'discourses' | 'blueprints' | 'consolidated' | 'assignment' | 'teacher_details' | 'settings' | 'dictionary'>(() => {
        const saved = localStorage.getItem('admin_active_tab');
        // Migrate old 'reports' tab to dashboard
        if (saved === 'reports') return 'dashboard';
        return (saved as any) || 'dashboard';
    });
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isDesktopCollapsed, setDesktopCollapsed] = useState(() => {
        const saved = localStorage.getItem('admin_sidebar_collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('admin_active_tab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        localStorage.setItem('admin_sidebar_collapsed', String(isDesktopCollapsed));
    }, [isDesktopCollapsed]);

    // Viewing/Editing Paper State
    const [viewingBlueprint, setViewingBlueprint] = useState<Blueprint | null>(null);
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [paperTypes, setPaperTypes] = useState<QuestionPaperType[]>([]);
    const [discourses, setDiscourses] = useState<Discourse[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const blueprintRef = useRef<Blueprint | null>(null);

    useEffect(() => {
        blueprintRef.current = viewingBlueprint;
    }, [viewingBlueprint]);

    useEffect(() => {
        const load = async () => {
            const [types, disc] = await Promise.all([
                getQuestionPaperTypes(),
                getDiscourses()
            ]);
            setPaperTypes(types);
            setDiscourses(disc);
        };
        load();
    }, []);

    useEffect(() => {
        const load = async () => {
            if (viewingBlueprint) {
                const cur = await getCurriculum(viewingBlueprint.classLevel, viewingBlueprint.subject);
                const db = getDB() || await initDB();
                setCurriculum(filterCurriculumByTerm(db, cur, viewingBlueprint.examTerm));
            } else {
                setCurriculum(null);
            }
        };
        load();
    }, [viewingBlueprint]);

    const handleEditBlueprint = async (bp: Blueprint) => {
        try {
            const fullBp = await getBlueprintById(bp.id);
            if (fullBp) {
                const db = getDB() || await initDB();
                const paperType = paperTypes.find(p => p.id === fullBp.questionPaperTypeId);
                const cur = db.curriculums.find(c => c.classLevel === fullBp.classLevel && c.subject === fullBp.subject);
                const filteredCur = filterCurriculumByTerm(db, cur, fullBp.examTerm);
                
                const bpWithQNo = {
                    ...fullBp,
                    items: ensureBlueprintItemsHaveQNo(fullBp.items, filteredCur || null, paperType)
                };
                setViewingBlueprint(bpWithQNo);
            } else {
                Swal.fire("Error", "Could not load full blueprint data", "error");
            }
        } catch (error) {
            console.error("Failed to load blueprint:", error);
            Swal.fire("Error", "Failed to load blueprint details", "error");
        }
    };

    const handleSaveBlueprint = async () => {
        const latestBlueprint = blueprintRef.current;
        if (!latestBlueprint) return;
        setIsSaving(true);
        try {
            await saveBlueprint(latestBlueprint);
            Swal.fire("Saved", "Blueprint saved successfully!", "success");
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmQuestions = async () => {
        if (!viewingBlueprint) return;
        const confirmed = { ...viewingBlueprint, isQuestionConfirmed: true };
        setViewingBlueprint(confirmed);
        setIsSaving(true);
        try {
            await saveBlueprint(confirmed);
            Swal.fire("Confirmed", "Question Paper confirmed successfully!", "success");
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmAnswerKey = async () => {
        if (!viewingBlueprint) return;
        const confirmed = { ...viewingBlueprint, isAnswerKeyConfirmed: true };
        setViewingBlueprint(confirmed);
        setIsSaving(true);
        try {
            await saveBlueprint(confirmed);
            Swal.fire("Confirmed", "Answer Key confirmed successfully!", "success");
        } finally {
            setIsSaving(false);
        }
    };

    const updateItemField = (id: string, field: keyof BlueprintItem, val: any) => {
        setViewingBlueprint(prev => {
            if (!prev) return prev;
            const newItems = prev.items.map(item => {
                if (item.id !== id) return item;
                const updated = { ...item, [field]: val };
                if (field === 'questionCount') {
                    updated.totalMarks = updated.marksPerQuestion * (Number(val) || 0);
                }
                if (updated.hasInternalChoice) {
                    if (field === 'knowledgeLevel') updated.knowledgeLevelB = val as KnowledgeLevel;
                    else if (field === 'knowledgeLevelB') updated.knowledgeLevelB = updated.knowledgeLevel;
                    else updated.knowledgeLevelB = updated.knowledgeLevelB || updated.knowledgeLevel;
                    updated.unitIdB = updated.unitId;
                    updated.subUnitIdB = updated.subUnitIdB || updated.subUnitId;
                    updated.itemFormatB = updated.itemFormatB || updated.itemFormat;
                } else {
                    updated.unitIdB = undefined;
                    updated.subUnitIdB = undefined;
                    updated.knowledgeLevelB = undefined;
                    updated.cognitiveProcessB = undefined;
                    updated.itemFormatB = undefined;
                }
                return updated;
            });
            return { ...prev, items: newItems };
        });
    };

    const handleDownloadPDF = (type: string = 'all') => exportPDF(viewingBlueprint, curriculum, type, true);
    const handleDownloadWord = (type: string = 'all') => exportWord(viewingBlueprint, curriculum, discourses, type);

    const handleMoveItem = (itemId: string, newUnitId: string, newSectionId: string, newSubUnitId?: string) => {
        if (!viewingBlueprint || !curriculum) return;
        const newUnit = curriculum.units.find(u => u.id === newUnitId);
        if (!newUnit) return;
        
        const updatedItems = viewingBlueprint.items.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    unitId: newUnitId,
                    subUnitId: newSubUnitId || newUnit.subUnits[0]?.id || 'unknown',
                    unitIdB: item.hasInternalChoice ? newUnitId : undefined,
                    subUnitIdB: item.hasInternalChoice ? (item.unitId === newUnitId ? (item.subUnitIdB || newSubUnitId || newUnit.subUnits[0]?.id || 'unknown') : (newSubUnitId || newUnit.subUnits[0]?.id || 'unknown')) : undefined,
                };
            }
            return item;
        });
        setViewingBlueprint({ ...viewingBlueprint, items: updatedItems });
    };

    const handleRegenerateBlueprint = async () => {
        if (!viewingBlueprint || !curriculum) return;

        const result = await Swal.fire({
            title: 'Reset Blueprint?',
            text: "This will regenerate all items according to unit weightages and strict KL targets (12/20/8). Existing questions will be lost.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, Reset it!'
        });

        if (result.isConfirmed) {
            try {
                const db = getDB() || await initDB();
                const newItems = generateBlueprintTemplate(
                    db, 
                    curriculum, 
                    viewingBlueprint.examTerm, 
                    viewingBlueprint.questionPaperTypeId
                );
                
                if (newItems.length > 0) {
                    setViewingBlueprint({ ...viewingBlueprint, items: newItems });
                    Swal.fire("Success", "Blueprint has been reset and optimized.", "success");
                } else {
                    Swal.fire("Error", "Failed to generate blueprint template. Check configuration.", "error");
                }
            } catch (err) {
                console.error(err);
                Swal.fire("Error", "An unexpected error occurred during regeneration.", "error");
            }
        }
    };

    const renderContent = () => {
        if (viewingBlueprint && curriculum) {
            return (
                <UniversalBlueprintView
                    blueprint={viewingBlueprint}
                    curriculum={curriculum}
                    paperType={paperTypes.find(p => p.id === viewingBlueprint.questionPaperTypeId)}
                    discourses={discourses}
                    isAdmin={true}
                    onBack={() => setViewingBlueprint(null)}
                    onUpdateItemField={updateItemField}
                    onMoveItem={handleMoveItem} 
                    onSave={handleSaveBlueprint}
                    onRegenerate={handleRegenerateBlueprint} 
                    onConfirm={async () => {}}
                    onConfirmQuestions={handleConfirmQuestions}
                    onConfirmAnswerKey={handleConfirmAnswerKey}
                    onDownloadPDF={handleDownloadPDF}
                    onDownloadWord={handleDownloadWord}
                    onUpdateReportSettings={(s, p) => setViewingBlueprint(prev => prev ? { ...prev, reportSettings: s, perReportSettings: p } : null)}
                    onSaveSettings={handleSaveBlueprint}
                    isSaving={isSaving}
                />
            );
        }

        switch (activeTab) {
            case 'dashboard': return <AdminDashboard onEditBlueprint={handleEditBlueprint} />;
            case 'curriculum': return <AdminCurriculumManager />;
            case 'config': return <AdminExamConfigManager />;
            case 'papertype': return <AdminPaperTypeManager />;
            case 'users': return <AdminUserManager />;
            case 'discourses': return <AdminDiscourseManager />;
            case 'blueprints': return <AdminQuestionPaperManager onEditBlueprint={handleEditBlueprint} />;
            case 'consolidated': return <AdminQuestionConsolidator />;
            case 'assignment': return <AdminAssignmentManager />;
            case 'teacher_details': return <AdminTeacherDetailsView />;
            case 'settings': return <AdminAppSettingsManager />;
            case 'dictionary': return <AdminDictionaryManager />;
            default: return <AdminDashboard onEditBlueprint={handleEditBlueprint} />;
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'blueprints', label: 'Blue Print Config', icon: FileText },
        { id: 'consolidated', label: 'Consolidated QP', icon: ClipboardList },
        { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
        { id: 'config', label: 'Weightage Config', icon: Sliders },
        { id: 'papertype', label: 'Question Types', icon: FileType },
        { id: 'discourses', label: 'Discourses', icon: List },
        { id: 'dictionary', label: 'Tamil Dictionary', icon: Book },
        { id: 'assignment', label: 'QP Assignments', icon: RefreshCw },
        { id: 'teacher_details', label: 'Teacher DB', icon: GraduationCap },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'settings', label: 'App Settings', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-100 transform transition-all duration-300 lg:translate-x-0 lg:static
                ${isDesktopCollapsed ? 'lg:w-20' : 'lg:w-72'}
                w-72
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex flex-col h-full overflow-hidden">
                    <div className={`p-6 flex items-center justify-between transition-all duration-300 ${isDesktopCollapsed ? 'lg:flex-col lg:gap-4 lg:px-4' : ''}`}>
                        <div className={`flex items-center gap-3 ${isDesktopCollapsed ? 'lg:flex-col lg:gap-2' : ''}`}>
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 overflow-hidden border border-gray-50 shrink-0">
                                <img src="/img/logo.png" alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className={`transition-all duration-300 ${isDesktopCollapsed ? 'lg:hidden' : 'block'}`}>
                                <h1 className="font-black text-gray-900 tracking-tight leading-none">ADMIN</h1>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Control Center</p>
                            </div>
                        </div>
                        <button className="lg:hidden p-2 text-gray-400" onClick={() => setSidebarOpen(false)}>
                            <X size={20} />
                        </button>
                        <button 
                            className="hidden lg:flex p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" 
                            onClick={() => setDesktopCollapsed(!isDesktopCollapsed)}
                            title={isDesktopCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        >
                            {isDesktopCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                        </button>
                    </div>

                    <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id || (item.id === 'blueprints' && viewingBlueprint);
                            
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveTab(item.id as any);
                                        setSidebarOpen(false);
                                        setViewingBlueprint(null);
                                    }}
                                    className={`
                                        w-full flex items-center transition-all duration-200 group relative
                                        ${isDesktopCollapsed ? 'lg:justify-center lg:px-0 lg:py-3' : 'px-4 py-3 gap-3'}
                                        ${isActive
                                            ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                                    `}
                                    title={isDesktopCollapsed ? item.label : undefined}
                                >
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-r-full" />
                                    )}
                                    <Icon size={18} className={`${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'} shrink-0`} />
                                    <span className={`text-sm ${isActive ? 'font-black' : 'font-bold'} transition-all duration-300 ${isDesktopCollapsed ? 'lg:hidden' : 'block'}`}>{item.label}</span>
                                    {isActive && !isDesktopCollapsed && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    <div className={`p-4 border-t border-gray-50 transition-all duration-300 ${isDesktopCollapsed ? 'lg:p-2' : ''}`}>
                        <div className={`bg-gray-50 rounded-2xl p-4 flex items-center gap-3 transition-all duration-300 ${isDesktopCollapsed ? 'lg:flex-col lg:p-2 lg:gap-2' : ''}`}>
                            <div 
                                className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0"
                                title={isDesktopCollapsed ? user.name : undefined}
                            >
                                {user.name.charAt(0)}
                            </div>
                            <div className={`flex-1 overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'lg:hidden' : 'block'}`}>
                                <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">System Admin</p>
                            </div>
                            <button 
                                onClick={onLogout}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"
                                title="Logout"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar bg-[#f8fafc]">
                <header className="h-20 bg-white border-b border-gray-50 flex items-center px-4 lg:px-8 lg:hidden no-print">
                    <button 
                        className="p-2 -ml-2 text-gray-400"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu size={24} />
                    </button>
                    <div className="ml-4 flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            <Settings size={16} />
                        </div>
                        <span className="font-black text-gray-900 tracking-tight text-sm uppercase">Admin Panel</span>
                    </div>
                </header>

                <div className={`${activeTab === 'consolidated' ? 'w-full h-full' : viewingBlueprint ? 'max-w-7xl mx-auto sm:p-4 lg:p-10 p-0.5' : 'max-w-7xl mx-auto p-4 lg:p-10'}`}>
                    {renderContent()}
                </div>
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                
                @media print {
                    .no-print { display: none !important; }
                    
                    html, body, #root, .flex.h-screen {
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    
                    main { 
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important; 
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                    }

                    .max-w-7xl {
                        max-width: none !important;
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    aside {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default AdminPortal;
