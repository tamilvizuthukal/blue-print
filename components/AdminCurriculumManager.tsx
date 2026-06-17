
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    Trash2, Plus, X, BookOpen, Layers, Search, ChevronRight, Edit3, Save, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
    ClassLevel, SubjectType, Curriculum, Unit, SubUnit
} from '../types';
import {
    getCurriculum, saveCurriculum
} from '../services/db';

import { LoadingSkeleton } from './LoadingSkeleton';

const AdminCurriculumManager = () => {
    const [selectedClass, setSelectedClass] = useState<ClassLevel>(ClassLevel._10);
    const [selectedSubject, setSelectedSubject] = useState<SubjectType>(SubjectType.TAMIL_AT);
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await getCurriculum(selectedClass, selectedSubject);
                const curr = data || { 
                    id: `curr_${Date.now()}`, 
                    name: `${selectedSubject} - ${selectedClass}`, 
                    classLevel: selectedClass, 
                    subject: selectedSubject, 
                    units: [] 
                };
                setCurriculum(curr);
                if (curr.units.length > 0) {
                    setActiveUnitId(curr.units[0].id);
                } else {
                    setActiveUnitId(null);
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [selectedClass, selectedSubject]);

    const activeUnit = curriculum?.units.find(u => u.id === activeUnitId);

    const saveCurr = async (curr: Curriculum) => {
        setCurriculum(curr);
        setIsSaving(true);
        try {
            await saveCurriculum(curr);
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    const handleAddUnit = () => {
        if (!curriculum) return;
        const newUnit: Unit = {
            id: Math.random().toString(36).substr(2, 9),
            unitNumber: curriculum.units.length + 1,
            name: 'New Unit',
            subUnits: [],
            learningOutcomes: ''
        };
        const updated = { ...curriculum, units: [...curriculum.units, newUnit] };
        saveCurr(updated);
        setActiveUnitId(newUnit.id);
    };

    const updateUnit = (id: string, field: keyof Unit, val: any) => {
        if (!curriculum) return;
        saveCurr({ ...curriculum, units: curriculum.units.map(u => u.id === id ? { ...u, [field]: val } : u) });
    };

    const addSubUnit = (unitId: string) => {
        if (!curriculum) return;
        saveCurr({
            ...curriculum, units: curriculum.units.map(u => u.id === unitId ? {
                ...u, subUnits: [...u.subUnits, { id: Math.random().toString(36).substr(2, 9), name: '', learningOutcomes: '' }]
            } : u)
        });
    };

    const updateSubUnit = (unitId: string, sId: string, field: keyof SubUnit, val: string) => {
        if (!curriculum) return;
        saveCurr({
            ...curriculum, units: curriculum.units.map(u => u.id === unitId ? {
                ...u, subUnits: u.subUnits.map(s => s.id === sId ? { ...s, [field]: val } : s)
            } : u)
        });
    };

    const deleteUnit = (id: string) => {
        Swal.fire({
            title: "Delete Unit?",
            text: "This will remove all associated subunits and data.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            confirmButtonText: "Yes, delete it"
        }).then(result => {
            if (result.isConfirmed && curriculum) {
                const updatedUnits = curriculum.units.filter(u => u.id !== id);
                saveCurr({ ...curriculum, units: updatedUnits });
                if (activeUnitId === id) {
                    setActiveUnitId(updatedUnits[0]?.id || null);
                }
            }
        });
    };

    const filteredUnits = curriculum?.units.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.unitNumber.toString().includes(searchTerm)
    ) || [];

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        Curriculum Designer
                        {isSaving && <span className="flex items-center gap-1.5 text-xs font-bold text-blue-500 animate-pulse bg-blue-50 px-2 py-1 rounded-full"><Save size={12}/> Saving...</span>}
                    </h2>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Structure & Learning Outcomes</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl">
                        <select 
                            value={selectedClass} 
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedClass(isNaN(parseInt(val)) ? val as ClassLevel : parseInt(val) as ClassLevel);
                            }} 
                            className="bg-transparent border-none focus:ring-0 text-xs font-black text-gray-700 cursor-pointer uppercase tracking-wider"
                        >
                            {Object.values(ClassLevel)
                                .filter(v => typeof v === 'number' && v !== ClassLevel._SSLC)
                                .map(v => <option key={v} value={v}>{`Class ${v}`}</option>)
                            }
                        </select>
                    </div>
                    <div className="w-px h-6 bg-gray-100"></div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl">
                        <select 
                            value={selectedSubject} 
                            onChange={(e) => setSelectedSubject(e.target.value as SubjectType)} 
                            className="bg-transparent border-none focus:ring-0 text-xs font-black text-gray-700 cursor-pointer uppercase tracking-wider"
                        >
                            {Object.values(SubjectType).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                {/* Sidebar: Unit List */}
                <div className="w-80 flex flex-col bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-50 space-y-4">
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Search units..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-50 border-none rounded-2xl py-3 pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 transition-all"
                            />
                        </div>
                        <button 
                            onClick={handleAddUnit}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <Plus size={16} /> Add New Unit
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                        {loading ? (
                            <LoadingSkeleton count={5} height="60px" />
                        ) : filteredUnits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <AlertCircle size={32} className="text-gray-200 mb-2" />
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No units found</p>
                            </div>
                        ) : (
                            filteredUnits.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => setActiveUnitId(u.id)}
                                    className={`
                                        w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all duration-300 group
                                        ${activeUnitId === u.id 
                                            ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100' 
                                            : 'hover:bg-gray-50 text-gray-500 hover:text-gray-900'}
                                    `}
                                >
                                    <span className={`
                                        flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm
                                        ${activeUnitId === u.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-100 text-gray-400 group-hover:bg-white'}
                                    `}>
                                        {u.unitNumber}
                                    </span>
                                    <div className="flex-1 text-left overflow-hidden">
                                        <p className={`text-sm font-bold truncate ${activeUnitId === u.id ? 'text-blue-900' : ''} tamil-font`}>
                                            {u.name || 'Untitled Unit'}
                                        </p>
                                        <p className="text-[10px] font-black uppercase tracking-tighter opacity-50 mt-0.5">
                                            {u.subUnits.length} Chapters
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className={`transition-transform duration-300 ${activeUnitId === u.id ? 'translate-x-1 opacity-100' : 'opacity-0'}`} />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    {activeUnit ? (
                        <div className="flex flex-col h-full">
                            {/* Content Header */}
                            <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl">
                                        {activeUnit.unitNumber}
                                    </div>
                                    <div className="flex-1">
                                        <input 
                                            type="text"
                                            value={activeUnit.name}
                                            onChange={(e) => updateUnit(activeUnit.id, 'name', e.target.value)}
                                            className="w-full text-2xl font-black text-gray-900 bg-transparent border-none focus:ring-0 p-0 tamil-font"
                                            placeholder="Enter Unit Name..."
                                        />
                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mt-1">Editing Curriculum Unit</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => deleteUnit(activeUnit.id)}
                                        className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                        title="Delete Unit"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                <div className="max-w-5xl space-y-6">
                                    {/* Learning Outcomes */}
                                    <section className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <BookOpen size={12} /> Unit Learning Outcomes
                                            </h3>
                                        </div>
                                        <div className="relative group">
                                            <textarea
                                                className="w-full text-base border-2 border-gray-50 rounded-[1.5rem] p-5 bg-gray-50/30 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none resize-none min-h-[120px] transition-all font-medium text-gray-700 leading-relaxed tamil-font"
                                                value={activeUnit.learningOutcomes || ''}
                                                onChange={(e) => updateUnit(activeUnit.id, 'learningOutcomes', e.target.value)}
                                                placeholder="What should students achieve by the end of this unit?"
                                            />
                                            <Edit3 size={14} className="absolute right-5 top-5 text-gray-200 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                    </section>

                                    {/* Chapters / Subunits */}
                                    <section className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
                                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Layers size={12} /> Chapters & Detailed LOs
                                                </h3>
                                            </div>
                                            <button 
                                                onClick={() => addSubUnit(activeUnit.id)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                            >
                                                <Plus size={12} /> Add Chapter
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            {activeUnit.subUnits.map((sub, sIdx) => (
                                                <div key={sub.id} className="bg-white rounded-[1.5rem] border-2 border-gray-50 p-4 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-500/5 transition-all group/item flex flex-col gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-black text-[10px]">
                                                            {(sIdx + 1).toString().padStart(2, '0')}
                                                        </span>
                                                        <input 
                                                            type="text"
                                                            value={sub.name}
                                                            onChange={(e) => updateSubUnit(activeUnit.id, sub.id, 'name', e.target.value)}
                                                            className="flex-1 text-base font-bold text-gray-900 bg-transparent border-none focus:ring-0 p-0 tamil-font"
                                                            placeholder="Chapter Title..."
                                                        />
                                                        <button 
                                                            onClick={() => {
                                                                if (curriculum) {
                                                                    const updated = {
                                                                        ...curriculum,
                                                                        units: curriculum.units.map(u => u.id === activeUnit.id ? {
                                                                            ...u, subUnits: u.subUnits.filter(s => s.id !== sub.id)
                                                                        } : u)
                                                                    };
                                                                    saveCurr(updated);
                                                                }
                                                            }}
                                                            className="p-1.5 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                    <textarea 
                                                        value={sub.learningOutcomes || ''}
                                                        onChange={(e) => updateSubUnit(activeUnit.id, sub.id, 'learningOutcomes', e.target.value)}
                                                        className="w-full text-xs text-gray-500 bg-gray-50/50 rounded-xl p-3 border-none focus:ring-2 focus:ring-purple-100 transition-all tamil-font resize-none min-h-[60px]"
                                                        placeholder="Learning outcomes specific to this chapter..."
                                                    />
                                                </div>
                                            ))}
                                            
                                            {activeUnit.subUnits.length === 0 && (
                                                <div 
                                                    onClick={() => addSubUnit(activeUnit.id)}
                                                    className="py-10 border-2 border-dashed border-gray-100 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 hover:border-purple-200 transition-all group"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-300 group-hover:text-purple-500 transition-colors">
                                                        <Plus size={16} />
                                                    </div>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No chapters yet. Click to add.</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-200 mb-6">
                                <BookOpen size={40} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2">Select a Unit</h3>
                            <p className="text-gray-400 max-w-xs text-xs font-bold uppercase tracking-widest leading-relaxed">Choose a unit to start designing</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e2e8f0; }
                
                .tamil-font {
                    font-family: 'TAU-Paalai', 'Noto Serif Tamil', serif;
                    line-height: 1.5;
                }
            `}</style>
        </div>
    );
};

export default AdminCurriculumManager;

