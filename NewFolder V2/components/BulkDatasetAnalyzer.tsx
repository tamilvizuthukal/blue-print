import React, { useState, useMemo, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import { 
    ArrowLeft, Search, Check, AlertCircle, Copy, Trash2, 
    Play, CheckSquare, Square, X, CheckCircle2, ListFilter
} from 'lucide-react';
import { analyzeDataset, bulkAddDictionaryWords } from '../services/db';

interface BulkDatasetAnalyzerProps {
    onBack: () => void;
}

const BulkDatasetAnalyzer: React.FC<BulkDatasetAnalyzerProps> = ({ onBack }) => {
    // Left panel states
    const [inputText, setInputText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Right panel states
    const [unknownWords, setUnknownWords] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
    const [visibleCount, setVisibleCount] = useState(200);
    const [isInserting, setIsInserting] = useState(false);

    // Scroll ref for lazy loading
    const rightPanelScrollRef = useRef<HTMLDivElement>(null);
    // Ref for the text editor textarea
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Flag to ignore onSelect event when selection is programmatic
    const isProgrammaticSelectionRef = useRef(false);

    // Highlight and select the word in the text editor (cycles through occurrences)
    const highlightWordInEditor = (word: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const text = inputText;
        let searchIndex = 0;

        // Cycle occurrences if clicking the already selected word
        const currentSelectedText = text.substring(textarea.selectionStart, textarea.selectionEnd);
        if (currentSelectedText === word) {
            searchIndex = textarea.selectionEnd;
        }

        let index = text.indexOf(word, searchIndex);
        if (index === -1) {
            index = text.indexOf(word); // Wrap around to first occurrence
        }

        if (index !== -1) {
            isProgrammaticSelectionRef.current = true;
            textarea.focus();
            textarea.setSelectionRange(index, index + word.length);
            
            // Reset programmatic flag after selection triggers onSelect synchronously
            setTimeout(() => {
                isProgrammaticSelectionRef.current = false;
            }, 50);
        } else {
            Swal.fire({
                title: 'Info',
                text: `"${word}" not found in editor text.`,
                icon: 'info',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };

    // Auto-select text in text editor and put in the search textbox
    const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        if (isProgrammaticSelectionRef.current) return;

        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start !== end) {
            const selectedText = textarea.value.substring(start, end).trim();
            // Automatically update search textbox if it's a valid candidate (non-empty and contains Tamil chars)
            if (selectedText && selectedText.length < 50 && /[\u0B80-\u0BFF]/.test(selectedText)) {
                setSearchQuery(selectedText);
            }
        }
    };

    // Statistics from the last analysis
    const [stats, setStats] = useState<{
        totalExtracted: number;
        unique: number;
        matches: number;
        unknown: number;
    } | null>(null);

    // Clean text processing
    const handleClearText = () => {
        setInputText('');
        setUnknownWords([]);
        setSearchQuery('');
        setSelectedWords(new Set());
        setStats(null);
    };

    const handleCopyText = async () => {
        if (!inputText) {
            Swal.fire({
                title: 'Info',
                text: 'No text to copy.',
                icon: 'info',
                timer: 1500,
                showConfirmButton: false
            });
            return;
        }
        try {
            await navigator.clipboard.writeText(inputText);
            Swal.fire({
                title: 'Copied!',
                text: 'Text copied to clipboard successfully.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Failed to copy text:', err);
            Swal.fire('Error', 'Failed to copy text.', 'error');
        }
    };

    // Run Cleanup and extraction
    const handleAnalyze = async () => {
        if (!inputText.trim()) {
            Swal.fire('Warning', 'Please enter or paste some Tamil text first.', 'warning');
            return;
        }

        setIsAnalyzing(true);
        setSelectedWords(new Set());
        setVisibleCount(200);

        try {
            const res = await analyzeDataset(inputText);
            setUnknownWords(res.unknownWords);
            setStats({
                totalExtracted: res.totalExtractedCount,
                unique: res.uniqueCount,
                matches: res.matchCount,
                unknown: res.unknownCount
            });

            // Show SweetAlert Completed Dialog (Requirement 7)
            Swal.fire({
                title: 'Analysis Completed',
                html: `
                    <div class="text-left font-semibold text-slate-700 space-y-2 mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div class="flex justify-between border-b border-gray-200/60 pb-2">
                            <span>Total Extracted Words:</span>
                            <span class="font-extrabold text-slate-900">${res.totalExtractedCount.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between border-b border-gray-200/60 py-2">
                            <span>Unique Words:</span>
                            <span class="font-extrabold text-slate-900">${res.uniqueCount.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between border-b border-gray-200/60 py-2">
                            <span>Dictionary Matches:</span>
                            <span class="font-extrabold text-green-600">${res.matchCount.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between pt-2">
                            <span>Unknown Words:</span>
                            <span class="font-extrabold text-indigo-600">${res.unknownCount.toLocaleString()}</span>
                        </div>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'View Unknown Words',
                confirmButtonColor: '#4f46e5'
            });

        } catch (err: any) {
            console.error('Error analyzing dataset:', err);
            Swal.fire('Error', err.message || 'Failed to analyze text.', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Filtered words in right panel based on search box
    const filteredWords = useMemo(() => {
        const query = searchQuery.trim().normalize('NFC');
        if (!query) return unknownWords;
        return unknownWords.filter(w => w.includes(query));
    }, [unknownWords, searchQuery]);

    // Handle scroll for virtual/lazy loading to keep DOM light
    const handleRightPanelScroll = () => {
        const container = rightPanelScrollRef.current;
        if (!container) return;

        // If we are close to the bottom (within 100px), render more items
        if (container.scrollHeight - container.scrollTop - container.clientHeight < 100) {
            if (visibleCount < filteredWords.length) {
                setVisibleCount(prev => Math.min(prev + 200, filteredWords.length));
            }
        }
    };

    // Reset visible count when filtered list changes
    useEffect(() => {
        setVisibleCount(200);
    }, [searchQuery, unknownWords]);

    // Word selection helper
    const handleToggleSelectWord = (word: string) => {
        setSelectedWords(prev => {
            const next = new Set(prev);
            if (next.has(word)) {
                next.delete(word);
            } else {
                next.add(word);
            }
            return next;
        });
    };

    const isAllSelected = useMemo(() => {
        if (filteredWords.length === 0) return false;
        return filteredWords.every(w => selectedWords.has(w));
    }, [filteredWords, selectedWords]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            // Deselect all filtered words
            setSelectedWords(prev => {
                const next = new Set(prev);
                filteredWords.forEach(w => next.delete(w));
                return next;
            });
        } else {
            // Select all filtered words
            setSelectedWords(prev => {
                const next = new Set(prev);
                filteredWords.forEach(w => next.add(w));
                return next;
            });
        }
    };

    // Remove word from list instantly without database changes (Requirement 4)
    const handleRemoveWordFromAnalysis = (word: string) => {
        setUnknownWords(prev => prev.filter(w => w !== word));
        setSelectedWords(prev => {
            if (prev.has(word)) {
                const next = new Set(prev);
                next.delete(word);
                return next;
            }
            return prev;
        });
        if (stats) {
            setStats(prev => prev ? {
                ...prev,
                unknown: prev.unknown - 1
            } : null);
        }
    };

    // Bulk insertion handling
    const performBulkInsert = async (wordsToInsert: string[]) => {
        if (wordsToInsert.length === 0) {
            Swal.fire('Warning', 'No words selected or available for insertion.', 'warning');
            return;
        }

        setIsInserting(true);
        try {
            Swal.fire({
                title: 'Saving to Dictionary...',
                text: `Inserting ${wordsToInsert.length} words in bulk.`,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Call bulk insertion API with custom flag true
            const res = await bulkAddDictionaryWords(wordsToInsert, true);

            Swal.close();

            // Show SweetAlert Insert Completed Dialog (Requirement 7)
            Swal.fire({
                title: 'Dictionary Update Completed',
                html: `
                    <div class="text-left font-semibold text-slate-700 space-y-2 mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div class="flex justify-between border-b border-gray-200/60 pb-2">
                            <span>Selected Words:</span>
                            <span class="font-extrabold text-slate-900">${res.selectedCount.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between border-b border-gray-200/60 py-2">
                            <span>Successfully Added:</span>
                            <span class="font-extrabold text-green-600">${res.addedCount.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between border-b border-gray-200/60 py-2">
                            <span>Skipped Existing:</span>
                            <span class="font-extrabold text-amber-600">${res.skippedCount.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between pt-2">
                            <span>Failed:</span>
                            <span class="font-extrabold ${res.failedCount > 0 ? 'text-red-600' : 'text-slate-900'}">${res.failedCount.toLocaleString()}</span>
                        </div>
                    </div>
                `,
                icon: res.failedCount > 0 ? 'warning' : 'success',
                confirmButtonText: 'Done',
                confirmButtonColor: '#4f46e5'
            });

            // Remove successfully added words from current list
            const addedSet = new Set(wordsToInsert);
            setUnknownWords(prev => prev.filter(w => !addedSet.has(w)));
            setSelectedWords(prev => {
                const next = new Set(prev);
                wordsToInsert.forEach(w => next.delete(w));
                return next;
            });

            if (stats) {
                setStats(prev => prev ? {
                    ...prev,
                    unknown: Math.max(0, prev.unknown - res.addedCount)
                } : null);
            }

        } catch (err: any) {
            Swal.close();
            console.error('Error inserting words:', err);
            Swal.fire('Error', err.message || 'Failed to insert words into dictionary.', 'error');
        } finally {
            setIsInserting(false);
        }
    };

    const handleAddAll = () => {
        performBulkInsert(unknownWords);
    };

    const handleAddSelected = () => {
        performBulkInsert(Array.from(selectedWords));
    };

    // Sort words alphabetically (locale ta)
    const sortedWords = useMemo(() => {
        return [...filteredWords].sort((a, b) => a.localeCompare(b, 'ta'));
    }, [filteredWords]);

    // Group sorted words by first character
    const groupedWords = useMemo(() => {
        const groups: { [key: string]: string[] } = {};
        sortedWords.forEach(word => {
            const firstChar = word.charAt(0);
            if (!groups[firstChar]) {
                groups[firstChar] = [];
            }
            groups[firstChar].push(word);
        });
        return groups;
    }, [sortedWords]);

    // Render grouped words list with Select/Deselect all group functionality
    const renderGroupedList = () => {
        let renderedWordCount = 0;
        const elements: React.ReactNode[] = [];

        for (const [char, words] of Object.entries(groupedWords)) {
            if (renderedWordCount >= visibleCount) break;

            const groupWordsInSelected = words.filter(w => selectedWords.has(w));
            const allSelected = groupWordsInSelected.length === words.length;
            const someSelected = groupWordsInSelected.length > 0 && !allSelected;

            const handleToggleGroup = () => {
                setSelectedWords(prev => {
                    const next = new Set(prev);
                    if (allSelected) {
                        // Deselect all words in this group
                        words.forEach(w => next.delete(w));
                    } else {
                        // Select all words in this group
                        words.forEach(w => next.add(w));
                    }
                    return next;
                });
            };

            elements.push(
                <div key={`group-${char}`} className="mb-4">
                    {/* Group Header with Checkbox and select/deselect shortcuts */}
                    <div className="flex items-center justify-between px-2.5 py-2 bg-slate-100/60 rounded-xl border border-slate-200/50 mb-2 shrink-0">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleToggleGroup}
                                className="text-slate-400 hover:text-indigo-650 transition shrink-0"
                                title={allSelected ? "Deselect Group" : "Select Group"}
                            >
                                {allSelected ? (
                                    <CheckSquare size={15} className="text-indigo-600" />
                                ) : someSelected ? (
                                    <div className="w-[15px] h-[15px] border border-indigo-650 bg-indigo-50 flex items-center justify-center rounded">
                                        <div className="w-2.5 h-0.5 bg-indigo-650" />
                                    </div>
                                ) : (
                                    <Square size={15} className="text-slate-400" />
                                )}
                            </button>
                            <span className="text-xs font-extrabold text-slate-800">
                                {char} ({words.length} {words.length === 1 ? 'சொல்' : 'சொற்கள்'})
                            </span>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setSelectedWords(prev => {
                                        const next = new Set(prev);
                                        words.forEach(w => next.add(w));
                                        return next;
                                    });
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:underline"
                            >
                                தேர்வு செய்க
                            </button>
                            <span className="text-slate-300 text-[10px]">|</span>
                            <button
                                onClick={() => {
                                    setSelectedWords(prev => {
                                        const next = new Set(prev);
                                        words.forEach(w => next.delete(w));
                                        return next;
                                    });
                                }}
                                className="text-[10px] font-bold text-slate-500 hover:underline"
                            >
                                நீக்குக
                            </button>
                        </div>
                    </div>

                    {/* Grouped Words */}
                    <div className="flex flex-col gap-2 pl-1">
                        {words.map(word => {
                            renderedWordCount++;
                            if (renderedWordCount > visibleCount) return null;

                            const isSelected = selectedWords.has(word);
                            return (
                                <div 
                                    key={word}
                                    className="flex items-center gap-2.5 py-1 min-w-0"
                                >
                                    <button
                                        onClick={() => handleToggleSelectWord(word)}
                                        className="text-slate-400 hover:text-indigo-600 transition shrink-0"
                                    >
                                        {isSelected ? (
                                            <CheckSquare size={16} className="text-indigo-600" />
                                        ) : (
                                            <Square size={16} className="text-slate-350" />
                                        )}
                                    </button>
                                    
                                    {/* Modern Pill Style Tag */}
                                    <div 
                                        onClick={() => highlightWordInEditor(word)}
                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all min-w-0 cursor-pointer ${
                                            isSelected 
                                                ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 shadow-sm' 
                                                : 'bg-slate-50/50 border-slate-200/85 text-slate-800 hover:bg-slate-100/70 hover:border-slate-300 hover:shadow-sm'
                                        }`}
                                    >
                                        <span 
                                            style={{ fontFamily: "'TAU-Pallai', 'Inter', sans-serif", fontSize: '14px' }}
                                            className="font-bold truncate max-w-[170px]"
                                            title={word}
                                        >
                                            {word}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation(); // Avoid triggering highlighting/selection when deleting
                                                handleRemoveWordFromAnalysis(word);
                                            }}
                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50/50 w-4 h-4 rounded-full flex items-center justify-center transition leading-none text-xs shrink-0 font-extrabold"
                                            title="Remove from analysis list"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        return elements;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-[calc(100vh-140px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                        title="Back to Dictionary Words"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <ListFilter className="text-indigo-600" size={26} />
                            Bulk Dataset Analyzer
                        </h1>
                        <p className="text-xs font-semibold text-gray-400 mt-0.5">
                            Extract Tamil words from books, PDFs, OCR output, and analyze against the dictionary database.
                        </p>
                    </div>
                </div>
            </div>

            {/* Layout Panels */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden">
                
                {/* Left Panel (Text Processing Area) - 70% width */}
                <div className="w-full md:w-[70%] flex flex-col bg-white rounded-2xl border border-gray-100 p-5 shadow-sm min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-3 shrink-0">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Paste Tamil Text Dataset
                        </label>
                        {inputText && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-lg">
                                {inputText.length.toLocaleString()} characters
                            </span>
                        )}
                    </div>
                    
                    <div className="flex-1 min-h-0 relative">
                        <textarea
                            ref={textareaRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onSelect={handleTextareaSelect}
                            placeholder="அச்சுப்பொறி, வலைத்தளங்கள், மின்நூல்கள் மற்றும் OCR வெளியீடுகளில் இருந்து உரைகளை இங்கே ஒட்டவும்..."
                            className="w-full h-full p-4 rounded-xl border border-gray-100 focus:border-indigo-500 focus:outline-none bg-slate-50/40 focus:bg-white transition-all text-sm font-medium text-gray-800 resize-none font-sans selection:bg-yellow-300 selection:text-slate-900"
                            disabled={isAnalyzing}
                        />
                        {isAnalyzing && (
                            <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-xl">
                                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm font-bold text-indigo-600 mt-4 animate-pulse">
                                    Preprocessing text & analyzing dictionary...
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-50 shrink-0">
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !inputText.trim()}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition shadow-lg shadow-indigo-100"
                        >
                            <Play size={16} fill="currentColor" />
                            Analyze Words
                        </button>
                        <button
                            onClick={handleClearText}
                            disabled={isAnalyzing || !inputText}
                            className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:hover:bg-white px-5 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
                        >
                            Clear Text
                        </button>
                        <button
                            onClick={handleCopyText}
                            disabled={isAnalyzing || !inputText}
                            className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:hover:bg-white px-5 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
                        >
                            <Copy size={16} />
                            Copy Text
                        </button>
                    </div>
                </div>

                {/* Right Panel (Unknown Words Panel) - 30% width */}
                <div className="w-full md:w-[30%] flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm min-h-0 overflow-hidden">
                    
                    {/* Header Details */}
                    <div className="p-4 border-b border-gray-50 shrink-0 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Unknown Words Panel
                            </h3>
                            {unknownWords.length > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 animate-pulse">
                                    {unknownWords.length.toLocaleString()} words
                                </span>
                            )}
                        </div>

                        {/* Search Box */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search unknown words..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 text-slate-800 pl-9 pr-8 py-2 rounded-xl text-xs border border-transparent focus:border-indigo-100 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-semibold"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Actions for Insertion */}
                        {unknownWords.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                    onClick={handleAddAll}
                                    disabled={isInserting}
                                    className="py-2 text-[11px] font-bold text-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-md shadow-indigo-50 disabled:opacity-50"
                                >
                                    Add All Words
                                </button>
                                <button
                                    onClick={handleAddSelected}
                                    disabled={isInserting || selectedWords.size === 0}
                                    className="py-2 text-[11px] font-bold text-center bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg transition shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-200"
                                >
                                    Add Selected ({selectedWords.size})
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Words Selection Header (if dataset is loaded) */}
                    {unknownWords.length > 0 && (
                        <div className="px-4 py-2 border-b border-gray-50 bg-[#fafafa] flex items-center justify-between shrink-0">
                            <button
                                onClick={handleToggleSelectAll}
                                className="flex items-center gap-2 text-[11px] font-extrabold text-slate-600 hover:text-slate-800 cursor-pointer"
                            >
                                {isAllSelected ? (
                                    <CheckSquare size={14} className="text-indigo-600" />
                                ) : (
                                    <Square size={14} className="text-slate-400" />
                                )}
                                <span>Select All Filtered</span>
                            </button>
                            
                            <span className="text-[10px] font-bold text-slate-400">
                                Showing {Math.min(visibleCount, filteredWords.length).toLocaleString()} of {filteredWords.length.toLocaleString()}
                            </span>
                        </div>
                    )}

                    {/* Scrollable Words Container */}
                    <div 
                        ref={rightPanelScrollRef}
                        onScroll={handleRightPanelScroll}
                        className="flex-1 overflow-y-auto p-4 min-h-0"
                    >
                        {unknownWords.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <CheckCircle2 className="text-slate-200 mb-3" size={44} />
                                <h4 className="text-sm font-bold text-slate-700">No Unknown Words</h4>
                                <p className="text-xs font-semibold text-slate-400 mt-1 max-w-[200px]">
                                    {stats ? "All extracted words are already in the dictionary!" : "Paste Tamil text on the left panel and click Analyze Words."}
                                </p>
                            </div>
                        ) : filteredWords.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <Search className="text-slate-200 mb-3" size={40} />
                                <h4 className="text-xs font-bold text-slate-700">No matches found</h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">Try a different search term.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {renderGroupedList()}

                                {visibleCount < filteredWords.length && (
                                    <div className="text-center py-2 shrink-0">
                                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkDatasetAnalyzer;
