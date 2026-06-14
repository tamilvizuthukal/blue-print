import React, { useState, useEffect } from 'react';
import {
    Users, FileText, FileType, Settings, CheckCircle, Clock,
    Activity, Shield, Zap, LayoutGrid, Globe, ArrowUpRight
} from 'lucide-react';
import {
    getUsers, getBlueprints, getQuestionPaperTypes, getExamConfigs, getHealth, getLiveUsers
} from '../services/db';
import { Blueprint, User } from '../types';

interface AdminDashboardProps {
    onEditBlueprint?: (bp: Blueprint) => void;
}

import { TableRowSkeleton } from './LoadingSkeleton';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onEditBlueprint }) => {
    const [stats, setStats] = useState({
        users: 0,
        blueprints: 0,
        paperTypes: 0,
        configs: 0
    });
    const [health, setHealth] = useState({ status: 'connecting', database: 'initializing' });
    const [recentBlueprints, setRecentBlueprints] = useState<Blueprint[]>([]);
    const [allBlueprints, setAllBlueprints] = useState<Blueprint[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [liveUsers, setLiveUsers] = useState<User[]>([]);
    const [selectedFilter, setSelectedFilter] = useState<string>('all');
    const [showLiveUsersModal, setShowLiveUsersModal] = useState(false);
    const [loading, setLoading] = useState(true);

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

                const uniqueBlueprintKeys = new Set(blueprintsData.map(bp =>
                    `${bp.classLevel}|${bp.subject}|${bp.questionPaperTypeId}|${bp.examTerm}|${bp.academicYear || '2025-26'}|${bp.setId || 'SET A'}`
                ));

                setStats({
                    users: userData.length,
                    blueprints: uniqueBlueprintKeys.size,
                    paperTypes: paperTypesData.length,
                    configs: configsData.length
                });
                setHealth(healthData);
                setUsers(userData);
                setAllBlueprints(blueprintsData);

                if (blueprintsData.length > 0) {
                    const sorted = [...blueprintsData].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    const latest = sorted[0];
                    setSelectedFilter(`${latest.examTerm}|${latest.academicYear || '2025-26'}`);
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
            const year = bp.academicYear || '2025-26';
            options.add(`${bp.examTerm}|${year}`);
        });
        return Array.from(options).sort();
    }, [allBlueprints]);

    useEffect(() => {
        let filtered = [...allBlueprints];
        if (selectedFilter && selectedFilter !== 'all') {
            const [term, year] = selectedFilter.split('|');
            filtered = filtered.filter(bp => bp.examTerm === term && (bp.academicYear || '2025-26') === year);
        }

        const groups: Record<string, Blueprint[]> = {};
        filtered.forEach(bp => {
            const key = `${bp.classLevel}|${bp.subject}|${bp.questionPaperTypeId}|${bp.examTerm}|${bp.academicYear || '2025-26'}|${bp.setId || 'SET A'}`;
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

        setRecentBlueprints(sorted.slice(0, 10)); // Show more items in the stream
    }, [selectedFilter, allBlueprints]);

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
                        className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-100 rounded-2xl transition-all shadow-sm border border-gray-100"
                    >
                        <Settings size={18} className="text-gray-400" />
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

            {/* Stat Grid: 2 per row on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <StatCard
                    title="Active Pulse"
                    count={liveUsers.length}
                    subtext={`${stats.users} total`}
                    icon={Users}
                    gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                    glowColor="#3b82f6"
                    onClick={() => setShowLiveUsersModal(true)}
                    delay={0}
                />
                <StatCard
                    title="Data Units"
                    count={stats.blueprints}
                    icon={FileText}
                    gradient="linear-gradient(135deg, #10b981 0%, #047857 100%)"
                    glowColor="#10b981"
                    delay={100}
                />
                <StatCard
                    title="Templates"
                    count={stats.paperTypes}
                    icon={FileType}
                    gradient="linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
                    glowColor="#8b5cf6"
                    delay={200}
                />
                <StatCard
                    title="Config Nodes"
                    count={stats.configs}
                    icon={Settings}
                    gradient="linear-gradient(135deg, #f59e0b 0%, #b45309 100%)"
                    glowColor="#f59e0b"
                    delay={300}
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

                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-50 bg-gray-50/20">
                                        <th className="p-5 sm:p-6 font-black uppercase text-[8px] tracking-[0.2em]">Assigned Teachers</th>
                                        <th className="p-5 sm:p-6 font-black uppercase text-[8px] tracking-[0.2em]">Subject / Archetype</th>
                                        <th className="p-5 sm:p-6 font-black uppercase text-[8px] tracking-[0.2em]">Config</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={3} className="p-6">
                                                <TableRowSkeleton columns={3} rows={5} />
                                            </td>
                                        </tr>
                                    ) : recentBlueprints.length === 0 ? (
                                        <tr><td colSpan={3} className="p-16 text-center text-gray-300 font-black uppercase tracking-widest text-[9px]">Idle Signal</td></tr>
                                    ) : (
                                        recentBlueprints.map((bp, i) => {
                                            const allOwners = (bp as any).allOwners || [bp.ownerId];
                                            // Filter out admin users as per user requirement
                                            const assignedTeachers = users.filter(u => allOwners.includes(u.id) && u.role !== 'ADMIN');

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
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-black text-gray-800">{bp.subject}</span>
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 rounded-md">Class {bp.classLevel}</span>
                                                            </div>
                                                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                                                                {bp.examTerm} • {bp.academicYear || '2025-26'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 sm:p-6">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-3 py-1 rounded-lg bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest shadow-md">
                                                                    {bp.questionPaperTypeName}
                                                                </span>
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
                                                            </div>
                                                            <span className="text-[8px] text-gray-400 font-black uppercase tracking-[0.2em] px-1">
                                                                Status: Active Unit
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
