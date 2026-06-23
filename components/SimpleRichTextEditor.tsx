import React, { useState, useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Image, Table as TableIcon, Plus, Trash2, ListChecks, Sparkles, ClipboardPaste } from 'lucide-react';
import DOMPurify from 'dompurify';
import Swal from 'sweetalert2';
import { runSpellCheck, SpellCheckIssue } from '../services/db';
import GrammarHighlightEditor from './GrammarHighlightEditor';

const SimpleRichTextEditor = ({ value, onChange, placeholder, isAnswerTab = false, onToggleStructured }: any) => {
    const ref = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, visible: boolean, target: any }>({ x: 0, y: 0, visible: false, target: null });
    const [preservePasteFormat, setPreservePasteFormat] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('preservePasteFormat') !== 'false';
        }
        return true;
    });

    // Sync external value changes only when not focused to avoid cursor loss
    useEffect(() => {
        if (ref.current && document.activeElement !== ref.current) {
            const cleanHTML = DOMPurify.sanitize(value || '', {
                ADD_TAGS: ['table', 'tbody', 'tr', 'th', 'td', 'br', 'span', 'b', 'i', 'u', 'img', 'ul', 'ol', 'li', 'p'],
                ADD_ATTR: ['style', 'class', 'src', 'alt', 'width', 'height', 'border', 'padding', 'margin', 'id', 'contenteditable'],
            });
            if (ref.current.innerHTML !== cleanHTML) {
                ref.current.innerHTML = cleanHTML;
            }
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const handleInput = () => {
        if (ref.current) {
            const rawHTML = ref.current.innerHTML;
            const cleanHTML = DOMPurify.sanitize(rawHTML, {
                ADD_TAGS: ['table', 'tbody', 'tr', 'th', 'td', 'br', 'span', 'b', 'i', 'u', 'img', 'ul', 'ol', 'li', 'p'],
                ADD_ATTR: ['style', 'class', 'src', 'alt', 'width', 'height', 'border', 'padding', 'margin', 'id', 'contenteditable'],
            });
            onChange(cleanHTML);
        }
    };

    const tabCount = useRef(0);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            tabCount.current += 1;
            
            if (isAnswerTab && tabCount.current >= 3) {
                // Intelligently delete the spaces from previous tabs (4 spaces * 2 tabs = 8 spaces)
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const node = range.startContainer;
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent || '';
                        const offset = range.startOffset;
                        let count = 0;
                        // Count trailing spaces/nbsp up to 12
                        while (count < 12 && offset - 1 - count >= 0) {
                            const char = text[offset - 1 - count];
                            if (char === ' ' || char === '\u00a0') {
                                count++;
                            } else {
                                break;
                            }
                        }
                        if (count > 0) {
                            const delRange = document.createRange();
                            delRange.setStart(node, offset - count);
                            delRange.setEnd(node, offset);
                            selection.removeAllRanges();
                            selection.addRange(delRange);
                            document.execCommand('delete');
                        }
                    }
                }

                // Insert a right-aligned score marker for answers on the 3rd tab
                const markerId = `mark-${Date.now()}`;
                document.execCommand('insertHTML', false, `<span id="${markerId}" class="mark-indicator" contenteditable="true" data-type="mark-box"></span>`);
                
                setTimeout(() => {
                    const el = document.getElementById(markerId);
                    if (el) {
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(el);
                        range.collapse(false);
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                    }
                    handleInput(); 
                }, 0);
                
                tabCount.current = 0; 
            } else {
                // Insert standard 4 spaces for a Tab
                document.execCommand('insertHTML', false, '\u00a0\u00a0\u00a0\u00a0');
            }
            handleInput();
        } else if (e.key === '5' && ref.current) {
            // Check for 0.5 typing to auto-convert to ½
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.startContainer;
                const offset = range.startOffset;
                
                if (container.nodeType === Node.TEXT_NODE) {
                    const text = container.textContent || '';
                    const before = text.substring(0, offset);
                    if (before.endsWith('0.')) {
                        e.preventDefault();
                        // Delete the '0.'
                        const newRange = document.createRange();
                        newRange.setStart(container, offset - 2);
                        newRange.setEnd(container, offset);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                        document.execCommand('delete');
                        // Insert '½'
                        document.execCommand('insertText', false, '½');
                        handleInput();
                    }
                }
            }
        } else {
            // Reset tab count on any other key
            tabCount.current = 0;
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const cell = target.closest('td, th');
        const table = target.closest('table');

        if (table) {
            e.preventDefault();
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                visible: true,
                target: { cell, table }
            });
        }
    };

    const exec = (cmd: string, val?: string) => {
        document.execCommand(cmd, false, val);
        handleInput();
        ref.current?.focus();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        if (!preservePasteFormat) {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
            handleInput();
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'IMG') {
            e.preventDefault();
            e.stopPropagation();
            showImageResizeDialog(target as HTMLImageElement);
        }
    };

    const showImageResizeDialog = (img: HTMLImageElement) => {
        const currentWidth = img.style.width || img.getAttribute('width') || '';
        const currentHeight = img.style.height || img.getAttribute('height') || '';

        Swal.fire({
            title: 'படத்தின் அளவை மாற்று (Resize Image)',
            html: `
                <div style="text-align: left; display: flex; flex-direction: column; gap: 12px; font-family: sans-serif;">
                    <div>
                        <label style="font-size: 13px; font-weight: bold; color: #374151;">அகலம் (Width) - எ.கா: 300px அல்லது 50%:</label>
                        <input id="swal-img-width" class="swal2-input" style="width: 90%; margin: 6px 0;" placeholder="e.g. 300px, 100%, 50%" value="${currentWidth}">
                    </div>
                    <div>
                        <label style="font-size: 13px; font-weight: bold; color: #374151;">உயரம் (Height) - எ.கா: auto அல்லது 200px:</label>
                        <input id="swal-img-height" class="swal2-input" style="width: 90%; margin: 6px 0;" placeholder="e.g. auto, 200px" value="${currentHeight || 'auto'}">
                    </div>
                </div>
            `,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'சேமி (Save)',
            denyButtonText: 'படத்தை நீக்கு (Delete Image)',
            cancelButtonText: 'ரத்து செய் (Cancel)',
            confirmButtonColor: '#4f46e5',
            denyButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            preConfirm: () => {
                const w = (document.getElementById('swal-img-width') as HTMLInputElement).value.trim();
                const h = (document.getElementById('swal-img-height') as HTMLInputElement).value.trim();
                return { width: w, height: h };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const { width, height } = result.value;
                if (width) {
                    img.style.width = width;
                    img.setAttribute('width', width);
                } else {
                    img.style.width = '';
                    img.removeAttribute('width');
                }
                if (height) {
                    img.style.height = height;
                    img.setAttribute('height', height);
                } else {
                    img.style.height = '';
                    img.removeAttribute('height');
                }
                handleInput();
            } else if (result.isDenied) {
                img.remove();
                handleInput();
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'படம் நீக்கப்பட்டது.',
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        });
    };

    const handleImageUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    const dataUrl = reader.result as string;
                    const imgHtml = `<img src="${dataUrl}" style="max-width: 100%; height: auto; cursor: pointer; display: inline-block; margin: 8px 0;" alt="Uploaded Image" />`;
                    exec('insertHTML', imgHtml);
                    
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'படம் சேர்க்கப்பட்டது. அளவை மாற்ற படத்தின் மீது இருமுறை கிளிக் செய்யவும் (Double-click to resize).',
                        showConfirmButton: false,
                        timer: 4500
                    });
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleInsertTable = () => {
        const rows = prompt("Enter number of rows:", "3");
        const cols = prompt("Enter number of columns:", "2");
        if (rows && cols) {
            const r = parseInt(rows);
            const c = parseInt(cols);
            if (isNaN(r) || isNaN(c)) return;

            let tableHtml = '<table style="width:100%; border-collapse: collapse; border: 1px solid black; margin: 10px 0;">';
            for (let i = 0; i < r; i++) {
                tableHtml += '<tr>';
                for (let j = 0; j < c; j++) {
                    tableHtml += '<td style="border: 1px solid black; padding: 8px; min-width: 50px;">&nbsp;</td>';
                }
                tableHtml += '</tr>';
            }
            tableHtml += '</table><p>&nbsp;</p>';
            exec('insertHTML', tableHtml);
        }
    };

    // Table Customization Logic
    const addRow = (above: boolean) => {
        const { cell } = contextMenu.target;
        if (!cell) return;
        const row = cell.parentElement;
        const newRow = row.cloneNode(true);
        // Clear content in new row cells
        //@ts-ignore
        Array.from(newRow.cells).forEach((c: any) => c.innerHTML = '&nbsp;');
        if (above) row.before(newRow);
        else row.after(newRow);
        handleInput();
    };

    const addCol = (after: boolean) => {
        const { cell, table } = contextMenu.target;
        if (!cell || !table) return;
        const index = cell.cellIndex;
        //@ts-ignore
        Array.from(table.rows).forEach((row: any) => {
            const newCell = row.insertCell(after ? index + 1 : index);
            newCell.innerHTML = '&nbsp;';
            newCell.style.border = '1px solid black';
            newCell.style.padding = '8px';
            newCell.style.minWidth = '50px';
        });
        handleInput();
    };

    const deleteTablePart = (type: 'row' | 'col' | 'table') => {
        const { cell, table } = contextMenu.target;
        if (!table) return;
        if (type === 'table') {
            table.remove();
        } else if (type === 'row' && cell) {
            cell.parentElement.remove();
        } else if (type === 'col' && cell) {
            const index = cell.cellIndex;
            //@ts-ignore
            Array.from(table.rows).forEach((row: any) => row.deleteCell(index));
        }
        handleInput();
    };

    const handleSpellCheck = async () => {
        if (!ref.current) return;
        const text = ref.current.innerText || ref.current.textContent || '';
        if (!text.trim()) {
            Swal.fire({
                title: "உரை இல்லை (Empty Text)",
                text: "சரிபார்க்க உள்ளடக்கத்தை உள்ளிடவும். (Please enter text to check.)",
                icon: "warning",
                confirmButtonColor: "#4f46e5",
                confirmButtonText: "சரி"
            });
            return;
        }

        Swal.fire({
            title: 'பிழை திருத்தப்படுகிறது...',
            html: `
                <div class="flex flex-col items-center justify-center gap-3 py-4">
                    <div class="w-12 h-12 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin"></div>
                    <p class="text-gray-500 font-bold text-sm">AI உங்கள் தமிழைச் சரிபார்க்கிறது...</p>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const result = await runSpellCheck(text);
            Swal.close();

            if (!result || !result.issues || result.issues.length === 0) {
                Swal.fire({
                    title: "வாழ்த்துகள்!",
                    text: "எழுத்துப் பிழைகள் எதுவும் கண்டறியப்படவில்லை.",
                    icon: "success",
                    confirmButtonColor: "#4f46e5",
                    confirmButtonText: "சரி"
                });
                return;
            }

            showSpellCheckReview(result.issues);

        } catch (error) {
            console.error("Spell check failed:", error);
            Swal.fire({
                title: "தோல்வி",
                text: "பிழை திருத்துவதில் சிக்கல் ஏற்பட்டது. ஏபிஐ கீ சரியாக உள்ளதா என சரிபார்க்கவும்.",
                icon: "error",
                confirmButtonColor: "#ef4444",
                confirmButtonText: "சரி"
            });
        }
    };

    const showSpellCheckReview = (issues: SpellCheckIssue[]) => {
        let issuesHtml = `
            <div style="text-align: left; max-height: 400px; overflow-y: auto; padding-right: 8px;" class="custom-scrollbar">
                <p style="font-size: 13px; color: #4b5563; font-weight: 600; margin-bottom: 15px;">
                    கண்டறியப்பட்ட பிழைகள் கீழே பட்டியலிடப்பட்டுள்ளன. அவற்றை மாற்ற மாற்று பொத்தானை அழுத்தவும்:
                </p>
        `;

        issues.forEach((issue, idx) => {
            const badgeColor = 
                issue.type === 'spelling' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                issue.type === 'grammar' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-blue-50 text-blue-700 border-blue-200';
            
            const badgeLabel = 
                issue.type === 'spelling' ? 'எழுத்துப்பிழை (Spelling)' :
                issue.type === 'grammar' ? 'இலக்கணம் (Grammar)' :
                'ஐயம் (Uncertain)';

            issuesHtml += `
                <div style="display: flex; flex-direction: column; gap: 8px; padding: 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; margin-bottom: 12px; font-family: 'DM Sans', sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}">
                            ${badgeLabel}
                        </span>
                        <span style="font-size: 10px; font-weight: bold; color: #9ca3af; text-transform: uppercase;">
                            Confidence: ${issue.confidence}
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; margin-top: 4px;">
                        <span style="text-decoration: line-through; color: #ef4444; font-weight: bold; font-family: 'TAU-Paalai', serif;">${issue.source}</span>
                        <span style="color: #9ca3af;">&rarr;</span>
                        <span style="color: #10b981; font-weight: bold; font-family: 'TAU-Paalai', serif;">${issue.suggestion}</span>
                    </div>
                    <p style="font-size: 11px; color: #6b7280; margin: 2px 0 0 0; line-height: 1.4;">
                        <strong>விளக்கம் (Reason):</strong> ${issue.explanation}
                    </p>
                    <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                        <button
                            data-source="${encodeURIComponent(issue.source)}"
                            data-target="${encodeURIComponent(issue.suggestion)}"
                            class="spell-replace-btn px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-100 flex items-center gap-1 active:scale-95"
                        >
                            மாற்றுக (Replace)
                        </button>
                    </div>
                </div>
            `;
        });

        issuesHtml += `</div>`;

        Swal.fire({
            title: `<div style="font-family: var(--ap-display); font-size: 18px; font-weight: 800; color: #1e1b4b;">AI தமிழ் பிழை திருத்தி</div>`,
            html: issuesHtml,
            width: '500px',
            showConfirmButton: true,
            confirmButtonText: 'முடிந்தது (Done)',
            confirmButtonColor: '#4f46e5',
            customClass: {
                popup: 'rounded-[32px]'
            },
            didOpen: (popup) => {
                const buttons = popup.querySelectorAll('.spell-replace-btn');
                buttons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const source = decodeURIComponent(btn.getAttribute('data-source') || '');
                        const target = decodeURIComponent(btn.getAttribute('data-target') || '');
                        
                        if (source && target) {
                            applyReplacement(source, target);
                            btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                            btn.classList.add('bg-green-600', 'cursor-default');
                            btn.innerHTML = 'மாற்றப்பட்டது (Replaced ✓)';
                            btn.setAttribute('disabled', 'true');
                        }
                    });
                });
            }
        });
    };

    const applyReplacement = (source: string, target: string) => {
        if (ref.current) {
            let html = ref.current.innerHTML;
            const escapedSource = source.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(escapedSource, 'g');
            html = html.replace(regex, target);
            ref.current.innerHTML = html;
            handleInput();
        }
    };

    return (
        <div className="border rounded-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all relative">
            <div className="bg-gray-50 border-b p-1.5 flex flex-wrap gap-1 items-center">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="Bold"><Bold size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="Italic"><Italic size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="Underline"><Underline size={14} /></button>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="Bullet List"><List size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="Number List"><ListOrdered size={14} /></button>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleImageUpload(); }} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="Insert Image"><Image size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleInsertTable(); }} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="Insert Table (வழக்கமான அட்டவணை)"><TableIcon size={14} /></button>
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSpellCheck(); }}
                    className="p-1.5 px-3 hover:bg-violet-100 text-violet-700 rounded transition-all flex items-center gap-1.5 border border-violet-200 shadow-sm active:scale-95 group"
                    title="AI Spell Check (தமிழ் எழுத்துப் பிழை திருத்தி)"
                >
                    <Sparkles size={16} className="group-hover:animate-pulse text-violet-600" />
                    <span className="text-[11px] font-black whitespace-nowrap uppercase tracking-tighter">AI பிழை திருத்து</span>
                </button>
                
                <div className="w-px h-4 bg-gray-300 mx-1"></div>

                <button
                    type="button"
                    onClick={() => {
                        const newVal = !preservePasteFormat;
                        setPreservePasteFormat(newVal);
                        localStorage.setItem('preservePasteFormat', String(newVal));
                    }}
                    className={`p-1.5 px-2.5 rounded transition-all flex items-center gap-1.5 border text-xs font-bold active:scale-95 ${
                        preservePasteFormat 
                            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' 
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                    title={preservePasteFormat ? "வடிவமைப்பைத் தக்கவைக்கவும் (Preserve Formatting: ON)" : "வடிவமைப்பை நீக்கவும் (Preserve Formatting: OFF)"}
                >
                    <ClipboardPaste size={14} className={preservePasteFormat ? "text-blue-600" : "text-gray-400"} />
                    <span className="text-[11px] font-black whitespace-nowrap uppercase tracking-tighter">
                        {preservePasteFormat ? 'பார்மேட் ஆன்' : 'பார்மேட் ஆஃப்'}
                    </span>
                </button>

                <div className="w-px h-4 bg-gray-300 mx-1"></div>

                {isAnswerTab && (
                    <div className="flex items-center gap-0.5 px-1 py-0.5 bg-green-50 rounded border border-green-100 ml-1">
                        <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter mr-1 ml-1">Bullets:</span>
                        {['•', '▪', '➢', '➔', '✔', '★', '❖', '✅'].map(b => (
                            <button
                                key={b}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    const html = `<ul class="custom-bullet-list" style="list-style-type: '${b}';"><li style="padding-left: 0.2rem;">&nbsp;</li></ul>`;
                                    exec('insertHTML', html);
                                }}
                                className="w-6 h-6 flex items-center justify-center bg-white hover:bg-green-500 hover:text-white border border-gray-100 rounded text-xs transition-all active:scale-90"
                            >
                                {b}
                            </button>
                        ))}
                    </div>
                )}

                {isAnswerTab && (
                    <div className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider">
                        Tab Key enabled for marks
                    </div>
                )}
            </div>
            <GrammarHighlightEditor
                ref={ref}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="p-4 min-h-[150px] outline-none text-sm prose max-w-none editor-content tamil-font"
                onKeyDown={handleKeyDown}
                onContextMenu={handleContextMenu}
                onPaste={handlePaste}
                onDoubleClick={handleDoubleClick}
            />

            {/* Table Context Menu */}
            {contextMenu.visible && (
                <div
                    className="fixed z-[100] bg-white border shadow-2xl rounded-lg py-2 w-52 overflow-hidden"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 mb-1">Table Controls</div>
                    <button onClick={() => { addRow(true); setContextMenu(prev => ({ ...prev, visible: false })); }} className="w-full text-left px-4 py-2 text-xs hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Plus size={12} /> Add Row Above</button>
                    <button onClick={() => { addRow(false); setContextMenu(prev => ({ ...prev, visible: false })); }} className="w-full text-left px-4 py-2 text-xs hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Plus size={12} /> Add Row Below</button>
                    <button onClick={() => { addCol(false); setContextMenu(prev => ({ ...prev, visible: false })); }} className="w-full text-left px-4 py-2 text-xs hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Plus size={12} /> Add Column Left</button>
                    <button onClick={() => { addCol(true); setContextMenu(prev => ({ ...prev, visible: false })); }} className="w-full text-left px-4 py-2 text-xs hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Plus size={12} /> Add Column Right</button>
                    <div className="border-t my-1"></div>
                    <button
                        onClick={() => {
                            const { cell } = contextMenu.target;
                            if (cell) {
                                const isHeader = cell.tagName === 'TH';
                                const row = cell.parentElement;
                                //@ts-ignore
                                Array.from(row.cells).forEach((c: any) => {
                                    const newTag = isHeader ? 'td' : 'th';
                                    const newCell = document.createElement(newTag);
                                    newCell.innerHTML = c.innerHTML;
                                    newCell.style.cssText = c.style.cssText;
                                    if (!isHeader) {
                                        newCell.style.fontWeight = 'bold';
                                        newCell.style.backgroundColor = '#f3f4f6';
                                    } else {
                                        newCell.style.fontWeight = 'normal';
                                        newCell.style.backgroundColor = 'transparent';
                                    }
                                    c.replaceWith(newCell);
                                });
                                handleInput();
                            }
                            setContextMenu(prev => ({ ...prev, visible: false }));
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 flex items-center gap-2"
                    >
                        <Bold size={12} /> Toggle Header Row
                    </button>
                    <button
                        onClick={() => {
                            const { cell } = contextMenu.target;
                            if (cell) {
                                cell.style.backgroundColor = cell.style.backgroundColor === 'yellow' ? 'transparent' : 'yellow';
                                handleInput();
                            }
                            setContextMenu(prev => ({ ...prev, visible: false }));
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-yellow-50 flex items-center gap-2"
                    >
                        <div className="w-3 h-3 bg-yellow-400 border border-gray-300"></div> Highlight Cell (Yellow)
                    </button>
                    <div className="border-t my-1"></div>
                    <button onClick={() => { deleteTablePart('row'); setContextMenu(prev => ({ ...prev, visible: false })); }} className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={12} /> Delete Row</button>
                    <button onClick={() => { deleteTablePart('col'); setContextMenu(prev => ({ ...prev, visible: false })); }} className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={12} /> Delete Column</button>
                    <button onClick={() => { deleteTablePart('table'); setContextMenu(prev => ({ ...prev, visible: false })); }} className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2 font-bold"><Trash2 size={12} /> Delete Entire Table</button>
                </div>
            )}
        </div>
    );
};

export default SimpleRichTextEditor;
