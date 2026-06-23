import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    Search, Plus, Edit2, Trash2, Download, Upload, X, Filter, FileText, Check, AlertCircle, ChevronLeft, ChevronRight, HelpCircle
} from 'lucide-react';
import { DictionaryWord } from '../types';
import {
    getDictionaryWords, addDictionaryWord, updateDictionaryWord, deleteDictionaryWord, importDictionaryWords
} from '../services/db';
import { TableRowSkeleton } from './LoadingSkeleton';

const AdminDictionaryManager = () => {
    // State management
    const [words, setWords] = useState<DictionaryWord[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalWords, setTotalWords] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'system' | 'custom'>('all');
    const [matchCase, setMatchCase] = useState(false);
    const [matchWholeWord, setMatchWholeWord] = useState(false);
    const [useRegex, setUseRegex] = useState(false);

    // Modals
    const [isAddEditOpen, setIsAddEditOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    
    // Form state
    const [editingWord, setEditingWord] = useState<DictionaryWord | null>(null);
    const [wordInput, setWordInput] = useState('');
    const [isCustomInput, setIsCustomInput] = useState(true);

    // Import state
    const [importMethod, setImportMethod] = useState<'paste' | 'file'>('paste');
    const [pasteContent, setPasteContent] = useState('');
    const [importIsCustom, setImportIsCustom] = useState(true);
    const [importLoading, setImportLoading] = useState(false);

    // Load words on query, filter, page, limit change
    const loadWords = (overrideQuery?: string, overridePage?: number) => {
        setLoading(true);
        const isCustomParam = filterType === 'all' ? undefined : (filterType === 'custom' ? 1 : 0);
        const activeQuery = overrideQuery !== undefined ? overrideQuery : searchQuery;
        const activePage = overridePage !== undefined ? overridePage : page;
        
        getDictionaryWords({
            query: activeQuery,
            isCustom: isCustomParam,
            page: activePage,
            limit,
            matchCase,
            matchWholeWord,
            useRegex
        }).then(data => {
            setWords(data.words);
            setTotalWords(data.total);
            setLoading(false);
        }).catch(err => {
            console.error("Failed to load dictionary words:", err);
            setLoading(false);
            Swal.fire("Error", "Failed to retrieve dictionary words.", "error");
        });
    };

    useEffect(() => {
        loadWords();
    }, [page, limit, filterType, matchCase, matchWholeWord, useRegex]);

    // Handle search query with enter key or manual trigger
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        loadWords(searchQuery, 1);
    };

    // Open add/edit modal
    const handleOpenAdd = () => {
        setEditingWord(null);
        setWordInput('');
        setIsCustomInput(true);
        setIsAddEditOpen(true);
    };

    const handleOpenEdit = (w: DictionaryWord) => {
        setEditingWord(w);
        setWordInput(w.word);
        setIsCustomInput(w.isCustom);
        setIsAddEditOpen(true);
    };

    // Add or edit word submission
    const handleAddEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Clean Tamil word
        const cleanWord = (wordInput.match(/[\u0B80-\u0BFF]+/g) || []).join('').trim();
        if (cleanWord.length <= 1) {
            return Swal.fire("Warning", "Please enter a valid Tamil word (at least 2 letters).", "warning");
        }

        try {
            if (editingWord) {
                // Edit word
                await updateDictionaryWord(editingWord.word, cleanWord, isCustomInput);
                Swal.fire({
                    title: "Success!",
                    text: "Word updated successfully.",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                // Add word (uses addDictionaryWord which sets is_custom to 1)
                const res = await addDictionaryWord(cleanWord);
                if (res.added) {
                    Swal.fire({
                        title: "Success!",
                        text: "New word added successfully.",
                        icon: "success",
                        timer: 1500,
                        showConfirmButton: false
                    });
                } else {
                    Swal.fire("Info", "This word is already in the dictionary.", "info");
                }
            }
            setIsAddEditOpen(false);
            loadWords();
        } catch (err: any) {
            console.error("Save dictionary word error:", err);
            Swal.fire("Error", err.message || "An error occurred during execution.", "error");
        }
    };

    // Delete word
    const handleDeleteWord = (word: string) => {
        Swal.fire({
            title: "Are you sure?",
            text: `"${word}" will be deleted from the dictionary!`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#3b82f6",
            confirmButtonText: "Yes, delete it!",
            cancelButtonText: "Cancel"
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDictionaryWord(word);
                    Swal.fire({
                        title: "Deleted!",
                        text: "Word has been deleted successfully.",
                        icon: "success",
                        timer: 1500,
                        showConfirmButton: false
                    });
                    loadWords();
                } catch (err) {
                    console.error("Delete word error:", err);
                    Swal.fire("Error", "Failed to delete word.", "error");
                }
            }
        });
    };

    // Export words as CSV
    const handleExport = async () => {
        try {
            const isCustomParam = filterType === 'all' ? undefined : (filterType === 'custom' ? 1 : 0);
            
            Swal.fire({
                title: 'Preparing Export...',
                text: 'Preparing words for download.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const data = await getDictionaryWords({
                query: searchQuery,
                isCustom: isCustomParam,
                page: 1,
                limit: 100000 // A large enough number to fetch all
            });

            Swal.close();

            if (data.words.length === 0) {
                return Swal.fire("Info", "No words to export.", "info");
            }

            // Generate CSV
            let csvContent = "\ufeffWord,Type\n"; // Include UTF-8 BOM for Tamil characters support in Excel
            data.words.forEach(w => {
                const typeText = w.isCustom ? "Custom" : "System";
                csvContent += `"${w.word}","${typeText}"\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            const dateStr = new Date().toISOString().slice(0, 10);
            link.setAttribute("download", `Tamil_Dictionary_Words_${filterType}_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Swal.fire("Success!", `${data.words.length} words exported successfully.`, "success");
        } catch (err) {
            console.error("Export error:", err);
            Swal.fire("Error", "Failed to export dictionary words.", "error");
        }
    };

    // Bulk Import Logic
    const handleImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let wordsToImport: string[] = [];

        if (importMethod === 'paste') {
            if (!pasteContent.trim()) {
                return Swal.fire("Warning", "Please enter some words.", "warning");
            }
            wordsToImport = pasteContent
                .split(/[\n,\s;]+/)
                .map(w => w.trim())
                .filter(w => w.length > 1);
        } else {
            const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                return Swal.fire("Warning", "Please select a file.", "warning");
            }
            return;
        }

        if (wordsToImport.length === 0) {
            return Swal.fire("Warning", "No valid Tamil words detected.", "warning");
        }

        processImport(wordsToImport);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            let parsedWords: string[] = [];
            
            if (file.name.endsWith('.csv')) {
                const lines = text.split('\n');
                lines.forEach((line, index) => {
                    if (index === 0 && (line.toLowerCase().includes('word') || line.toLowerCase().includes('வார்த்தை'))) {
                        return;
                    }
                    const cols = line.split(',');
                    if (cols[0]) {
                        const word = cols[0].replace(/['"]+/g, '').trim();
                        if (word) parsedWords.push(word);
                    }
                });
            } else {
                parsedWords = text
                    .split(/[\n,\s;]+/)
                    .map(w => w.trim())
                    .filter(w => w.length > 1);
            }

            if (parsedWords.length === 0) {
                Swal.fire("Warning", "No words detected in the file.", "warning");
                e.target.value = '';
                return;
            }

            processImport(parsedWords);
            e.target.value = '';
        };

        reader.onerror = () => {
            Swal.fire("Error", "Failed to read the file.", "error");
        };

        reader.readAsText(file, 'UTF-8');
    };

    const processImport = async (wordList: string[]) => {
        setImportLoading(true);
        try {
            Swal.fire({
                title: 'Importing...',
                text: `Analyzing ${wordList.length} words.`,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const res = await importDictionaryWords(wordList, importIsCustom);
            
            Swal.close();
            setImportLoading(false);
            setIsImportOpen(false);
            setPasteContent('');

            Swal.fire({
                title: "இம்போர்ட் நிறைவடைந்தது! (Import Completed)",
                html: `<div class="text-sm font-semibold text-slate-700 flex flex-col gap-2 mt-2">
                    <div class="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-center">
                        <span class="font-extrabold text-base">${res.count}</span> புதிய சொற்கள் சேர்க்கப்பட்டன (Newly Added)
                    </div>
                    ${res.skipped ? `
                    <div class="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-center">
                        <span class="font-extrabold text-base">${res.skipped}</span> ஏற்கனவே உள்ள மாற்று/நகல் சொற்கள் தவிர்க்கப்பட்டன (Duplicates Skipped)
                    </div>
                    ` : ''}
                </div>`,
                icon: "success"
            });

            loadWords();
        } catch (err: any) {
            Swal.close();
            setImportLoading(false);
            console.error("Import error:", err);
            Swal.fire("Error", err.message || "Failed to import words.", "error");
        }
    };

    // Pagination helper variables
    const totalPages = Math.ceil(totalWords / limit);
    const startIndex = (page - 1) * limit + 1;
    const endIndex = Math.min(page * limit, totalWords);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <FileText className="text-indigo-600" size={26} />
                        Dictionary Words Management
                    </h1>
                    <p className="text-sm font-semibold text-gray-400 mt-1">
                        View, add, edit, export, and import Tamil words used in spelling and grammar checks.
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 hover:border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition shadow-sm hover:shadow"
                    >
                        <Download size={16} className="text-gray-500" />
                        Export
                    </button>
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 hover:border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition shadow-sm hover:shadow"
                    >
                        <Upload size={16} className="text-gray-500" />
                        Import
                    </button>
                    <button
                        onClick={handleOpenAdd}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white transition shadow-lg shadow-indigo-100"
                    >
                        <Plus size={16} />
                        Add Word
                    </button>
                </div>
            </div>

            {/* Quick stats and filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Stats cards */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FileText size={20} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Words</p>
                        <h3 className="text-2xl font-black text-gray-900 mt-1">{totalWords}</h3>
                    </div>
                </div>

                {/* Filter and search card - span 3 */}
                <div className="md:col-span-3 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Filter Tabs */}
                    <div className="flex bg-gray-50 p-1 rounded-xl w-full md:w-auto">
                        <button
                            onClick={() => { setFilterType('all'); setPage(1); }}
                            className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${filterType === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            All Words ({filterType === 'all' ? totalWords : ''})
                        </button>
                        <button
                            onClick={() => { setFilterType('system'); setPage(1); }}
                            className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${filterType === 'system' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            System Words
                        </button>
                        <button
                            onClick={() => { setFilterType('custom'); setPage(1); }}
                            className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${filterType === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Custom Words
                        </button>
                    </div>

                    {/* Search Form */}
                    <form onSubmit={handleSearchSubmit} className="relative w-full md:w-[450px]">
                        <input
                            type="text"
                            placeholder="Search (⇅ for history)"
                            value={searchQuery}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchQuery(val);
                                if (val === '') {
                                    setPage(1);
                                    loadWords('', 1);
                                }
                            }}
                            className="w-full bg-gray-50 text-gray-900 pl-10 pr-28 py-2.5 rounded-xl text-sm border border-transparent focus:border-indigo-100 focus:bg-white focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-semibold"
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-transparent">
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchQuery(''); setPage(1); loadWords('', 1); }}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded transition"
                                    title="Clear Search"
                                >
                                    <X size={14} />
                                </button>
                            )}

                            {/* Aa - Match Case */}
                            <button
                                type="button"
                                onClick={() => { setPage(1); setMatchCase(!matchCase); }}
                                className={`h-6 px-1.5 text-[10px] font-extrabold rounded transition-all cursor-pointer border ${
                                    matchCase 
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
                                        : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                                title="Match Case"
                            >
                                Aa
                            </button>

                            {/* ab - Match Whole Word */}
                            <button
                                type="button"
                                onClick={() => { setPage(1); setMatchWholeWord(!matchWholeWord); }}
                                className={`h-6 px-1.5 text-[10px] font-extrabold rounded transition-all cursor-pointer border ${
                                    matchWholeWord 
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
                                        : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                                title="Match Whole Word"
                            >
                                <span className="underline decoration-2">ab</span>
                            </button>

                            {/* .* - Use Regex */}
                            <button
                                type="button"
                                onClick={() => { setPage(1); setUseRegex(!useRegex); }}
                                className={`h-6 px-1.5 text-xs font-black rounded transition-all cursor-pointer border ${
                                    useRegex 
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
                                        : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                                title="Use Regular Expression"
                            >
                                .*
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Words Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-6">
                            <TableRowSkeleton columns={4} rows={10} />
                        </div>
                    ) : words.length === 0 ? (
                        <div className="py-16 text-center">
                            <HelpCircle className="mx-auto text-gray-300 mb-4" size={48} />
                            <h3 className="text-base font-black text-gray-700">No Words Found</h3>
                            <p className="text-sm font-semibold text-gray-400 mt-1">
                                {searchQuery ? "No words matched your search criteria." : "No words found in the dictionary database."}
                            </p>
                            {searchQuery && (
                                <button
                                    onClick={() => { setSearchQuery(''); setPage(1); loadWords('', 1); }}
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 hover:bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 transition"
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-50 bg-[#fafafa]">
                                    <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-20">S.No</th>
                                    <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Word (Tamil)</th>
                                    <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-48">Type</th>
                                    <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-36 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {words.map((item, index) => (
                                    <tr key={item.word} className="hover:bg-gray-50/50 transition">
                                        <td className="py-4 px-6 text-sm font-bold text-gray-500">
                                            {startIndex + index}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span 
                                                style={{ fontFamily: "'TAU-Pallai', 'Inter', sans-serif", fontSize: '14px' }}
                                                className="font-bold text-gray-900"
                                            >
                                                {item.word}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            {item.isCustom ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                    Custom Word
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                                    System Word
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                                                    title="Edit Word"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteWord(item.word)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                                                    title="Delete Word"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination Controls */}
                {!loading && words.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-50 px-6 py-4 gap-4">
                        <div className="text-xs font-bold text-gray-400">
                            Showing {startIndex} - {endIndex} of {totalWords} words
                        </div>
                        
                        <div className="flex items-center gap-6">
                            {/* Limit Selector */}
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                <span>Show:</span>
                                <select
                                    value={limit}
                                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                                    className="bg-gray-50 border border-gray-100 rounded-lg py-1 px-2.5 font-bold focus:outline-none focus:border-indigo-100 text-gray-700"
                                >
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                </select>
                            </div>

                            {/* Navigation Buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-xs font-bold text-gray-500">
                                    Page {page} of {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || totalPages === 0}
                                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add / Edit Word Modal */}
            {isAddEditOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-50 p-5">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                {editingWord ? <Edit2 className="text-indigo-600" size={18} /> : <Plus className="text-indigo-600" size={18} />}
                                {editingWord ? "Edit Word" : "Add New Word"}
                            </h3>
                            <button onClick={() => setIsAddEditOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddEditSubmit}>
                            <div className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Word (Tamil letters only)</label>
                                    <input
                                        type="text"
                                        value={wordInput}
                                        onChange={(e) => setWordInput(e.target.value)}
                                        placeholder="Enter word (e.g., வணக்கம்)"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:outline-none bg-gray-50/50 focus:bg-white transition-all text-sm font-bold text-gray-900"
                                        required
                                        autoFocus
                                    />
                                    <p className="text-[10px] font-bold text-gray-400">
                                        Note: Only Tamil letters are allowed.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-700">Is Custom Word?</h4>
                                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">Mark this as a custom word added by administrators.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={isCustomInput} 
                                            onChange={(e) => setIsCustomInput(e.target.checked)} 
                                            className="sr-only peer" 
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 bg-gray-50/80 px-6 py-4 border-t border-gray-50">
                                <button
                                    type="button"
                                    onClick={() => setIsAddEditOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-lg shadow-indigo-100"
                                >
                                    {editingWord ? "Update" : "Add"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Words Modal */}
            {isImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-50 p-5">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <Upload className="text-indigo-600" size={18} />
                                Bulk Import Words
                            </h3>
                            <button 
                                onClick={() => !importLoading && setIsImportOpen(false)} 
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                disabled={importLoading}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleImportSubmit}>
                            <div className="p-6 space-y-5">
                                {/* Import Method Toggle */}
                                <div className="flex bg-gray-50 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setImportMethod('paste')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${importMethod === 'paste' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                    >
                                        Paste Words
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setImportMethod('file')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${importMethod === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                    >
                                        Upload File (.TXT / .CSV)
                                    </button>
                                </div>

                                {importMethod === 'paste' ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Word List</label>
                                        <textarea
                                            value={pasteContent}
                                            onChange={(e) => setPasteContent(e.target.value)}
                                            placeholder="Paste words here (separated by commas, spaces, or new lines)... e.g., பள்ளி, வகுப்பு, ஆசிரியர், புத்தகம்"
                                            rows={6}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:outline-none bg-gray-50/50 focus:bg-white transition-all text-sm font-medium text-gray-900"
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select File</label>
                                        <div className="border-2 border-dashed border-gray-200 hover:border-indigo-400 rounded-2xl p-8 text-center bg-gray-50/50 hover:bg-indigo-50/10 transition group cursor-pointer relative">
                                            <input
                                                type="file"
                                                id="import-file-input"
                                                accept=".txt,.csv"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                            />
                                            <Upload className="mx-auto text-gray-400 group-hover:text-indigo-600 mb-3 transition" size={36} />
                                            <h4 className="text-sm font-bold text-gray-700">Drag and drop file here, or click to select</h4>
                                            <p className="text-xs text-gray-400 mt-1 font-semibold">Only .TXT or .CSV files are supported (UTF-8 encoded)</p>
                                        </div>
                                        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex gap-2">
                                            <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] font-bold text-blue-700 leading-normal">
                                                Note: For CSV, the first column is treated as the word. For TXT, words should be separated by commas or new lines.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-700">Mark as Custom Words</h4>
                                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">Imported words will be saved as administrator-added custom words.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={importIsCustom} 
                                            onChange={(e) => setImportIsCustom(e.target.checked)} 
                                            className="sr-only peer" 
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 bg-gray-50/80 px-6 py-4 border-t border-gray-50">
                                <button
                                    type="button"
                                    onClick={() => setIsImportOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition"
                                    disabled={importLoading}
                                >
                                    Cancel
                                </button>
                                {importMethod === 'paste' && (
                                    <button
                                        type="submit"
                                        className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-lg shadow-indigo-100"
                                        disabled={importLoading}
                                    >
                                        Import
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDictionaryManager;
