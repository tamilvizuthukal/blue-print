import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    FileText, Lock, Unlock, Eye, EyeOff, Search, Trash2, User as UserIcon, Calendar, BookOpen, Clock, Share2, X, Plus, UserPlus, Edit2, CheckCircle, RotateCcw, Loader2, ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { Blueprint, User, ExamTerm } from '../types';
import { getBlueprints, getUsers, deleteBlueprint, toggleBlueprintLock, toggleBlueprintHidden, getSharedWithUsers, removeShare, shareBlueprint, resetBlueprintConfirmation, saveBlueprint, getCurrentAcademicYear, getCurriculum } from '../services/db';
import { runBulkExportAndMerge, runBulkExamExport, runBulkExamExportAndMerge } from '../services/pdfExportService';

interface AdminQuestionPaperManagerProps {
    user: User;
    onEditBlueprint: (bp: Blueprint) => void;
}

import { TableRowSkeleton, CardSkeleton } from './LoadingSkeleton';

const AdminQuestionPaperManager = ({ user, onEditBlueprint }: AdminQuestionPaperManagerProps) => {
    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFilter, setSelectedFilter] = useState<string>('');
    const [selectedShareBp, setSelectedShareBp] = useState<string | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [sharedUsers, setSharedUsers] = useState<User[]>([]);
    const [loadingShared, setLoadingShared] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedFilter, blueprints.length]);

    useEffect(() => {
        const loadSharedUsers = async () => {
            if (!selectedShareBp) {
                setSharedUsers([]);
                return;
            }
            setLoadingShared(true);
            try {
                const data = await getSharedWithUsers(selectedShareBp);
                setSharedUsers(data);
            } catch (error) {
                console.error("Error loading shared users:", error);
            } finally {
                setLoadingShared(false);
            }
        };
        loadSharedUsers();
    }, [selectedShareBp]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allBlueprints, allUsers] = await Promise.all([
                getBlueprints('all'),
                getUsers()
            ]);
            setBlueprints(allBlueprints);
            setUsers(allUsers);

            // Auto-select the latest created exam if no filter is selected
            if (!selectedFilter && allBlueprints.length > 0) {
                const sorted = [...allBlueprints].sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                const latest = sorted[0];
                const filterStr = `${latest.examTerm}|${latest.academicYear || getCurrentAcademicYear()}`;
                setSelectedFilter(filterStr);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleBulkPrint = async (bp: Blueprint) => {
        try {
            Swal.fire({
                title: 'Loading Curriculum…',
                text: 'Please wait...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });
            const cur = await getCurriculum(bp.classLevel, bp.subject);
            if (!cur) {
                Swal.fire('Error', 'Curriculum not found for this class and subject.', 'error');
                return;
            }
            Swal.close();
            await runBulkExportAndMerge(bp, cur, true);
        } catch (error) {
            console.error("Bulk print failed:", error);
            Swal.fire('Error', 'Failed to load curriculum or run export.', 'error');
        }
    };

    const handleBulkExamExportClick = async () => {
        await runBulkExamExport(selectedFilter, blueprints);
    };

    const handleBulkExamExportMergeClick = async () => {
        await runBulkExamExportAndMerge(selectedFilter, blueprints);
    };

    const handleDelete = async (ids: string[]) => {
        const msg = ids.length > 1 
            ? `These ${ids.length} question papers will be permanently deleted!`
            : "This question paper will be permanently deleted!";

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
                for (const id of ids) {
                    await deleteBlueprint(id);
                }
                await loadData();
                Swal.fire("Deleted", "Question paper(s) removed successfully.", "success");
            }
        });
    };

    const handleToggleLock = async (ids: string[], isLocking?: boolean) => {
        const group = blueprints.filter(b => ids.includes(b.id));
        if (group.length > 1) {
            const options: Record<string, string> = { 'all': 'All Teachers / அனைத்து ஆசிரியர்களும்' };
            group.forEach(b => {
                const name = getUserName(b.ownerId);
                options[b.id] = name;
            });

            const { value: selection } = await Swal.fire({
                title: 'Lock / Unlock Selection',
                text: 'Select teacher or apply to all:',
                input: 'select',
                inputOptions: options,
                inputPlaceholder: 'Choose...',
                showCancelButton: true,
                confirmButtonColor: '#2563eb'
            });

            if (!selection) return;
            
            const targetIds = selection === 'all' ? ids : [selection];
            for (const id of targetIds) {
                await toggleBlueprintLock(id);
            }
        } else {
            for (const id of ids) {
                await toggleBlueprintLock(id);
            }
        }
        await loadData();
        Swal.fire("Success", "Lock status updated.", "success");
    };

    const handleToggleHidden = async (ids: string[]) => {
        for (const id of ids) {
            await toggleBlueprintHidden(id);
        }
        await loadData();
    };

    const handleUpdateSet = async (ids: string[], currentSet: string) => {
        const { value: selectedSet } = await Swal.fire({
            title: 'Update Question Set / தொகுப்பை மாற்றுக',
            text: 'Select the new set for the selected question paper(s):',
            input: 'select',
            inputOptions: {
                'SET A': 'SET A',
                'SET B': 'SET B',
                'SET C': 'SET C',
                'SET D': 'SET D',
                'GENERAL': 'GENERAL SET'
            },
            inputValue: currentSet || 'SET A',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Update Set',
            inputValidator: (value) => {
                if (!value) {
                    return 'You must select a set!';
                }
            }
        });

        if (selectedSet) {
            try {
                Swal.fire({
                    title: 'Updating Set...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                for (const id of ids) {
                    const bp = blueprints.find(b => b.id === id);
                    if (bp) {
                        const updatedBp = { ...bp, setId: selectedSet };
                        await saveBlueprint(updatedBp);
                    }
                }

                await loadData();
                Swal.fire("Success", "Question set updated successfully.", "success");
            } catch (error) {
                console.error("Error updating set:", error);
                Swal.fire("Error", "Failed to update set. Please try again.", "error");
            }
        }
    };

    const handleResetConfirmation = async (ids: string[]) => {
        const group = blueprints.filter(b => ids.includes(b.id));
        let targetIds = ids;

        if (group.length > 1) {
            const options: Record<string, string> = { 'all': 'All Teachers / அனைத்து ஆசிரியர்களும்' };
            group.forEach(b => {
                const name = getUserName(b.ownerId);
                options[b.id] = name;
            });

            const { value: selection } = await Swal.fire({
                title: 'Reset Confirmation Selection',
                text: 'Choose teacher to reset or select All:',
                input: 'select',
                inputOptions: options,
                inputPlaceholder: 'Choose...',
                showCancelButton: true,
                confirmButtonColor: '#f59e0b'
            });

            if (!selection) return;
            targetIds = selection === 'all' ? ids : [selection];
        } else {
            const result = await Swal.fire({
                title: "Reset Confirmation?",
                text: "This will allow the user to edit the pattern again. Continue?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#f59e0b",
                cancelButtonColor: "#64748b",
                confirmButtonText: "Yes, reset it"
            });
            if (!result.isConfirmed) return;
        }

        for (const id of targetIds) {
            await resetBlueprintConfirmation(id);
        }
        await loadData();
        Swal.fire("Reset", "Confirmation has been reset successfully.", "success");
    };

    const handleRemoveShare = async (bpId: string, userId: string) => {
        Swal.fire({
            title: "Remove Sharing?",
            text: "This user will lose access to this paper.",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, remove"
        }).then(async (result) => {
            if (result.isConfirmed) {
                await removeShare(bpId, userId);
                await loadData();
                setLoadingShared(true);
                try {
                    setSharedUsers(await getSharedWithUsers(bpId));
                    Swal.fire("Removed", "User access removed.", "success");
                } finally {
                    setLoadingShared(false);
                }
            }
        });
    };

    const handleAddShare = async (bpId: string, toUserId: string) => {
        const bp = blueprints.find(b => b.id === bpId);
        if (!bp) return;

        const fromUserId = bp.ownerId || '1';

        const success = await shareBlueprint(bpId, fromUserId, toUserId);
        if (success) {
            await loadData();
            setLoadingShared(true);
            try {
                setSharedUsers(await getSharedWithUsers(bpId));
            } finally {
                setLoadingShared(false);
            }
            setUserSearchTerm('');
            Swal.fire("Shared", "Paper shared successfully!", "success");
        } else {
            Swal.fire("Error", "Could not share. User might already have access.", "error");
        }
    };

    const getUserName = (userId?: string) => {
        if (!userId) return 'Unknown';
        const user = users.find(u => u.id === userId);
        return user ? user.name : 'Unknown';
    };

    const filterOptions = Array.from(new Set(blueprints.map(bp => `${bp.examTerm}|${bp.academicYear || getCurrentAcademicYear()}`))).sort();

    const filteredBlueprints = blueprints.filter(bp => {
        if (!selectedFilter) return false;

        const ownerName = getUserName(bp.ownerId).toLowerCase();
        const paperName = bp.questionPaperTypeName.toLowerCase();
        const subject = bp.subject.toLowerCase();
        const search = searchTerm.toLowerCase();

        const matchesSearch = ownerName.includes(search) ||
            paperName.includes(search) ||
            subject.includes(search) ||
            bp.classLevel.toString().includes(search) ||
            (bp.setId || '').toLowerCase().includes(search);

        const currentBpFilter = `${bp.examTerm}|${bp.academicYear || getCurrentAcademicYear()}`;
        const matchesFilter = selectedFilter === 'all' || currentBpFilter === selectedFilter;

        return matchesSearch && matchesFilter;
    });

    const groupedBlueprints = React.useMemo(() => {
        const groups: Record<string, Blueprint[]> = {};

        filteredBlueprints.forEach(bp => {
            // Group by core paper configuration
            const key = `${bp.classLevel}|${bp.subject}|${bp.questionPaperTypeId}|${bp.examTerm}|${bp.academicYear || getCurrentAcademicYear()}|${bp.setId || 'SET A'}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(bp);
        });

        return Object.values(groups).sort((a, b) => {
            const firstA = a[0];
            const firstB = b[0];

            // 1. Sort by Class Level
            const classA = firstA.classLevel === 'SSLC' ? 11 : parseInt(firstA.classLevel as string) || 0;
            const classB = firstB.classLevel === 'SSLC' ? 11 : parseInt(firstB.classLevel as string) || 0;
            if (classA !== classB) return classA - classB;

            // 2. Sort by Subject (AT before BT)
            const getSubjectType = (s: string) => s.includes('BT') ? 1 : 0;
            const typeA = getSubjectType(firstA.subject);
            const typeB = getSubjectType(firstB.subject);
            if (typeA !== typeB) return typeA - typeB;
            
            if (firstA.subject !== firstB.subject) return firstA.subject.localeCompare(firstB.subject);

            // 3. Sort by Set
            const setA = (firstA.setId || '').toUpperCase();
            const setB = (firstB.setId || '').toUpperCase();
            return setA.localeCompare(setB);
        });
    }, [filteredBlueprints]);

    const totalPages = Math.max(1, Math.ceil(groupedBlueprints.length / pageSize));

    const paginatedGroupedBlueprints = React.useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return groupedBlueprints.slice(startIndex, startIndex + pageSize);
    }, [groupedBlueprints, currentPage, pageSize]);

    const activeShareBp = blueprints.find(b => b.id === selectedShareBp);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">User Question Papers</h2>
                    <p className="text-sm font-medium text-gray-500 mt-1 italic">Manage and monitor question papers created by all users</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-gray-50">
                    <div className="w-full sm:w-auto min-w-[240px]">
                        <select
                            value={selectedFilter}
                            onChange={(e) => setSelectedFilter(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-50 bg-gray-50/50 text-sm font-bold text-gray-700 transition-all cursor-pointer"
                        >
                            <option value="">Select Exam</option>
                            <option value="all">All Exams & Years</option>
                            {filterOptions.map(opt => {
                                const [term, year] = opt.split('|');
                                return (
                                    <option key={opt} value={opt}>
                                        {term} ({year})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search papers, users or sets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-50 bg-gray-50/50 text-sm font-medium transition-all"
                        />
                    </div>

                    {user.role === 'WEBMASTER' && (
                        <>
                            <button
                                onClick={handleBulkExamExportClick}
                                className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                title="Bulk Print / Export selected Exam PDFs as ZIP"
                            >
                                <Download size={16} />
                                <span>Bulk Print</span>
                            </button>

                            <button
                                onClick={handleBulkExamExportMergeClick}
                                className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                title="Bulk Print / Merge selected Exam PDFs into a Single PDF"
                            >
                                <FileText size={16} />
                                <span>Bulk Print Merge</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile & Tablet Card View - optimized for smaller screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4">
                {loading ? (
                    <CardSkeleton count={4} />
                ) : paginatedGroupedBlueprints.length > 0 ? (
                    paginatedGroupedBlueprints.map((group) => {
                        const bp = group[0];
                        const ids = group.map(b => b.id);
                        const allConfirmed = group.every(b => b.isConfirmed);
                        const anyConfirmed = group.some(b => b.isConfirmed);
                        const anyLocked = group.some(b => b.isLocked);
                        const anyHidden = group.some(b => b.isHidden);

                        return (
                            <div key={bp.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-4 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                            <FileText size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col">
                                                <span className="font-black text-blue-700 text-sm truncate uppercase tracking-tight">Class {bp.classLevel}</span>
                                                <div className="font-black text-gray-900 text-xs mt-1 uppercase line-clamp-2">{bp.subject}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <button
                                            onClick={() => handleUpdateSet(ids, bp.setId || 'SET A')}
                                            className="px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-600 text-[9px] font-black uppercase border border-purple-100 flex items-center gap-1 transition-all group/set cursor-pointer"
                                            title="Click to update Set / தொகுப்பை மாற்றுக"
                                        >
                                            {(() => {
                                                const s = bp.setId || 'A';
                                                if (s.startsWith('SET')) return s;
                                                if (s === 'GENERAL') return 'GENERAL SET';
                                                return `SET ${s}`;
                                            })()}
                                            <Edit2 size={9} className="opacity-40 group-hover/set:opacity-100 transition-opacity" />
                                        </button>
                                        <button
                                            onClick={() => setSelectedShareBp(bp.id)}
                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold transition-colors ${bp.sharedWith?.length ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}
                                        >
                                            <Share2 size={9} /> {bp.sharedWith?.length || 0}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{bp.questionPaperTypeName}</div>
                                    <div className="text-[10px] font-medium text-gray-500 truncate">{bp.examTerm} | {bp.academicYear}</div>
                                </div>

                                <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                                    <div className="flex flex-col gap-1 w-full overflow-hidden">
                                        {group.map(b => {
                                            const user = users.find(u => u.id === b.ownerId);
                                            // Never show admin users as teachers
                                            if (!user || user.role === 'ADMIN') return null;
                                            return (
                                                <div key={b.id} className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-[8px]">
                                                        <UserIcon size={10} />
                                                    </div>
                                                    <div className="text-[10px] font-bold text-gray-800 truncate">{user.name}</div>
                                                </div>
                                            );
                                        })}
                                        <div className="text-[9px] text-gray-400 flex items-center gap-1 mt-1">
                                            <Calendar size={8} /> {new Date(bp.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 items-end shrink-0">
                                        {allConfirmed ? (
                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-green-100 text-green-700 uppercase tracking-tighter">Confirmed</span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-amber-100 text-amber-700 uppercase tracking-tighter">Draft</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-gray-50/40 rounded-xl p-1 border border-gray-100/50">
                                    {user.role === 'WEBMASTER' && <button onClick={() => handleBulkPrint(bp)} className="flex-1 flex justify-center p-2 text-rose-600 hover:bg-white rounded-lg transition-all" title="Bulk Print / Save Consolidated PDF"><FileText size={16} /></button>}
                                    <button onClick={() => onEditBlueprint(bp)} className="flex-1 flex justify-center p-2 text-blue-600 hover:bg-white rounded-lg transition-all" title="Edit"><Edit2 size={16} /></button>
                                    <button onClick={() => handleToggleLock(ids)} className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${anyLocked ? 'text-amber-600' : 'text-gray-400'}`} title="Lock/Unlock">{anyLocked ? <Lock size={16} /> : <Unlock size={16} />}</button>
                                    <button onClick={() => handleToggleHidden(ids)} className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${anyHidden ? 'text-gray-400' : 'text-blue-600'}`} title="Show/Hide">{anyHidden ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                    {anyConfirmed && <button onClick={() => handleResetConfirmation(ids)} className="flex-1 flex justify-center p-2 text-orange-500 hover:bg-white rounded-lg transition-all" title="Reset Confirmation"><RotateCcw size={16} /></button>}
                                    <button onClick={() => handleDelete(ids)} className="flex-1 flex justify-center p-2 text-red-500 hover:text-red-700 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full bg-white rounded-2xl border-2 border-dashed border-gray-100 p-12 text-center text-gray-400">
                        <FileText size={48} className="mx-auto opacity-20 mb-3" />
                        <p className="font-bold uppercase tracking-widest text-xs">No question papers found</p>
                    </div>
                )}
            </div>

            {/* Mobile Pagination Controls */}
            {!loading && groupedBlueprints.length > 0 && (
                <div className="lg:hidden bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center gap-4">
                    {/* Page Size & Info */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-between">
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
                                {[5, 10, 15, 20, 25].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                        <span className="text-xs font-bold text-gray-500">
                            Showing {groupedBlueprints.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                            {Math.min(currentPage * pageSize, groupedBlueprints.length)} of {groupedBlueprints.length} entries
                        </span>
                    </div>

                    {/* Page Navigation */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1.5 w-full justify-center">
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
            )}


            {/* Desktop View - Table Style (Shown on large screens) */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto scrollbar-hide">
                    {loading ? (
                        <div className="p-6">
                            <TableRowSkeleton columns={6} rows={10} />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse table-fixed min-w-[1100px]">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest w-[21%]">Paper Details</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest w-[9%] text-center">Question Set</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest w-[15%]">Assigned Teachers</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest w-[9%]">Sharing</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest w-[16%] text-center">Status</th>
                                    <th className="px-3 py-4 text-xs font-black text-gray-400 uppercase tracking-widest w-[30%] text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {paginatedGroupedBlueprints.length > 0 ? (
                                    paginatedGroupedBlueprints.map((group) => {
                                        const bp = group[0];
                                        const ids = group.map(b => b.id);
                                        const allConfirmed = group.every(b => b.isConfirmed);
                                        const anyConfirmed = group.some(b => b.isConfirmed);
                                        const anyLocked = group.some(b => b.isLocked);
                                        const anyHidden = group.some(b => b.isHidden);

                                        return (
                                            <tr key={bp.id} className="hover:bg-blue-50/20 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-start gap-3">
                                                        <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 mt-0.5 group-hover:scale-110 transition-transform">
                                                            <FileText size={20} />
                                                        </div>
                                                        <div className="flex flex-col gap-1 overflow-hidden">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-blue-700 text-sm uppercase tracking-tight">Class {bp.classLevel}</span>
                                                            </div>
                                                            <div className="font-black text-gray-900 text-xs uppercase truncate" title={bp.subject}>{bp.subject}</div>
                                                            <div className="flex flex-col gap-1 mt-0.5">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{bp.questionPaperTypeName}</div>
                                                                <div className="text-[9px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 w-fit">
                                                                    {bp.examTerm} | {bp.academicYear}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <button 
                                                        onClick={() => handleUpdateSet(ids, bp.setId || 'SET A')}
                                                        className="px-3 py-1.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-600 text-[10px] font-black uppercase border border-purple-100 inline-flex items-center justify-center gap-1.5 transition-all group/set cursor-pointer hover:shadow-sm"
                                                        title="Click to update Set / தொகுப்பை மாற்றுக"
                                                    >
                                                        {(() => {
                                                            const s = bp.setId || 'A';
                                                            if (s.startsWith('SET')) return s;
                                                            if (s === 'GENERAL') return 'GENERAL SET';
                                                            return `SET ${s}`;
                                                        })()}
                                                        <Edit2 size={11} className="opacity-40 group-hover/set:opacity-100 transition-opacity" />
                                                    </button>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                                        {(() => {
                                                            const teacherBlueprints = group.filter(b => {
                                                                const u = users.find(user => user.id === b.ownerId);
                                                                // Only show non-admin users as teachers
                                                                return u && u.role !== 'ADMIN';
                                                            });
                                                            
                                                            if (teacherBlueprints.length === 0) {
                                                                return <span className="text-[10px] text-gray-400 italic font-medium">No Teacher Assigned</span>;
                                                            }

                                                            return teacherBlueprints.map(b => {
                                                                const user = users.find(u => u.id === b.ownerId);
                                                                return (
                                                                    <div key={b.id} className="flex items-center gap-2">
                                                                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                                                                            <UserIcon size={12} />
                                                                        </div>
                                                                        <div className="overflow-hidden">
                                                                            <div className="text-xs font-bold text-gray-800 truncate">{user?.name || <span className="italic text-gray-400">Unknown</span>}</div>
                                                                            <div className="text-[8px] text-gray-400 flex items-center gap-1">
                                                                                <Calendar size={8} /> {new Date(b.createdAt).toLocaleDateString()}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <button
                                                        onClick={() => setSelectedShareBp(bp.id)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${bp.sharedWith?.length ? 'bg-blue-100 text-blue-800 hover:shadow-md hover:shadow-blue-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                                    >
                                                        <Share2 size={12} />
                                                        {bp.sharedWith?.length ? `${bp.sharedWith.length} Users` : 'Not Shared'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {group.map(b => {
                                                            const user = users.find(u => u.id === b.ownerId);
                                                            // Never show admin users in the status column
                                                            if (!user || user.role === 'ADMIN') return null;
                                                            const displayName = user.name;
                                                            return (
                                                                <div key={b.id} className="w-full flex flex-col gap-1 mb-2 last:mb-0 border-b border-gray-50 pb-2 last:border-0">
                                                                    {b.isConfirmed ? (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black bg-green-100 text-green-700 gap-1 uppercase w-full justify-center tracking-tighter">
                                                                            <CheckCircle size={10} /> {displayName}: Confirmed
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black bg-amber-100 text-amber-700 gap-1 uppercase w-full justify-center tracking-tighter">
                                                                            <Clock size={10} /> {displayName}: Draft
                                                                        </span>
                                                                    )}
                                                                    <div className="flex gap-1 w-full">
                                                                        {b.isLocked ? (
                                                                            <span className="flex-1 inline-flex items-center py-0.5 rounded-md text-[8px] font-black bg-gray-800 text-white gap-1 uppercase justify-center"><Lock size={8} /> Locked</span>
                                                                        ) : (
                                                                            <span className="flex-1 inline-flex items-center py-0.5 rounded-md text-[8px] font-black bg-blue-50 text-blue-600 gap-1 uppercase justify-center"><Unlock size={8} /> Unlocked</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-5">
                                                    <div className="flex items-center justify-center gap-1.5 min-w-[240px]">
                                                        {user.role === 'WEBMASTER' && <button onClick={() => handleBulkPrint(bp)} className="w-9 h-9 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0" title="Bulk Print / Save Consolidated PDF"><FileText size={18} /></button>}
                                                        <button onClick={() => onEditBlueprint(bp)} className="w-9 h-9 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0" title="View/Edit"><Edit2 size={18} /></button>
                                                        <button onClick={() => handleToggleLock(ids)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0 ${anyLocked ? 'text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:bg-gray-100'}`} title="Lock/Unlock">{anyLocked ? <Lock size={18} /> : <Unlock size={18} />}</button>
                                                        <button onClick={() => handleToggleHidden(ids)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0 ${anyHidden ? 'text-gray-400 hover:bg-gray-100' : 'text-blue-600 hover:bg-blue-50'}`} title="Show/Hide">{anyHidden ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                                        <button onClick={() => handleResetConfirmation(ids)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0 ${anyConfirmed ? 'text-orange-600 hover:bg-orange-50' : 'text-gray-300 opacity-40 pointer-events-none'}`} title="Reset Confirmation"><RotateCcw size={18} /></button>
                                                        <button onClick={() => handleDelete(ids)} className="w-9 h-9 flex items-center justify-center text-red-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors shrink-0" title="Delete"><Trash2 size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                                            <FileText size={48} className="mx-auto opacity-10 mb-2" />
                                            <p className="font-black uppercase tracking-widest text-xs italic">No matching papers</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Desktop Pagination Controls */}
                {!loading && groupedBlueprints.length > 0 && (
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
                                    {[5, 10, 15, 20, 25].map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>
                            <span className="text-xs font-bold text-gray-500">
                                Showing {groupedBlueprints.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                                {Math.min(currentPage * pageSize, groupedBlueprints.length)} of {groupedBlueprints.length} entries
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
                )}
            </div>


            {/* Sharing Details Modal */}
            {selectedShareBp && activeShareBp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Sharing Management</h3>
                                <p className="text-xs text-gray-500">Managing for: {activeShareBp.questionPaperTypeName}</p>
                            </div>
                            <button
                                onClick={() => setSelectedShareBp(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Current Shared Users */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <Share2 size={16} /> Currently Shared With / தற்போது பகிரப்பட்டது
                                </h4>
                                <div className="space-y-3">
                                    {loadingShared ? (
                                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                                            <Loader2 size={24} className="text-blue-600 animate-spin mb-2" />
                                            <p className="text-xs text-gray-500">Loading shared users...</p>
                                        </div>
                                    ) : sharedUsers.length > 0 ? (
                                        sharedUsers.map(user => (
                                            <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                                                        {user.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <div className="text-xs font-bold text-gray-900 truncate">{user.name || user.username}</div>
                                                        <div className="text-[10px] text-gray-500 truncate">@{user.username}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveShare(selectedShareBp, user.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remove Access"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            <Share2 size={32} className="mx-auto text-gray-200 mb-2" />
                                            <p className="text-xs text-gray-500 italic">Not shared with anyone</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Share with New Users */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <UserPlus size={16} /> Share With New Users / புதிய பயனருடன் பகிர
                                </h4>
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        value={userSearchTerm}
                                        onChange={(e) => setUserSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {users
                                        .filter(u =>
                                            u.id !== activeShareBp.ownerId &&
                                            !activeShareBp.sharedWith?.includes(u.id) &&
                                            (u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                                u.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
                                        )
                                        .map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => handleAddShare(selectedShareBp, user.id)}
                                                className="w-full flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50/20 transition-all text-left group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm group-hover:bg-blue-100 group-hover:text-blue-700">
                                                        {user.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-gray-800">{user.name}</div>
                                                        <div className="text-[10px] text-gray-500">{user.username}</div>
                                                    </div>
                                                </div>
                                                <Plus size={16} className="text-gray-400 group-hover:text-blue-600" />
                                            </button>
                                        ))
                                    }
                                    {userSearchTerm && users.filter(u =>
                                        u.id !== activeShareBp.ownerId &&
                                        !activeShareBp.sharedWith?.includes(u.id) &&
                                        (u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                            u.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
                                    ).length === 0 && (
                                            <p className="text-xs text-center text-gray-400 py-4 italic">No matching users found</p>
                                        )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 text-right flex-shrink-0">
                            <button
                                onClick={() => setSelectedShareBp(null)}
                                className="px-6 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminQuestionPaperManager;
