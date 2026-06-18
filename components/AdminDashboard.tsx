import React, { useState, useEffect } from 'react';
import {
    Users, FileText, FileType, Settings, CheckCircle, Clock,
    Activity, Shield, Zap, LayoutGrid, Globe, ArrowUpRight, X,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import {
    getUsers, getBlueprints, getQuestionPaperTypes,
    getExamConfigs, getHealth, getLiveUsers, getCurrentAcademicYear
} from '../services/db';
import { Blueprint, User } from '../types';

interface AdminDashboardProps {
    onEditBlueprint?: (bp: Blueprint) => void;
}

import { TableRowSkeleton } from './LoadingSkeleton';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onEditBlueprint }) => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        assignedTeachers: 0,
        pendingSets: 0,
        totalSets: 0,
        completedSets: 0
    });
    const [health, setHealth] = useState({ status: 'connecting', database: 'initializing' });
    const [recentBlueprints, setRecentBlueprints] = useState<Blueprint[]>([]);
    const [allBlueprints, setAllBlueprints] = useState<Blueprint[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [liveUsers, setLiveUsers] = useState<User[]>([]);
    const [selectedFilter, setSelectedFilter] = useState<string>('all');
    const [showLiveUsersModal, setShowLiveUsersModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'completed' | 'pending'>('pending');
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        const loadLiveUsers = async () => {
            try {
                const data = await getLiveUsers();
                setLiveUsers(data);
            } catch (err) {
                console.error("Failed to load live users:", err);
            }
        };

        loadLiveUsers();
        const interval = setInterval(loadLiveUsers, 15000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const loadStats = async () => {
            setLoading(true);
            try {
                const [userData, blueprintsData, paperTypesData, configsData, healthData] = await Promise.all([
                    getUsers(),
                    getBlueprints('all'),
                    getQuestionPaperTypes(),
                    getExamConfigs(),
                    getHealth()
                ]);

                const groups: Record<string, Blueprint[]> = {};
                blueprintsData.forEach(bp => {
                    const key = `${bp.classLevel}|${bp.subject}|${bp.questionPaperTypeId}|${bp.examTerm}|${bp.academicYear || getCurrentAcademicYear()}|${bp.setId || 'SET A'}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(bp);
                });

                const groupList = Object.values(groups);
                const completedSetsCount = groupList.filter(group => 
                    group.some(bp => bp.isConfirmed && bp.isAnswerKeyConfirmed)
                ).length;
                
                const pendingSetsCount = groupList.length - completedSetsCount;

                // Calculate unique assigned teachers (excluding admins)
                const assignedTeacherIds = new Set(blueprintsData.map(bp => bp.ownerId));
                const assignedTeachersCount = userData.filter(u => 
                    assignedTeacherIds.has(u.id) && u.role !== 'ADMIN'
                ).length;

                setStats({
                    totalUsers: userData.length,
                    assignedTeachers: assignedTeachersCount,
                    pendingSets: pendingSetsCount,
                    totalSets: groupList.length,
                    completedSets: completedSetsCount
                });
                setHealth(healthData);
                setUsers(userData);
                setAllBlueprints(blueprintsData);

                if (blueprintsData.length > 0) {
                    const sorted = [...blueprintsData].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    const latest = sorted[0];
                    setSelectedFilter(`${latest.examTerm}|${latest.academicYear || getCurrentAcademicYear()}`);
                }
            } catch (err) {
                console.error("Failed to load dashboard stats:", err);
                const healthData = await getHealth();
                setHealth(healthData);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, []);

    const filterOptions = React.useMemo(() => {
        const options = new Set<string>();
        allBlueprints.forEach(bp => {
            const year = bp.academicYear || getCurrentAcademicYear();
            options.add(`${bp.examTerm}|${year}`);
        });
        return Array.from(options).sort();
    }, [allBlueprints]);

    const counts = React.useMemo(() => {
        let filtered = [...allBlueprints];
        if (selectedFilter && selectedFilter !== 'all') {
            const [term, year] = selectedFilter.split('|');
            filtered = filtered.filter(bp => bp.examTerm === term && (bp.academicYear || getCurrentAcademicYear()) === year);
        }

        return {
            pending: filtered.filter(bp => !(bp.isConfirmed && bp.isAnswerKeyConfirmed)).length,
            completed: filtered.filter(bp => bp.isConfirmed && bp.isAnswerKeyConfirmed).length
        };
    }, [allBlueprints, selectedFilter]);

    useEffect(() => {
        let filtered = [...allBlueprints];
        if (selectedFilter && selectedFilter !== 'all') {
            const [term, year] = selectedFilter.split('|');
            filtered = filtered.filter(bp => bp.examTerm === term && (bp.academicYear || getCurrentAcademicYear()) === year);
        }

        // Filter based on completion status (Both must be confirmed for Completed list)
        if (activeTab === 'completed') {
            filtered = filtered.filter(bp => bp.isConfirmed === true && bp.isAnswerKeyConfirmed === true);
        } else {
            filtered = filtered.filter(bp => !(bp.isConfirmed === true && bp.isAnswerKeyConfirmed === true));
        }

        const groups: Record<string, Blueprint[]> = {};
        filtered.forEach(bp => {
            const key = `${bp.classLevel}|${bp.subject}|${bp.questionPaperTypeId}|${bp.examTerm}|${bp.academicYear || getCurrentAcademicYear()}|${bp.setId || 'SET A'}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(bp);
        });

        const uniqueList = Object.values(groups).map(group => {
            const sortedGroup = [...group].sort((a, b) =>
                new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
            );
            const representative = { ...sortedGroup[0] };
            (representative as any).allOwners = group.map(b => b.ownerId);
            return representative;
        });

        const sorted = uniqueList.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setRecentBlueprints(sorted); // Store entire list
        setCurrentPage(1); // Reset page on filter or tab change
    }, [selectedFilter, allBlueprints, activeTab]);

    const totalPages = Math.max(1, Math.ceil(recentBlueprints.length / pageSize));

    const paginatedBlueprints = React.useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return recentBlueprints.slice(startIndex, startIndex + pageSize);
    }, [recentBlueprints, currentPage, pageSize]);

    const StatCard = ({ title, count, icon: Icon, gradient, onClick, subtext, delay, glowColor }: any) => (
        <div
            onClick={onClick}
            className={`
                relative group overflow-hidden rounded-3xl p-5 sm:p-6
                transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-both
                ${onClick ? 'cursor-pointer hover:-translate-y-1 active:scale-95' : 'cursor-default'}
            `}
            style={{
                animationDelay: `${delay}ms`,
                background: gradient,
                boxShadow: `0 10px 25px -10px ${glowColor}60`
            }}
        >
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative z-10 flex flex-col justify-between h-full text-white">
                <div className="flex justify-between items-start mb-3">
                    <div className="p-2.5 sm:p-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/20 group-hover:scale-105 transition-transform duration-500">
                        <Icon size={20} className="sm:w-6 sm:h-6" strokeWidth={2.5} />
                    </div>
                    {onClick && <ArrowUpRight size={14} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />}
                </div>

                <div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl sm:text-4xl font-black tracking-tighter">
                            {count}
                        </span>
                        {subtext && (
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wider opacity-80 ml-1">
                                {subtext}
                            </span>
                        )}
                    </div>
                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] mt-1 opacity-80 leading-none">
                        {title}
                    </h3>
                </div>
            </div>

            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                <Icon size={80} strokeWidth={1} />
            </div>
        </div>
    );

    const LiveUsersModal = () => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                <div className="p-6 sm:p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Active Frequency</span>
                        </div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Live Connections</h3>
                    </div>
                    <button
                        onClick={() => setShowLiveUsersModal(false)}
                        className="w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-2xl transition-all shadow-sm border border-red-100 group"
                    >
                        <X size={18} className="text-red-500 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto p-4 sm:p-6 space-y-2 custom-scrollbar">
                    {liveUsers.length === 0 ? (
                        <div className="py-12 text-center text-gray-300 font-black uppercase tracking-[0.3em] text-[10px]">
                            Signal Idle
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {liveUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl border border-gray-50 bg-white hover:border-blue-100 hover:bg-blue-50/20 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm">
                                            {user.name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">{user.name}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                                <span>{user.schoolName || 'Hub'}</span>
                                                <span className="opacity-30">•</span>
                                                <span>{user.pen || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-6 bg-gray-50/50 flex justify-end">
                    <button
                        onClick={() => setShowLiveUsersModal(false)}
                        className="w-full sm:w-auto px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95"
                    >
                        Close Portal
                    </button>
                </div>
            </div>
        </div>
    );

    const isHealthy = health.status === 'ok';

    return (
        <div className="p-1 sm:p-2 space-y-6 sm:space-y-10 animate-in fade-in duration-700">
            {showLiveUsersModal && <LiveUsersModal />}

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-0.5 w-6 bg-blue-600 rounded-full"></div>
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em]">Matrix Control</span>
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight leading-[1.1]">
                        System <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Core</span>
                    </h2>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 p-2 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-100 shadow-sm w-fit">
                    <div className="flex items-center gap-3 bg-gray-50/50 p-2.5 sm:p-3 rounded-2xl border border-gray-100/50">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${isHealthy ? 'bg-green-100 text-green-600 shadow-green-50' : 'bg-red-100 text-red-600 shadow-red-50'} flex items-center justify-center shadow-lg transition-all`}>
                            <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="hidden sm:block">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Integrity</span>
                            <span className={`text-xs font-black tracking-tight ${isHealthy ? 'text-gray-900' : 'text-red-600'}`}>
                                {isHealthy ? 'Optimized' : 'Disrupted'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pr-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-lg shadow-blue-50">
                            <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Latency</span>
                            <span className="text-xs font-black tracking-tight text-gray-900">0.02ms</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stat Grid: 2 per row on mobile, 6 on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                <StatCard
                    title="Total User"
                    count={stats.totalUsers}
                    icon={Users}
                    gradient="linear-gradient(135deg, #64748b 0%, #334155 100%)"
                    glowColor="#64748b"
                    delay={0}
                />
                <StatCard
                    title="Active User"
                    count={liveUsers.length}
                    icon={Activity}
                    gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                    glowColor="#3b82f6"
                    onClick={() => setShowLiveUsersModal(true)}
                    delay={100}
                />
                <StatCard
                    title="Assigned Teachers"
                    count={stats.assignedTeachers}
                    icon={Users}
                    gradient="linear-gradient(135deg, #10b981 0%, #047857 100%)"
                    glowColor="#10b981"
                    delay={200}
                />
                <StatCard
                    title="Total Set"
                    count={stats.totalSets}
                    icon={Settings}
                    gradient="linear-gradient(135deg, #f59e0b 0%, #b45309 100%)"
                    glowColor="#f59e0b"
                    delay={300}
                />
                <StatCard
                    title="Completed Set"
                    count={stats.completedSets}
                    icon={CheckCircle}
                    gradient="linear-gradient(135deg, #ec4899 0%, #be185d 100%)"
                    glowColor="#ec4899"
                    delay={400}
                />
                <StatCard
                    title="Pending"
                    count={stats.pendingSets}
                    icon={Clock}
                    gradient="linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
                    glowColor="#8b5cf6"
                    delay={500}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 sm:gap-10">
                {/* Activity Feed */}
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-gray-200">
                                <LayoutGrid size={18} />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">Deployment Stream</h3>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex p-1 bg-gray-100/50 rounded-2xl w-full sm:w-auto">
                                <button
                                    onClick={() => setActiveTab('pending')}
                                    className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <Clock size={14} />
                                    Task Pending ({counts.pending})
                                </button>
                                <button
                                    onClick={() => setActiveTab('completed')}
                                    className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'completed' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <CheckCircle size={14} />
                                    Task Completed ({counts.completed})
                                </button>
                            </div>
                            <select
                                value={selectedFilter}
                                onChange={(e) => setSelectedFilter(e.target.value)}
                                className="bg-white border border-gray-100 rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none shadow-sm w-full sm:w-auto"
                            >
                                <option value="all">Global Matrix</option>
                                {filterOptions.map(opt => {
                                    const [term, year] = opt.split('|');
                                    return (
                                        <option key={opt} value={opt}>{term} {year}</option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-50 bg-gray-50/20">
                                        <th className="p-5 sm:p-6 font-black uppercase text-[8px] tracking-[0.2em]">Teacher Name & PEN</th>
                                        <th className="p-5 sm:p-6 font-black uppercase text-[8px] tracking-[0.2em]">8-AT & SET & Type</th>
                                        <th className="p-5 sm:p-6 font-black uppercase text-[8px] tracking-[0.2em] text-center">Blue Print Confirm</th>
                                        <th className="p-5 sm:p-6 font-black uppercase text-[8px] tracking-[0.2em] text-center">Question Confirm</th>
                                        <th className="p-5 sm:p-6 font-black uppercase text-[8px] tracking-[0.2em] text-center">Answer Key Confirm</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="p-6">
                                                <TableRowSkeleton columns={5} rows={5} />
                                            </td>
                                        </tr>
                                    ) : paginatedBlueprints.length === 0 ? (
                                        <tr><td colSpan={5} className="p-16 text-center text-gray-300 font-black uppercase tracking-widest text-[9px]">Idle Signal</td></tr>
                                    ) : (
                                        paginatedBlueprints.map((bp, i) => {
                                            const allOwners = (bp as any).allOwners || [bp.ownerId];
                                            // Filter out admin users as per user requirement
                                            const assignedTeachers = users.filter(u => allOwners.includes(u.id) && u.role !== 'ADMIN');

                                            // Helper functions for confirmation statuses
                                            const isTextEmpty = (html?: string) => {
                                                if (!html) return true;
                                                if (html.includes('<img')) return false;
                                                const clean = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                                                return clean === '';
                                            };

                                            const getQuestionStatus = () => {
                                                if (bp.isQuestionConfirmed) return 'Confirmed';
                                                const hasStarted = bp.items.some(item => 
                                                    (item.questionText && !isTextEmpty(item.questionText)) ||
                                                    (item.questionTextB && !isTextEmpty(item.questionTextB))
                                                );
                                                return hasStarted ? 'Pending' : 'Not Yet Started';
                                            };

                                            const getAnswerKeyStatus = () => {
                                                if (bp.isAnswerKeyConfirmed) return 'Confirmed';
                                                const hasStarted = bp.items.some(item => 
                                                    (item.answerText && !isTextEmpty(item.answerText)) ||
                                                    (item.answerTextB && !isTextEmpty(item.answerTextB)) ||
                                                    item.discourseId || 
                                                    item.discourseIdB || 
                                                    (item.structuredAnswers && item.structuredAnswers.length > 0) ||
                                                    (item.structuredAnswersB && item.structuredAnswersB.length > 0) ||
                                                    (item.furtherInfo && item.furtherInfo.trim() !== '') ||
                                                    (item.furtherInfoB && item.furtherInfoB.trim() !== '')
                                                );
                                                return hasStarted ? 'Pending' : 'Not Yet Started';
                                            };

                                            const getSubjectCode = (subj: string) => {
                                                if (subj === 'Tamil AT') return 'AT';
                                                if (subj === 'Tamil BT') return 'BT';
                                                return subj;
                                            };

                                            const renderStatusBadge = (status: 'Confirmed' | 'Pending' | 'Not Yet Started') => {
                                                switch (status) {
                                                    case 'Confirmed':
                                                        return (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-green-100 text-green-700 border border-green-200">
                                                                Confirmed
                                                            </span>
                                                        );
                                                    case 'Pending':
                                                        return (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-orange-100 text-orange-700 border border-orange-200">
                                                                Pending
                                                            </span>
                                                        );
                                                    case 'Not Yet Started':
                                                        return (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-gray-100 text-gray-500 border border-gray-200">
                                                                Not Yet Started
                                                            </span>
                                                        );
                                                }
                                            };

                                            return (
                                                <tr key={bp.id} className="hover:bg-blue-50/10 transition-colors group">
                                                    <td className="p-5 sm:p-6">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                                                <Users size={16} />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                {assignedTeachers.length > 0 ? (
                                                                    assignedTeachers.map((teacher, idx) => (
                                                                        <div key={teacher.id} className="flex flex-col">
                                                                            <span className="text-sm font-black text-gray-900 leading-none">
                                                                                {teacher.name}
                                                                            </span>
                                                                            <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                                                                PEN: {teacher.pen || 'N/A'}
                                                                            </span>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-xs font-bold text-gray-400 italic">No Teacher Assigned</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 sm:p-6">
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="text-sm font-black text-gray-800">
                                                                {bp.classLevel === 'SSLC' ? 'SSLC' : bp.classLevel}-{getSubjectCode(bp.subject)}
                                                            </span>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {bp.setId && (
                                                                    <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 font-black text-[9px] uppercase">
                                                                        {(() => {
                                                                            const s = bp.setId;
                                                                            if (s.startsWith('SET')) return s;
                                                                            if (s === 'GENERAL') return 'GENERAL SET';
                                                                            return `SET ${s}`;
                                                                        })()}
                                                                    </span>
                                                                )}
                                                                <span className="px-3 py-1 rounded-lg bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest shadow-md">
                                                                    {bp.questionPaperTypeName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 sm:p-6 text-center">
                                                        {renderStatusBadge(bp.isConfirmed ? 'Confirmed' : 'Pending')}
                                                    </td>
                                                    <td className="p-5 sm:p-6 text-center">
                                                        {renderStatusBadge(getQuestionStatus())}
                                                    </td>
                                                    <td className="p-5 sm:p-6 text-center">
                                                        {renderStatusBadge(getAnswerKeyStatus())}
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
                                        {[5, 10, 15, 20, 25].map(size => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                </div>
                                <span className="text-xs font-bold text-gray-500">
                                    Showing {recentBlueprints.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                                    {Math.min(currentPage * pageSize, recentBlueprints.length)} of {recentBlueprints.length} entries
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
            </div>
        </div>
    );
};

export default AdminDashboard;
