import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { runTamilGrammarCheck, WordAnalysis } from '../utils/tamilChecker';
import { checkTamilSpelling, addTamilWord } from '../services/db';
import { Sparkles, Check, Plus, AlertCircle, X } from 'lucide-react';
import DOMPurify from 'dompurify';
import Swal from 'sweetalert2';

// Helper to extract plain text from contentEditable DOM preserving trailing spaces and converting newlines properly
const getRawTextFromElement = (element: HTMLElement): string => {
  let text = "";
  const traverse = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'br') {
        text += '\n';
      } else if (tagName === 'p' || tagName === 'div' || tagName === 'tr' || tagName === 'li') {
        if (text && !text.endsWith('\n')) {
          text += '\n';
        }
        for (let i = 0; i < node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
        }
        if (!text.endsWith('\n')) {
          text += '\n';
        }
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
        }
      }
    }
  };
  for (let i = 0; i < element.childNodes.length; i++) {
    traverse(element.childNodes[i]);
  }

  // Find if the last active leaf node in the DOM is a <br>
  const getLastActiveNode = (n: Node): Node | null => {
    if (n.nodeType === Node.TEXT_NODE) {
      return n.nodeValue ? n : null;
    }
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      if (el.tagName.toLowerCase() === 'br') {
        return el;
      }
      for (let i = el.childNodes.length - 1; i >= 0; i--) {
        const active = getLastActiveNode(el.childNodes[i]);
        if (active) return active;
      }
    }
    return null;
  };

  const lastActive = getLastActiveNode(element);
  if (lastActive && lastActive.nodeType === Node.ELEMENT_NODE && (lastActive as HTMLElement).tagName.toLowerCase() === 'br') {
    if (text.endsWith('\n')) {
      text = text.slice(0, -1);
    }
  }

  // Normalize non-breaking spaces to standard spaces for consistency in state
  return text.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');
};

// Helper to normalize HTML for comparison, avoiding carets jumping due to space character formats
const normalizeHtmlForComparison = (html: string): string => {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/div>/g, '')
    .replace(/<div>/g, '\n')
    .replace(/<\/p>/g, '')
    .replace(/<p>/g, '\n');
};

interface GrammarHighlightEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  isAnswerField?: boolean;
  returnPlainText?: boolean;
}

interface TooltipState {
  word: string;
  type: 'grammar-add' | 'grammar-del' | 'grammar-error' | 'spelling-error';
  suggestion?: string;
  reasons: string[];
  x: number;
  y: number;
  visible: boolean;
  wordIndex: number;
  positionAbove: boolean;
}

