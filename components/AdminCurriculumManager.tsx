
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    Trash2, Plus, X
} from 'lucide-react';
import {
    ClassLevel, SubjectType, Curriculum, Unit
} from '../types';
import {
    getCurriculum, saveCurriculum, getDB
} from '../services/db';

import { LoadingSkeleton } from './LoadingSkeleton';

const AdminCurriculumManager = () => {
    const [selectedClass, setSelectedClass] = useState<ClassLevel>(ClassLevel._10);
    const [selectedSubject, setSelectedSubject] = useState<SubjectType>(SubjectType.TAMIL_AT);
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await getCurriculum(selectedClass, selectedSubject);
                setCurriculum(data || { 
                    id: `curr_${Date.now()}`, 
                    name: `${selectedSubject} - ${selectedClass}`, 
                    classLevel: selectedClass, 
                    subject: selectedSubject, 
                    units: [] 
                });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [selectedClass, selectedSubject]);


    const saveCurr = async (curr: Curriculum) => {
        setCurriculum(curr);
        await saveCurriculum(curr);
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
        saveCurr({ ...curriculum, units: [...curriculum.units, newUnit] });
    };

    const updateUnit = (id: string, field: keyof Unit, val: any) => {
        if (!curriculum) return;
        saveCurr({ ...curriculum, units: curriculum.units.map(u => u.id === id ? { ...u, [field]: val } : u) });
    };

    const addSubUnit = (unitId: string) => {
        if (!curriculum) return;
        saveCurr({
            ...curriculum, units: curriculum.units.map(u => u.id === unitId ? {
                ...u, subUnits: [...u.subUnits, { id: Math.random().toString(36).substr(2, 9), name: 'New SubUnit' }]
            } : u)
        });
    };

    const updateSubUnit = (unitId: string, sId: string, val: string) => {
        if (!curriculum) return;
        saveCurr({
            ...curriculum, units: curriculum.units.map(u => u.id === unitId ? {
                ...u, subUnits: u.subUnits.map(s => s.id === sId ? { ...s, name: val } : s)
            } : u)
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-0">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 font-display tracking-tight">Curriculum & Units</h2>
                    <p className="text-gray-500 mt-1 font-medium italic">Manage syllabus structure and learning outcomes.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-100/50 p-1 rounded-xl border border-gray-100">
                        <select 
                            value={selectedClass} 
                            onChange={(e) => setSelectedClass(parseInt(e.target.value, 10) as ClassLevel)} 
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 px-3 cursor-pointer"
                        >
                            {Object.values(ClassLevel).filter(v => typeof v === 'number').map(v => <option key={v} value={v}>Class {v}</option>)}
                        </select>
                        <div className="w-px h-4 bg-gray-200"></div>
                        <select 
                            value={selectedSubject} 
                            onChange={(e) => setSelectedSubject(e.target.value as SubjectType)} 
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 px-3 cursor-pointer"
                        >
                            {Object.values(SubjectType).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <LoadingSkeleton count={3} height="250px" />
                ) : curriculum?.units.map((unit, idx) => (
                    <div key={unit.id} className="ap-card group hover:border-blue-200 transition-all duration-300">
                        <div className="p-5">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                <div className="flex items-center gap-3 flex-1">
                                    <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-lg shadow-blue-100">Unit {unit.unitNumber}</span>
                                    <input
                                        className="font-bold text-xl text-gray-900 bg-transparent border-b-2 border-transparent focus:border-blue-500 outline-none flex-1 transition-all"
                                        style={{ fontFamily: "'TAU-Urai', 'Times New Roman', serif" }}
                                        value={unit.name}
                                        onChange={(e) => updateUnit(unit.id, 'name', e.target.value)}
                                        placeholder="Enter Unit Name"
                                    />
                                </div>
                                <button onClick={() => {
                                    Swal.fire({
                                        title: "Delete Unit?",
                                        text: "All sub-units will be removed as well.",
                                        icon: "warning",
                                        showCancelButton: true,
                                        confirmButtonColor: "#d33",
                                        confirmButtonText: "Yes, delete"
                                    }).then(result => {
                                        if (result.isConfirmed && curriculum) {
                                            saveCurr({ ...curriculum, units: curriculum.units.filter(u => u.id !== unit.id) });
                                        }
                                    });
                                }} className="self-end md:self-center p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete Unit">
                                    <Trash2 size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Learning Outcomes Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Learning Outcomes</label>
                                    </div>
                                    <textarea
                                        className="w-full text-base border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none resize-none min-h-[120px] transition-all font-medium text-gray-700 leading-relaxed tamil-font"
                                        value={unit.learningOutcomes || ''}
                                        onChange={(e) => updateUnit(unit.id, 'learningOutcomes', e.target.value)}
                                        placeholder="What should students learn in this unit?"
                                    />
                                </div>

                                {/* Sub-units Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Chapters / Sub-units</label>
                                    </div>
                                    <div className="space-y-3 bg-gray-50/30 p-4 rounded-2xl border border-gray-50/50">
                                        {unit.subUnits.map((sub, sIdx) => (
                                            <div key={sub.id} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group/item">
                                                <span className="text-[10px] font-bold text-gray-300 w-5">{(sIdx + 1).toString().padStart(2, '0')}</span>
                                                <input
                                                    className="text-base font-semibold text-gray-700 bg-transparent outline-none w-full tamil-font"
                                                    value={sub.name}
                                                    onChange={(e) => updateSubUnit(unit.id, sub.id, e.target.value)}
                                                    placeholder="Chapter Name"
                                                />
                                                <button onClick={() => {
                                                    Swal.fire({
                                                        title: "Delete Sub-unit?",
                                                        icon: "warning",
                                                        showCancelButton: true,
                                                        confirmButtonColor: "#d33",
                                                        confirmButtonText: "Delete"
                                                    }).then(result => {
                                                        if (result.isConfirmed && curriculum) {
                                                            saveCurr({ ...curriculum, units: curriculum.units.map(u => u.id === unit.id ? { ...u, subUnits: u.subUnits.filter(s => s.id !== sub.id) } : u) });
                                                        }
                                                    });
                                                }} className="text-gray-200 hover:text-red-400 transition-colors">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        <button 
                                            onClick={() => addSubUnit(unit.id)} 
                                            className="w-full py-3 bg-white border-2 border-dashed border-gray-100 rounded-xl text-xs font-bold text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus size={16} /> Add Sub-unit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                <button 
                    onClick={handleAddUnit} 
                    className="w-full py-8 border-3 border-dashed border-gray-200 text-gray-400 rounded-[24px] hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all duration-300 flex flex-col justify-center items-center gap-3"
                >
                    <div className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-blue-500">
                        <Plus size={28} />
                    </div>
                    <span className="font-bold font-display text-lg tracking-tight">Add New Curriculum Unit</span>
                </button>
            </div>
        </div>
    );
};

export default AdminCurriculumManager;
