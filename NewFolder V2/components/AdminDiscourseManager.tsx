import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Discourse, SubjectType, CognitiveProcess, DiscourseScores } from '@/types';
import { getDiscourses, saveDiscourses } from '@/services/db';
import { Plus, Trash2, Edit2, X, Search, FileText, Printer, Download } from 'lucide-react';

import { TableRowSkeleton, CardSkeleton } from './LoadingSkeleton';

const AdminDiscourseManager: React.FC = () => {
    const [discourses, setDiscourses] = useState<Discourse[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDiscourse, setEditingDiscourse] = useState<Discourse | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSubject, setFilterSubject] = useState<string>(SubjectType.TAMIL_AT);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfSubjectFilter, setPdfSubjectFilter] = useState<'ALL' | SubjectType>('ALL');

    const formatMarkString = (m: number) => {
        const s = m.toString();
        if (s.endsWith('.5')) {
            const whole = s.split('.')[0];
            return whole === '0' ? '½' : `${whole}½`;
        }
        return s;
    };



    const [formData, setFormData] = useState<Partial<Discourse>>({
        name: '',
        subject: SubjectType.TAMIL_AT,
        marks: 5,
        rubrics: [],
        cognitiveProcess: CognitiveProcess.CP1,
        aiPrompt: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getDiscourses();
            setDiscourses(data);
        } catch (error) {
            console.error('Error loading discourses:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name) return Swal.fire("Required", "Discourse name is required", "warning");

        try {
            const all = await getDiscourses();
            if (editingDiscourse) {
                await saveDiscourses(all.map(d => d.id === editingDiscourse.id ? { ...formData, id: d.id } as Discourse : d));
            } else {
                const newDiscourse = {
                    ...formData,
                    id: Math.random().toString(36).substr(2, 9),
                    description: formData.description || ''
                } as Discourse;
                await saveDiscourses([...all, newDiscourse]);
            }
            Swal.fire("Saved", "Discourse saved successfully", "success");
            setIsFormOpen(false);
            setEditingDiscourse(null);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving discourse:', error);
            Swal.fire("Error", "Error saving discourse. Please check your connection.", "error");
        }
    };

    const handleEdit = (d: Discourse) => {
        setEditingDiscourse(d);
        setFormData({ ...d });
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
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
                try {
                    const all = await getDiscourses();
                    await saveDiscourses(all.filter(d => d.id !== id));
                    Swal.fire("Deleted", "Discourse has been removed", "success");
                    loadData();
                } catch (error) {
                    Swal.fire("Error", "Failed to delete discourse", "error");
                }
            }
        });
    };

    const resetForm = () => {
        setFormData({
            name: '',
            subject: SubjectType.TAMIL_AT,
            marks: 5,
            rubrics: [],
            cognitiveProcess: CognitiveProcess.CP1,
            aiPrompt: ''
        });
    };

    const addRubric = () => {
        const newRubric: DiscourseScores = { point: '', marks: 1 };
        setFormData({
            ...formData,
            rubrics: [...(formData.rubrics || []), newRubric]
        });
    };

    const removeRubric = (index: number) => {
        const updated = [...(formData.rubrics || [])];
        updated.splice(index, 1);
        setFormData({ ...formData, rubrics: updated });
    };

    const updateRubric = (index: number, field: keyof DiscourseScores, value: string | number) => {
        const updated = [...(formData.rubrics || [])];
        updated[index] = { ...updated[index], [field]: value } as DiscourseScores;
        setFormData({ ...formData, rubrics: updated });
    };

    const filteredDiscourses = discourses.filter(d => {
        const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSubject = d.subject === filterSubject;
        return matchesSearch && matchesSubject;
    });

    // Grouping and Sorting Logic
    const groupedDiscourses = filteredDiscourses.reduce((groups, d) => {
        const markKey = d.marks;
        if (!groups[markKey]) {
            groups[markKey] = [];
        }
        groups[markKey].push(d);
        return groups;
    }, {} as Record<number, Discourse[]>);

    // Sort marks keys numerically
    const sortedMarkKeys = Object.keys(groupedDiscourses)
        .map(Number)
        .sort((a, b) => a - b);

    // Sort discourses within each group alphabetically by name
    sortedMarkKeys.forEach(key => {
        groupedDiscourses[key].sort((a, b) => a.name.localeCompare(b.name, 'ta'));
    });

    const formatMark = (m: number) => {
        const s = m.toString();
        let result = s;
        if (s.endsWith('.5')) {
            const whole = s.split('.')[0];
            result = whole === '0' ? '½' : `${whole}½`;
        }
        return <span className="english-font" style={{ fontFamily: "'Times New Roman', serif" }}>{result}</span>;
    };

    const renderMixedText = (text: string | undefined | null) => {
        if (!text) return '-';
        // Split by Tamil characters vs others (English/Numbers/Symbols)
        const segments = text.toString().split(/([அ-ஹ\u0B80-\u0BFF]+)/);

        return segments.map((seg, i) => {
            if (!seg) return null;
            const isTamil = /[அ-ஹ\u0B80-\u0BFF]/.test(seg);
            return (
                <span
                    key={i}
                    className={isTamil ? "tamil-font" : "english-font"}
                    style={{
                        fontFamily: isTamil ? `'TAU-Paalai', 'Latha', serif` : `'Times New Roman', serif`,
                        fontSize: isTamil ? 'inherit' : 'inherit',
                        lineHeight: isTamil ? '1.4' : '1.2'
                    }}
                >
                    {seg}
                </span>
            );
        });
    };

    if (loading) return (
        <div className="p-4 lg:p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="h-10 w-64 bg-gray-200 animate-pulse rounded-lg"></div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="h-10 w-48 bg-gray-100 animate-pulse rounded-lg"></div>
                    <div className="h-10 w-24 bg-gray-100 animate-pulse rounded-lg"></div>
                    <div className="h-10 w-32 bg-gray-100 animate-pulse rounded-lg"></div>
                </div>
            </div>
            <CardSkeleton count={6} />
        </div>
    );

    return (
        <>
            <div className={`p-4 lg:p-6 ${isPdfModalOpen ? 'no-print' : ''}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Discourse & Rubrics Manager</h2>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search discourses..."
                            className="pl-10 pr-4 py-2 border rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="border p-2 rounded-lg bg-white font-bold text-blue-700"
                        value={filterSubject}
                        onChange={e => setFilterSubject(e.target.value)}
                    >
                        <option value={SubjectType.TAMIL_AT}>Tamil AT</option>
                        <option value={SubjectType.TAMIL_BT}>Tamil BT</option>
                    </select>

                    <button
                        onClick={() => setIsPdfModalOpen(true)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center shadow hover:bg-red-700 font-bold transition-all gap-2 text-sm"
                        title="Export all Tamil AT and Tamil BT Discourses and Value Points to PDF"
                    >
                        <FileText size={18} /> Export PDF
                    </button>

                    <button
                        onClick={() => {
                            resetForm();
                            setEditingDiscourse(null);
                            setIsFormOpen(true);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded flex items-center shadow hover:bg-blue-700 font-bold text-sm"
                    >
                        <Plus size={18} className="mr-2" /> New Discourse
                    </button>
                </div>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
                            <h3 className="text-lg font-bold text-gray-900">{editingDiscourse ? 'Edit Discourse' : 'New Discourse'}</h3>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Subject</label>
                                    <select
                                        className="border w-full p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value as SubjectType })}
                                    >
                                        <option value={SubjectType.TAMIL_AT}>Tamil AT</option>
                                        <option value={SubjectType.TAMIL_BT}>Tamil BT</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Marks Category</label>
                                    <select
                                        className="border w-full p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={isNaN(formData.marks) ? '' : formData.marks}
                                        onChange={e => setFormData({ ...formData, marks: parseInt(e.target.value) || 0 })}
                                    >
                                        <option value="3">3 Marks</option>
                                        <option value="5">5 Marks</option>
                                        <option value="6">6 Marks</option>
                                        <option value="8">8 Marks</option>
                                        <option value="10">10 Marks</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cognitive Process</label>
                                    <select
                                        className="border w-full p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={formData.cognitiveProcess || ''}
                                        onChange={e => setFormData({ ...formData, cognitiveProcess: e.target.value as CognitiveProcess })}
                                    >
                                        <option value="">-- Select --</option>
                                        {Object.entries(CognitiveProcess).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-full">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Discourse Name</label>
                                    <input
                                        className="border w-full p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Essay, Letter, Diary Entry"
                                    />
                                </div>
                                <div className="col-span-full">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">AI விடை வடிவமைப்பு புராம்ப்ட் (AI Answer Prompt Template)</label>
                                    <textarea
                                        className="border w-full p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold text-slate-800"
                                        value={formData.aiPrompt || ''}
                                        onChange={e => setFormData({ ...formData, aiPrompt: e.target.value })}
                                        placeholder="இந்த டிஸ்கோர்ஸுக்கு விடை எவ்வாறு அமையவேண்டும் என்பதற்கான புராம்ப்ட் (எ.கா: மூன்று பத்திகளில் விடையை அமைக்கவும், ஒவ்வொன்றிற்கும் தகுந்த தலைப்பு வழங்கவும்...)"
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-gray-700 text-sm">Evaluation Rubrics (Optional)</h4>
                                    <button onClick={addRubric} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full flex items-center transition-all">
                                        <Plus size={14} className="mr-1" /> Add Point
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {(formData.rubrics || []).map((r, idx) => (
                                        <div key={idx} className="flex gap-2 items-start group">
                                            <div className="flex-1">
                                                <input
                                                    className="border w-full p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    placeholder="Point / Description"
                                                    value={r.point}
                                                    onChange={e => updateRubric(idx, 'point', e.target.value)}
                                                />
                                            </div>
                                            <div className="w-24">
                                                <input
                                                    type="number"
                                                    className="border w-full p-2 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    placeholder="Marks"
                                                    step="0.5"
                                                    value={isNaN(r.marks) ? '' : r.marks}
                                                    onChange={e => updateRubric(idx, 'marks', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                            <button
                                                onClick={() => removeRubric(idx)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {(!formData.rubrics || formData.rubrics.length === 0) && (
                                        <div className="text-center py-6 bg-white rounded-xl border border-dashed border-gray-200">
                                            <p className="text-xs text-gray-400">No rubric points added yet</p>
                                        </div>
                                    )}
                                </div>

                                {(formData.rubrics || []).length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end items-center gap-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Rubric:</span>
                                        <span className={`text-sm font-black px-3 py-1 rounded-full ${(formData.rubrics || []).reduce((sum, r) => sum + r.marks, 0) === formData.marks
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {formatMark((formData.rubrics || []).reduce((sum, r) => sum + r.marks, 0))} / {formData.marks}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="px-6 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-8 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                            >
                                Save Discourse
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-8">
                {sortedMarkKeys.map(markKey => (
                    <div key={markKey} className="space-y-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xl font-black text-blue-800 bg-blue-50 px-6 py-2 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-2">
                                <span className="english-font" style={{ fontFamily: "'Times New Roman', serif" }}>{markKey}</span>
                                <span>Marks Category</span>
                            </h3>
                            <div className="h-px flex-1 bg-gradient-to-r from-blue-100 to-transparent"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupedDiscourses[markKey].map(d => {
                                const totalRubricMarks = d.rubrics?.reduce((sum, r) => sum + r.marks, 0) || 0;
                                return (
                                    <div key={d.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all flex flex-col justify-between group">
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-blue-700 transition-colors">{renderMixedText(d.name)}</h3>
                                                    <div className="flex items-center flex-nowrap gap-2 mt-2">
                                                        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100">{d.subject}</span>
                                                        {d.cognitiveProcess && (
                                                            <span className="shrink-0 text-[10px] font-black uppercase tracking-widest bg-purple-50 text-purple-600 px-2 py-1 rounded-lg border border-purple-100">{d.cognitiveProcess}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 -mr-2 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(d)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Edit Discourse">
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button onClick={() => handleDelete(d.id)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete Discourse">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            {d.aiPrompt && (
                                                <div className="mt-3 pt-3 border-t border-gray-50 space-y-1 bg-indigo-50/20 p-2.5 rounded-xl border border-indigo-100/50 text-left">
                                                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">AI Answer Prompt</p>
                                                    <p className="text-xs font-bold text-indigo-950/80 leading-relaxed line-clamp-2" title={d.aiPrompt}>
                                                        {d.aiPrompt}
                                                    </p>
                                                </div>
                                            )}

                                            {d.rubrics && d.rubrics.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
                                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Evaluation Criteria (Rubrics)</p>
                                                    <ul className="space-y-1">
                                                        {d.rubrics.slice(0, 5).map((r, i) => (
                                                            <li key={i} className="flex justify-between items-start text-sm text-gray-600 bg-gray-50/50 px-2 py-1 rounded-lg border border-transparent hover:border-gray-100 hover:bg-white transition-all">
                                                                <span className="flex-1 leading-relaxed pr-2">{renderMixedText(r.point)}</span>
                                                                <b className="text-gray-900 english-font bg-white px-2 py-0.5 rounded-md shadow-sm border border-gray-100">{formatMark(r.marks)}</b>
                                                            </li>
                                                        ))}
                                                        {d.rubrics.length > 5 && (
                                                            <li className="text-[11px] italic text-blue-500 font-bold pl-2 flex items-center gap-1">
                                                                <Plus size={10} />
                                                                <span>{d.rubrics.length - 5} More Criteria Defined</span>
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-1 pt-0 border-t border-gray-50 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Validation:</span>
                                                <div className={`h-2 w-2 rounded-full ${totalRubricMarks === d.marks ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">Total Marks</span>
                                                <span className={`text-sm font-black px-4 py-1.5 rounded-xl border ${totalRubricMarks === d.marks
                                                        ? 'bg-green-50 text-green-700 border-green-100'
                                                        : 'bg-amber-50 text-amber-700 border-amber-100'
                                                    }`}>
                                                    {formatMark(d.marks)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {filteredDiscourses.length === 0 && (
                    <div className="py-32 text-center bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-white rounded-2xl shadow-xl shadow-gray-200/50 text-gray-300">
                            <Search size={48} />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-800">No Discourses Found</p>
                            <p className="text-gray-400 mt-1 italic font-medium">Try adjusting your search or subject filter.</p>
                        </div>
                    </div>
                )}
            </div>
            </div>

            {isPdfModalOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/80 backdrop-blur-md p-2 md:p-6 overflow-hidden discourse-pdf-modal-container">
                    <style>{`
                        @page {
                            size: A4 portrait;
                            margin: 10mm 12mm 10mm 12mm;
                        }
                        @media print {
                            .no-print {
                                display: none !important;
                            }
                            html, body, #root, main, .discourse-pdf-modal-container, .discourse-pdf-scroll-area {
                                position: static !important;
                                inset: auto !important;
                                background: white !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                overflow: visible !important;
                                width: 100% !important;
                                height: auto !important;
                                display: block !important;
                                box-shadow: none !important;
                                border: none !important;
                            }
                            .printable-pdf-document {
                                position: static !important;
                                box-shadow: none !important;
                                border: none !important;
                                width: 100% !important;
                                max-width: 100% !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                display: block !important;
                            }
                            .avoid-break {
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                            }
                            .avoid-break-after, h1, h2, h3, h4, .mark-category-header, .subject-banner {
                                page-break-after: avoid !important;
                                break-after: avoid !important;
                            }
                            table {
                                page-break-inside: auto;
                                border-collapse: collapse !important;
                                width: 100% !important;
                            }
                            tr {
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                            }
                            thead {
                                display: table-header-group;
                            }
                        }
                    `}</style>

                    {/* Toolbar Header (no-print) */}
                    <div className="bg-slate-800 text-white px-6 py-4 rounded-t-2xl flex flex-wrap justify-between items-center gap-4 no-print border-b border-slate-700 shadow-lg shrink-0">
                        <div className="flex items-center gap-3">
                            <FileText className="text-red-400" size={24} />
                            <div>
                                <h3 className="text-lg font-bold">Discourses & Value Points Specification PDF Export</h3>
                                <p className="text-xs text-slate-400">Tamil AT & Tamil BT Master Discourses with Rubrics & Value Points</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 bg-slate-900/70 px-3 py-1.5 rounded-lg border border-slate-700">
                                <span className="text-xs font-bold text-slate-300">Filter Subject:</span>
                                <select
                                    className="bg-slate-800 text-white font-bold text-xs p-1 rounded outline-none border border-slate-600 cursor-pointer"
                                    value={pdfSubjectFilter}
                                    onChange={e => setPdfSubjectFilter(e.target.value as any)}
                                >
                                    <option value="ALL">ALL (Tamil AT & Tamil BT)</option>
                                    <option value={SubjectType.TAMIL_AT}>Tamil AT Only</option>
                                    <option value={SubjectType.TAMIL_BT}>Tamil BT Only</option>
                                </select>
                            </div>

                            <button
                                onClick={() => window.print()}
                                className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-xl flex items-center gap-2 font-bold text-sm shadow-md transition-all cursor-pointer"
                            >
                                <Printer size={18} /> Print / Save as PDF
                            </button>

                            <button
                                onClick={() => setIsPdfModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Document Container */}
                    <div className="flex-1 overflow-y-auto bg-slate-200/80 p-3 md:p-6 rounded-b-2xl discourse-pdf-scroll-area">
                        <div className="printable-pdf-document bg-white p-6 md:p-8 max-w-[210mm] mx-auto shadow-2xl rounded-xl text-slate-900 border border-slate-200">
                            
                            {/* Document Header */}
                            <div className="text-center border-b-2 border-slate-900 pb-3 mb-5 avoid-break-after">
                                <h1
                                    className="text-xl md:text-2xl font-black mb-1 text-slate-900 leading-snug"
                                    style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', 'Latha', 'Tamil Sangam MN', serif", fontSize: '16pt' }}
                                >
                                    தமிழ் AT & தமிழ் BT - வினாக்களின் வகைகள் மற்றும் மதிப்பெண் பகிர்வு
                                </h1>
                                <h2
                                    className="text-[11px] font-black text-slate-600 tracking-widest uppercase font-serif"
                                    style={{ fontFamily: "'Times New Roman', serif" }}
                                >
                                    Master Discourses & Evaluation Rubrics (Value Points) Specification
                                </h2>
                                <div
                                    className="flex justify-between items-center text-[11px] font-semibold text-slate-500 mt-2 pt-2 border-t border-slate-200"
                                    style={{ fontFamily: "'Times New Roman', serif" }}
                                >
                                    <span>Date Generated: {new Date().toLocaleDateString('en-GB')}</span>
                                    <span>Subject: {pdfSubjectFilter === 'ALL' ? 'Tamil AT & Tamil BT' : pdfSubjectFilter}</span>
                                    <span>Tamil Vizuthukal Assessment Engine</span>
                                </div>
                            </div>

                            {/* Render Subjects */}
                            {[SubjectType.TAMIL_AT, SubjectType.TAMIL_BT]
                                .filter(s => pdfSubjectFilter === 'ALL' || pdfSubjectFilter === s)
                                .map(subj => {
                                    const subjDiscourses = discourses.filter(d => d.subject === subj);
                                    if (subjDiscourses.length === 0) return null;

                                    const grouped = subjDiscourses.reduce((groups, d) => {
                                        const markKey = d.marks;
                                        if (!groups[markKey]) groups[markKey] = [];
                                        groups[markKey].push(d);
                                        return groups;
                                    }, {} as Record<number, Discourse[]>);

                                    const sortedMarks = Object.keys(grouped).map(Number).sort((a, b) => a - b);
                                    sortedMarks.forEach(key => {
                                        grouped[key].sort((a, b) => a.name.localeCompare(b.name, 'ta'));
                                    });

                                    return (
                                        <div key={subj} className="mb-6">
                                            {/* Subject Banner */}
                                            <div className="bg-slate-900 text-white px-3.5 py-1.5 rounded-lg font-bold text-sm mb-4 flex justify-between items-center border border-slate-800 avoid-break-after subject-banner">
                                                <span style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', 'Latha', serif", fontSize: '14pt' }}>
                                                    பாடப்பிரிவு: {subj === SubjectType.TAMIL_AT ? 'தமிழ் AT (Tamil AT)' : 'தமிழ் BT (Tamil BT)'}
                                                </span>
                                                <span className="text-[11px] uppercase tracking-widest bg-slate-800 border border-slate-700 px-2 py-0.5 rounded" style={{ fontFamily: "'Times New Roman', serif" }}>
                                                    {subjDiscourses.length} Discourses
                                                </span>
                                            </div>

                                            {/* Marks Categories */}
                                            {sortedMarks.map(markKey => (
                                                <div key={markKey} className="mb-5 space-y-3">
                                                    <div className="flex items-center gap-2 border-b-2 border-blue-200 pb-1 avoid-break-after mark-category-header">
                                                        <h3 className="text-sm font-black text-blue-900 flex items-center gap-1.5">
                                                            <span className="english-font" style={{ fontFamily: "'Times New Roman', serif", fontSize: '14pt' }}>{markKey}</span>
                                                            <span style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', 'Latha', serif", fontSize: '13pt' }}>மதிப்பெண் வினா வகைகள் ({markKey} Marks Category)</span>
                                                        </h3>
                                                    </div>

                                                    {grouped[markKey].map((d, dIdx) => {
                                                        const totalRubricMarks = d.rubrics?.reduce((sum, r) => sum + (r.marks || 0), 0) || 0;

                                                        return (
                                                            <div key={d.id || dIdx} className="border border-slate-300 rounded-lg p-2.5 mb-3 avoid-break bg-white shadow-none">
                                                                <div className="flex justify-between items-center bg-slate-100/90 px-3 py-1 rounded border border-slate-200 mb-2 gap-3">
                                                                    <h4
                                                                        className="font-bold text-slate-900 text-sm leading-snug"
                                                                        style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', 'Latha', serif", fontSize: '14px' }}
                                                                    >
                                                                        {dIdx + 1}. {d.name}
                                                                    </h4>
                                                                    <div className="text-right shrink-0 flex items-center gap-1.5">
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ fontFamily: "'Times New Roman', serif" }}>Marks:</span>
                                                                        <span className="text-xs font-black bg-white px-2.5 py-0.5 rounded border border-slate-300 inline-block text-slate-900" style={{ fontFamily: "'Times New Roman', serif" }}>
                                                                            {formatMarkString(d.marks)}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Evaluation Criteria Table */}
                                                                {d.rubrics && d.rubrics.length > 0 ? (
                                                                    <div className="overflow-hidden mt-1">
                                                                        <table className="w-full text-left border-collapse bg-white border border-slate-300 rounded text-xs table-fixed">
                                                                            <thead>
                                                                                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800">
                                                                                    <th className="py-1 px-2 border-r border-slate-300 text-center w-10 font-bold" style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', serif", fontSize: '12px' }}>வ.எண்</th>
                                                                                    <th className="py-1 px-2.5 border-r border-slate-300 font-bold" style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', serif", fontSize: '12px' }}>மதிப்பீட்டுப் புள்ளிகள் (Value Points / Rubric Criteria)</th>
                                                                                    <th className="py-1 px-2 text-center w-24 font-bold" style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', serif", fontSize: '12px' }}>மதிப்பெண்</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {d.rubrics.map((r, rIdx) => (
                                                                                    <tr key={rIdx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                                                                        <td className="py-1 px-2 border-r border-slate-200 text-center font-bold text-slate-600 font-mono text-[11px]" style={{ fontFamily: "'Times New Roman', serif" }}>
                                                                                            {rIdx + 1}
                                                                                        </td>
                                                                                        <td className="py-1 px-2.5 border-r border-slate-200 text-slate-900 leading-snug" style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', 'Latha', serif", fontSize: '14px' }}>
                                                                                            {r.point}
                                                                                        </td>
                                                                                        <td className="py-1 px-2 text-center font-bold font-serif text-slate-900 text-xs" style={{ fontFamily: "'Times New Roman', serif" }}>
                                                                                            {formatMarkString(r.marks)}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                            <tfoot>
                                                                                <tr className="bg-slate-50 font-bold border-t border-slate-300">
                                                                                    <td colSpan={2} className="py-1 px-2.5 text-right border-r border-slate-300 text-slate-700" style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', serif", fontSize: '13px' }}>
                                                                                        மொத்த மதிப்பீட்டுப் புள்ளிகள் (Total Rubric Sum):
                                                                                    </td>
                                                                                    <td className={`py-1 px-2 text-center font-serif text-xs font-black ${totalRubricMarks === d.marks ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`} style={{ fontFamily: "'Times New Roman', serif" }}>
                                                                                        {formatMarkString(totalRubricMarks)} / {formatMarkString(d.marks)}
                                                                                    </td>
                                                                                </tr>
                                                                            </tfoot>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-2 bg-white border border-dashed border-slate-300 rounded text-center mt-1">
                                                                        <p className="text-[11px] italic text-slate-400" style={{ fontFamily: "'TAU-Paalai', 'TAU-Pallai', serif" }}>
                                                                            (மதிப்பீட்டுப் புள்ளிகள் எதுவும் சேர்க்கப்படவில்லை - No evaluation value points defined)
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}

                            {/* Document Footer */}
                            <div className="mt-8 pt-4 border-t-2 border-slate-900 flex justify-between items-center text-[11px] text-slate-500" style={{ fontFamily: "'Times New Roman', serif" }}>
                                <span>End of Specification Document</span>
                                <span>Tamil Vizuthukal - Discourse & Rubrics Manager</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminDiscourseManager;