export const GrammarHighlightEditor = forwardRef<HTMLDivElement, GrammarHighlightEditorProps & React.HTMLAttributes<HTMLDivElement>>(({
  value,
  onChange,
  placeholder = "உள்ளிடவும் (Type here)...",
  className = "",
  style = {},
  isAnswerField = false,
  returnPlainText = false,
  ...restProps
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  
  useImperativeHandle(ref, () => editorRef.current as HTMLDivElement);

  const [misspelled, setMisspelled] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState>({
    word: '',
    type: 'grammar-add',
    reasons: [],
    x: 0,
    y: 0,
    visible: false,
    wordIndex: -1,
    positionAbove: false
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
      if (spellingTimeout.current) clearTimeout(spellingTimeout.current);
    };
  }, []);

  const isCheckingSpelling = useRef(false);
  const spellingTimeout = useRef<NodeJS.Timeout | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Caret save/restore utilities
  const getCaretCharacterOffsetWithin = (element: HTMLElement): number => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    const targetNode = range.startContainer;
    const targetOffset = range.startOffset;

    if (!element.contains(targetNode)) return 0;

    let text = "";
    let caretIndex = -1;

    const traverse = (node: Node) => {
      if (node === targetNode && node.nodeType === Node.TEXT_NODE) {
        caretIndex = text.length + targetOffset;
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        text += node.nodeValue || "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'br') {
          if (node === targetNode && targetOffset === 0) {
            caretIndex = text.length;
          }
          text += '\n';
        } else if (tagName === 'p' || tagName === 'div' || tagName === 'tr' || tagName === 'li') {
          if (text && !text.endsWith('\n')) {
            text += '\n';
          }
          
          for (let i = 0; i < node.childNodes.length; i++) {
            if (node === targetNode && i === targetOffset) {
              caretIndex = text.length;
            }
            traverse(node.childNodes[i]);
          }
          
          if (node === targetNode && targetOffset === node.childNodes.length) {
            caretIndex = text.length;
          }

          if (!text.endsWith('\n')) {
            text += '\n';
          }
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            if (node === targetNode && i === targetOffset) {
              caretIndex = text.length;
            }
            traverse(node.childNodes[i]);
          }
          if (node === targetNode && targetOffset === node.childNodes.length) {
            caretIndex = text.length;
          }
        }
      }
    };

    for (let i = 0; i < element.childNodes.length; i++) {
      if (element === targetNode && i === targetOffset) {
        caretIndex = text.length;
      }
      traverse(element.childNodes[i]);
    }
    if (element === targetNode && targetOffset === element.childNodes.length) {
      caretIndex = text.length;
    }

    return caretIndex !== -1 ? caretIndex : text.length;
  };

  const setCaretPosition = (element: HTMLElement, offset: number) => {
    const range = document.createRange();
    const sel = window.getSelection();
    if (!sel) return;

    let text = "";
    let targetNode: Node | null = null;
    let nodeOffset = 0;
    let found = false;

    const setFound = (node: Node, o: number) => {
      targetNode = node;
      nodeOffset = o;
      found = true;
    };

    const traverse = (node: Node) => {
      if (found) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.nodeValue?.length || 0;
        if (offset >= text.length && offset <= text.length + len) {
          setFound(node, offset - text.length);
          return;
        }
        text += node.nodeValue || "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'br') {
          if (offset === text.length) {
            const parent = node.parentNode;
            if (parent) {
              const idx = Array.prototype.indexOf.call(parent.childNodes, node);
              setFound(parent, idx);
              return;
            }
          }
          text += '\n';
          if (offset === text.length && !found) {
            const parent = node.parentNode;
            if (parent) {
              const idx = Array.prototype.indexOf.call(parent.childNodes, node);
              setFound(parent, idx + 1);
              return;
            }
          }
        } else if (tagName === 'p' || tagName === 'div' || tagName === 'tr' || tagName === 'li') {
          if (text && !text.endsWith('\n')) {
            if (offset === text.length) {
              setFound(node, 0);
              return;
            }
            text += '\n';
          }

          for (let i = 0; i < node.childNodes.length; i++) {
            traverse(node.childNodes[i]);
            if (found) return;
          }

          if (!text.endsWith('\n')) {
            if (offset === text.length) {
              const parent = node.parentNode;
              if (parent) {
                const idx = Array.prototype.indexOf.call(parent.childNodes, node);
                setFound(parent, idx + 1);
                return;
              }
            }
            text += '\n';
          }
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            traverse(node.childNodes[i]);
            if (found) return;
          }
        }
      }
    };

    for (let i = 0; i < element.childNodes.length; i++) {
      traverse(element.childNodes[i]);
      if (found) break;
    }

    if (targetNode) {
      try {
        range.setStart(targetNode, nodeOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (err) {
        console.warn('Failed to restore caret position', err);
      }
    } else {
      // Fallback: place caret at the end
      try {
        range.selectNodeContents(element);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {}
    }
  };

  const highlightTimeout = useRef<NodeJS.Timeout | null>(null);

  const triggerHighlight = (text: string, currentMisspelled: string[], immediate = false) => {
    if (highlightTimeout.current) clearTimeout(highlightTimeout.current);

    // Memory management: for larger text, force debounced execution to prevent UI locks
    const isLargeText = text.length > 3000;
    const isExtremelyLargeText = text.length > 15000;
    
    // Determine debounce delay based on text size
    let debounceDelay = 400;
    if (isExtremelyLargeText) {
      debounceDelay = 1500; // Increase to 1.5s pause guard for large texts
    } else if (isLargeText) {
      debounceDelay = 800;  // 800ms for medium-large texts
    }

    const shouldForceDebounce = isLargeText;

    const run = () => {
      if (!editorRef.current) return;

      // Memory Management: If text is extremely large, only run grammar check on a safe chunk size
      let checkedText = text;
      if (text.length > 25000) {
        checkedText = text.substring(0, 25000);
      }

      const caretOffset = getCaretCharacterOffsetWithin(editorRef.current);
      const highlighted = highlightContent(checkedText, currentMisspelled, text.length > 25000 ? text : undefined);

      // Since highlightContent now escapes unsafe tags internally, we don't need DOMPurify here.
      // This saves massive CPU and memory allocations during editing!
      const normCurrent = normalizeHtmlForComparison(editorRef.current.innerHTML);
      const normNew = normalizeHtmlForComparison(highlighted);

      if (normCurrent !== normNew) {
        editorRef.current.innerHTML = highlighted;
        setCaretPosition(editorRef.current, caretOffset);
      }
    };

    if (immediate && !shouldForceDebounce) {
      run();
    } else {
      highlightTimeout.current = setTimeout(run, debounceDelay);
    }
  };

  // Run SQLite-based spelling check asynchronously (debounced)
  const triggerSpellingCheck = (text: string) => {
    if (spellingTimeout.current) clearTimeout(spellingTimeout.current);
    
    // Strip HTML to get plain text, normalising space symbols
    const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/[\u00a0]/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (!cleanText) {
      setMisspelled([]);
      return;
    }

    spellingTimeout.current = setTimeout(async () => {
      if (isCheckingSpelling.current) return;
      isCheckingSpelling.current = true;
      try {
        // Memory management: limit spelling check query size
        let queryText = cleanText;
        if (cleanText.length > 20000) {
          queryText = cleanText.substring(0, 20000);
        }
        const errors = await checkTamilSpelling(queryText);
        setMisspelled(errors);
      } catch (err) {
        console.error('Failed checking spelling against SQLite:', err);
      } finally {
        isCheckingSpelling.current = false;
      }
    }, cleanText.length > 10000 ? 1500 : 600); // Dynamic spelling check debounce
  };

  // Re-run highlighting of spelling & grammar issues in real-time
  const highlightContent = (text: string, currentMisspelled: string[], fullText?: string): string => {
    if (!text) return "";

    const escapeHtml = (unsafe: string): string => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    // Split text into tokens keeping spaces (including non-breaking spaces) and newlines
    const tokens = text.split(/([ \t\u00a0]+|\n|\r)/);
    
    // Extract non-empty, non-whitespace words for grammar check
    const wordsOnly = tokens.filter(t => t.trim().replace(/\u00a0/g, '').length > 0);
    
    // If no words, just return original text with standard newline tags
    if (wordsOnly.length === 0) {
      let html = escapeHtml(text).replace(/ /g, '\u00a0').replace(/\n/g, '<br/>');
      if (text.endsWith('\n')) {
        html += '<br/>';
      }
      return html;
    }

    const grammarResults = runTamilGrammarCheck(text);
    
    let resultHTML = "";
    let wordIdx = 0;

    tokens.forEach(token => {
      if (token === '\n' || token === '\r') {
        resultHTML += '<br/>';
      } else if (/^[ \t\u00a0]+$/.test(token)) {
        // Convert all standard spaces to non-breaking spaces to avoid browser collapsing trailing/multiple spaces
        resultHTML += token.replace(/ /g, '\u00a0');
      } else if (token.length > 0) {
        // It's a word
        const res = grammarResults[wordIdx];
        wordIdx++;
        
        if (res) {
          const isWordMisspelled = currentMisspelled.includes(res.cleaned);
          let classes = '';
          const escapedOriginal = escapeHtml(res.original);
          let dataset = `data-word="${escapedOriginal}" data-index="${res.index}"`;

          if (res.status !== 'correct') {
            if (res.status === 'grammar-error') {
              classes = 'tamil-usage-highlight text-blue-600 font-bold border-b-2 border-blue-500 cursor-pointer bg-blue-50/50 px-0.5 rounded';
            } else {
              classes = 'tamil-grammar-highlight text-emerald-600 font-bold border-b-2 border-emerald-500 cursor-pointer bg-emerald-50/50 px-0.5 rounded';
            }
            dataset += ` data-type="${res.status}" data-suggestion="${escapeHtml(res.suggestion || '')}" data-reasons="${encodeURIComponent(res.reasons.join('|'))}"`;
          } else if (isWordMisspelled) {
            classes = 'tamil-spelling-highlight text-rose-600 font-bold border-b-2 border-rose-500 cursor-pointer bg-rose-50/50 px-0.5 rounded';
            dataset += ` data-type="spelling-error"`;
          }

          if (classes) {
            resultHTML += `<span class="${classes}" ${dataset}>${escapedOriginal}</span>`;
          } else {
            resultHTML += escapedOriginal;
          }
        } else {
          resultHTML += escapeHtml(token);
        }
      }
    });

    if (text.endsWith('\n')) {
      resultHTML += '<br/>';
    }

    // If we chunked the text, append the remaining text as plain escaped text
    if (fullText && fullText.length > text.length) {
      const remainingText = fullText.substring(text.length);
      resultHTML += escapeHtml(remainingText).replace(/ /g, '\u00a0').replace(/\n/g, '<br/>');
    }

    return resultHTML;
  };

  // First sync
  useEffect(() => {
    if (editorRef.current) {
      const cleanInput = DOMPurify.sanitize(value || '');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanInput;
      const rawText = getRawTextFromElement(tempDiv);
      
      editorRef.current.innerHTML = cleanInput;
      triggerSpellingCheck(rawText);
      triggerHighlight(rawText, misspelled, true);
    }
  }, []);

  // Update editor when value changes externally (and not focused)
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      const cleanInput = DOMPurify.sanitize(value || '');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanInput;
      const rawText = getRawTextFromElement(tempDiv);
      
      editorRef.current.innerHTML = cleanInput;
      triggerSpellingCheck(rawText);
      triggerHighlight(rawText, misspelled, true);
    }
  }, [value]);

  // Re-run highlight when misspelled words update
  useEffect(() => {
    if (!editorRef.current) return;
    const rawText = getRawTextFromElement(editorRef.current);
    if (!rawText.trim()) return;
    triggerHighlight(rawText, misspelled, true);
  }, [misspelled]);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!tooltip.visible) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const tooltipElement = document.getElementById('tamil-editor-tooltip');
      if (tooltipElement && tooltipElement.contains(e.target as Node)) {
        return;
      }
      
      const target = e.target as HTMLElement;
      if (target.classList.contains('tamil-spelling-highlight') || target.classList.contains('tamil-grammar-highlight') || target.classList.contains('tamil-usage-highlight')) {
        return;
      }

      setTooltip(prev => ({ ...prev, visible: false }));
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [tooltip.visible]);

  const handleInput = () => {
    if (!editorRef.current) return;
    const rawHTML = editorRef.current.innerHTML;
    const rawText = getRawTextFromElement(editorRef.current);
    
    // Run spelling check on input (debounced)
    triggerSpellingCheck(rawText);

    // Trigger visual highlight update (debounced)
    triggerHighlight(rawText, misspelled, false);

    // Standard sanitize and pass changes to parent
    const cleanHTML = DOMPurify.sanitize(rawHTML, {
      ADD_TAGS: ['span', 'br', 'b', 'i', 'u', 'table', 'tbody', 'tr', 'td', 'th', 'p', 'ul', 'ol', 'li', 'img'],
      ADD_ATTR: ['class', 'style', 'data-word', 'data-index', 'data-type', 'data-suggestion', 'data-reasons', 'src', 'alt']
    });
    
    if (returnPlainText) {
      onChange(rawText);
    } else {
      onChange(cleanHTML);
    }
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    // Check if clicked a highlighted element
    const isSpelling = target.classList.contains('tamil-spelling-highlight');
    const isGrammar = target.classList.contains('tamil-grammar-highlight');
    const isUsage = target.classList.contains('tamil-usage-highlight');

    if (isSpelling || isGrammar || isUsage) {
      e.stopPropagation();
      
      const rect = target.getBoundingClientRect();
      
      // Calculate coordinates relative to document (to escape overflow: hidden parents via Portal)
      const tooltipWidth = 288; // w-72 is 288px
      const margin = 16;
      let x = rect.left + window.scrollX;
      
      // Keep within horizontal boundaries
      const maxAvailableX = window.innerWidth + window.scrollX - tooltipWidth - margin;
      if (x > maxAvailableX) {
        x = Math.max(margin, maxAvailableX);
      }

      // Check if there is enough space below the viewport
      const spaceBelow = window.innerHeight - rect.bottom;
      const estimatedHeight = 220; // approximate height of the tooltip including suggestions
      const positionAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

      const y = positionAbove 
        ? rect.top + window.scrollY 
        : rect.bottom + window.scrollY;

      const type = target.getAttribute('data-type') as any;
      const word = target.getAttribute('data-word') || target.innerText;
      const suggestion = target.getAttribute('data-suggestion') || undefined;
      const index = parseInt(target.getAttribute('data-index') || '-1');
      
      const reasonsRaw = target.getAttribute('data-reasons') || '';
      const reasons = reasonsRaw ? decodeURIComponent(reasonsRaw).split('|') : [];

      setTooltip({
        word,
        type,
        suggestion,
        reasons,
        x,
        y,
        visible: true,
        wordIndex: index,
        positionAbove
      });
    } else {
      setTooltip(prev => ({ ...prev, visible: false }));
    }
  };

  // Action: Apply sandhi correction
  const applyCorrection = () => {
    if (!editorRef.current || !tooltip.suggestion) return;

    const rawText = getRawTextFromElement(editorRef.current);
    const words = rawText.trim().split(/\s+/);
    
    if (tooltip.wordIndex >= 0 && tooltip.wordIndex < words.length) {
      words[tooltip.wordIndex] = tooltip.suggestion;
      const updatedText = words.join(' ');
      
      editorRef.current.innerHTML = updatedText;
      handleInput();
      setTooltip(prev => ({ ...prev, visible: false }));
    }
  };

  // Action: Add word to SQLite spelling dictionary
  const addToDictionary = async () => {
    const wordToAdd = tooltip.word;
    if (!wordToAdd) return;

    try {
      const result = await addTamilWord(wordToAdd);
      if (result.success) {
        // Remove both raw clicked word and cleaned backend word from local misspelled state to update highlights instantly
        const cleanWord = result.word;
        setMisspelled(prev => prev.filter(w => w !== wordToAdd && w !== cleanWord));
        setTooltip(prev => ({ ...prev, visible: false }));
        
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `"${cleanWord}" அகராதியில் சேர்க்கப்பட்டது.`,
          showConfirmButton: false,
          timer: 2000
        });
      }
    } catch (err) {
      console.error('Failed to add word to dictionary:', err);
      Swal.fire({
        icon: 'error',
        title: 'தோல்வி',
        text: 'அகராதியில் சேர்க்கும் போது பிழை ஏற்பட்டது.',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  return (
    <div className="relative w-full">
      <style dangerouslySetInnerHTML={{ __html: `
        .tamil-grammar-highlight {
          color: #059669 !important;
          font-weight: bold !important;
          border-bottom: 2px solid #10b981 !important;
          background-color: rgba(16, 185, 129, 0.08) !important;
          cursor: pointer !important;
          padding: 0 2px !important;
          border-radius: 4px !important;
        }
        .tamil-usage-highlight {
          color: #2563eb !important;
          font-weight: bold !important;
          border-bottom: 2px solid #3b82f6 !important;
          background-color: rgba(59, 130, 246, 0.08) !important;
          cursor: pointer !important;
          padding: 0 2px !important;
          border-radius: 4px !important;
        }
        .tamil-spelling-highlight {
          color: #dc2626 !important;
          font-weight: bold !important;
          border-bottom: 2px dashed #ef4444 !important;
          background-color: rgba(239, 68, 68, 0.08) !important;
          cursor: pointer !important;
          padding: 0 2px !important;
          border-radius: 4px !important;
        }
      `}} />
      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={(e) => {
          handleInput();
          if (restProps.onInput) restProps.onInput(e as any);
        }}
        onBlur={(e) => {
          handleInput();
          if (restProps.onBlur) restProps.onBlur(e as any);
        }}
        onClick={(e) => {
          handleEditorClick(e);
          if (restProps.onClick) restProps.onClick(e);
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter' || e.key === '.' || e.key === '?' || e.key === '!') {
            setTimeout(() => {
              if (editorRef.current) {
                const textAfter = getRawTextFromElement(editorRef.current);
                // Memory management: only run immediate highlight on space/punctuation if text is small (< 3000 chars)
                const isSmall = textAfter.length < 3000;
                triggerHighlight(textAfter, misspelled, isSmall);
              }
            }, 0);
          }
          if (restProps.onKeyDown) restProps.onKeyDown(e as any);
        }}
        className={`w-full outline-none prose max-w-none text-sm leading-relaxed min-h-[50px] p-2 bg-transparent border-b border-dashed border-gray-200 focus:border-blue-500 focus:ring-0 resize-none ${className}`}
        style={{
          fontFamily: 'TAU-Paalai, serif',
          fontSize: '14px',
          ...style
        }}
        data-placeholder={placeholder}
        {...restProps}
      />

      {/* Real-time Validation Interactive Tooltip */}
      {tooltip.visible && mounted && document.body && createPortal(
        <div
          id="tamil-editor-tooltip"
          className="absolute z-[9999] bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-72 flex flex-col gap-3 transition-all animate-scale-in"
          style={{
            left: `${tooltip.x}px`,
            top: tooltip.positionAbove ? `${tooltip.y - 8}px` : `${tooltip.y + 8}px`,
            transform: tooltip.positionAbove ? 'translateY(-100%)' : 'none',
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b pb-2">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
              tooltip.type === 'spelling-error' 
                ? 'bg-rose-50 border-rose-200 text-rose-700' 
                : tooltip.type === 'grammar-error'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              {tooltip.type === 'spelling-error' 
                ? 'எழுத்துப் பிழை (Spelling)' 
                : tooltip.type === 'grammar-error'
                  ? 'மரபுப் பிழை (Usage)'
                  : 'இலக்கணப் பிழை (Grammar)'}
            </span>
            <button 
              onClick={() => setTooltip(prev => ({ ...prev, visible: false }))}
              className="text-gray-400 hover:text-gray-600 rounded-full p-0.5 hover:bg-gray-100 transition-colors cursor-pointer border-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* Details */}
          <div className="text-xs text-slate-700 leading-relaxed font-semibold">
            வார்த்தை: <span className="font-extrabold text-slate-900 font-serif">{tooltip.word}</span>
          </div>

          {/* Suggestions & Action Buttons */}
          {tooltip.type === 'spelling-error' ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-slate-500 italic">
                இந்த வார்த்தை அகராதியில் இல்லை. இது சரியான வார்த்தையெனில் அகராதியில் சேர்க்கலாம்.
              </p>
              <button
                onClick={addToDictionary}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer border-0"
              >
                <Plus size={14} /> Add to Dictionary
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tooltip.suggestion && (
                <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-100 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">பரிந்துரை (Suggestion):</span>
                  <span className="text-sm font-extrabold font-serif">{tooltip.suggestion}</span>
                </div>
              )}
              {tooltip.reasons.length > 0 && (
                <ul className="text-[10px] text-slate-500 list-disc pl-4 space-y-1 my-1">
                  {tooltip.reasons.map((r, idx) => (
                    <li key={idx} dangerouslySetInnerHTML={{ __html: r }} />
                  ))}
                </ul>
              )}
              {tooltip.suggestion && (
                <button
                  onClick={applyCorrection}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer border-0"
                >
                  <Check size={14} /> திருத்தவும் (Apply Suggestion)
                </button>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});

export default GrammarHighlightEditor;
