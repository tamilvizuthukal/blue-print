import React, { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
    Role, ClassLevel, SubjectType, ExamTerm,
    BlueprintItem, Blueprint, ItemFormat, KnowledgeLevel, CognitiveProcess, Unit, SubUnit, Curriculum, User, QuestionPaperType, Discourse, ExamConfiguration
} from '@/types';
import {
    generateBlueprintTemplate, getCurriculum,
    getDB, initDB, saveBlueprint, deleteBlueprint, getQuestionPaperTypes, getUsers,
    getDefaultFormat, getDefaultKnowledge, getAllAccessibleBlueprints, filterCurriculumByTerm, getDiscourses, getBlueprintById,
    getExamConfigs, getFilteredCurriculum, getCurrentAcademicYear
} from '@/services/db';
import {
    Trash2, Plus, Download, LogOut, FileText,
    Settings, Edit2, Edit3, Save, UserCircle, LayoutDashboard, ChevronLeft, List, CheckCircle, RefreshCw, Clock,
    Share2, Lock, ChevronDown, ChevronUp, Sparkles, BookOpen, GraduationCap, Filter
} from 'lucide-react';
import { useExport } from '@/hooks/useExport';
import { ensureBlueprintItemsHaveQNo } from '../utils/reportCalculations';
import BlueprintSharingModal from './BlueprintSharingModal';
import { QuestionEntryForm } from './QuestionEntryForm';
import { BlueprintMatrix } from './BlueprintMatrix';
import { ReportsView } from './ReportsView';
import { SummaryTable } from './SummaryTable';
import UniversalBlueprintView from './UniversalBlueprintView';
import UserProfile from './UserProfile';
import { TableRowSkeleton, CardSkeleton } from './LoadingSkeleton';

interface UserDashboardProps {
    user: User;
    onLogout: () => void;
    onUpdateUser: (user: User) => void;
}

// ─── Expanded Gradient palette ───────────────────────────────────────────────
const CARD_GRADIENTS = [
    { from: '#6366f1', to: '#8b5cf6', accent: '#c4b5fd' },
    { from: '#ec4899', to: '#f43f5e', accent: '#fda4af' },
    { from: '#10b981', to: '#059669', accent: '#6ee7b7' },
    { from: '#f59e0b', to: '#d97706', accent: '#fde68a' },
    { from: '#06b6d4', to: '#0891b2', accent: '#93c5fd' },
    { from: '#8b5cf6', to: '#7c3aed', accent: '#e9d5ff' },
    { from: '#f43f5e', to: '#e11d48', accent: '#fecdd3' },
    { from: '#3b82f6', to: '#2563eb', accent: '#bfdbfe' },
    { from: '#84cc16', to: '#65a30d', accent: '#d9f99d' },
    { from: '#0ea5e9', to: '#0284c7', accent: '#bae6fd' },
    { from: '#d946ef', to: '#c026d3', accent: '#f5d0fe' },
    { from: '#64748b', to: '#475569', accent: '#e2e8f0' },
];

const calculateAcademicYear = () => {
    const now = new Date();
    const month = now.getMonth(); // 0 = Jan, 5 = June
    const year = now.getFullYear();
    const startYear = month >= 5 ? year : year - 1;
    const endYear = (startYear + 1) % 100;
    const endYearStr = endYear.toString().padStart(2, '0');
    return `${startYear}-${endYearStr}`;
};

