import React from 'react';
import { Plus, Trash2, ListChecks } from 'lucide-react';
import { AnswerMark } from '../types';

interface StructuredAnswerEditorProps {
    value: AnswerMark[];
    onChange: (val: AnswerMark[]) => void;
    label?: string;
    placeholder?: string;
}

const normalizeMark = (val: string): string => {
    const trimmed = val.trim();
    if (!trimmed) return '';

    // Handle specific cases
    if (trimmed === '0.5' || trimmed === '.5' || trimmed === '1/2' || trimmed === '½') return '½';

    // Handle floating point numbers ending in .5
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
        if (num % 1 === 0.5) {
            const integerPart = Math.floor(num);
            return integerPart === 0 ? '½' : `${integerPart}½`;
        }
        return trimmed;
    }

    return trimmed;
};

const StructuredAnswerEditor = ({ value, onChange, label = "Answer", placeholder = "Answer point..." }: StructuredAnswerEditorProps) => {
    // Ensure we always have at least one row if empty, but don't force it if the user deleted all
    const answers = value;
    const [focusedIdx, setFocusedIdx] = React.useState<number | null>(null);
    const textareaRefs = React.useRef<(HTMLTextAreaElement | null)[]>([]);

    const bullets = ['•', '▪', '➢', '➔', '✔', '★', '❖', '✅'];

    const handleUpdate = (index: number, field: keyof AnswerMark, val: string) => {
        const newAnswers = [...answers].map(a => ({ ...a }));
        let finalizedVal = val;

        if (field === 'mark') {
            finalizedVal = normalizeMark(val);
        }

        newAnswers[index][field] = finalizedVal;
        onChange(newAnswers);
    };

    const addRow = () => {
        onChange([...answers, { answer: '', mark: '' }]);
    };

    const removeRow = (index: number) => {
        const newAnswers = [...answers];
        newAnswers.splice(index, 1);
        onChange(newAnswers);
    };

    const insertBullet = (bullet: string) => {
        if (focusedIdx === null || focusedIdx >= answers.length) return;
        
        const currentRef = textareaRefs.current[focusedIdx];
        if (!currentRef) return;

        const start = currentRef.selectionStart;
        const end = currentRef.selectionEnd;
        const text = currentRef.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        
        // If content is empty or we are at the start, just add the bullet followed by a space
        // Otherwise add space before if needed? Actually user usually wants it at start.
        const newVal = before + bullet + ' ' + after;
        
        handleUpdate(focusedIdx, 'answer', newVal);
        
        // Return focus and set cursor position after the bullet
        setTimeout(() => {
            currentRef.focus();
            const newPos = start + bullet.length + 1;
            currentRef.setSelectionRange(newPos, newPos);
        }, 0);
    };

    return (
        <div className="bg-white border-2 border-green-100 rounded-xl shadow-sm overflow-hidden animate-fade-in mb-4">
            <div className="bg-green-50/50 border-b border-green-100 px-4 py-3 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <h4 className="text-[13px] font-bold text-green-800 flex items-center gap-2">
                        <ListChecks size={18} className="text-green-600" />
                        {label}
                    </h4>
                    <div className="text-[10px] font-black text-green-700 bg-green-100 px-2.5 py-1 rounded-full uppercase tracking-widest border border-green-200">
                        Input Answer Mode
                    </div>
                </div>

                {/* Bullet Toolbar */}
                <div className="flex items-center gap-1.5 p-1 bg-white/80 rounded-lg border border-green-100 shadow-sm ml-auto">
                    <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter mr-1 ml-1">Bullets:</span>
                    {bullets.map(b => (
                        <button
                            key={b}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Don't lose focus
                                insertBullet(b);
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-white hover:bg-green-500 hover:text-white border border-gray-100 rounded shadow-sm text-sm transition-all active:scale-90"
                        >
                            {b}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-white">
                <div className="flex gap-2 mb-3 px-2 text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50 py-2 rounded-lg border border-gray-100">
                    <div className="w-8 text-center border-r shrink-0">Sl.No</div>
                    <div className="flex-[9] px-2 text-left">Answer Content</div>
                    <div className="flex-[1] text-center border-l shrink-0">Mark</div>
                    <div className="w-8 shrink-0"></div>
                </div>

                <div className="space-y-3">
                    {answers.map((ans, idx) => (
                        <div key={idx} className="flex gap-2 items-start group animate-slide-up" style={{ animationDelay: `${idx * 40}ms` }}>
                            <div className="w-8 h-10 shrink-0 flex items-center justify-center font-black text-xs text-green-600 bg-green-50/50 rounded-lg border border-green-100 transition-colors">
                                {idx + 1}
                            </div>
                            <div className="flex-[9]">
                                <textarea
                                    ref={el => { textareaRefs.current[idx] = el; }}
                                    rows={1}
                                    className={`w-full border-2 rounded-xl px-4 py-2.5 text-sm focus:border-green-400 focus:ring-4 focus:ring-green-50 outline-none transition-all placeholder:text-gray-300 tamil-font resize-none overflow-hidden ${focusedIdx === idx ? 'border-green-200 bg-green-50/10' : 'border-gray-100'}`}
                                    placeholder={placeholder}
                                    value={ans.answer}
                                    onFocus={(e) => {
                                        setFocusedIdx(idx);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onChange={(e) => {
                                        handleUpdate(idx, 'answer', e.target.value);
                                        // Auto-expand textarea
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                />
                            </div>
                            <div className="flex-[1] shrink-0">
                                <input
                                    className="w-full border-2 border-gray-100 rounded-xl px-2 py-2.5 text-sm text-center font-black focus:border-green-400 focus:ring-4 focus:ring-green-50 outline-none transition-all bg-gray-50/30 group-hover:bg-green-50/10 min-w-[50px]"
                                    placeholder="0.5"
                                    value={ans.mark}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        // Allow typing 0. before converting
                                        if (val === '0.' || val === '.') {
                                            const newAnswers = [...value].map(a => ({ ...a }));
                                            newAnswers[idx].mark = val;
                                            onChange(newAnswers);
                                        } else {
                                            handleUpdate(idx, 'mark', val);
                                        }
                                    }}
                                />
                            </div>
                            <div className="w-8 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                    onClick={() => removeRow(idx)}
                                    className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all active:scale-90"
                                    title="Delete row"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {answers.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl mb-4 bg-gray-50/30">
                        <ListChecks size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-xs font-medium">No points added. Click below to add the first answer point.</p>
                    </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3">
                    <button
                        onClick={addRow}
                        className="w-full py-3.5 border-2 border-dashed border-green-200 rounded-2xl text-[11px] font-black text-green-600 hover:text-green-700 hover:border-green-400 hover:bg-green-50/50 transition-all flex items-center justify-center gap-2 group active:scale-[0.99]"
                    >
                        <div className="bg-green-100 group-hover:bg-green-600 group-hover:text-white p-1 rounded-full transition-all">
                            <Plus size={14} />
                        </div>
                        ADD NEW ANSWER POINT
                    </button>
                    <div className="flex items-center justify-center gap-3">
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StructuredAnswerEditor;
