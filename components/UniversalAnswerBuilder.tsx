import React, { useState, useRef, useEffect } from 'react';
import { 
    Plus, Trash2, GripVertical, Copy, ArrowUp, ArrowDown, 
    Type, Heading as HeadingIcon, List, ListOrdered, 
    Columns, Table as TableIcon, Image as ImageIcon, 
    HelpCircle, Quote as QuoteIcon, Settings2 
} from 'lucide-react';
import Swal from 'sweetalert2';

export interface AnswerBlock {
    id: string;
    type: 'heading' | 'paragraph' | 'bullet' | 'numbered' | 'split-row' | 'multi-column' | 'table' | 'image' | 'formula' | 'quote';
    content?: string;
    level?: 1 | 2 | 3;
    bulletSymbol?: string;
    // Split Row
    splitColumns?: string[];
    splitSymbol?: string;
    customSymbol?: string;
    // Multi Column
    multiColumns?: string[];
    // Table
    tableRows?: string[][]; // rows x cols
    // Image
    imageUrl?: string;
    imageAlt?: string;
    // Block Marks
    marks?: number;
}

interface UniversalAnswerBuilderProps {
    blocks: AnswerBlock[];
    onChange: (blocks: AnswerBlock[]) => void;
    placeholder?: string;
    showMarks?: boolean;
}

const DEFAULT_BLOCKS = (placeholder: string): AnswerBlock[] => [
    { id: Math.random().toString(36).substr(2, 9), type: 'paragraph', content: '' }
];

const AVAILABLE_SYMBOLS = ['-', ':', '=', '/', '+', '×', '÷', '→', '⇒', '•', '~', '|', 'Custom Symbol'];
const BULLET_SYMBOLS = ['▪', '•', '➢', '➔', '✔', '★', '❖', '✅'];

const formatDisplayMark = (val: number | undefined): string => {
    if (val === undefined || isNaN(val)) return '';
    const s = val.toString();
    if (s.endsWith('.5')) {
        const whole = s.split('.')[0];
        return whole === '0' ? '½' : `${whole}½`;
    }
    return s;
};

export const parseDisplayMark = (str: string): number | undefined => {
    let clean = str.trim();
    if (!clean) return undefined;
    if (clean === '½') return 0.5;
    if (clean.endsWith('½')) {
        const wholeStr = clean.slice(0, -1);
        const whole = parseInt(wholeStr) || 0;
        return whole + 0.5;
    }
    let val = parseFloat(clean);
    if (isNaN(val)) return undefined;
    return val;
};

interface AutoResizingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
}

const AutoResizingTextarea: React.FC<AutoResizingTextareaProps> = ({ value, onChange, ...props }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
                if (onChange) onChange(e);
                adjustHeight();
            }}
            {...props}
        />
    );
};