const UserDashboard: React.FC<UserDashboardProps> = ({ user, onLogout, onUpdateUser }) => {
    const { handleDownloadPDF: exportPDF, handleDownloadWord: exportWord } = useExport();
    const [view, setView] = useState<'list' | 'create' | 'edit' | 'profile'>('list');
    const [currentBlueprint, setCurrentBlueprint] = useState<Blueprint | null>(null);
    const [selectedClass, setSelectedClass] = useState<ClassLevel>(ClassLevel._10);
    const [selectedSubject, setSelectedSubject] = useState<SubjectType>(SubjectType.TAMIL_AT);
    const [selectedTerm, setSelectedTerm] = useState<ExamTerm>(ExamTerm.FIRST);
    const [selectedSet, setSelectedSet] = useState('Set A');
    const [selectedPaperType, setSelectedPaperType] = useState<string>('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState(() => {
        return getCurrentAcademicYear();
    });
    const [isConfigExpanded, setIsConfigExpanded] = useState(true);
    const [sharingBlueprintId, setSharingBlueprintId] = useState<string | null>(null);
    const [filterView, setFilterView] = useState<'all' | 'owned' | 'shared'>('all');
    const [listCombinedFilter, setListCombinedFilter] = useState<string>('all');
    const [isSaving, setIsSaving] = useState(false);
    const [animateHeader, setAnimateHeader] = useState(false);
    const [loading, setLoading] = useState(true);

    // ─── Profile Completeness Validation ──────────────────────────────────────
    const isProfileIncomplete = useMemo(() => {
        const requiredFields: (keyof User)[] = [
            'name', 'email', 'phoneNumber', 'dob', 'pen', 'designation',
            'joinDate', 'schoolName', 'district', 'bankAccountNumber', 'bankIfsc'
        ];
        const missing = requiredFields.filter(field => {
            const val = user[field];
            return !val || String(val).trim() === '';
        });

        if (missing.length > 0) {
            console.log('Profile incomplete. Missing fields:', missing);
        }

        return missing.length > 0;
    }, [user]);

    useEffect(() => {
        if (isProfileIncomplete && view !== 'profile') {
            setView('profile');
            Swal.fire({
                title: "Complete Your Profile",
                text: "Please fill in all details before accessing the dashboard.",
                icon: "info",
                confirmButtonColor: "#4f46e5"
            });
        }
    }, [isProfileIncomplete, view]);

    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
    const [paperTypes, setPaperTypes] = useState<QuestionPaperType[]>([]);
    const [examConfigs, setExamConfigs] = useState<ExamConfiguration[]>([]);
    const [allCurriculums, setAllCurriculums] = useState<Curriculum[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [discourses, setDiscourses] = useState<Discourse[]>([]);

    const blueprintRef = useRef<Blueprint | null>(null);

    useEffect(() => {
        blueprintRef.current = currentBlueprint;
    }, [currentBlueprint]);

    useEffect(() => {
        setAnimateHeader(true);
        const load = async () => {
            setLoading(true);
            try {
                const [bps, pts, discList, configs, curList] = await Promise.all([
                    getAllAccessibleBlueprints(user.id),
                    getQuestionPaperTypes(),
                    getDiscourses(),
                    getExamConfigs(),
                    getFilteredCurriculum()
                ]);

                let usersList: User[] = [];
                if (user.role === Role.ADMIN || user.role === Role.WEBMASTER) {
                    try {
                        usersList = await getUsers();
                    } catch (err) {
                        console.warn('Admin user list fetch failed:', err);
                        usersList = [];
                    }
                }

                // Sort by createdAt descending (latest first)
                const sortedBps = bps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                // Filter out hidden ones for UI counts and auto-selection
                const visibleBps = sortedBps.filter(bp => !bp.isHidden);

                setBlueprints(sortedBps);
                setPaperTypes(pts);
                setExamConfigs(configs);
                setAllCurriculums(curList);
                setAllUsers(usersList);
                setDiscourses(discList);

                // Set default filter if not already set, using only visible blueprints
                if ((!listCombinedFilter || listCombinedFilter === 'all') && visibleBps.length > 0) {
                    const latest = visibleBps[0];
                    const filterVal = `${latest.examTerm}|${latest.academicYear || getCurrentAcademicYear()}`;
                    setListCombinedFilter(filterVal);
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user.id, view]);

    const handleShowPaperTypeDetails = (typeId: string) => {
        const pt = paperTypes.find(p => p.id === typeId);
        if (!pt) return;

        const totalQuestions = pt.sections.reduce((acc, s) => acc + s.count, 0);

        const rows = pt.sections.map((s, idx) => {
            const marksPerQ = s.marks;
            const sectionTotal = s.marks * s.count;
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #fff; border: 1px solid #f1f5f9; border-radius: 20px; margin-bottom: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01); white-space: nowrap;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                        <div style="width: 28px; height: 28px; background: #1e1b4b; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; box-shadow: 0 4px 10px rgba(30,27,75,0.2);">${idx + 1}</div>
                        <div style="font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.05em;">SECTION ${idx + 1}</div>
                    </div>
                    <div style="display: flex; align-items: center; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; flex-shrink: 0; margin-left: 10px;">
                        <div style="width: 38px; text-align: right;"><span style="color: #1e293b;">${s.count}</span><span style="color: #3b82f6; font-size: 10px; margin-left: 2px;">Q</span></div>
                        <div style="width: 22px; text-align: center; color: #cbd5e1; font-weight: 400; font-size: 14px;">×</div>
                        <div style="width: 38px; text-align: center;"><span style="color: #1e293b;">${marksPerQ}</span><span style="color: #8b5cf6; font-size: 10px; margin-left: 2px;">M</span></div>
                        <div style="width: 22px; text-align: center; color: #cbd5e1; font-weight: 400; font-size: 14px;">=</div>
                        <div style="width: 48px; text-align: right;"><span style="color: #ec4899;">${sectionTotal}</span><span style="color: #ec4899; font-size: 10px; margin-left: 2px;">M</span></div>
                    </div>
                </div>
            `;
        }).join('');

        Swal.fire({
            html: `
                <div style="text-align: left; padding: 5px; width: 100%; overflow-x: hidden;">
                    <div style="margin-bottom: 30px;">
                        <div style="font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; color: #1e1b4b; letter-spacing: -0.03em;">${pt.name.toUpperCase()}</div>
                        <div style="font-size: 14px; color: #94a3b8; font-weight: 600; font-style: italic; margin-top: 4px;">Exam Structure Overview</div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 35px;">
                        <div style="background: #fff1f2; padding: 16px 4px; border-radius: 20px; text-align: center; border: 1px solid #ffe4e6; box-shadow: 0 4px 12px rgba(236,72,153,0.08);">
                            <div style="font-size: 9px; font-weight: 800; color: #ec4899; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Total Marks</div>
                            <div style="font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #be185d; line-height: 1;">${pt.totalMarks}</div>
                        </div>
                        <div style="background: #eff6ff; padding: 16px 4px; border-radius: 20px; text-align: center; border: 1px solid #dbeafe; box-shadow: 0 4px 12px rgba(59,130,246,0.08);">
                            <div style="font-size: 9px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Questions</div>
                            <div style="font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #0369a1; line-height: 1;">${totalQuestions}</div>
                        </div>
                        <div style="background: #f0fdf4; padding: 16px 4px; border-radius: 20px; text-align: center; border: 1px solid #dcfce7; box-shadow: 0 4px 12px rgba(16,185,129,0.08);">
                            <div style="font-size: 9px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Total Time</div>
                            <div style="font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #15803d; line-height: 1;">90 Mins</div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 25px;">
                        <div style="flex: 1; height: 1.5px; background: linear-gradient(to right, transparent, #e2e8f0);"></div>
                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.15em; white-space: nowrap;">Questions & Marks Structure</div>
                        <div style="flex: 1; height: 1.5px; background: linear-gradient(to left, transparent, #e2e8f0);"></div>
                    </div>

                    <div style="max-height: 380px; overflow-y: auto; padding-right: 8px; margin-bottom: 10px;" class="custom-scrollbar">
                        ${rows}
                    </div>
                </div>
                <style>
                    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                </style>
            `,
            width: '480px',
            padding: '2.5rem',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: {
                popup: 'rounded-[48px]',
                closeButton: 'top-8 right-8 focus:outline-none'
            }
        });
    };

    const handleShowWeightageDetails = (cls: ClassLevel, sub: SubjectType, term: ExamTerm) => {
        const normalizeClass = (value: unknown) => value === 'SSLC'
            ? 'SSLC'
            : Number.isFinite(Number(value)) ? String(Number(value)) : String(value ?? '').trim();
        const config = examConfigs.find(c =>
            normalizeClass(c.classLevel) === normalizeClass(cls) &&
            String(c.subject).trim() === String(sub).trim() &&
            String(c.term).trim() === String(term).trim()
        );
        const cur = allCurriculums.find(c => c.classLevel === cls && c.subject === sub);

        if (!config) {
            Swal.fire({
                title: "No Weightage Found",
                text: "Weightage configuration is not set for this exam.",
                icon: "info",
                confirmButtonColor: "#4f46e5"
            });
            return;
        }

        const rows = config.weightages.map(w => {
            const unit = cur?.units.find(u => u.unitNumber === w.unitNumber);
            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; text-align: left; font-size: 13px;">
                        <div style="font-weight: bold; color: #1e293b;">Unit ${w.unitNumber}</div>
                        <div style="font-size: 14px; color: #64748b; font-family: 'TAU-Paalai', serif;">${unit?.name || 'N/A'}</div>
                    </td>
                    <td style="padding: 10px; text-align: center; font-size: 14px; font-weight: 800; color: #10b981;">
                        ${(w.percentage).toFixed(0)}%
                    </td>
                </tr>
            `;
        }).join('');

        Swal.fire({
            title: `<div style="font-family: var(--ap-display); font-size: 18px; font-weight: 800;">Exam Weightage</div>`,
            html: `
                <div style="text-align: left; margin-bottom: 15px; padding: 10px; background: #f0f9ff; border-radius: 12px; border: 1px solid #bae6fd;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0369a1; letter-spacing: 0.05em;">Current Scope</div>
                    <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px;">
                        Class ${cls === 'SSLC' ? '11 (SSLC)' : cls} • ${sub}
                    </div>
                    <div style="font-size: 12px; color: #64748b; font-weight: 600;">${term}</div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-family: var(--ap-font);">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Unit Details</th>
                            <th style="padding: 12px 10px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Weightage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `,
            width: '450px',
            confirmButtonText: 'Got it',
            confirmButtonColor: '#4f46e5',
            customClass: {
                popup: 'rounded-[24px]'
            }
        });
    };

    useEffect(() => {
        const loadCurriculum = async () => {
            if (view === 'create' || view === 'edit') {
                const cur = await getCurriculum(selectedClass, selectedSubject);
                const db = getDB() || await initDB();
                setCurriculum(filterCurriculumByTerm(db, cur, selectedTerm));
            }
        };
        loadCurriculum();
    }, [selectedClass, selectedSubject, selectedTerm, view]);

    useEffect(() => {
        if (currentBlueprint?.isConfirmed) {
            setIsConfigExpanded(false);
        } else {
            setIsConfigExpanded(true);
        }
    }, [currentBlueprint?.isConfirmed]);

    const handleCreateNew = () => {
        setCurrentBlueprint(null);
        setSelectedClass(ClassLevel._10);
        setSelectedSubject(SubjectType.TAMIL_AT);
        setSelectedTerm(ExamTerm.FIRST);
        setSelectedSet('Set A');
        const db = getDB();
        setSelectedAcademicYear((db as any)?.appSettings?.academicYear || calculateAcademicYear());
        setSelectedPaperType('');
        setIsConfigExpanded(true);
        setView('create');
    };

    const handleEdit = async (bp: Blueprint) => {
        if (bp.isLocked) {
            Swal.fire("Locked", "This question paper is locked by the admin and cannot be edited.", "info");
            return;
        }
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
                setCurrentBlueprint(bpWithQNo);
                setSelectedClass(fullBp.classLevel);
                setSelectedSubject(fullBp.subject);
                setSelectedTerm(fullBp.examTerm);
                setSelectedSet(fullBp.setId || 'Set A');
                setSelectedPaperType(fullBp.questionPaperTypeId || '');
                setView('edit');
            } else {
                Swal.fire("Error", "Could not load full blueprint data", "error");
            }
        } catch (error) {
            console.error("Failed to load blueprint:", error);
            Swal.fire("Error", "Failed to load blueprint details", "error");
        }
    };

    const handleDelete = async (id: string) => {
        const bp = blueprints.find(b => b.id === id);
        if (bp?.isLocked) {
            Swal.fire("Locked", "This question paper is locked by the admin and cannot be deleted.", "info");
            return;
        }
        Swal.fire({
            title: "Are you sure?",
            text: "You won't be able to revert this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete it!"
        }).then(async (result) => {
            if (result.isConfirmed) {
                await deleteBlueprint(id);
                const updated = await getAllAccessibleBlueprints(user.id);
                setBlueprints(updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                Swal.fire("Deleted", "Your blueprint has been deleted.", "success");
            }
        });
    };

    const handleGenerate = async () => {
        if (!curriculum) return Swal.fire("Error", "Curriculum not found for selected Class/Subject!", "error");
        if (!selectedPaperType) return Swal.fire("Required", "Please select a Question Paper Type.", "warning");
        try {
            const db = getDB();
            if (!db) await initDB();
            const items = generateBlueprintTemplate(getDB()!, curriculum, selectedTerm, selectedPaperType);
            const paperType = paperTypes.find(p => p.id === selectedPaperType);
            const newBlueprint: Blueprint = {
                id: Math.random().toString(36).substr(2, 9),
                examTerm: selectedTerm,
                classLevel: selectedClass,
                subject: selectedSubject,
                questionPaperTypeId: selectedPaperType,
                questionPaperTypeName: paperType?.name || 'Unknown',
                totalMarks: paperType?.totalMarks || 0,
                items,
                createdAt: new Date().toISOString(),
                setId: selectedSet,
                academicYear: selectedAcademicYear,
                ownerId: user.id,
                sharedWith: [],
                isConfirmed: false
            };
            setCurrentBlueprint(newBlueprint);
        } catch (error) {
            Swal.fire("Exact allocation unavailable", error instanceof Error ? error.message : String(error), "error");
        }
    };

    const handleRegeneratePattern = async () => {
        const latestBlueprint = blueprintRef.current;
        if (!latestBlueprint || !curriculum) return;
        Swal.fire({
            title: "Regenerate Pattern?",
            text: "This will replace all current questions with a new random pattern. Continue?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Yes, regenerate"
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const db = getDB();
                    if (!db) await initDB();
                    const newItems = generateBlueprintTemplate(getDB()!, curriculum, latestBlueprint.examTerm, latestBlueprint.questionPaperTypeId);
                    const regenerated = { ...latestBlueprint, items: newItems, isConfirmed: false };
                    blueprintRef.current = regenerated;
                    setCurrentBlueprint(regenerated);
                    Swal.fire("Regenerated", "A new exact-weightage pattern has been generated.", "success");
                } catch (error) {
                    Swal.fire("Exact allocation unavailable", error instanceof Error ? error.message : String(error), "error");
                }
            }
        });
    };

    const handleConfirmPattern = async () => {
        if (!currentBlueprint) return;
        const confirmed = { ...currentBlueprint, isConfirmed: true };
        setCurrentBlueprint(confirmed);
        await saveBlueprint(confirmed);
        Swal.fire("Confirmed", "Blueprint pattern confirmed successfully!", "success");
    };

    const handleConfirmQuestions = async () => {
        if (!currentBlueprint) return;
        const confirmed = { ...currentBlueprint, isQuestionConfirmed: true };
        setCurrentBlueprint(confirmed);
        await saveBlueprint(confirmed);
        Swal.fire("Confirmed", "Question Paper confirmed successfully!", "success");
    };

    const handleConfirmAnswerKey = async () => {
        if (!currentBlueprint) return;
        const confirmed = { ...currentBlueprint, isAnswerKeyConfirmed: true };
        setCurrentBlueprint(confirmed);
        await saveBlueprint(confirmed);
        Swal.fire("Confirmed", "Answer Key confirmed successfully!", "success");
    };

    const handleConfirmReport = async (reportId: string) => {
        if (!currentBlueprint || user.role !== Role.WEBMASTER) return;
        const previous = currentBlueprint;
        const confirmed = {
            ...previous,
            confirmedReports: { ...(previous.confirmedReports || {}), [reportId]: true },
        };
        setCurrentBlueprint(confirmed);
        try {
            await saveBlueprint(confirmed);
            await Swal.fire('Confirmed', `${reportId.replace('report', 'Report ')} confirmed successfully.`, 'success');
        } catch (error) {
            setCurrentBlueprint(previous);
            const reason = error instanceof Error ? error.message : 'Could not save confirmation.';
            await Swal.fire('Confirmation failed', reason, 'error');
        }
    };

    const handleSaveReportSettings = async () => {
        if (!currentBlueprint) return;
        await saveBlueprint(currentBlueprint);
        Swal.fire("Saved", "Report settings saved successfully!", "success");
    };

    const handleSaveToDB = async () => {
        const latestBlueprint = blueprintRef.current;
        if (!latestBlueprint) return;
        setIsSaving(true);
        try {
            await saveBlueprint(latestBlueprint);
            const updated = await getAllAccessibleBlueprints(user.id);
            setBlueprints(updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            Swal.fire("Saved", "Blueprint saved successfully!", "success");
        } catch (error) {
            console.error("Save failed:", error);
            Swal.fire("Error", "Failed to save blueprint.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPDF = (type: string = 'all') => exportPDF(currentBlueprint, curriculum, type);
    const handleDownloadWord = (type: string = 'all') => exportWord(currentBlueprint, curriculum, discourses, type);

    const updateItem = (id: string, field: keyof BlueprintItem | Partial<BlueprintItem>, value?: any) => {
        setCurrentBlueprint(prev => {
            if (!prev) return prev;
            const updatedItems = prev.items.map(i => {
                if (i.id === id) {
                    let updated = { ...i };
                    if (typeof field === 'object' && field !== null) {
                        updated = { ...updated, ...field };
                    } else {
                        updated = { ...updated, [field as keyof BlueprintItem]: value };
                    }

                    const qCount = typeof field === 'object' && field !== null && 'questionCount' in field
                        ? (field as any).questionCount
                        : (field === 'questionCount' ? value : undefined);
                    if (qCount !== undefined) {
                        updated.totalMarks = updated.marksPerQuestion * (Number(qCount) || 0);
                    }

                    const marksVal = typeof field === 'object' && field !== null && 'marksPerQuestion' in field
                        ? (field as any).marksPerQuestion
                        : (field === 'marksPerQuestion' ? value : undefined);
                    if (marksVal !== undefined) {
                        const newMarks = Number(marksVal) || 0;
                        updated.totalMarks = updated.questionCount * newMarks;
                        
                        const matchingDiscourses = discourses.filter(d => 
                            d.subject === prev.subject && d.marks === newMarks
                        );
                        if (updated.discourseId && !matchingDiscourses.some(d => d.id === updated.discourseId)) {
                            updated.discourseId = undefined;
                            updated.enableDiscourse = false;
                        }
                        if (updated.discourseIdB && !matchingDiscourses.some(d => d.id === updated.discourseIdB)) {
                            updated.discourseIdB = undefined;
                            updated.enableDiscourseB = false;
                        }
                    }

                    if (updated.hasInternalChoice) {
                        const isKLevelChanged = (typeof field === 'object' && field !== null ? 'knowledgeLevel' in field : field === 'knowledgeLevel');
                        const isKLevelBChanged = (typeof field === 'object' && field !== null ? 'knowledgeLevelB' in field : field === 'knowledgeLevelB');
                        const isCPChanged = (typeof field === 'object' && field !== null ? 'cognitiveProcess' in field : field === 'cognitiveProcess');
                        const isCPBChanged = (typeof field === 'object' && field !== null ? 'cognitiveProcessB' in field : field === 'cognitiveProcessB');
                        const isUnitIdChanged = (typeof field === 'object' && field !== null ? 'unitId' in field : field === 'unitId');

                        if (isKLevelChanged) {
                            updated.knowledgeLevelB = (typeof field === 'object' && field !== null ? (field as any).knowledgeLevel : value) as KnowledgeLevel;
                        } else if (isKLevelBChanged) {
                            updated.knowledgeLevelB = updated.knowledgeLevel;
                        }

                        if (isCPChanged) {
                            updated.cognitiveProcessB = (typeof field === 'object' && field !== null ? (field as any).cognitiveProcess : value) as CognitiveProcess;
                        } else if (isCPBChanged) {
                            updated.cognitiveProcessB = updated.cognitiveProcess;
                        }

                        if (isUnitIdChanged) {
                            const unitVal = typeof field === 'object' && field !== null ? (field as any).unitId : value;
                            updated.unitIdB = unitVal;
                            const newUnit = curriculum?.units.find(u => u.id === unitVal);
                            updated.subUnitIdB = newUnit?.subUnits[0]?.id || 'unknown';
                        } else {
                            updated.unitIdB = updated.unitId;
                            updated.subUnitIdB = updated.subUnitIdB || updated.subUnitId;
                        }
                        updated.itemFormatB = updated.itemFormatB || updated.itemFormat;
                    } else {
                        updated.unitIdB = undefined;
                        updated.subUnitIdB = undefined;
                        updated.knowledgeLevelB = undefined;
                        updated.cognitiveProcessB = undefined;
                        updated.itemFormatB = undefined;
                    }
                    return updated;
                }
                return i;
            });
            return { ...prev, items: updatedItems };
        });
    };

    const moveItem = (itemId: string, newUnitId: string, newSectionId: string, newSubUnitId?: string) => {
        if (!currentBlueprint || !curriculum) return;
        const newUnit = curriculum.units.find(u => u.id === newUnitId);
        if (!newUnit) return;
        const updatedItems = currentBlueprint.items.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    unitId: newUnitId,
                    subUnitId: newSubUnitId || newUnit.subUnits[0]?.id || 'unknown',
                    unitIdB: item.hasInternalChoice ? newUnitId : undefined,
                    // If moving to a new unit, we should also reset subUnitIdB to a valid subunit for the new unit,
                    // otherwise keep the existing one.
                    subUnitIdB: item.hasInternalChoice ? (item.unitId === newUnitId ? (item.subUnitIdB || newSubUnitId || newUnit.subUnits[0]?.id || 'unknown') : (newSubUnitId || newUnit.subUnits[0]?.id || 'unknown')) : undefined,
                };
            }
            return item;
        });
        setCurrentBlueprint({ ...currentBlueprint, items: updatedItems });
    };

    // ─── stats ─────────────────────────────────────────────────────────────────
    const visibleBlueprints = blueprints.filter(b => !b.isHidden);
    const ownedCount = visibleBlueprints.filter(b => b.ownerId === user.id).length;
    const sharedCount = visibleBlueprints.filter(b => b.ownerId !== user.id).length;
    const confirmedCount = visibleBlueprints.filter(b => b.isConfirmed).length;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

                :root {
                    --ap-bg: #f8fafc;
                    --ap-surface: #ffffff;
                    --ap-surface2: #f1f5f9;
                    --ap-border: rgba(0,0,0,0.08);
                    --ap-text: #1e293b;
                    --ap-muted: #64748b;
                    --ap-accent: #2563eb;
                    --ap-accent-light: rgba(37, 99, 235, 0.1);
                    --ap-radius: 20px;
                    --ap-font: 'DM Sans', sans-serif;
                    --ap-display: 'Syne', sans-serif;
                }

                .ud-root {
                    min-height: 100vh;
                    background-color: var(--ap-bg);
                    background-image: 
                        radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.05) 0%, transparent 40%),
                        radial-gradient(circle at 100% 100%, rgba(124, 58, 237, 0.05) 0%, transparent 40%);
                    font-family: var(--ap-font);
                    color: var(--ap-text);
                    padding-bottom: 5rem;
                }

                /* ── Header ─────────────────────────────────────── */
                .ud-header {
                    position: sticky;
                    top: 0;
                    z-index: 50;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border-bottom: 1px solid var(--ap-border);
                    padding: 0 1.5rem;
                    height: 72px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 4px 30px rgba(0,0,0,0.02);
                }

                .ud-logo {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-family: var(--ap-display);
                    font-weight: 800;
                    font-size: 1.25rem;
                    letter-spacing: -0.03em;
                    color: var(--ap-text);
                }

                .ud-logo-icon {
                    width: 40px; height: 40px;
                    background: linear-gradient(135deg, #2563eb, #7c3aed);
                    border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.3);
                }

                @keyframes iconPulse {
                    0%, 100% { box-shadow: 0 0 18px rgba(124,106,247,0.45); }
                    50% { box-shadow: 0 0 30px rgba(124,106,247,0.7); }
                }

                .ud-back-btn {
                    width: 34px; height: 34px;
                    border-radius: 10px;
                    border: 1px solid var(--dash-border);
                    background: var(--dash-surface);
                    color: var(--dash-muted);
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-right: 0.5rem;
                }
                .ud-back-btn:hover { background: var(--dash-surface2); color: var(--dash-text); }

                .ud-user-chip {
                    display: flex; align-items: center; gap: 0.6rem;
                    background: var(--ap-surface2);
                    border: 1px solid var(--ap-border);
                    border-radius: 100px;
                    padding: 0.4rem 1rem 0.4rem 0.4rem;
                    transition: all 0.2s;
                }
                .ud-user-chip:hover { background: #fff; border-color: var(--ap-accent); }
                .ud-avatar {
                    width: 32px; height: 32px;
                    border-radius: 50%;
                    background: var(--ap-accent);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.75rem; font-weight: 700; color: #fff;
                    flex-shrink: 0;
                    box-shadow: 0 4px 8px rgba(37, 99, 235, 0.2);
                }
                .ud-username {
                    font-size: 0.85rem; font-weight: 700;
                    color: var(--ap-text);
                    display: none;
                }
                @media (min-width: 480px) { .ud-username { display: block; } }

                .ud-logout-btn {
                    width: 34px; height: 34px;
                    border-radius: 10px;
                    border: 1px solid rgba(239,68,68,0.2);
                    background: rgba(239,68,68,0.05);
                    color: #ef4444;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .ud-logout-btn:hover { background: #ef4444; color: #fff; }

                /* ── Content Container ──────────────────────────── */
                .ud-container {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: 1.5rem 1rem;
                }
                @media (max-width: 639px) {
                    .ud-container.ud-container-compact {
                        padding: 0.25rem 0.1rem;
                    }
                }

                /* ── Stats Strip ────────────────────────────────── */
                .ud-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }

                .ud-stat-card {
                    background: var(--ap-surface);
                    border: 1px solid var(--ap-border);
                    border-radius: var(--ap-radius);
                    padding: 1rem;
                    display: flex; flex-direction: column; 
                    align-items: center; text-align: center;
                    gap: 0.3rem;
                    position: relative; overflow: hidden;
                    border-bottom: 3px solid transparent;
                    transition: all 0.3s ease;
                }
                .ud-stat-card.purple { border-bottom-color: #6366f1; }
                .ud-stat-card.pink { border-bottom-color: #ec4899; }
                .ud-stat-card.green { border-bottom-color: #10b981; }

                .ud-stat-label { font-size: 0.65rem; font-weight: 700; color: var(--ap-muted); text-transform: uppercase; letter-spacing: 0.08em; }
                .ud-stat-value { font-family: var(--ap-display); font-size: 1.5rem; font-weight: 800; color: var(--ap-text); line-height: 1; }

                /* ── Section Header ─────────────────────────────── */
                .ud-section-hdr {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                @media (min-width: 768px) {
                    .ud-section-hdr {
                        flex-direction: row;
                        align-items: center;
                        justify-content: space-between;
                    }
                }

                .ud-header-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                }
                @media (min-width: 768px) {
                    .ud-header-top { width: auto; order: 0; }
                }

                .ud-header-controls {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                @media (min-width: 768px) {
                    .ud-header-controls { order: 2; margin-left: auto; }
                }

                .ud-section-title {
                    font-family: var(--ap-display);
                    font-size: 1.25rem;
                    font-weight: 800;
                    letter-spacing: -0.02em;
                    color: var(--ap-text);
                    margin: 0;
                }
                @media (min-width: 768px) {
                    .ud-section-title { font-size: 1.75rem; }
                }

                /* ── Tabs (Full Width) ───────────────────────────── */
                .ud-tabs {
                    display: flex; 
                    background: var(--ap-surface2);
                    border-radius: 10px;
                    padding: 0.2rem;
                    width: 100%;
                }
                @media (min-width: 768px) {
                    .ud-tabs { width: auto; min-width: 320px; order: 1; }
                }

                .ud-tab {
                    flex: 1;
                    padding: 0.4rem;
                    border-radius: 8px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    cursor: pointer;
                    border: none;
                    background: transparent;
                    color: var(--ap-muted);
                    transition: all 0.2s;
                    text-align: center;
                }
                @media (min-width: 768px) {
                    .ud-tab { padding: 0.6rem 1.5rem; font-size: 0.75rem; }
                }

                .ud-tab.active {
                    background: #fff;
                    color: var(--ap-accent);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }

                /* ── Small New Blueprint Button ─────────────────── */
                .ud-new-btn-sm {
                    display: flex; align-items: center; gap: 0.3rem;
                    background: linear-gradient(135deg, #2563eb, #7c3aed);
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    padding: 0.4rem 0.6rem;
                    font-family: var(--ap-display);
                    font-size: 0.65rem;
                    font-weight: 700;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                @media (min-width: 768px) {
                    .ud-new-btn-sm { padding: 0.6rem 1.25rem; font-size: 0.85rem; border-radius: 10px; }
                }
                .ud-new-btn-sm:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 8px 15px rgba(37,99,235,0.2); }

                .ud-select-sm {
                    padding: 0.35rem 0.5rem;
                    border: 1px solid var(--ap-border);
                    border-radius: 6px;
                    font-size: 0.65rem;
                    font-weight: 700;
                    background: #fff;
                    color: var(--ap-text);
                    outline: none;
                }
                @media (min-width: 768px) {
                    .ud-select-sm { padding: 0.55rem 1rem; font-size: 0.85rem; border-radius: 10px; max-width: 220px; }
                }

                /* ── Desktop Table (Ultra Premium Design) ────────── */
                .ud-table-wrap {
                    display: none;
                    margin-top: 1rem;
                    animation: fadeUp 0.6s 0.2s ease both;
                }
                @media (min-width: 960px) { .ud-table-wrap { display: block; } }

                .ud-table { 
                    width: 100%; 
                    border-collapse: separate; 
                    border-spacing: 0 0.75rem; /* Gap between rows */
                }

                .ud-th {
                    padding: 0.75rem 1.25rem;
                    text-align: center;
                    font-size: 0.65rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    color: #94a3b8;
                    white-space: nowrap;
                }

                .ud-tr {
                    background: #fff;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .ud-tr:hover { 
                    transform: translateY(-2px) scale(1.002);
                    box-shadow: 0 12px 25px -8px rgba(0,0,0,0.08);
                    z-index: 10;
                    position: relative;
                }
                
                .ud-td {
                    padding: 1.25rem 1rem;
                    vertical-align: middle;
                    text-align: center;
                    border-top: 1px solid rgba(0,0,0,0.03);
                    border-bottom: 1px solid rgba(0,0,0,0.03);
                }

                /* Rounded corners for the row card */
                .ud-td:first-child { 
                    border-left: 1px solid rgba(0,0,0,0.03);
                    border-top-left-radius: 16px; 
                    border-bottom-left-radius: 16px; 
                }
                .ud-td:last-child { 
                    border-right: 1px solid rgba(0,0,0,0.03);
                    border-top-right-radius: 16px; 
                    border-bottom-right-radius: 16px; 
                }

                .ud-td-primary {
                    font-weight: 800;
                    color: #1e293b;
                    font-family: var(--ap-display);
                    font-size: 0.95rem;
                    line-height: 1.2;
                }

                .ud-td-secondary {
                    font-size: 0.7rem;
                    color: #94a3b8;
                    font-weight: 600;
                    margin-top: 0.2rem;
                }

                /* Marks Indicator in Table */
                .ud-table-marks {
                    display: inline-flex;
                    align-items: center; justify-content: center;
                    min-width: 45px;
                    height: 32px;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    font-weight: 800;
                    color: #1e293b;
                    font-size: 0.9rem;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
                }
                .ud-tr:hover .ud-table-marks {
                    background: var(--ap-accent);
                    border-color: var(--ap-accent);
                    color: #fff;
                    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
                }

                /* Table Badges Premium */
                .ud-table-badge {
                    display: inline-flex; align-items: center; gap: 0.35rem;
                    padding: 0.35rem 0.65rem;
                    border-radius: 10px;
                    font-size: 0.6rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .ud-table-badge.owner { background: #f0f9ff; color: #0ea5e9; }
                .ud-table-badge.shared { background: #fff1f2; color: #f43f5e; }
                .ud-table-badge.confirmed { background: #f0fdf4; color: #10b981; }
                .ud-table-badge.locked { background: #f8fafc; color: #64748b; }

                /* Action Buttons (Table Only) */
                .ud-t-actions { display: flex; align-items: center; justify-content: center; gap: 0.25rem; }
                .ud-t-btn {
                    width: 34px; height: 34px;
                    border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    color: #94a3b8;
                }
                .ud-t-btn:hover { background: #f8fafc; color: var(--ap-accent); transform: translateY(-1px); }
                .ud-t-btn.del:hover { color: #ef4444; background: #fef2f2; }
                .ud-t-btn:disabled { opacity: 0.3; cursor: not-allowed; }

                /* ── Empty State ─────────────────────────────────── */
                .ud-empty {
                    background: var(--dash-surface);
                    border: 1px solid var(--dash-border);
                    border-radius: var(--dash-radius);
                    padding: 4rem 2rem;
                    text-align: center;
                    animation: fadeUp 0.5s ease both;
                }
                .ud-empty-icon {
                    width: 60px; height: 60px;
                    border-radius: 18px;
                    background: var(--dash-surface2);
                    border: 1px solid var(--dash-border);
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 1.25rem;
                    color: var(--dash-muted);
                }

                /* ── Mobile Cards ────────────────────────────────── */
                .ud-cards {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 1.5rem;
                    animation: fadeUp 0.5s 0.15s ease both;
                }
                @media (min-width: 560px) { .ud-cards { grid-template-columns: repeat(2, 1fr); } }
                @media (min-width: 960px) { .ud-cards { display: none; } }

                .ud-card {
                    background: var(--ap-surface);
                    border: 1px solid var(--ap-border);
                    border-radius: 24px;
                    overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    animation: cardIn 0.5s ease both;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
                    position: relative;
                }
                .ud-card:hover { transform: translateY(-8px); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1); border-color: var(--ap-accent); }
                .ud-card:active { transform: scale(0.98); }

                .ud-card-header {
                    height: 120px;
                    position: relative;
                    overflow: hidden;
                    display: flex; align-items: flex-start;
                    padding: 1.5rem;
                }
                .ud-card-header-bg {
                    position: absolute;
                    inset: 0;
                    z-index: 0;
                }
                .ud-card-pattern {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                }
                .ud-card-marks {
                    position: absolute;
                    top: 1.25rem; right: 1.25rem;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(10px);
                    border: 1px solid var(--ap-border);
                    border-radius: 16px;
                    padding: 0.5rem 0.85rem;
                    text-align: center;
                    z-index: 10;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                }
                .ud-card-marks-label { font-size: 0.55rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ap-muted); }
                .ud-card-marks-val { font-family: var(--ap-display); font-size: 1.4rem; font-weight: 800; color: var(--ap-accent); line-height: 1; }

                .ud-card-badges {
                    display: flex; flex-wrap: wrap; gap: 0.5rem;
                    z-index: 10;
                }

                .ud-card-body { padding: 1.5rem; }

                .ud-card-title {
                    font-family: var(--ap-display);
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: var(--ap-text);
                    line-height: 1.3;
                    margin-bottom: 0.5rem;
                }
                .ud-card-by { font-size: 0.75rem; font-weight: 700; color: var(--ap-accent); margin-bottom: 0.15rem; }
                .ud-card-date { font-size: 0.72rem; font-weight: 500; color: var(--ap-muted); margin-bottom: 1rem; }

                .ud-card-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.6rem;
                    margin-bottom: 1rem;
                }
                .ud-card-meta {
                    background: var(--ap-surface2);
                    border: 1px solid var(--ap-border);
                    border-radius: 12px;
                    padding: 0.65rem;
                }
                .ud-card-meta-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ap-muted); margin-bottom: 0.2rem; }
                .ud-card-meta-val { font-size: 0.85rem; font-weight: 700; color: var(--ap-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

                .ud-card-actions { display: flex; gap: 0.5rem; }
                .ud-card-btn {
                    flex: 1;
                    display: flex; align-items: center; justify-content: center; gap: 0.35rem;
                    padding: 0.7rem;
                    border-radius: 12px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    cursor: pointer;
                    border: none;
                    transition: all 0.18s;
                }
                .ud-card-btn.edit { background: #eef2ff; color: #4338ca; }
                .ud-card-btn.edit:hover { background: #6366f1; color: #fff; }
                .ud-card-btn.edit:disabled { opacity: 0.3; cursor: not-allowed; }
                .ud-card-btn.share { background: #f0fdf4; color: #15803d; }
                .ud-card-btn.share:hover { background: #10b981; color: #fff; }
                .ud-card-btn.del { flex: 0 0 44px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
                .ud-card-btn.del:hover { background: #ef4444; color: #fff; }
                .ud-card-btn.del:disabled { opacity: 0.25; cursor: not-allowed; }

                /* ── Config Panel ────────────────────────────────── */
                .ud-config-panel {
                    background: var(--dash-surface);
                    border: 1px solid var(--dash-border);
                    border-radius: var(--dash-radius);
                    overflow: hidden;
                    margin-bottom: 1.25rem;
                    animation: fadeUp 0.4s ease both;
                }
                .ud-config-hdr {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 1rem 1.25rem;
                    cursor: pointer;
                    background: var(--dash-surface2);
                    border-bottom: 1px solid var(--dash-border);
                    transition: background 0.2s;
                }
                .ud-config-hdr:hover { background: rgba(124,106,247,0.08); }
                .ud-config-title {
                    display: flex; align-items: center; gap: 0.6rem;
                    font-family: var(--dash-display);
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--dash-text);
                }
                .ud-config-body { padding: 1.25rem; }
                .ud-form-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 0.85rem;
                }
                @media (min-width: 640px) { .ud-form-grid { grid-template-columns: repeat(2, 1fr); } }
                @media (min-width: 960px) { .ud-form-grid { grid-template-columns: repeat(4, 1fr); } }

                .ud-form-group { display: flex; flex-direction: column; gap: 0.35rem; }
                .ud-form-label {
                    font-size: 0.72rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--dash-muted);
                }
                .ud-form-label .req { color: #f87171; margin-left: 0.15rem; }

                .ud-form-select, .ud-form-input {
                    background: var(--dash-surface2);
                    border: 1px solid var(--dash-border);
                    border-radius: 10px;
                    padding: 0.6rem 0.85rem;
                    font-size: 0.85rem;
                    font-family: var(--dash-font);
                    color: var(--dash-text);
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    appearance: none;
                    -webkit-appearance: none;
                    width: 100%;
                }
                .ud-form-select:focus, .ud-form-input:focus {
                    border-color: rgba(124,106,247,0.5);
                    box-shadow: 0 0 0 3px rgba(124,106,247,0.12);
                }
                .ud-form-select:disabled, .ud-form-input:disabled { opacity: 0.4; cursor: not-allowed; }
                .ud-form-select option { background: #ffffff; color: #1e293b; }

                .ud-generate-btn {
                    display: flex; align-items: center; gap: 0.5rem;
                    background: linear-gradient(135deg, #7c6af7, #f472b6);
                    border: none; border-radius: 12px;
                    padding: 0.65rem 1.4rem;
                    font-family: var(--dash-display);
                    font-size: 0.85rem; font-weight: 700;
                    color: #fff; cursor: pointer;
                    transition: opacity 0.2s, transform 0.2s;
                    box-shadow: 0 4px 18px rgba(124,106,247,0.35);
                    margin-left: auto;
                    margin-top: 0.5rem;
                }
                .ud-generate-btn:hover { opacity: 0.9; transform: translateY(-1px); }

                /* ── Pulse shimmer for loading ────────────────────── */
                @keyframes shimmer {
                    from { background-position: -200% 0; }
                    to { background-position: 200% 0; }
                }
            `}</style>

            <div className="ud-root no-print-wrapper">

                {/* ── Header ────────────────────────────────────────────────── */}
                <header className="ud-header no-print">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {view !== 'list' && (
                            <button className="ud-back-btn" onClick={() => {
                                if (isProfileIncomplete) {
                                    Swal.fire({
                                        title: "Incomplete Profile",
                                        text: "Please complete and save your profile before returning to the dashboard.",
                                        icon: "warning",
                                        confirmButtonColor: "#4f46e5"
                                    });
                                    return;
                                }
                                setView('list');
                                setCurrentBlueprint(null);
                            }} title="Back">
                                <ChevronLeft size={18} />
                            </button>
                        )}
                        <div className="ud-logo">
                            <div className="ud-logo-icon" style={{ background: 'transparent' }}>
                                <img src="/img/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                            Blueprint Generator
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="ud-user-chip" onClick={() => setView('profile')} style={{ cursor: 'pointer' }} title="View Profile">
                            <div className="ud-avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
                            <span className="ud-username">{user.name}</span>
                        </div>
                        <button className="ud-logout-btn" onClick={onLogout} title="Logout">
                            <LogOut size={16} />
                        </button>
                    </div>
                </header>

                <div className={`ud-container ${currentBlueprint ? 'ud-container-compact' : ''}`}>

                    {/* ══════════════ LIST VIEW ══════════════════════════════════ */}
                    {view === 'list' && (
                        <div>
                            {/* Stats Strip */}
                            <div className="ud-stats">
                                <div className="ud-stat-card purple">
                                    <span className="ud-stat-label">Total</span>
                                    <span className="ud-stat-value" style={{ color: '#6366f1' }}>{blueprints.length}</span>
                                </div>
                                <div className="ud-stat-card pink">
                                    <span className="ud-stat-label">Owned</span>
                                    <span className="ud-stat-value" style={{ color: '#ec4899' }}>{ownedCount}</span>
                                </div>
                                <div className="ud-stat-card green">
                                    <span className="ud-stat-label">Confirmed</span>
                                    <span className="ud-stat-value" style={{ color: '#10b981' }}>{confirmedCount}</span>
                                </div>
                            </div>

                            {/* Section Header */}
                            <div className="ud-section-hdr">
                                <div className="ud-header-top">
                                    <div className="ud-header-controls">
                                        <select
                                            value={listCombinedFilter}
                                            onChange={(e) => setListCombinedFilter(e.target.value)}
                                            className="ud-select-sm"
                                        >
                                            <option value="">Select Exam</option>
                                            <option value="all">All Exams & Years</option>
                                            {Array.from(new Set(visibleBlueprints.map(bp => `${bp.examTerm}|${bp.academicYear || getCurrentAcademicYear()}`))).sort().map(opt => {
                                                const [term, year] = opt.split('|');
                                                return (
                                                    <option key={opt} value={opt}>
                                                        {term} ({year})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <button className="ud-new-btn-sm" onClick={() => {
                                            Swal.fire({
                                                title: "Access Restricted",
                                                text: "To create a new blueprint, please contact the Admin.",
                                                icon: "info",
                                                confirmButtonColor: "#4f46e5"
                                            });
                                        }}>
                                            <Plus size={14} />
                                            New Blueprint
                                        </button>
                                    </div>
                                </div>

                                <div className="ud-tabs">
                                    {(['all', 'owned', 'shared'] as const).map(f => (
                                        <button key={f} className={`ud-tab${filterView === f ? ' active' : ''}`} onClick={() => setFilterView(f)}>
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Content ── */}
                            {(() => {
                                const filteredBlueprints = visibleBlueprints.filter(bp => {
                                    const matchesType = filterView === 'owned' ? bp.ownerId === user.id :
                                        filterView === 'shared' ? bp.ownerId !== user.id : true;

                                    const currentBpFilter = `${bp.examTerm}|${bp.academicYear || getCurrentAcademicYear()}`;
                                    const matchesFilter = !listCombinedFilter || listCombinedFilter === 'all' || currentBpFilter === listCombinedFilter;

                                    return matchesType && matchesFilter;
                                });

                                if (loading) return (
                                    <>
                                        <div className="ud-table-wrap">
                                            <TableRowSkeleton columns={9} rows={5} />
                                        </div>
                                        <div className="ud-cards">
                                            <CardSkeleton count={4} />
                                        </div>
                                    </>
                                );

                                if (filteredBlueprints.length === 0) return (
                                    <div className="ud-empty">
                                        <div className="ud-empty-icon">
                                            <BookOpen size={26} />
                                        </div>
                                        <p style={{ fontFamily: 'var(--dash-display)', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>No blueprints found</p>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--dash-muted)' }}>Create your first blueprint to get started using the button above.</p>
                                    </div>
                                );

                                return (
                                    <>
                                        {/* ── Desktop Table ─────────────────────────── */}
                                        <div className="ud-table-wrap">
                                            <table className="ud-table">
                                                <thead className="ud-thead">
                                                    <tr>
                                                        {['Status', 'Date', 'Paper Type', 'Class', 'Subject', 'Term', 'Set', 'Marks', 'Actions'].map((h) => (
                                                            <th key={h} className="ud-th">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredBlueprints.map((bp) => {
                                                        const isOwner = bp.ownerId === user.id;
                                                        const ownerUser = !isOwner ? allUsers.find(u => u.id === bp.ownerId) : null;
                                                        return (
                                                            <tr key={bp.id} className="ud-tr">
                                                                <td className="ud-td">
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                                                                        {isOwner
                                                                            ? <span className="ud-table-badge owner"><UserCircle size={12} />Owner</span>
                                                                            : <span className="ud-table-badge shared"><Share2 size={12} />Shared</span>
                                                                        }
                                                                        {bp.isConfirmed ? (
                                                                            <span className="ud-table-badge confirmed"><CheckCircle size={12} />Confirmed</span>
                                                                        ) : (
                                                                            <span className="ud-table-badge" style={{ background: '#fef3c7', color: '#b45309' }}><Clock size={12} />Draft</span>
                                                                        )}
                                                                        {bp.isLocked && <span className="ud-table-badge locked"><Lock size={12} />Locked</span>}
                                                                    </div>
                                                                </td>
                                                                <td className="ud-td">
                                                                    <div className="ud-td-primary">{new Date(bp.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                                                                    <div className="ud-td-secondary">{new Date(bp.createdAt).getFullYear()}</div>
                                                                </td>
                                                                <td className="ud-td" style={{ textAlign: 'left' }}>
                                                                    <div
                                                                        className="ud-td-primary"
                                                                        style={{ color: 'var(--ap-accent)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                                        onClick={() => handleShowPaperTypeDetails(bp.questionPaperTypeId)}
                                                                        title="Click for Details"
                                                                    >
                                                                        {bp.questionPaperTypeName || 'N/A'}
                                                                    </div>
                                                                    {!isOwner && ownerUser && (
                                                                        <div className="ud-td-secondary">by {ownerUser.name}</div>
                                                                    )}
                                                                </td>
                                                                <td className="ud-td">
                                                                    <div className="ud-td-primary">Class {bp.classLevel === 'SSLC' ? '11' : bp.classLevel}</div>
                                                                    {bp.classLevel === 'SSLC' && <div className="ud-td-secondary">SSLC</div>}
                                                                </td>
                                                                <td className="ud-td">
                                                                    <div className="ud-td-primary" style={{ fontSize: '0.75rem', maxWidth: '140px', margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bp.subject}</div>
                                                                </td>
                                                                <td className="ud-td">
                                                                    <div
                                                                        className="ud-table-badge"
                                                                        style={{ background: '#f1f5f9', color: '#475569', cursor: 'pointer' }}
                                                                        onClick={() => handleShowWeightageDetails(bp.classLevel, bp.subject, bp.examTerm)}
                                                                        title="Click for Weightage"
                                                                    >
                                                                        {bp.examTerm}
                                                                    </div>
                                                                </td>
                                                                <td className="ud-td">
                                                                    <div className="ud-td-primary">{bp.setId || 'Set A'}</div>
                                                                </td>
                                                                <td className="ud-td">
                                                                    <div className="ud-table-marks">{bp.totalMarks}</div>
                                                                </td>
                                                                <td className="ud-td">
                                                                    <div className="ud-t-actions">
                                                                        <button className="ud-t-btn edit" title="Edit" onClick={() => handleEdit(bp)} disabled={!!bp.isLocked}>
                                                                            {bp.isLocked ? <Lock size={16} /> : <Edit3 size={16} />}
                                                                        </button>
                                                                        {isOwner && (
                                                                            <>
                                                                                <button className="ud-t-btn share" title="Share" onClick={() => setSharingBlueprintId(bp.id)}>
                                                                                    <Share2 size={16} />
                                                                                </button>
                                                                                <button className="ud-t-btn del" title="Delete" onClick={() => handleDelete(bp.id)} disabled={!!bp.isLocked}>
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* ── Mobile Cards ──────────────────────────── */}
                                        <div className="ud-cards">
                                            {filteredBlueprints.map((bp, index) => {
                                                const isOwner = bp.ownerId === user.id;
                                                const ownerUser = !isOwner ? allUsers.find(u => u.id === bp.ownerId) : null;
                                                const grad = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

                                                return (
                                                    <div key={bp.id} className="ud-card" style={{ animationDelay: `${index * 80}ms` }}>
                                                        {/* Card Header */}
                                                        <div className="ud-card-header" style={{ height: 'auto', minHeight: '100px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            <div className="ud-card-header-bg" style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }} />
                                                            <div className="ud-card-pattern" style={{
                                                                position: 'absolute', inset: 0, opacity: 0.3,
                                                                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                                                                backgroundSize: '12px 12px'
                                                            }} />

                                                            {/* Badges */}
                                                            <div className="ud-card-badges" style={{ position: 'relative', zIndex: 10 }}>
                                                                {isOwner
                                                                    ? <span style={{ background: '#06b6d4', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 800, padding: '0.25rem 0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>Owner</span>
                                                                    : <span style={{ background: '#0891b2', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 800, padding: '0.25rem 0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>Shared</span>
                                                                }
                                                                {bp.isConfirmed && (
                                                                    <span style={{ background: '#16a34a', color: '#fff', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 800, padding: '0.25rem 0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>✓ Confirmed</span>
                                                                )}
                                                                {bp.isLocked && (
                                                                    <span style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 800, padding: '0.25rem 0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔒 Locked</span>
                                                                )}
                                                            </div>

                                                            {/* Title & Date in Header */}
                                                            <div style={{ position: 'relative', zIndex: 10 }}>
                                                                <div
                                                                    style={{
                                                                        fontFamily: 'var(--ap-display)', fontSize: '1rem', fontWeight: 800, color: '#fff',
                                                                        lineHeight: 1.2, textShadow: '0 2px 4px rgba(0,0,0,0.2)', marginBottom: '0.2rem',
                                                                        cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted'
                                                                    }}
                                                                    onClick={() => handleShowPaperTypeDetails(bp.questionPaperTypeId)}
                                                                >
                                                                    {bp.questionPaperTypeName || 'N/A'}
                                                                </div>
                                                                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                                                                    {new Date(bp.createdAt).toLocaleDateString()}
                                                                    {!isOwner && ownerUser && ` • by ${ownerUser.name}`}
                                                                </div>
                                                            </div>

                                                            {/* Marks bubble */}
                                                            <div className="ud-card-marks">
                                                                <div className="ud-card-marks-label">Marks</div>
                                                                <div className="ud-card-marks-val">{bp.totalMarks}</div>
                                                            </div>
                                                        </div>

                                                        {/* Card Body */}
                                                        <div className="ud-card-body" style={{ padding: '0.75rem' }}>
                                                            <div className="ud-card-grid">
                                                                <div className="ud-card-meta">
                                                                    <div className="ud-card-meta-label">Class</div>
                                                                    <div className="ud-card-meta-val">Class {bp.classLevel === 'SSLC' ? '11 (SSLC)' : bp.classLevel}</div>
                                                                </div>
                                                                <div className="ud-card-meta" onClick={() => handleShowWeightageDetails(bp.classLevel, bp.subject, bp.examTerm)} style={{ cursor: 'pointer' }}>
                                                                    <div className="ud-card-meta-label">Term</div>
                                                                    <div className="ud-card-meta-val" style={{ color: 'var(--ap-accent)' }}>{bp.examTerm}</div>
                                                                </div>
                                                                <div className="ud-card-meta">
                                                                    <div className="ud-card-meta-label">Subject</div>
                                                                    <div className="ud-card-meta-val">{bp.subject}</div>
                                                                </div>
                                                                <div className="ud-card-meta">
                                                                    <div className="ud-card-meta-label">Set</div>
                                                                    <div className="ud-card-meta-val">{(() => {
                                                                        const s = (bp.setId || 'SET A').trim().toUpperCase();
                                                                        if (s === 'GENERAL' || s === 'GENERAL SET') return 'GENERAL SET';
                                                                        const letter = s.replace(/^SET\s*/i, '').trim().charAt(0) || 'A';
                                                                        return `SET ${letter}`;
                                                                    })()}</div>
                                                                </div>
                                                            </div>

                                                            <div className="ud-card-actions">
                                                                <button className="ud-card-btn edit" onClick={() => handleEdit(bp)} disabled={!!bp.isLocked}>
                                                                    {bp.isLocked ? <Lock size={14} /> : <Edit2 size={14} />}
                                                                    Edit
                                                                </button>
                                                                {isOwner && (
                                                                    <>
                                                                        <button className="ud-card-btn share" onClick={() => setSharingBlueprintId(bp.id)}>
                                                                            <Share2 size={14} /> Share
                                                                        </button>
                                                                        <button className="ud-card-btn del" onClick={() => handleDelete(bp.id)} disabled={!!bp.isLocked}>
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* ══════════════ CREATE / EDIT VIEW ═════════════════════════ */}
                    {(view === 'create' || view === 'edit') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Section title */}
                            <div className="ud-section-hdr no-print" style={{ marginBottom: 0 }}>
                                <h2 className="ud-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    {view === 'create' ? <><Sparkles size={20} style={{ color: 'var(--dash-accent)' }} /> New Blueprint</> : <><Edit2 size={20} style={{ color: 'var(--dash-accent2)' }} /> Edit Blueprint</>}
                                </h2>
                            </div>

                            {/* Config Panel */}
                            <div className="ud-config-panel no-print">
                                <div className="ud-config-hdr" onClick={() => setIsConfigExpanded(!isConfigExpanded)}>
                                    <div className="ud-config-title">
                                        <Settings size={17} style={{ color: 'var(--dash-accent)' }} />
                                        {view === 'create' ? 'Configuration' : 'Edit Configuration'}
                                        {currentBlueprint?.isConfirmed && (
                                            <span className="ud-badge confirmed" style={{ marginLeft: '0.5rem' }}><CheckCircle size={10} />Confirmed</span>
                                        )}
                                    </div>
                                    <div style={{ color: 'var(--dash-muted)' }}>
                                        {isConfigExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>

                                {isConfigExpanded && (
                                    <div className="ud-config-body">
                                        <div className="ud-form-grid">
                                            <div className="ud-form-group">
                                                <label className="ud-form-label">Class</label>
                                                <select className="ud-form-select" disabled={view === 'edit' || !!currentBlueprint?.isConfirmed} value={selectedClass} onChange={e => setSelectedClass(parseInt(e.target.value, 10) as ClassLevel)}>
                                                    {Object.values(ClassLevel).filter(v => typeof v === 'number').map(v => <option key={v} value={v}>Class {v}</option>)}
                                                </select>
                                            </div>
                                            <div className="ud-form-group">
                                                <label className="ud-form-label">Subject</label>
                                                <select className="ud-form-select" disabled={view === 'edit' || !!currentBlueprint?.isConfirmed} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value as SubjectType)}>
                                                    {Object.values(SubjectType).map(v => <option key={v} value={v}>{v}</option>)}
                                                </select>
                                            </div>
                                            <div className="ud-form-group">
                                                <label className="ud-form-label">Term</label>
                                                <select className="ud-form-select" disabled={view === 'edit' || !!currentBlueprint?.isConfirmed} value={selectedTerm} onChange={e => setSelectedTerm(e.target.value as ExamTerm)}>
                                                    {Object.values(ExamTerm).map(v => <option key={v} value={v}>{v}</option>)}
                                                </select>
                                            </div>
                                            <div className="ud-form-group">
                                                <label className="ud-form-label">Set</label>
                                                <select className="ud-form-select" disabled={view === 'edit' || !!currentBlueprint?.isConfirmed} value={selectedSet} onChange={e => setSelectedSet(e.target.value)}>
                                                    {['Set A', 'Set B', 'Set C', 'Set D'].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="ud-form-group">
                                                <label className="ud-form-label">Academic Year</label>
                                                <input type="text" className="ud-form-input" disabled={!!currentBlueprint?.isConfirmed} value={selectedAcademicYear} onChange={e => setSelectedAcademicYear(e.target.value)} placeholder="e.g. 2025-2026" />
                                            </div>
                                            {view === 'edit' && (
                                                <div className="ud-form-group">
                                                    <label className="ud-form-label">Paper Type</label>
                                                    <div className="ud-form-input" style={{ background: '#f8fafc', color: 'var(--ap-accent)', fontWeight: 800 }}>
                                                        {currentBlueprint?.questionPaperTypeName}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Paper Type Selection Cards ── */}
                                        {view === 'create' && (
                                            <div style={{ marginTop: '2.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                                    <div style={{ width: '4px', height: '24px', background: 'var(--ap-accent)', borderRadius: '4px' }}></div>
                                                    <label className="ud-form-label" style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Select Question Paper Type <span className="req">*</span></label>
                                                </div>

                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                                                    gap: '2rem',
                                                    padding: '10px'
                                                }}>
                                                    {paperTypes.map((pt, idx) => {
                                                        const isSelected = selectedPaperType === pt.id;
                                                        const totalQuestions = pt.sections.reduce((acc, s) => acc + s.count, 0);
                                                        const disabled = !!currentBlueprint?.isConfirmed;

                                                        return (
                                                            <div
                                                                key={pt.id}
                                                                onClick={() => !disabled && setSelectedPaperType(pt.id)}
                                                                style={{
                                                                    background: '#fff',
                                                                    border: isSelected ? '2.5px solid var(--ap-accent)' : '1px solid #e2e8f0',
                                                                    borderRadius: '45px',
                                                                    padding: '2.5rem',
                                                                    cursor: disabled ? 'default' : 'pointer',
                                                                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                    boxShadow: isSelected ? '0 30px 60px -12px rgba(37,99,235,0.2)' : '0 10px 20px -5px rgba(0,0,0,0.03)',
                                                                    transform: isSelected ? 'translateY(-8px)' : 'none',
                                                                    opacity: disabled && !isSelected ? 0.7 : 1,
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    position: 'relative'
                                                                }}
                                                            >
                                                                {/* Header */}
                                                                <div style={{ marginBottom: '1.75rem' }}>
                                                                    <div style={{ fontFamily: 'var(--ap-display)', fontSize: '1.4rem', fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.01em' }}>TYPE {idx + 1}</div>
                                                                    <div style={{ fontSize: '1.1rem', color: '#94a3b8', fontWeight: 600, fontStyle: 'italic', marginTop: '2px' }}>{pt.name}</div>
                                                                </div>

                                                                {/* Stats Grid */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
                                                                    <div style={{ background: '#fdf2f8', padding: '16px 4px', borderRadius: '24px', textAlign: 'center', border: '1px solid #fce7f3' }}>
                                                                        <div style={{ fontSize: '8px', fontWeight: 800, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>Total Marks</div>
                                                                        <div style={{ fontFamily: 'var(--ap-display)', fontSize: '20px', fontWeight: 800, color: '#be185d' }}>{pt.totalMarks}</div>
                                                                    </div>
                                                                    <div style={{ background: '#f0f9ff', padding: '16px 4px', borderRadius: '24px', textAlign: 'center', border: '1px solid #e0f2fe' }}>
                                                                        <div style={{ fontSize: '8px', fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>Questions</div>
                                                                        <div style={{ fontFamily: 'var(--ap-display)', fontSize: '20px', fontWeight: 800, color: '#0369a1' }}>{totalQuestions}</div>
                                                                    </div>
                                                                    <div style={{ background: '#f0fdf4', padding: '16px 4px', borderRadius: '24px', textAlign: 'center', border: '1px solid #dcfce7' }}>
                                                                        <div style={{ fontSize: '8px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>Total Time</div>
                                                                        <div style={{ fontFamily: 'var(--ap-display)', fontSize: '20px', fontWeight: 800, color: '#15803d' }}>90 Mins</div>
                                                                    </div>
                                                                </div>

                                                                {/* Separator */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                                                                    <div style={{ flex: 1, height: '1.5px', background: '#f1f5f9' }}></div>
                                                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>Questions & Marks Structure</div>
                                                                    <div style={{ flex: 1, height: '1.5px', background: '#f1f5f9' }}></div>
                                                                </div>

                                                                {/* Sections Preview */}
                                                                <div style={{ flex: 1 }}>
                                                                    {pt.sections.slice(0, 6).map((s, sIdx) => {
                                                                        const marksPerQ = s.marks;
                                                                        const sectionTotal = s.marks * s.count;
                                                                        return (
                                                                            <div key={sIdx} style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'space-between',
                                                                                padding: '12px 18px',
                                                                                background: '#fff',
                                                                                borderRadius: '20px',
                                                                                marginBottom: '10px',
                                                                                border: '1px solid #f1f5f9',
                                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                                                                            }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                                    <div style={{ width: '24px', height: '24px', background: '#1e1b4b', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>{sIdx + 1}</div>
                                                                                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SECTION {sIdx + 1}</div>
                                                                                </div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--ap-display)' }}>
                                                                                    <span style={{ color: '#1e293b' }}>{s.count}</span>
                                                                                    <span style={{ color: '#3b82f6', fontSize: '10px' }}>Q</span>
                                                                                    <span style={{ color: '#94a3b8', margin: '0 2px', fontWeight: 400 }}>×</span>
                                                                                    <span style={{ color: '#1e293b' }}>{marksPerQ}</span>
                                                                                    <span style={{ color: '#8b5cf6', fontSize: '10px' }}>M</span>
                                                                                    <span style={{ color: '#94a3b8', margin: '0 2px', fontWeight: 400 }}>=</span>
                                                                                    <span style={{ color: '#ec4899' }}>{sectionTotal}</span>
                                                                                    <span style={{ color: '#ec4899', fontSize: '10px' }}>M</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* Footer Action */}
                                                                <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
                                                                    <button
                                                                        style={{
                                                                            flex: 1,
                                                                            height: '54px',
                                                                            borderRadius: '20px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            gap: '10px',
                                                                            fontSize: '0.95rem',
                                                                            fontWeight: 800,
                                                                            background: isSelected ? 'var(--ap-accent)' : '#fff',
                                                                            color: isSelected ? '#fff' : '#1e1b4b',
                                                                            border: isSelected ? 'none' : '2px solid #f1f5f9',
                                                                            boxShadow: isSelected ? '0 10px 20px rgba(37,99,235,0.2)' : 'none',
                                                                            cursor: disabled ? 'default' : 'pointer',
                                                                            transition: 'all 0.2s',
                                                                            textTransform: 'uppercase',
                                                                            letterSpacing: '0.02em'
                                                                        }}
                                                                    >
                                                                        {isSelected ? <><CheckCircle size={18} /> SELECTED</> : <><Edit3 size={18} /> SELECT PATTERN</>}
                                                                    </button>
                                                                    <button style={{
                                                                        width: '54px', height: '54px', borderRadius: '20px', background: '#fff', border: '2px solid #f1f5f9',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', cursor: 'default'
                                                                    }}>
                                                                        <Trash2 size={20} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {view === 'create' && !currentBlueprint?.isConfirmed && (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                                                <button
                                                    className="ud-generate-btn"
                                                    onClick={handleGenerate}
                                                    style={{ height: '52px', borderRadius: '16px', padding: '0 2rem', fontSize: '1rem' }}
                                                    disabled={!selectedPaperType}
                                                >
                                                    <Sparkles size={18} /> Generate Matrix Pattern
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {currentBlueprint && curriculum && (
                                <UniversalBlueprintView
                                    blueprint={currentBlueprint}
                                    curriculum={curriculum}
                                    paperType={paperTypes.find(p => p.id === currentBlueprint.questionPaperTypeId)}
                                    discourses={discourses}
                                    isAdmin={user.role === Role.ADMIN || user.role === Role.WEBMASTER}
                                    isWebmaster={user.role === Role.WEBMASTER}
                                    onBack={() => { setView('list'); setCurrentBlueprint(null); }}
                                    onUpdateItemField={updateItem}
                                    onMoveItem={moveItem}
                                    onSave={handleSaveToDB}
                                    onRegenerate={handleRegeneratePattern}
                                    onConfirm={handleConfirmPattern}
                                    onConfirmQuestions={handleConfirmQuestions}
                                    onConfirmAnswerKey={handleConfirmAnswerKey}
                                    onConfirmReport={handleConfirmReport}
                                    onDownloadPDF={(type) => exportPDF(currentBlueprint, curriculum, type as any, false)}
                                    onDownloadWord={handleDownloadWord}
                                    onUpdateReportSettings={(s, p) => setCurrentBlueprint(prev => prev ? { ...prev, reportSettings: s, perReportSettings: p } : null)}
                                    onSaveSettings={handleSaveReportSettings}
                                    isSaving={isSaving}
                                />)}
                        </div>
                    )}

                    {/* ══════════════ PROFILE VIEW ═════════════════════════════════ */}
                    {view === 'profile' && (
                        <UserProfile
                            user={user}
                            onUpdate={onUpdateUser}
                            onBack={() => {
                                if (isProfileIncomplete) {
                                    Swal.fire({
                                        title: "Incomplete Profile",
                                        text: "Please complete and save your profile before returning to the dashboard.",
                                        icon: "warning",
                                        confirmButtonColor: "#4f46e5"
                                    });
                                    return;
                                }
                                setView('list');
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Sharing Modal */}
            {sharingBlueprintId && (
                <BlueprintSharingModal
                    blueprint={blueprints.find(bp => bp.id === sharingBlueprintId)!}
                    currentUserId={user.id}
                    onClose={() => setSharingBlueprintId(null)}
                    onShareComplete={async () => {
                        const updated = await getAllAccessibleBlueprints(user.id);
                        setBlueprints(updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                    }}
                />
            )}
        </>
    );
};

export default UserDashboard;
