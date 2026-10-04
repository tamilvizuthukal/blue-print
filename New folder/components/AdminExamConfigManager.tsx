import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    Trash2, Plus, Save, Settings2, Target, Percent, CheckCircle
} from 'lucide-react';
import {
    ClassLevel, SubjectType, ExamTerm, ExamConfiguration, Curriculum, UnitWeightage
} from '../types';
import {
    getExamConfigs, saveExamConfigs, getCurriculum, getDB
} from '../services/db';

import { LoadingSkeleton } from './LoadingSkeleton';

const AdminExamConfigManager = () => {
    const [configs, setConfigs] = useState<ExamConfiguration[]>([]);
    const [selectedClass, setSelectedClass] = useState<ClassLevel>(ClassLevel._10);
    const [selectedSubject, setSelectedSubject] = useState<SubjectType>(SubjectType.TAMIL_AT);
    const [selectedTerm, setSelectedTerm] = useState<ExamTerm>(ExamTerm.FIRST);
    const [currentConfig, setCurrentConfig] = useState<ExamConfiguration | null>(null);
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await getExamConfigs();
                setConfigs(data);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        const load = async () => {
            const cur = await getCurriculum(selectedClass, selectedSubject);
            setCurriculum(cur || null);
        };
        load();
    }, [selectedClass, selectedSubject]);

    useEffect(() => {
        const found = configs.find(c => c.classLevel === selectedClass && c.subject === selectedSubject && c.term === selectedTerm);
        if (found) {
            setCurrentConfig({ ...found });
        } else {
            setCurrentConfig({
                id: `temp-${Date.now()}`,
                classLevel: selectedClass,
                subject: selectedSubject,
                term: selectedTerm,
                weightages: []
            });
        }
    }, [selectedClass, selectedSubject, selectedTerm, configs]);

    const handleSave = async () => {
        if (!currentConfig) return;
        const totalPercent = currentConfig.weightages.reduce((sum, w) => sum + w.percentage, 0);
        if (totalPercent !== 100) {
            Swal.fire("Validation Error", "Total weightage must be exactly 100%", "warning");
            return;
        }

        const existingIdx = configs.findIndex(c => c.classLevel === currentConfig.classLevel && c.subject === currentConfig.subject && c.term === currentConfig.term);
        let newConfigs = [...configs];
        if (existingIdx >= 0) {
            newConfigs[existingIdx] = currentConfig;
        } else {
            newConfigs.push({ ...currentConfig, id: Math.random().toString(36).substr(2, 9) });
        }
        setConfigs(newConfigs);
        await saveExamConfigs(newConfigs);
        Swal.fire("Saved", "Configuration Saved!", "success");
    };

    const addWeightage = () => {
        if (!currentConfig) return;
        setCurrentConfig({ ...currentConfig, weightages: [...currentConfig.weightages, { unitNumber: currentConfig.weightages.length + 1, percentage: 0 }] });
    };

    const updateWeightage = (idx: number, field: keyof UnitWeightage, val: number) => {
        if (!currentConfig) return;
        const newW = [...currentConfig.weightages];
        newW[idx] = { ...newW[idx], [field]: val };
        setCurrentConfig({ ...currentConfig, weightages: newW });
    };

    const removeWeightage = (idx: number) => {
        if (!currentConfig) return;
        const newW = currentConfig.weightages.filter((_, i) => i !== idx);
        setCurrentConfig({ ...currentConfig, weightages: newW });
    };

    const totalPercent = currentConfig?.weightages.reduce((sum, w) => sum + w.percentage, 0) || 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="border-b border-gray-100 pb-4">
                <h2 className="text-3xl font-bold text-gray-900 font-display tracking-tight">Exam Weightage</h2>
                <p className="text-gray-500 mt-1 font-medium italic">Define how marks are distributed across units for each term.</p>
            </div>

            {/* Selection Controls - Combined into Single Row */}
            <div className="ap-card p-5 group hover:border-blue-300 transition-all duration-300 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-2 group-hover:text-blue-500 transition-colors">Class Level</label>
                    <select 
                        value={selectedClass} 
                        onChange={(e) => setSelectedClass(parseInt(e.target.value, 10) as ClassLevel)} 
                        className="w-full border-none bg-gray-50/50 rounded-xl p-2.5 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer font-['Times_New_Roman']"
                    >
                        {Object.values(ClassLevel).filter(v => typeof v === 'number').map(v => <option key={v} value={v}>Class {v}</option>)}
                    </select>
                </div>
                
                <div className="w-px h-10 bg-gray-100 hidden md:block self-center"></div>
                
                <div className="flex-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-2 group-hover:text-blue-500 transition-colors">Subject Area</label>
                    <select 
                        value={selectedSubject} 
                        onChange={(e) => setSelectedSubject(e.target.value as SubjectType)} 
                        className="w-full border-none bg-gray-50/50 rounded-xl p-2.5 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer font-['TAU-Paalai']"
                    >
                        {Object.values(SubjectType).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>

                <div className="w-px h-10 bg-gray-100 hidden md:block self-center"></div>

                <div className="flex-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-2 group-hover:text-blue-500 transition-colors">Exam Term</label>
                    <select 
                        value={selectedTerm} 
                        onChange={(e) => setSelectedTerm(e.target.value as ExamTerm)} 
                        className="w-full border-none bg-gray-50/50 rounded-xl p-2.5 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    >
                        {Object.values(ExamTerm).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
            </div>

            {/* Main Configuration Card */}
            <div className="ap-card overflow-hidden">
                {loading ? (
                    <div className="p-8">
                        <LoadingSkeleton count={4} height="80px" />
                    </div>
                ) : (
                    <>
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                                    <Settings2 size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 font-display">Unit Weightage Allocation</h3>
                                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Distribution Logic</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={`px-4 py-2 rounded-xl font-black text-sm border flex items-center gap-2 transition-all ${totalPercent === 100 ? 'bg-green-50 text-green-600 border-green-100 shadow-sm' : 'bg-red-50 text-red-500 border-red-100'} font-['Times_New_Roman']`}>
                                    <Percent size={14} />
                                    Total: {totalPercent}%
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            <div className="space-y-4">
                                {currentConfig?.weightages.length === 0 ? (
                                    <div className="text-center py-16 bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center gap-4 group">
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-gray-300 group-hover:scale-110 group-hover:text-blue-400 transition-all shadow-sm">
                                            <Plus size={32} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-500">No unit rules defined</p>
                                            <p className="text-xs text-gray-400 mt-1">Start by adding a unit weightage rule below.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {currentConfig?.weightages.map((w, idx) => {
                                            const unitInfo = curriculum?.units.find(u => u.unitNumber === w.unitNumber);
                                            return (
                                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-6 p-5 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50/50 transition-all group">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex flex-col items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Unit</span>
                                                            <input
                                                                type="number"
                                                                value={isNaN(w.unitNumber) ? '' : w.unitNumber}
                                                                onChange={(e) => updateWeightage(idx, 'unitNumber', parseInt(e.target.value) || 0)}
                                                                className="bg-transparent w-full text-center outline-none font-bold text-lg font-['Times_New_Roman'] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>

                                                        <div className="flex-1">
                                                            <p className="font-bold text-gray-800 text-lg font-['TAU-Paalai']">{unitInfo?.name || `Custom Unit ${w.unitNumber}`}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Target size={12} className="text-blue-500" />
                                                                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Weightage Target</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="relative group/input">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                className="bg-gray-50 border border-gray-100 rounded-xl p-4 w-28 text-center font-black text-xl text-gray-800 focus:bg-white focus:border-blue-500 focus:shadow-xl focus:shadow-blue-50 outline-none transition-all font-['Times_New_Roman'] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                value={isNaN(w.percentage) ? '' : w.percentage}
                                                                onChange={(e) => updateWeightage(idx, 'percentage', parseInt(e.target.value) || 0)}
                                                            />
                                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300 text-sm group-focus-within/input:text-blue-500">%</span>
                                                        </div>
                                                        <button
                                                            onClick={() => removeWeightage(idx)}
                                                            className="w-12 h-12 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Remove Rule"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <button
                                    onClick={addWeightage}
                                    className="w-full py-5 border-2 border-dashed border-gray-200 rounded-2xl font-bold text-gray-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-3 mt-4 group"
                                >
                                    <div className="p-1.5 rounded-lg bg-gray-100 group-hover:bg-blue-100 transition-colors">
                                        <Plus size={18} />
                                    </div>
                                    Add Unit Weightage Rule
                                </button>
                            </div>

                            <div className="mt-12 flex flex-col items-center">
                                <button
                                    onClick={handleSave}
                                    className="w-full max-w-lg bg-blue-600 text-white font-bold text-lg py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale disabled:pointer-events-none"
                                    disabled={totalPercent !== 100}
                                >
                                    <Save size={24} />
                                    Save Configuration
                                </button>
                                
                                {totalPercent !== 100 && (
                                    <div className="mt-6 flex flex-col items-center gap-1.5 animate-pulse">
                                        <p className="text-red-500 text-xs font-black uppercase tracking-[0.2em]">Validation Error</p>
                                        <p className="text-gray-400 text-[11px] font-medium italic">
                                            Total allocation must be exactly 100% to proceed.
                                        </p>
                                    </div>
                                )}
                                
                                {totalPercent === 100 && (
                                    <div className="mt-6 flex items-center gap-2 text-green-600">
                                        <CheckCircle size={14} />
                                        <p className="text-[11px] font-bold uppercase tracking-widest">Ready to Save</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminExamConfigManager;