export const UniversalAnswerBuilder: React.FC<UniversalAnswerBuilderProps> = ({
    blocks = [],
    onChange,
    placeholder = "Type your content here...",
    showMarks = true
}) => {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const [localBlocks, setLocalBlocks] = useState<AnswerBlock[]>(() => {
        return blocks.length > 0 ? blocks : DEFAULT_BLOCKS(placeholder);
    });

    const lastSentRef = useRef<string>('');

    useEffect(() => {
        if (blocks && blocks.length > 0) {
            const blocksJson = JSON.stringify(blocks);
            if (blocksJson !== lastSentRef.current && blocksJson !== JSON.stringify(localBlocks)) {
                setLocalBlocks(blocks);
            }
        }
    }, [blocks]);

    const activeBlocks = localBlocks;
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [activeMenuIdx, setActiveMenuIdx] = useState<number | null>(null);
    const [openUpward, setOpenUpward] = useState<boolean>(false);

    const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>, idx: number) => {
        const isCurrentlyOpen = activeMenuIdx === idx;
        if (!isCurrentlyOpen) {
            const rect = e.currentTarget.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            setOpenUpward(spaceBelow < 280 && spaceAbove > spaceBelow);
        }
        setActiveMenuIdx(isCurrentlyOpen ? null : idx);
    };

    const updateBlocks = (newBlocks: AnswerBlock[]) => {
        setLocalBlocks(newBlocks);
        lastSentRef.current = JSON.stringify(newBlocks);
        onChangeRef.current(newBlocks);
    };

    const handleBlockUpdate = (index: number, updates: Partial<AnswerBlock>) => {
        const newBlocks = [...activeBlocks];
        newBlocks[index] = { ...newBlocks[index], ...updates };
        updateBlocks(newBlocks);
    };

    const addBlock = (type: AnswerBlock['type'], index: number, position: 'above' | 'below') => {
        const newBlock: AnswerBlock = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            content: ''
        };

        // Initialize block-specific fields
        if (type === 'heading') {
            newBlock.level = 2;
        } else if (type === 'bullet') {
            newBlock.bulletSymbol = '▪';
        } else if (type === 'split-row') {
            newBlock.splitColumns = ['', ''];
            newBlock.splitSymbol = '-';
        } else if (type === 'multi-column') {
            newBlock.multiColumns = ['', ''];
        } else if (type === 'table') {
            newBlock.tableRows = [
                ['', ''],
                ['', '']
            ];
        }

        const newBlocks = [...activeBlocks];
        const insertIdx = position === 'above' ? index : index + 1;
        newBlocks.splice(insertIdx, 0, newBlock);
        updateBlocks(newBlocks);
        setActiveMenuIdx(null);
    };

    const duplicateBlock = (index: number) => {
        const blockToCopy = activeBlocks[index];
        const duplicated: AnswerBlock = {
            ...JSON.parse(JSON.stringify(blockToCopy)),
            id: Math.random().toString(36).substr(2, 9)
        };

        const newBlocks = [...activeBlocks];
        newBlocks.splice(index + 1, 0, duplicated);
        updateBlocks(newBlocks);
        setActiveMenuIdx(null);
    };

    const deleteBlock = (index: number) => {
        if (activeBlocks.length <= 1) {
            // Instead of deleting the last block, clear it
            const clearedBlock: AnswerBlock = {
                id: Math.random().toString(36).substr(2, 9),
                type: 'paragraph',
                content: ''
            };
            updateBlocks([clearedBlock]);
            return;
        }
        const newBlocks = [...activeBlocks];
        newBlocks.splice(index, 1);
        updateBlocks(newBlocks);
        setActiveMenuIdx(null);
    };

    const convertBlockType = (index: number, newType: AnswerBlock['type']) => {
        const block = activeBlocks[index];
        if (block.type === newType) return;

        const updated: AnswerBlock = {
            id: block.id,
            type: newType,
            content: block.content || ''
        };

        // Convert specific content types gracefully
        if (newType === 'heading') {
            updated.level = 2;
        } else if (newType === 'bullet') {
            updated.bulletSymbol = '▪';
        } else if (newType === 'split-row') {
            updated.splitColumns = [block.content || '', ''];
            updated.splitSymbol = '-';
        } else if (newType === 'multi-column') {
            updated.multiColumns = [block.content || '', ''];
        } else if (newType === 'table') {
            updated.tableRows = [
                [block.content || '', ''],
                ['', '']
            ];
        }

        const newBlocks = [...activeBlocks];
        newBlocks[index] = updated;
        updateBlocks(newBlocks);
        setActiveMenuIdx(null);
    };

    // Drag and Drop
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIdx(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === index) return;

        const newBlocks = [...activeBlocks];
        const draggedBlock = newBlocks[draggedIdx];
        newBlocks.splice(draggedIdx, 1);
        newBlocks.splice(index, 0, draggedBlock);
        updateBlocks(newBlocks);
        setDraggedIdx(index);
    };

    const handleDragEnd = () => {
        setDraggedIdx(null);
    };

    // Render Editor UI for block
    const renderBlockEditor = (block: AnswerBlock, index: number) => {
        switch (block.type) {
            case 'heading':
                return (
                    <div className="flex gap-2 items-center w-full">
                        <select
                            value={block.level || 2}
                            onChange={(e) => handleBlockUpdate(index, { level: parseInt(e.target.value) as 1 | 2 | 3 })}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none"
                        >
                            <option value={1}>H1</option>
                            <option value={2}>H2</option>
                            <option value={3}>H3</option>
                        </select>
                        <input
                            type="text"
                            value={block.content || ''}
                            onChange={(e) => handleBlockUpdate(index, { content: e.target.value })}
                            className="flex-grow border-0 border-b border-dashed border-gray-200 focus:border-blue-500 focus:ring-0 outline-none text-sm font-bold py-1 bg-transparent"
                            placeholder="Heading text..."
                        />
                    </div>
                );

            case 'paragraph':
                return (
                    <AutoResizingTextarea
                        value={block.content || ''}
                        onChange={(e) => handleBlockUpdate(index, { content: e.target.value })}
                        rows={1}
                        className="w-full border-0 border-b border-dashed border-gray-200 focus:border-blue-500 focus:ring-0 outline-none text-sm py-1 bg-transparent resize-none overflow-hidden"
                        placeholder="Paragraph content..."
                        style={{ minHeight: '32px' }}
                    />
                );

            case 'bullet':
                return (
                    <div className="flex gap-2 items-start w-full">
                        <select
                            value={block.bulletSymbol || '▪'}
                            onChange={(e) => handleBlockUpdate(index, { bulletSymbol: e.target.value })}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-1 text-sm outline-none w-10 text-center shrink-0"
                        >
                            {BULLET_SYMBOLS.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                        <AutoResizingTextarea
                            value={block.content || ''}
                            onChange={(e) => handleBlockUpdate(index, { content: e.target.value })}
                            rows={1}
                            className="flex-grow border-0 border-b border-dashed border-gray-200 focus:border-blue-500 focus:ring-0 outline-none text-sm py-1 bg-transparent resize-none overflow-hidden"
                            placeholder="Bullet item..."
                            style={{ minHeight: '32px' }}
                        />
                    </div>
                );

            case 'numbered':
                return (
                    <div className="flex gap-2 items-start w-full">
                        <span className="text-sm font-bold text-gray-400 pt-1 shrink-0 w-6 text-right">
                            {(() => {
                                // Find sequence number
                                let num = 1;
                                for (let i = 0; i < index; i++) {
                                    if (activeBlocks[i].type === 'numbered') num++;
                                }
                                return `${num}.`;
                            })()}
                        </span>
                        <AutoResizingTextarea
                            value={block.content || ''}
                            onChange={(e) => handleBlockUpdate(index, { content: e.target.value })}
                            rows={1}
                            className="flex-grow border-0 border-b border-dashed border-gray-200 focus:border-blue-500 focus:ring-0 outline-none text-sm py-1 bg-transparent resize-none overflow-hidden"
                            placeholder="Numbered item..."
                            style={{ minHeight: '32px' }}
                        />
                    </div>
                );

            case 'split-row':
                const cols = block.splitColumns || ['', ''];
                const symbol = block.splitSymbol || '-';
                return (
                    <div className="space-y-3 w-full bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        {/* Control header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Columns:</span>
                                <div className="flex gap-1">
                                    {[2, 3, 4, 5].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => {
                                                let newCols = [...cols];
                                                if (newCols.length < n) {
                                                    while (newCols.length < n) newCols.push('');
                                                } else if (newCols.length > n) {
                                                    newCols = newCols.slice(0, n);
                                                }
                                                handleBlockUpdate(index, { splitColumns: newCols });
                                            }}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${cols.length === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            Swal.fire({
                                                title: 'Custom Columns',
                                                text: 'Enter column count (up to 10):',
                                                input: 'number',
                                                inputValue: cols.length.toString(),
                                                showCancelButton: true,
                                                inputValidator: (val) => {
                                                    const n = parseInt(val);
                                                    if (isNaN(n) || n < 1 || n > 10) return 'Please enter a number between 1 and 10';
                                                    return null;
                                                }
                                            }).then(res => {
                                                if (res.isConfirmed) {
                                                    const n = parseInt(res.value);
                                                    let newCols = [...cols];
                                                    if (newCols.length < n) {
                                                        while (newCols.length < n) newCols.push('');
                                                    } else {
                                                        newCols = newCols.slice(0, n);
                                                    }
                                                    handleBlockUpdate(index, { splitColumns: newCols });
                                                }
                                            });
                                        }}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border bg-white text-gray-500 border-gray-200 hover:bg-gray-50 ${cols.length > 5 ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
                                    >
                                        Custom ({cols.length})
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Symbol:</span>
                                <select
                                    value={symbol}
                                    onChange={(e) => {
                                        const s = e.target.value;
                                        handleBlockUpdate(index, { splitSymbol: s });
                                    }}
                                    className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none font-bold"
                                >
                                    {AVAILABLE_SYMBOLS.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                {symbol === 'Custom Symbol' && (
                                    <input
                                        type="text"
                                        maxLength={5}
                                        value={block.customSymbol || ''}
                                        onChange={(e) => handleBlockUpdate(index, { customSymbol: e.target.value })}
                                        className="w-12 border rounded-lg px-2 py-1 text-xs text-center font-bold"
                                        placeholder="Char"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Input boxes */}
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                            {cols.map((val, cIdx) => (
                                <div key={cIdx} className="relative group/col">
                                    <span className="absolute top-1 left-2 text-[8px] font-bold text-gray-300 pointer-events-none">Col {cIdx + 1}</span>
                                    <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => {
                                            const newCols = [...cols];
                                            newCols[cIdx] = e.target.value;
                                            handleBlockUpdate(index, { splitColumns: newCols });
                                        }}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs pt-4 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none"
                                        placeholder={`Value...`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'multi-column':
                const mCols = block.multiColumns || ['', ''];
                return (
                    <div className="space-y-3 w-full bg-slate-50/30 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Multi-Column Layout</span>
                            <div className="flex gap-1">
                                {[2, 3, 4].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => {
                                            let newCols = [...mCols];
                                            if (newCols.length < n) {
                                                while (newCols.length < n) newCols.push('');
                                            } else {
                                                newCols = newCols.slice(0, n);
                                            }
                                            handleBlockUpdate(index, { multiColumns: newCols });
                                        }}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${mCols.length === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        {n} Cols
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${mCols.length}, minmax(0, 1fr))` }}>
                            {mCols.map((val, cIdx) => (
                                <AutoResizingTextarea
                                    key={cIdx}
                                    value={val}
                                    onChange={(e) => {
                                        const newCols = [...mCols];
                                        newCols[cIdx] = e.target.value;
                                        handleBlockUpdate(index, { multiColumns: newCols });
                                    }}
                                    rows={1}
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none resize-none overflow-hidden"
                                    placeholder={`Column ${cIdx + 1} content...`}
                                    style={{ minHeight: '40px' }}
                                />
                            ))}
                        </div>
                    </div>
                );

            case 'table':
                const tRows = block.tableRows || [['', ''], ['', '']];
                const rCount = tRows.length;
                const cCount = tRows[0]?.length || 2;
                return (
                    <div className="space-y-3 w-full bg-slate-50/30 p-3 rounded-xl border border-slate-100 overflow-x-auto">
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><TableIcon size={12}/> Table Editor</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const newRows = [...tRows, Array(cCount).fill('')];
                                        handleBlockUpdate(index, { tableRows: newRows });
                                    }}
                                    className="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-50 text-[10px] font-bold"
                                >
                                    + Row
                                </button>
                                <button
                                    onClick={() => {
                                        if (rCount <= 1) return;
                                        const newRows = tRows.slice(0, -1);
                                        handleBlockUpdate(index, { tableRows: newRows });
                                    }}
                                    className="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-50 text-[10px] font-bold text-red-600 disabled:opacity-50"
                                    disabled={rCount <= 1}
                                >
                                    - Row
                                </button>
                                <button
                                    onClick={() => {
                                        const newRows = tRows.map(row => [...row, '']);
                                        handleBlockUpdate(index, { tableRows: newRows });
                                    }}
                                    className="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-50 text-[10px] font-bold"
                                >
                                    + Col
                                </button>
                                <button
                                    onClick={() => {
                                        if (cCount <= 1) return;
                                        const newRows = tRows.map(row => row.slice(0, -1));
                                        handleBlockUpdate(index, { tableRows: newRows });
                                    }}
                                    className="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-50 text-[10px] font-bold text-red-600 disabled:opacity-50"
                                    disabled={cCount <= 1}
                                >
                                    - Col
                                </button>
                            </div>
                        </div>

                        <table className="border-collapse border border-gray-200 w-full min-w-[300px]">
                            <tbody>
                                {tRows.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        {row.map((cellVal, cIdx) => (
                                            <td key={cIdx} className="border border-gray-200 p-1">
                                                <input
                                                    type="text"
                                                    value={cellVal}
                                                    onChange={(e) => {
                                                        const newRows = tRows.map(r => [...r]);
                                                        newRows[rIdx][cIdx] = e.target.value;
                                                        handleBlockUpdate(index, { tableRows: newRows });
                                                    }}
                                                    className="w-full border-0 p-1.5 text-xs outline-none bg-transparent focus:bg-blue-50/50 rounded"
                                                    placeholder={`Cell...`}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );

            case 'image':
                return (
                    <div className="space-y-3 w-full bg-slate-50/30 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase border-b pb-2">
                            <ImageIcon size={12} /> Image Block
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                                type="text"
                                value={block.imageUrl || ''}
                                onChange={(e) => handleBlockUpdate(index, { imageUrl: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none"
                                placeholder="Image URL (http://... or data:image/...)"
                            />
                            <input
                                type="text"
                                value={block.imageAlt || ''}
                                onChange={(e) => handleBlockUpdate(index, { imageAlt: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none"
                                placeholder="Alt Text / Caption..."
                            />
                        </div>
                        {block.imageUrl && (
                            <div className="border rounded-xl overflow-hidden p-2 bg-white max-w-xs mx-auto">
                                <img src={block.imageUrl} alt={block.imageAlt || 'Preview'} className="max-w-full h-auto rounded" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                            </div>
                        )}
                    </div>
                );

            case 'formula':
                return (
                    <div className="flex gap-2 items-center w-full">
                        <span className="text-[10px] font-black text-violet-500 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1 select-none">Formula</span>
                        <input
                            type="text"
                            value={block.content || ''}
                            onChange={(e) => handleBlockUpdate(index, { content: e.target.value })}
                            className="flex-grow border-0 border-b border-dashed border-gray-200 focus:border-blue-500 focus:ring-0 outline-none text-sm font-mono py-1 bg-transparent italic"
                            placeholder="Write scientific or mathematical formula (e.g. E = mc²)"
                        />
                    </div>
                );

            case 'quote':
                return (
                    <div className="flex gap-2 items-start w-full border-l-4 border-gray-300 pl-3">
                        <QuoteIcon size={14} className="text-gray-400 mt-1.5 shrink-0" />
                        <AutoResizingTextarea
                            value={block.content || ''}
                            onChange={(e) => handleBlockUpdate(index, { content: e.target.value })}
                            rows={1}
                            className="flex-grow border-0 border-b border-dashed border-gray-200 focus:border-blue-500 focus:ring-0 outline-none text-sm py-1 bg-transparent italic text-gray-600 resize-none overflow-hidden"
                            placeholder="Quote text..."
                            style={{ minHeight: '32px' }}
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="border border-slate-100 rounded-xl shadow-sm bg-white">
            <div className="p-4 space-y-4">
                {activeBlocks.map((block, idx) => {
                    const isMenuOpen = activeMenuIdx === idx;
                    return (
                        <div
                            key={block.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            className={`flex gap-3 items-start group/row p-2 rounded-xl transition-all border ${draggedIdx === idx ? 'opacity-40 bg-slate-50 border-dashed' : 'border-transparent hover:bg-slate-50/50'}`}
                        >
                            {/* Drag handle */}
                            <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors p-1.5 pt-2 shrink-0">
                                <GripVertical size={16} />
                            </div>

                            {/* Block Content Editor */}
                            <div className="flex-grow min-w-0 self-center">
                                {renderBlockEditor(block, idx)}
                            </div>

                            {/* Block Marks Input */}
                            {showMarks && (
                                <div className="shrink-0 pt-0.5 self-center flex items-center gap-1">
                                    <input
                                        type="text"
                                        defaultValue={formatDisplayMark(block.marks)}
                                        key={`${block.id}-marks-${block.marks}`}
                                        onChange={(e) => {
                                            let val = e.target.value.trim();
                                            if (val === '0.5' || val === '.5' || val === '1/2') {
                                                e.target.value = '½';
                                                handleBlockUpdate(idx, { marks: 0.5 });
                                            } else if (val.endsWith('.5')) {
                                                const whole = val.slice(0, -2);
                                                if (/^\d+$/.test(whole)) {
                                                    const newVal = whole + '½';
                                                    e.target.value = newVal;
                                                    handleBlockUpdate(idx, { marks: parseInt(whole) + 0.5 });
                                                }
                                            }
                                        }}
                                        onBlur={(e) => {
                                            let valStr = e.target.value.trim();
                                            if (valStr === '0.5' || valStr === '.5' || valStr === '1/2') {
                                                valStr = '½';
                                            } else if (valStr.endsWith('.5')) {
                                                valStr = valStr.slice(0, -2) + '½';
                                            } else if (valStr.endsWith('0.5')) {
                                                valStr = valStr.slice(0, -3) + '½';
                                            } else if (valStr.endsWith('1/2')) {
                                                valStr = valStr.slice(0, -3) + '½';
                                            }
                                            e.target.value = valStr;
                                            const num = parseDisplayMark(valStr);
                                            handleBlockUpdate(idx, { marks: num });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        className="w-14 border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-center font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-50 bg-white"
                                        placeholder="Mark"
                                    />
                                </div>
                            )}

                            {/* Block Actions Dropdown */}
                            <div className="relative shrink-0 pt-0.5">
                                <button
                                    onClick={(e) => handleMenuClick(e, idx)}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all focus:outline-none"
                                    title="Block Menu"
                                >
                                    <Settings2 size={15} />
                                </button>
                                {isMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setActiveMenuIdx(null)} />
                                        <div className={`absolute right-0 ${openUpward ? 'bottom-full mb-2' : 'top-full mt-1'} w-44 bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in ${openUpward ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-150`}>
                                            <div className="px-2.5 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 mb-1 select-none">Block Actions</div>
                                            <button onClick={() => addBlock(block.type, idx, 'above')} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"><ArrowUp size={12}/> Add Above</button>
                                            <button onClick={() => addBlock(block.type, idx, 'below')} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"><ArrowDown size={12}/> Add Below</button>
                                            <button onClick={() => duplicateBlock(idx)} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Copy size={12}/> Duplicate</button>
                                            <button onClick={() => deleteBlock(idx)} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-bold"><Trash2 size={12}/> Delete</button>
                                            
                                            <div className="border-t border-slate-50 my-1"></div>
                                            <div className="px-2.5 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 select-none">Convert Type</div>
                                            <div className="grid grid-cols-2 gap-0.5 p-1">
                                                {(['paragraph', 'heading', 'bullet', 'numbered', 'split-row', 'multi-column', 'table', 'image', 'formula', 'quote'] as const).map(t => (
                                                    <button
                                                        key={t}
                                                        onClick={() => convertBlockType(idx, t)}
                                                        className={`px-1.5 py-1 rounded text-[10px] font-bold text-center capitalize transition-colors ${block.type === t ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}
                                                    >
                                                        {t.replace('-', ' ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Add Bar */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex flex-wrap gap-2 items-center justify-center rounded-b-xl">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1"><Plus size={10}/> Add Block:</span>
                {(['paragraph', 'heading', 'bullet', 'numbered', 'split-row', 'multi-column', 'table', 'image', 'formula', 'quote'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => addBlock(t, activeBlocks.length - 1, 'below')}
                        className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white border border-slate-200 rounded-lg text-[10px] font-bold shadow-sm transition-all active:scale-95 capitalize"
                    >
                        {t.replace('-', ' ')}
                    </button>
                ))}
            </div>
        </div>
    );
};

// Unified function to convert the block structure into styled HTML
export const convertAnswerBlocksToHtml = (blocks: AnswerBlock[]): string => {
    if (!blocks || blocks.length === 0) return '';

    const fmtMarksStr = (marks: number): string => {
        const s = marks.toString();
        if (s.endsWith('.5')) {
            const whole = s.split('.')[0];
            return whole === '0' ? '½' : `${whole}½`;
        }
        return s;
    };

    let numberedIndex = 1;

    return blocks.map(block => {
        let blockHtml = '';
        switch (block.type) {
            case 'heading':
                const hLevel = block.level || 2;
                blockHtml = `<h${hLevel} class="tamil-heading-font" style="margin-left: 0px; font-weight: bold; margin-top: 8px; margin-bottom: 6px;">${block.content || ''}</h${hLevel}>`;
                break;

            case 'paragraph':
                blockHtml = `<p class="tamil-font" style="margin-left: 8px; margin-top: 4px; margin-bottom: 4px; line-height: 1.6;">${block.content || ''}</p>`;
                break;

            case 'bullet':
                blockHtml = `
                    <div class="answer-bullet-row" style="display: flex; align-items: flex-start; margin-left: 8px; margin-top: 3px; margin-bottom: 3px; line-height: 1.6;">
                        <span class="answer-bullet-symbol" style="width: 8px; flex-shrink: 0; text-align: left; font-family: 'Times New Roman', serif !important;">${block.bulletSymbol || '▪'}</span>
                        <div class="answer-bullet-content tamil-font" style="flex-grow: 1; padding-left: 0px;">${block.content || ''}</div>
                    </div>
                `;
                break;

            case 'numbered':
                const num = numberedIndex++;
                blockHtml = `
                    <div class="answer-number-row" style="display: flex; align-items: flex-start; margin-left: 8px; margin-top: 3px; margin-bottom: 3px; line-height: 1.6;">
                        <span class="answer-number-symbol english-font" style="width: 16px; flex-shrink: 0; text-align: left; font-family: 'Times New Roman', serif !important;">${num}.</span>
                        <div class="answer-number-content tamil-font" style="flex-grow: 1; padding-left: 0px;">${block.content || ''}</div>
                    </div>
                `;
                break;

            case 'split-row':
                const cols = block.splitColumns || [];
                const sym = block.splitSymbol === 'Custom Symbol' ? (block.customSymbol || '-') : (block.splitSymbol || '-');
                blockHtml = `
                    <div class="answer-split-row" style="display: flex; align-items: flex-start; gap: 8px; margin-left: 8px; margin-top: 4px; margin-bottom: 4px; width: 100%; line-height: 1.6;">
                        ${cols.map((col, cIdx) => `
                            <div class="tamil-font" style="flex: 1; text-align: left;">${col}</div>
                            ${cIdx < cols.length - 1 ? `<span style="flex-shrink: 0; color: #666; font-family: 'Times New Roman', serif !important;">${sym}</span>` : ''}
                        `).join('')}
                    </div>
                `;
                break;

            case 'multi-column':
                const mCols = block.multiColumns || [];
                blockHtml = `
                    <div class="answer-multi-column" style="display: flex; gap: 12px; margin-left: 8px; margin-top: 4px; margin-bottom: 4px; width: 100%; line-height: 1.6;">
                        ${mCols.map(col => `
                            <div class="tamil-font" style="flex: 1; text-align: left;">${col}</div>
                        `).join('')}
                    </div>
                `;
                break;

            case 'table':
                const rows = block.tableRows || [];
                blockHtml = `
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-top: 6px; margin-bottom: 6px; margin-left: 8px; line-height: 1.6;">
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    ${row.map(cell => `
                                        <td class="tamil-font" style="border: 1px solid black; padding: 6px; vertical-align: top;">${cell}</td>
                                    `).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                break;

            case 'image':
                if (!block.imageUrl) return '';
                blockHtml = `
                    <div style="margin-left: 8px; margin-top: 8px; margin-bottom: 8px; text-align: center;">
                        <img src="${block.imageUrl}" alt="${block.imageAlt || ''}" style="max-width: 100%; height: auto; border-radius: 4px; display: inline-block;" />
                        ${block.imageAlt ? `<p class="tamil-font" style="font-size: 11px; color: #555; margin-top: 4px;">${block.imageAlt}</p>` : ''}
                    </div>
                `;
                break;

            case 'formula':
                blockHtml = `<div class="english-font" style="margin-left: 8px; margin-top: 4px; margin-bottom: 4px; font-family: 'Times New Roman', serif !important; font-style: italic; line-height: 1.4; font-size: 14px;">${block.content || ''}</div>`;
                break;

            case 'quote':
                blockHtml = `
                    <blockquote class="tamil-font" style="margin-left: 16px; border-left: 3px solid #ccc; padding-left: 8px; margin-top: 6px; margin-bottom: 6px; color: #555; font-style: italic; line-height: 1.6;">
                        ${block.content || ''}
                    </blockquote>
                `;
                break;

            default:
                break;
        }

        if (block.marks !== undefined && block.marks > 0) {
            return `
                <div class="answer-block-with-marks" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div style="flex-grow: 1; text-align: left; min-width: 0;">${blockHtml}</div>
                    <div class="english-font rubric-mark" style="font-weight: bold; flex-shrink: 0; text-align: right; min-width: 32px; font-family: 'Times New Roman', serif !important; padding-right: 4px; margin-top: 4px; line-height: 1.6;">${fmtMarksStr(block.marks)}</div>
                </div>
            `;
        }
        return blockHtml;
    }).join('');
};

const parseElementToBlocks = (el: Element, inheritedMarks?: number): AnswerBlock[] => {
    const id = () => Math.random().toString(36).substr(2, 9);
    const tagName = el.tagName.toLowerCase();

    // Check if it's the wrapper with marks
    if (el.classList.contains('answer-block-with-marks')) {
        const markEl = el.querySelector('.rubric-mark');
        const contentWrapper = el.firstElementChild;
        let marks: number | undefined = undefined;
        if (markEl) {
            const markText = markEl.textContent || '';
            if (markText === '½') {
                marks = 0.5;
            } else if (markText.endsWith('½')) {
                const whole = parseInt(markText.slice(0, -1)) || 0;
                marks = whole + 0.5;
            } else {
                const val = parseFloat(markText);
                if (!isNaN(val)) marks = val;
            }
        }
        if (contentWrapper && contentWrapper.firstElementChild) {
            return parseElementToBlocks(contentWrapper.firstElementChild, marks);
        }
    }

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
        const level = tagName === 'h1' ? 1 : (tagName === 'h2' ? 2 : 3);
        return [{
            id: id(),
            type: 'heading',
            level: level as 1 | 2 | 3,
            content: el.textContent || '',
            marks: inheritedMarks
        }];
    }

    if (tagName === 'p') {
        return [{
            id: id(),
            type: 'paragraph',
            content: el.textContent || '',
            marks: inheritedMarks
        }];
    }

    if (tagName === 'blockquote') {
        return [{
            id: id(),
            type: 'quote',
            content: el.textContent?.trim() || '',
            marks: inheritedMarks
        }];
    }

    if (tagName === 'table') {
        const rows: string[][] = [];
        el.querySelectorAll('tr').forEach(tr => {
            const row: string[] = [];
            tr.querySelectorAll('td, th').forEach(td => {
                row.push(td.textContent || '');
            });
            if (row.length > 0) rows.push(row);
        });
        return [{
            id: id(),
            type: 'table',
            tableRows: rows.length > 0 ? rows : [['', ''], ['', '']],
            marks: inheritedMarks
        }];
    }

    if (el.classList.contains('answer-bullet-row')) {
        const symbolEl = el.querySelector('.answer-bullet-symbol');
        const contentEl = el.querySelector('.answer-bullet-content');
        return [{
            id: id(),
            type: 'bullet',
            bulletSymbol: symbolEl?.textContent || '▪',
            content: contentEl?.textContent || '',
            marks: inheritedMarks
        }];
    }

    if (el.classList.contains('answer-number-row')) {
        const contentEl = el.querySelector('.answer-number-content');
        return [{
            id: id(),
            type: 'numbered',
            content: contentEl?.textContent || '',
            marks: inheritedMarks
        }];
    }

    if (tagName === 'ul') {
        const blocks: AnswerBlock[] = [];
        el.querySelectorAll('li').forEach((li, liIdx) => {
            blocks.push({
                id: id(),
                type: 'bullet',
                bulletSymbol: '▪',
                content: li.textContent || '',
                marks: liIdx === 0 ? inheritedMarks : undefined
            });
        });
        if (blocks.length === 0) {
            blocks.push({ id: id(), type: 'bullet', bulletSymbol: '▪', content: '', marks: inheritedMarks });
        }
        return blocks;
    }

    if (tagName === 'ol') {
        const blocks: AnswerBlock[] = [];
        el.querySelectorAll('li').forEach((li, liIdx) => {
            blocks.push({
                id: id(),
                type: 'numbered',
                content: li.textContent || '',
                marks: liIdx === 0 ? inheritedMarks : undefined
            });
        });
        if (blocks.length === 0) {
            blocks.push({ id: id(), type: 'numbered', content: '', marks: inheritedMarks });
        }
        return blocks;
    }

    if (tagName === 'li') {
        return [{
            id: id(),
            type: 'bullet',
            bulletSymbol: '▪',
            content: el.textContent || '',
            marks: inheritedMarks
        }];
    }

    if (el.classList.contains('answer-split-row')) {
        const cols: string[] = [];
        let symbol = '-';
        
        Array.from(el.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                cols.push((node as Element).textContent || '');
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent?.trim();
                if (text) symbol = text;
            }
        });

        return [{
            id: id(),
            type: 'split-row',
            splitColumns: cols,
            splitSymbol: symbol === '-' ? '-' : 'Custom Symbol',
            customSymbol: symbol !== '-' ? symbol : undefined,
            marks: inheritedMarks
        }];
    }

    if (el.classList.contains('answer-multi-column')) {
        const cols: string[] = [];
        el.querySelectorAll('div').forEach(div => {
            cols.push(div.textContent || '');
        });
        return [{
            id: id(),
            type: 'multi-column',
            multiColumns: cols,
            marks: inheritedMarks
        }];
    }

    if (el.classList.contains('english-font') && el.getAttribute('style')?.includes('font-style: italic')) {
        return [{
            id: id(),
            type: 'formula',
            content: el.textContent || '',
            marks: inheritedMarks
        }];
    }

    const img = el.querySelector('img') || (tagName === 'img' ? el : null);
    if (img) {
        return [{
            id: id(),
            type: 'image',
            imageUrl: img.getAttribute('src') || '',
            imageAlt: img.getAttribute('alt') || '',
            marks: inheritedMarks
        }];
    }

    if (el.textContent?.trim()) {
        return [{
            id: id(),
            type: 'paragraph',
            content: el.textContent || '',
            marks: inheritedMarks
        }];
    }

    return [];
};

export const convertHtmlToAnswerBlocks = (html: string, placeholder: string): AnswerBlock[] => {
    if (!html || !html.trim()) {
        return [
            { id: Math.random().toString(36).substr(2, 9), type: 'paragraph', content: '' }
        ];
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const body = doc.body;
        const blocks: AnswerBlock[] = [];

        const nodes = Array.from(body.childNodes);
        if (nodes.length === 0) {
            return [{ id: Math.random().toString(36).substr(2, 9), type: 'paragraph', content: '' }];
        }

        nodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element;
                const parsedBlocks = parseElementToBlocks(el);
                blocks.push(...parsedBlocks);
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                if (text.trim()) {
                    blocks.push({
                        id: Math.random().toString(36).substr(2, 9),
                        type: 'paragraph',
                        content: text.trim()
                    });
                }
            }
        });

        return blocks.length > 0 ? blocks : [{ id: Math.random().toString(36).substr(2, 9), type: 'paragraph', content: '' }];
    } catch (e) {
        console.error('Failed to parse html to blocks:', e);
        return [{ id: Math.random().toString(36).substr(2, 9), type: 'paragraph', content: '' }];
    }
};
