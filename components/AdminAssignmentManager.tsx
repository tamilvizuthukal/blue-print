import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import {
    Users, Search, CheckCircle, AlertCircle, FileText,
    Settings, PlusCircle, ArrowRight, UserPlus,
    BookOpen, Layers, Calendar, Loader2, List,
    Trash2, Eye, Filter, RefreshCw, Edit,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import {
    getUsers, saveBlueprint, getBlueprints, deleteBlueprint,
    getQuestionPaperTypes, generateBlueprintTemplate,
    getDB, initDB, getCurriculum, filterCurriculumByTerm,
    getCurrentAcademicYear
} from '../services/db';
import {
    User, Blueprint, QuestionPaperType, Role,
    ClassLevel, SubjectType, ExamTerm
} from '../types';

interface AdminAssignmentManagerProps {
    onAssign?: () => void;
}

const AdminAssignmentManager: React.FC<AdminAssignmentManagerProps> = ({ onAssign }) => {
    // State
    const [activeTab, setActiveTab] = useState<'assign' | 'view'>('assign');
    const [users, setUsers] = useState<User[]>([]);
    const teacherUsers = React.useMemo(() => users.filter(u => u.role !== Role.ADMIN), [users]);
    const [loading, setLoading] = useState(true);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [listSearchTerm, setListSearchTerm] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [editingBlueprintIds, setEditingBlueprintIds] = useState<string[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);
    const [paperTypes, setPaperTypes] = useState<QuestionPaperType[]>([]);
    const [assignedPapers, setAssignedPapers] = useState<Blueprint[]>([]);

    // Filters & Pagination State
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(6);

    const filteredAssignments = React.useMemo(() => {
        let filtered = [...assignedPapers];
        
        if (selectedClass && selectedClass !== 'all') {
            filtered = filtered.filter(bp => String(bp.classLevel) === selectedClass);
        }
        
        if (selectedSubject && selectedSubject !== 'all') {
            filtered = filtered.filter(bp => bp.subject === selectedSubject);
        }

        if (listSearchTerm.trim()) {
            const search = listSearchTerm.toLowerCase();
            filtered = filtered.filter(bp => {
                const teacher = users.find(u => u.id === bp.ownerId);
                return (
                    (teacher?.name.toLowerCase().includes(search)) ||
                    bp.subject.toLowerCase().includes(search) ||
                    bp.questionPaperTypeName.toLowerCase().includes(search) ||
                    bp.classLevel.toString().includes(search) ||
                    bp.examTerm.toLowerCase().includes(search)
                );
            });
        }
        return filtered;
    }, [assignedPapers, listSearchTerm, selectedClass, selectedSubject, users]);

    const flatAssignments = React.useMemo(() => {
        return [...filteredAssignments].map(bp => {
            const teacher = users.find(u => u.id === bp.ownerId);
            return {
                key: bp.id,
                blueprint: bp,
                teacher: teacher || { name: 'Unknown Teacher', schoolName: '', pen: '' },
                classLevel: bp.classLevel,
                subject: bp.subject,
                questionPaperTypeId: bp.questionPaperTypeId,
                questionPaperTypeName: bp.questionPaperTypeName,
                examTerm: bp.examTerm,
                academicYear: bp.academicYear || getCurrentAcademicYear(),
                setId: bp.setId || 'A',
                totalMarks: bp.totalMarks
            };
        }).sort((a, b) => {
            const parseClass = (c: any) => {
                if (c === 'SSLC') return 11;
                return parseInt(c) || 0;
            };
            const classDiff = parseClass(a.classLevel) - parseClass(b.classLevel);
            if (classDiff !== 0) return classDiff;

            const getSubjectOrder = (sub: string) => {
                if (sub === SubjectType.TAMIL_AT) return 1;
                if (sub === SubjectType.TAMIL_BT) return 2;
                return 3;
            };
            const subjectDiff = getSubjectOrder(a.subject) - getSubjectOrder(b.subject);
            if (subjectDiff !== 0) return subjectDiff;

            const typeDiff = a.questionPaperTypeName.localeCompare(b.questionPaperTypeName, undefined, { numeric: true });
            if (typeDiff !== 0) return typeDiff;

            const getTermOrder = (term: string) => {
                if (term.includes('First')) return 1;
                if (term.includes('Second')) return 2;
                if (term.includes('Third')) return 3;
                return 4;
            };
            const termDiff = getTermOrder(a.examTerm) - getTermOrder(b.examTerm);
            if (termDiff !== 0) return termDiff;

            const setDiff = (a.setId || 'A').localeCompare(b.setId || 'A', undefined, { numeric: true });
            if (setDiff !== 0) return setDiff;

            return a.teacher.name.localeCompare(b.teacher.name);
        });
    }, [filteredAssignments, users]);

    const paginatedAssignments = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return flatAssignments.slice(start, start + pageSize);
    }, [flatAssignments, currentPage, pageSize]);

    const totalPages = Math.max(1, Math.ceil(flatAssignments.length / pageSize));

    // Reset page on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [listSearchTerm, selectedClass, selectedSubject, pageSize]);
    // Paper Configuration State
    const [config, setConfig] = useState({
        classLevel: 10 as ClassLevel,
        subject: SubjectType.TAMIL_AT,
        examTerm: ExamTerm.FIRST,
        paperType: '',
        setLabel: 'SET A',
        examYear: new Date().getFullYear().toString() + '-' + (new Date().getFullYear() + 1).toString().slice(2),
        totalMarks: 10,
    });

    // Options
    const classOptions = [ClassLevel._8, ClassLevel._9, ClassLevel._10];
    const subjectOptions = Object.values(SubjectType);
    const termOptions = Object.values(ExamTerm);
    // Set options stored as 'SET A', 'SET B', etc. to match the blueprint setId format
    const setOptions = [
        { value: 'SET A', label: 'SET A' },
        { value: 'SET B', label: 'SET B' },
        { value: 'SET C', label: 'SET C' },
        { value: 'SET D', label: 'SET D' },
        { value: 'GENERAL', label: 'GENERAL SET' },
    ];
    // Sort paper types by name for consistent Type 1, Type 2, Type 3 order
    const sortedPaperTypes = React.useMemo(() =>
        [...paperTypes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
        [paperTypes]
    );

    useEffect(() => {
        loadBaseData();
    }, []);

    useEffect(() => {
        if (activeTab === 'view') {
            loadAssignments();
        }
    }, [activeTab]);

    const loadBaseData = async () => {
        try {
            setLoading(true);
            let db = getDB();
            if (!db) db = await initDB();

            const [allUsers, pTypes] = await Promise.all([
                getUsers(),
                getQuestionPaperTypes()
            ]);

            setUsers(allUsers);
            setPaperTypes(pTypes);

            // Sort by name and set first type as default
            const sorted = [...pTypes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            if (sorted.length > 0) {
                setConfig(prev => ({
                    ...prev,
                    paperType: sorted[0].id,
                    totalMarks: sorted[0].totalMarks
                }));
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAssignments = async () => {
        try {
            setLoadingAssignments(true);
            const allBps = await getBlueprints('all');
            // Filter only those assigned by admin
            setAssignedPapers(allBps.filter(bp => bp.isAdminAssigned).sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ));
        } catch (error) {
            console.error('Failed to load assignments:', error);
        } finally {
            setLoadingAssignments(false);
        }
    };

    const handleDeleteAssignment = async (ids: string | string[]) => {
        const idArray = Array.isArray(ids) ? ids : [ids];
        const msg = idArray.length > 1
            ? `Are you sure you want to delete these ${idArray.length} assignments?`
            : 'Are you sure you want to delete this assignment?';

        Swal.fire({
            title: "Are you sure?",
            text: msg,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete it!"
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    for (const id of idArray) {
                        await deleteBlueprint(id);
                    }
                    loadAssignments();
                    Swal.fire("Deleted", "Assignment(s) removed successfully.", "success");
                } catch (error) {
                    console.error('Delete failed:', error);
                    Swal.fire("Error", "Failed to delete assignment.", "error");
                }
            }
        });
    };



    const filteredUsers = teacherUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.staffId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.pen?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleUserSelection = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSelectAll = () => {
        if (selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0) {
            setSelectedUserIds([]);
        } else {
            setSelectedUserIds(filteredUsers.map(u => u.id));
        }
    };

    const handleEditAssignment = (bps: Blueprint[]) => {
        setEditingBlueprintIds(bps.map(bp => bp.id));
        const first = bps[0];
        setConfig({
            classLevel: first.classLevel,
            subject: first.subject,
            examTerm: first.examTerm,
            paperType: first.questionPaperTypeId,
            // Normalize setId to 'SET X' format
            setLabel: first.setId
                ? (first.setId.startsWith('SET') ? first.setId : `SET ${first.setId}`)
                : 'SET A',
            examYear: first.academicYear,
            totalMarks: first.totalMarks,
        });
        // Deduplicate ownerIds — if the same teacher has duplicate blueprints, only select them once
        const uniqueOwnerIds = [...new Set(bps.map(bp => bp.ownerId).filter(Boolean))];
        setSelectedUserIds(uniqueOwnerIds);
        setActiveTab('assign');

        // Scroll to top to see the form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingBlueprintIds([]);
        setSelectedUserIds([]);
        // Reset to some defaults if needed, or just keep current config
    };

    const handleAssign = async () => {
        if (selectedUserIds.length === 0) {
            Swal.fire("Error", "Please select at least one teacher. (குறைந்தது ஒரு ஆசிரியரைத் தேர்ந்தெடுக்கவும்)", "error");
            return;
        }

        if (!config.paperType) {
            Swal.fire("Error", "Please select a paper type. (வினாத்தாள் வகையைத் தேர்ந்தெடுக்கவும்)", "error");
            return;
        }

        setIsAssigning(true);

        try {
            const db = getDB();
            if (!db) throw new Error("Database not initialized");

            const selectedPaperType = paperTypes.find(t => t.id === config.paperType) || paperTypes[0];
            const timestamp = new Date().toISOString();

            // 1. Get base curriculum
            const curriculum = await getCurriculum(config.classLevel, config.subject);
            if (!curriculum) {
                Swal.fire("Error", `No curriculum found for Class ${config.classLevel} ${config.subject}.`, "error");
                setIsAssigning(false);
                return;
            }

            // 2. Filter curriculum by term if needed
            const filteredCurriculum = filterCurriculumByTerm(db, curriculum, config.examTerm);
            if (!filteredCurriculum) {
                Swal.fire("Error", `No active units found for ${config.examTerm}.`, "error");
                setIsAssigning(false);
                return;
            }

            // Always reload users too so names are fresh
            const freshUsers = await getUsers();
            setUsers(freshUsers);

            // Deduplicate selectedUserIds to prevent creating duplicate blueprints
            const uniqueUserIds = [...new Set(selectedUserIds)];

            // Resolve teacher names for success message
            const teacherNames = uniqueUserIds
                .map(id => freshUsers.find(u => u.id === id)?.name)
                .filter(Boolean);

            // If updating, delete the old ones first
            if (editingBlueprintIds.length > 0) {
                for (const id of editingBlueprintIds) {
                    await deleteBlueprint(id);
                }
            } else {
                // For fresh assignments: check for already-assigned papers and remove old duplicates
                const existingBps = await getBlueprints('all');
                const duplicateIds = existingBps
                    .filter(bp =>
                        bp.isAdminAssigned &&
                        uniqueUserIds.includes(bp.ownerId) &&
                        bp.questionPaperTypeId === config.paperType &&
                        bp.examTerm === config.examTerm &&
                        bp.academicYear === config.examYear &&
                        // Normalize both sides for comparison
                        (bp.setId || 'SET A').replace(/^SET\s*/i, '').trim() === (config.setLabel || 'SET A').replace(/^SET\s*/i, '').trim() &&
                        bp.classLevel === config.classLevel &&
                        bp.subject === config.subject
                    )
                    .map(bp => bp.id);
                for (const id of duplicateIds) {
                    await deleteBlueprint(id);
                }
            }

            // Create new blueprints for all unique selected users
            for (const userId of uniqueUserIds) {
                const items = generateBlueprintTemplate(
                    db,
                    filteredCurriculum,
                    config.examTerm,
                    config.paperType
                ).map(item => ({
                    ...item,
                    id: Math.random().toString(36).substr(2, 9)
                }));

                const newBlueprint: Blueprint = {
                    id: Math.random().toString(36).substr(2, 9),
                    ownerId: userId,
                    classLevel: config.classLevel,
                    subject: config.subject,
                    questionPaperTypeId: config.paperType,
                    questionPaperTypeName: selectedPaperType.name,
                    examTerm: config.examTerm,
                    academicYear: config.examYear,
                    setId: config.setLabel,
                    totalMarks: config.totalMarks,
                    items: items,
                    isConfirmed: false,
                    isLocked: false,
                    isHidden: false,
                    createdAt: timestamp,
                    isAdminAssigned: true,
                    reportSettings: {
                        fontFamily: "TAU-Paalai",
                        fontSizeBody: 12,
                        fontSizeTitle: 14,
                        fontSizeTamil: 14,
                        rowHeight: 35,
                        columnWidths: {},
                        showLogo: true,
                        compactMode: false,
                        lineHeight: 1.6
                    }
                };

                await saveBlueprint(newBlueprint);
            }

            const teacherList = teacherNames.length > 0
                ? `\n\nTeachers:\n${teacherNames.map(n => `• ${n}`).join('\n')}`
                : '';

            const successMsg = editingBlueprintIds.length > 0
                ? `Successfully updated assignment.${teacherList}`
                : `Successfully assigned to ${uniqueUserIds.length} teacher(s).${teacherList}`;

            Swal.fire("Success", successMsg, "success");

            setEditingBlueprintIds([]);
            setSelectedUserIds([]);

            if (onAssign) {
                onAssign();
            }

            // Always reload and switch to view tab so teacher names show immediately
            await loadAssignments();
            setActiveTab('view');

        } catch (error: any) {
            console.error('Process failed:', error);
            Swal.fire("Error", `Process failed: ${error.message}`, "error");
        } finally {
            setIsAssigning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 space-y-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Initializing Database...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
                        <UserPlus size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 font-display tracking-tight">
                            Assignment Manager
                        </h2>
                    </div>
                </div>

                <div className="flex p-1 bg-gray-100/80 rounded-xl backdrop-blur-md border border-gray-200 shadow-inner w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('assign')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all duration-300 ${activeTab === 'assign'
                            ? 'bg-white text-blue-600 shadow-md'
                            : 'text-gray-500 hover:text-gray-800'
                            }`}
                    >
                        <PlusCircle size={16} /> New Assignment
                    </button>
                    <button
                        onClick={() => setActiveTab('view')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all duration-300 ${activeTab === 'view'
                            ? 'bg-white text-blue-600 shadow-md'
                            : 'text-gray-500 hover:text-gray-800'
                            }`}
                    >
                        <List size={16} /> View Assignments
                    </button>
                </div>
            </div>

            {activeTab === 'assign' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Configuration */}
                    <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
                        <div className="ap-card overflow-hidden border-blue-50 shadow-sm">
                            <div className="p-4 border-b border-gray-50 bg-blue-50/30 flex items-center justify-between">
                                <h3 className="font-bold text-blue-900 font-display flex items-center gap-2 text-sm">
                                    <Settings size={16} className="text-blue-600" />
                                    1. Paper Setup
                                </h3>
                            </div>
                            <div className="p-4 grid grid-cols-2 md:grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Layers size={12} /> Class
                                    </label>
                                    <select
                                        value={config.classLevel}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const parsedVal = isNaN(Number(val)) ? val : Number(val);
                                            setConfig({ ...config, classLevel: parsedVal as ClassLevel });
                                        }}
                                        className="ap-select w-full bg-gray-50/50 text-sm py-2"
                                    >
                                        {classOptions.map(opt => <option key={opt} value={opt}>Class {opt}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <BookOpen size={12} /> Subject
                                    </label>
                                    <select
                                        value={config.subject}
                                        onChange={(e) => setConfig({ ...config, subject: e.target.value as SubjectType })}
                                        className="ap-select w-full bg-gray-50/50 text-sm py-2"
                                    >
                                        {subjectOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Calendar size={12} /> Exam Term
                                    </label>
                                    <select
                                        value={config.examTerm}
                                        onChange={(e) => setConfig({ ...config, examTerm: e.target.value as ExamTerm })}
                                        className="ap-select w-full bg-gray-50/50 text-sm py-2"
                                    >
                                        {termOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={12} /> Paper Type
                                    </label>
                                    <select
                                        value={config.paperType}
                                        onChange={(e) => {
                                            const type = sortedPaperTypes.find(t => t.id === e.target.value);
                                            setConfig({
                                                ...config,
                                                paperType: e.target.value,
                                                totalMarks: type?.totalMarks || config.totalMarks
                                            });
                                        }}
                                        className="ap-select w-full bg-gray-50/50 text-sm py-2"
                                    >
                                        <option value="" disabled>Select Type</option>
                                        {sortedPaperTypes.map(type => (
                                            <option key={type.id} value={type.id}>{type.name} ({type.totalMarks} Marks)</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <PlusCircle size={12} /> Question Set
                                    </label>
                                    <select
                                        value={config.setLabel}
                                        onChange={(e) => setConfig({ ...config, setLabel: e.target.value })}
                                        className="ap-select w-full bg-gray-50/50 text-sm py-2"
                                    >
                                        {setOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5 col-span-1 md:col-span-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Marks & Year</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            value={isNaN(config.totalMarks) ? '' : config.totalMarks}
                                            onChange={(e) => setConfig({ ...config, totalMarks: parseInt(e.target.value) || 0 })}
                                            placeholder="Marks"
                                            className="ap-input bg-gray-50/50 h-[38px] text-sm"
                                        />
                                        <input
                                            type="text"
                                            value={config.examYear}
                                            onChange={(e) => setConfig({ ...config, examYear: e.target.value })}
                                            placeholder="Year"
                                            className="ap-input bg-gray-50/50 h-[38px] text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Teacher Selection and Assign Button */}
                    <div className="lg:col-span-8 space-y-4">
                        <div className="ap-card flex flex-col h-[700px] shadow-lg shadow-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-white sticky top-0 z-10 backdrop-blur-md">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-gray-800 font-display flex items-center gap-2 text-sm">
                                        <Users size={16} className="text-blue-600" />
                                        2. Select Teachers
                                    </h3>
                                    <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                        {[...new Set(selectedUserIds)].length} / {teacherUsers.length} Selected
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-b border-gray-50 bg-gray-50/20">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search teachers..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="ap-input pl-10 h-10 bg-white border-gray-200 focus:border-blue-500 focus:shadow-md transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <div className="px-4 py-2 bg-gray-50/50 flex items-center justify-between border-b border-gray-50">
                                <button
                                    onClick={handleSelectAll}
                                    className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-colors flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md active:scale-95"
                                >
                                    <CheckCircle size={12} />
                                    {selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0 ? 'Deselect All' : 'Select All Filtered'}
                                </button>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Filter size={10} />
                                    {filteredUsers.length} Results
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                                {filteredUsers.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                                        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-4 border border-dashed border-gray-200">
                                            <Users size={32} />
                                        </div>
                                        <p className="font-bold text-gray-400 text-xs">No teachers found.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {filteredUsers.map(user => {
                                            const isSelected = selectedUserIds.includes(user.id);
                                            return (
                                                <div
                                                    key={user.id}
                                                    onClick={() => toggleUserSelection(user.id)}
                                                    className={`p-3 flex items-center justify-between cursor-pointer rounded-xl border transition-all duration-200 group/item ${isSelected
                                                        ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-50'
                                                        : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50/30'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black transition-all ${isSelected
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-100 text-gray-400 group-hover/item:bg-blue-100 group-hover/item:text-blue-400'
                                                            }`}>
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className={`font-bold text-sm truncate transition-colors ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                                                {user.name}
                                                            </div>
                                                            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider truncate">
                                                                PEN: {user.pen || 'N/A'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                        : 'border-gray-200 bg-gray-50 group-hover/item:border-blue-200'
                                                        }`}>
                                                        {isSelected && <CheckCircle size={12} strokeWidth={3} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Summary and Assign Button Integrated back into the Card footer to remove space */}
                            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md">
                                                <Layers size={16} />
                                            </div>
                                            <div>
                                                <div className="text-[8px] font-black text-white/50 uppercase tracking-widest">Configuration</div>
                                                <div className="font-extrabold text-white text-[11px]">Class {config.classLevel} - {config.subject}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md">
                                                <Users size={16} />
                                            </div>
                                            <div>
                                                <div className="text-[8px] font-black text-white/50 uppercase tracking-widest">Target</div>
                                                <div className="font-extrabold text-white text-[11px]">{[...new Set(selectedUserIds)].length} Selected</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        {editingBlueprintIds.length > 0 && (
                                            <button
                                                onClick={handleCancelEdit}
                                                className="flex-1 sm:flex-none px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button
                                            onClick={handleAssign}
                                            disabled={isAssigning || selectedUserIds.length === 0}
                                            className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-blue-700 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/10"
                                        >
                                            {isAssigning ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={14} />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    {editingBlueprintIds.length > 0 ? 'Update' : 'Confirm Assign'}
                                                    <ArrowRight size={14} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (

                <div className="space-y-6">
                    {/* View Assignments List */}
                    <div className="ap-card overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-white flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-100 rounded-2xl text-purple-600">
                                    <List size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg">Assigned Question Papers</h3>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none shadow-sm h-10 cursor-pointer"
                                >
                                    <option value="all">All Classes</option>
                                    <option value="8">Class 8</option>
                                    <option value="9">Class 9</option>
                                    <option value="10">Class 10</option>
                                    <option value="SSLC">SSLC</option>
                                </select>
                                
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none shadow-sm h-10 cursor-pointer"
                                >
                                    <option value="all">All Subjects</option>
                                    <option value="Tamil AT">Tamil AT</option>
                                    <option value="Tamil BT">Tamil BT</option>
                                </select>

                                <div className="relative flex-1 sm:flex-none sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search assignments..."
                                        value={listSearchTerm}
                                        onChange={(e) => setListSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-200 transition-all bg-gray-50/50"
                                    />
                                </div>

                                <button
                                    onClick={loadAssignments}
                                    className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all h-10 w-10 flex items-center justify-center border border-gray-100 shadow-sm"
                                    title="Refresh List"
                                >
                                    <RefreshCw size={20} className={loadingAssignments ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-100 text-left">
                                        <th className="p-3 font-black uppercase text-[9px] tracking-widest text-gray-400 border-x border-gray-100">Teacher & School</th>
                                        <th className="p-3 font-black uppercase text-[9px] tracking-widest text-gray-400 border-x border-gray-100">Class & Subject</th>
                                        <th className="p-3 font-black uppercase text-[9px] tracking-widest text-gray-400 border-x border-gray-100">Set & Paper Type</th>
                                        <th className="p-3 font-black uppercase text-[9px] tracking-widest text-gray-400 border-x border-gray-100">Confirmation Status</th>
                                        <th className="p-3 font-black uppercase text-[9px] tracking-widest text-gray-400 text-right no-print border-l border-gray-100">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loadingAssignments ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="animate-spin text-blue-600" size={24} />
                                                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Loading...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginatedAssignments.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <FileText className="text-gray-200" size={32} />
                                                    <p className="text-gray-400 font-bold text-xs">No assignments found.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedAssignments.map(assignment => {
                                            const bp = assignment.blueprint;
                                            const teacher = assignment.teacher;
                                            
                                            // Calculate confirmed components count
                                            const confirmedCount = [
                                                bp.isConfirmed, 
                                                bp.isQuestionConfirmed, 
                                                bp.isAnswerKeyConfirmed
                                            ].filter(Boolean).length;
                                            
                                            let badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                                            if (confirmedCount === 3) {
                                                badgeClass = "bg-green-50 text-green-700 border-green-200";
                                            } else if (confirmedCount === 0) {
                                                badgeClass = "bg-red-50 text-red-700 border-red-200";
                                            }

                                            return (
                                                <tr key={assignment.key} className="hover:bg-purple-50/20 transition-colors group border-b border-gray-100">
                                                    {/* Teacher & School */}
                                                    <td className="p-4 align-middle border-x border-gray-50 whitespace-nowrap">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="font-bold text-gray-900 text-sm">{teacher.name}</div>
                                                            {teacher.schoolName && (
                                                                <div className="text-[10px] text-gray-500 font-medium">
                                                                    {teacher.schoolName}
                                                                </div>
                                                            )}
                                                            {teacher.pen && (
                                                                <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                                                                    PEN: {teacher.pen}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Class & Subject */}
                                                    <td className="p-4 align-middle border-r border-gray-50 font-bold text-gray-900 whitespace-nowrap">
                                                        {assignment.classLevel}-{assignment.subject}
                                                    </td>

                                                    {/* Set & Paper Type */}
                                                    <td className="p-4 align-middle border-r border-gray-50 min-w-[200px]">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-[10px] font-black bg-purple-50 text-purple-600 px-2.5 py-1 rounded-xl border border-purple-100 uppercase tracking-widest">
                                                                    {(() => {
                                                                        const s = assignment.setId || 'A';
                                                                        if (s.startsWith('SET')) return s;
                                                                        if (s === 'GENERAL') return 'GENERAL SET';
                                                                        return `SET ${s}`;
                                                                    })()}
                                                                </span>
                                                                <span className="font-black text-gray-800 text-[11px] uppercase tracking-tight leading-tight">
                                                                    {assignment.questionPaperTypeName}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest w-fit">
                                                                    {assignment.examTerm}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-gray-300">•</span>
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                                                    {assignment.academicYear}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Confirmation Status */}
                                                    <td className="p-4 align-middle border-r border-gray-50 min-w-[280px]">
                                                        <div className="flex flex-col gap-2">
                                                            {/* Summary Badge */}
                                                            <div>
                                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-sm ${badgeClass}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${confirmedCount === 3 ? 'bg-green-500' : confirmedCount === 0 ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                                                                    {confirmedCount === 3 
                                                                        ? "3/3 Confirmed" 
                                                                        : confirmedCount === 0 
                                                                            ? "Pending (0/3 Confirmed)" 
                                                                            : `${confirmedCount}/3 Confirmed`}
                                                                </span>
                                                            </div>
                                                            {/* Individual Indicators */}
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-600 font-medium">
                                                                <span className="flex items-center gap-1">
                                                                    <span>📊 Blueprint:</span>
                                                                    <span className={`font-black text-xs ${bp.isConfirmed ? "text-green-600" : "text-amber-500"}`}>
                                                                        {bp.isConfirmed ? "✅" : "⏳"}
                                                                    </span>
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <span>📄 Question Paper:</span>
                                                                    <span className={`font-black text-xs ${bp.isQuestionConfirmed ? "text-green-600" : "text-amber-500"}`}>
                                                                        {bp.isQuestionConfirmed ? "✅" : "⏳"}
                                                                    </span>
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <span>🔑 Answer Key:</span>
                                                                    <span className={`font-black text-xs ${bp.isAnswerKeyConfirmed ? "text-green-600" : "text-amber-500"}`}>
                                                                        {bp.isAnswerKeyConfirmed ? "✅" : "⏳"}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="p-3 text-right no-print align-middle border-l border-gray-50">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleEditAssignment([bp])}
                                                                className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="Edit Assignment"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteAssignment([bp.id])}
                                                                className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                title="Delete Assignment"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                            {/* Page Size & Info */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rows per page:</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-white border border-gray-100 rounded-xl px-3 py-1.5 text-xs font-black text-gray-700 focus:outline-none shadow-sm cursor-pointer"
                                    >
                                        {[6, 12, 18, 24, 30].map(size => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                </div>
                                <span className="text-xs font-bold text-gray-500">
                                    Showing {flatAssignments.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                                    {Math.min(currentPage * pageSize, flatAssignments.length)} of {flatAssignments.length} entries
                                </span>
                            </div>

                            {/* Page Navigation */}
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="w-9 h-9 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-500 hover:text-blue-600 disabled:opacity-40 disabled:hover:text-gray-500 transition-all shadow-sm active:scale-95 shrink-0"
                                    >
                                        <ChevronLeft size={16} strokeWidth={2.5} />
                                    </button>

                                    {/* Direct Page Links */}
                                    {Array.from({ length: totalPages }).map((_, idx) => {
                                        const pageNum = idx + 1;
                                        const isFirst = pageNum === 1;
                                        const isLast = pageNum === totalPages;
                                        const isWithinRange = Math.abs(pageNum - currentPage) <= 1;

                                        if (isFirst || isLast || isWithinRange) {
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`w-9 h-9 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95 shrink-0 ${
                                                        currentPage === pageNum
                                                            ? 'bg-blue-600 text-white border border-blue-600 shadow-blue-100'
                                                            : 'bg-white text-gray-600 hover:bg-blue-50/20 border border-gray-100'
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        } else if (
                                            (pageNum === 2 && currentPage > 3) ||
                                            (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                                        ) {
                                            return <span key={pageNum} className="text-gray-400 text-xs px-1 select-none">...</span>;
                                        }
                                        return null;
                                    })}

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="w-9 h-9 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-500 hover:text-blue-600 disabled:opacity-40 disabled:hover:text-gray-500 transition-all shadow-sm active:scale-95 shrink-0"
                                    >
                                        <ChevronRight size={16} strokeWidth={2.5} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAssignmentManager;


