
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    Trash2, Plus, X, Edit, Save, FileText, Clock, Layers, HelpCircle, Sparkles, Award
} from 'lucide-react';
import {
    QuestionPaperType, QuestionPatternSection
} from '../types';
import {
    getQuestionPaperTypes, saveQuestionPaperTypes
} from '../services/db';

import { TableRowSkeleton, CardSkeleton } from './LoadingSkeleton';

const AdminPaperTypeManager = () => {
    const [types, setTypes] = useState<QuestionPaperType[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<QuestionPaperType>>({
        name: '',
        description: '',
        sections: []
    });
    const defaultSection: QuestionPatternSection = { id: '', marks: 1, count: 1, optionCount: 0, timePerQuestion: 0, instruction: '', massViewHeader: '' };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await getQuestionPaperTypes();
                const sortedData = [...data].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                setTypes(sortedData);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        if (!formData.name) return Swal.fire("Required", "Name is required.", "warning");
        if (!formData.sections || formData.sections.length === 0) return Swal.fire("Required", "At least one section is required.", "warning");

        const totalMarks = (formData.sections || []).reduce((sum, s) => sum + (s.marks * s.count), 0);
        const finalData: QuestionPaperType = {
            id: editingId || Math.random().toString(36).substr(2, 9),
            name: formData.name,
            totalMarks: totalMarks,
            description: formData.description || '',
            sections: formData.sections || []
        };

        const newTypes = editingId
            ? types.map(t => t.id === editingId ? finalData : t)
            : [...types, finalData];

        const sortedTypes = [...newTypes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        try {
            await saveQuestionPaperTypes(sortedTypes);
            setTypes(sortedTypes);
            setEditingId(null);
            setFormData({ name: '', description: '', sections: [] });
            setIsFormOpen(false);
            Swal.fire("Saved", "Paper pattern saved successfully!", "success");
        } catch (err) {
            Swal.fire("Error", "Failed to save paper pattern.", "error");
        }
    };

    const handleDeleteType = async (id: string) => {
        Swal.fire({
            title: "Are you sure?",
            text: "This will remove this paper type permanently!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete it!"
        }).then(async (result) => {
            if (result.isConfirmed) {
                const newTypes = types.filter(t => t.id !== id);
                const sortedTypes = [...newTypes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                setTypes(sortedTypes);
                await saveQuestionPaperTypes(sortedTypes);
                Swal.fire("Deleted", "Paper pattern has been removed.", "success");
            }
        });
    };


    const handleAddNew = () => {
        setEditingId(null);
        setFormData({ name: '', description: '', sections: [] });
        setIsFormOpen(true);
    };

    const handleEdit = (t: QuestionPaperType) => {
        setEditingId(t.id);
        setFormData(t);
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => {
        setEditingId(null);
        setFormData({ name: '', description: '', sections: [] });
        setIsFormOpen(false);
    };

    const addSection = () => setFormData({ ...formData, sections: [...(formData.sections || []), { ...defaultSection, id: Math.random().toString(36).substr(2, 9) }] });
    const removeSection = (idx: number) => { const s = [...(formData.sections || [])]; s.splice(idx, 1); setFormData({ ...formData, sections: s }); };
    const updateSection = (idx: number, field: keyof QuestionPatternSection, val: string | number) => { const s = [...(formData.sections || [])]; s[idx] = { ...s[idx], [field]: val } as any; setFormData({ ...formData, sections: s }); };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-0">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 font-display tracking-tight">Paper Types</h2>
                    <p className="text-gray-500 mt-1 font-medium italic">Define exam patterns and marks distribution.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {!isFormOpen && (
                        <button
                            onClick={handleAddNew}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-purple-100 transition-all text-sm flex items-center gap-2 active:scale-95"
                        >
                            <Plus size={18} /> New Pattern
                        </button>
                    )}
                </div>
            </div>

            {isFormOpen ? (
                <div className="ap-card border-purple-100 p-0 overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-6 bg-gradient-to-r from-purple-50/50 to-white border-b border-purple-50 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-purple-700 font-display flex items-center gap-2">
                            {editingId ? <Edit size={20} /> : <Plus size={20} />}
                            {editingId ? 'Edit Paper Type' : 'Configure New Pattern'}
                        </h3>
                        {editingId && <span className="text-[10px] font-black bg-purple-100 text-purple-600 px-2 py-1 rounded-lg uppercase tracking-widest">ID: {editingId}</span>}
                    </div>

                    <div className="p-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Pattern Name</label>
                                <input
                                    placeholder="e.g. Revision Exam / Monthly Test"
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-purple-50 focus:border-purple-200 outline-none transition-all font-bold text-gray-700"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Brief Description</label>
                                <input
                                    placeholder="What is this exam pattern for?"
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-purple-50 focus:border-purple-200 outline-none transition-all font-medium text-gray-600"
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50/50 p-6 rounded-[24px] border border-gray-100">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-5 bg-purple-600 rounded-full"></div>
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Sections Configuration</label>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 bg-purple-100/60 px-3.5 py-1.5 rounded-full border border-purple-200 shadow-sm">
                                        <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider">Total Marks:</span>
                                        <span className="text-sm font-black text-purple-800">{(formData.sections || []).reduce((sum, s) => sum + (s.marks * s.count), 0)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-emerald-100/60 px-3.5 py-1.5 rounded-full border border-emerald-200 shadow-sm">
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Estimated Time:</span>
                                        <span className="text-sm font-black text-emerald-800">{(formData.sections || []).reduce((sum, s) => sum + ((s.timePerQuestion || 0) * s.count), 0)} mins</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {(formData.sections || []).map((s, idx) => (
                                    <div key={idx} className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 relative">
                                        
                                        {/* Section Header */}
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-5">
                                            <div className="flex items-center gap-2.5">
                                                <span className="bg-indigo-900 text-indigo-100 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm">
                                                    Section {idx + 1}
                                                </span>
                                                <span className="text-xs text-gray-400 font-medium">Configure rules and metrics for this section</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeSection(idx)}
                                                className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
                                                title="Remove Section"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Color-Coded 6-column Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                                
                                                {/* Q. Count (Blue) */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-wider block">Questions (Count)</label>
                                                    <input 
                                                        type="number" 
                                                        className="w-full border border-blue-100 bg-blue-50/20 hover:bg-blue-50/40 rounded-xl p-3 text-center text-sm font-bold text-blue-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all font-mono outline-none" 
                                                        value={isNaN(s.count) ? '' : s.count} 
                                                        onChange={e => updateSection(idx, 'count', parseInt(e.target.value) || 0)} 
                                                    />
                                                </div>
                                                
                                                {/* Marks/Q (Purple) */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-purple-500 uppercase tracking-wider block">Marks per Q</label>
                                                    <input 
                                                        type="number" 
                                                        className="w-full border border-purple-100 bg-purple-50/20 hover:bg-purple-50/40 rounded-xl p-3 text-center text-sm font-bold text-purple-900 focus:ring-4 focus:ring-purple-100 focus:border-purple-300 transition-all font-mono outline-none" 
                                                        value={isNaN(s.marks) ? '' : s.marks} 
                                                        onChange={e => updateSection(idx, 'marks', parseInt(e.target.value) || 0)} 
                                                    />
                                                </div>
                                                
                                                {/* Options (Amber) */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-wider block">Choices/Options</label>
                                                    <input 
                                                        type="number" 
                                                        className="w-full border border-amber-100 bg-amber-50/20 hover:bg-amber-50/40 rounded-xl p-3 text-center text-sm font-bold text-amber-900 focus:ring-4 focus:ring-amber-100 focus:border-amber-300 transition-all font-mono outline-none" 
                                                        value={isNaN(s.optionCount) ? '' : s.optionCount} 
                                                        onChange={e => updateSection(idx, 'optionCount', parseInt(e.target.value) || 0)} 
                                                    />
                                                </div>

                                                {/* Time per Q (Emerald) */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-wider block">Time per Q (min)</label>
                                                    <input 
                                                        type="number" 
                                                        className="w-full border border-emerald-100 bg-emerald-50/20 hover:bg-emerald-50/40 rounded-xl p-3 text-center text-sm font-bold text-emerald-900 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-300 transition-all font-mono outline-none" 
                                                        value={isNaN(s.timePerQuestion) ? '' : s.timePerQuestion} 
                                                        onChange={e => updateSection(idx, 'timePerQuestion', parseInt(e.target.value) || 0)} 
                                                    />
                                                </div>

                                                {/* Section Total Marks (Rose Badge) */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">Section Marks</label>
                                                    <div className="w-full border border-rose-100 bg-rose-50/50 rounded-xl p-3 text-center text-sm font-black text-rose-700 select-none font-mono">
                                                        {((s.count || 0) * (s.marks || 0))} M
                                                    </div>
                                                </div>

                                                {/* Section Total Time (Teal Badge) */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-teal-500 uppercase tracking-wider block">Section Time</label>
                                                    <div className="w-full border border-teal-100 bg-teal-50/50 rounded-xl p-3 text-center text-sm font-black text-teal-700 select-none font-mono">
                                                        {((s.count || 0) * (s.timePerQuestion || 0))} mins
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Section Instruction */}
                                            <div className="space-y-1.5 mt-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-bold block">Section Instruction</label>
                                                <textarea
                                                    placeholder="Enter instructions or notes for this section (e.g. Answer all questions)"
                                                    className="w-full border border-gray-200 bg-gray-50/30 hover:bg-gray-50/50 rounded-xl p-3 text-sm font-medium text-gray-700 focus:ring-4 focus:ring-purple-100 focus:border-purple-300 focus:bg-white outline-none transition-all min-h-[72px]"
                                                    value={s.instruction || ''}
                                                    onChange={e => updateSection(idx, 'instruction', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addSection}
                                className="w-full mt-6 py-4 border-2 border-dashed border-purple-100 hover:border-purple-300 bg-purple-50/20 hover:bg-purple-50/40 rounded-2xl text-sm font-bold text-purple-600/70 hover:text-purple-700 transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer"
                            >
                                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-purple-400 group-hover:text-purple-600 shadow-sm transition-colors duration-300">
                                    <Plus size={16} />
                                </div>
                                Add New Section
                            </button>
                        </div>

                        <div className="flex justify-end items-center gap-4 pt-4">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-6 py-3 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer active:scale-95"
                            >
                                Cancel Changes
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-10 py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:shadow-indigo-200 hover:shadow-2xl transition-all duration-300 text-sm flex items-center gap-2 active:scale-95 cursor-pointer"
                            >
                                <Save size={18} /> {editingId ? 'Update Pattern' : 'Create Pattern'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : loading ? (
                <CardSkeleton count={6} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {types.map(t => {
                        const totalQns = t.sections.reduce((sum, s) => sum + s.count, 0);
                        const totalTime = t.sections.reduce((sum, s) => sum + ((s.timePerQuestion || 0) * s.count), 0);
                        return (
                            <div key={t.id} className="relative overflow-hidden bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-purple-500/15 transition-all duration-500 flex flex-col h-full group hover:-translate-y-1">
                                {/* Animated top gradient bar */}
                                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out"></div>

                                <div className="p-8 flex-1">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-black text-slate-800 tracking-tight group-hover:text-purple-600 transition-colors uppercase leading-tight">{t.name}</h3>
                                            <p className="text-sm font-medium text-slate-400 italic line-clamp-2">{t.description || 'General exam pattern definition'}</p>
                                        </div>
                                    </div>

                                    {/* Summary Row */}
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        <div className="bg-purple-50/50 rounded-2xl p-3 border border-purple-100/40 text-center hover:bg-purple-50 transition-colors duration-300">
                                            <div className="text-[9px] font-black text-purple-400 uppercase tracking-wider mb-0.5">Total Marks</div>
                                            <div className="text-lg font-black text-purple-700 font-mono">{t.totalMarks}</div>
                                        </div>
                                        <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100/40 text-center hover:bg-blue-50 transition-colors duration-300">
                                            <div className="text-[9px] font-black text-blue-400 uppercase tracking-wider mb-0.5">Questions</div>
                                            <div className="text-lg font-black text-blue-700 font-mono">{totalQns}</div>
                                        </div>
                                        <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100/40 text-center hover:bg-emerald-50 transition-colors duration-300">
                                            <div className="text-[9px] font-black text-emerald-400 uppercase tracking-wider mb-0.5">Total Time</div>
                                            <div className="text-lg font-black text-emerald-700 font-mono">90 Mins</div>
                                        </div>
                                    </div>

                                    {/* Compact list of sections listed one-by-one stacked vertically */}
                                    <div className="space-y-3">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="h-px bg-slate-100 flex-1"></span>
                                            Questions & Marks Structure
                                            <span className="h-px bg-slate-100 flex-1"></span>
                                        </div>
                                        
                                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                            {t.sections.map((s, idx) => {
                                                const sectionTotalMarks = s.count * s.marks;
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className="flex items-center justify-between bg-slate-50/70 hover:bg-white hover:border-purple-200 border border-slate-100/80 px-3 py-1.5 rounded-xl transition-all duration-300 shadow-sm hover:scale-[1.02] active:scale-95 group/sec-chip"
                                                    >
                                                        {/* Section Number indicator */}
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-lg bg-indigo-900 text-indigo-100 flex items-center justify-center font-black text-[9px] shadow-sm select-none">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Section {idx + 1}</span>
                                                        </div>
                                                        {/* Color-coded inline details: 4Q x 1M = 4M with alignment */}
                                                        <div className="flex items-center text-xs font-mono font-bold text-slate-700 select-none">
                                                            <span className="inline-block w-[32px] text-right text-blue-600 font-black">{s.count}Q</span>
                                                            <span className="text-slate-300 mx-1 font-sans w-[12px] text-center">×</span>
                                                            <span className="inline-block w-[32px] text-center text-purple-600 font-black">{s.marks}M</span>
                                                            <span className="text-slate-300 mx-1 font-sans w-[12px] text-center">=</span>
                                                            <span className="inline-block w-[42px] text-right text-rose-500 font-black">{sectionTotalMarks}M</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center rounded-b-[2rem]">
                                    <button
                                        type="button"
                                        onClick={() => handleEdit(t)}
                                        className="bg-white px-6 py-2.5 rounded-xl shadow-sm border border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-200 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                                    >
                                        <Edit size={14} /> Edit Pattern
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteType(t.id)}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-300 hover:text-red-500 hover:border-red-100 transition-all hover:scale-[1.05] active:scale-[0.95] shadow-sm cursor-pointer"
                                        title="Delete Type"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {types.length === 0 && (
                        <div className="col-span-full py-24 text-center ap-card bg-gray-50/50 border-dashed border-2 flex flex-col items-center gap-4">
                            <div className="w-20 h-20 rounded-full bg-white shadow-inner flex items-center justify-center text-gray-200">
                                <FileText size={40} strokeWidth={1} />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-gray-400 font-display">No Patterns Defined</p>
                                <p className="text-sm text-gray-400 mt-1 italic">Start by creating your first exam configuration.</p>
                            </div>
                            <button onClick={handleAddNew} className="mt-2 text-purple-600 font-black text-xs uppercase tracking-widest hover:underline hover:scale-105 transition-all">Create Pattern Now</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminPaperTypeManager;
