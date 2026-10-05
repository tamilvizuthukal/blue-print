import React, { useEffect, useRef, useState } from 'react';
import { Download, Printer, Save, Undo, Redo, Bold, Italic, Underline, Type as TypeIcon, Image as ImageIcon, Minus, Plus, AlignLeft, AlignCenter, AlignRight, AlignJustify, Trash2, ArrowLeftRight, Eye } from 'lucide-react';
import Swal from 'sweetalert2';

interface PaginatedA4EditorProps {
    initialHtml: string;
    onSave: (html: string) => void;
    title: string;
    paperCode?: string;
}

const fonts = [
    { name: 'TAU-Paalai', label: 'TAU-Paalai' },
    { name: 'TAU-Urai', label: 'TAU-Urai' },
    { name: 'Times New Roman', label: 'Times New Roman' },
    { name: 'Arial', label: 'Arial' },
    { name: 'Georgia', label: 'Georgia' }
];

const editorStyles = `
    .a4-document-editor {
        width: 210mm;
        min-height: 297mm;
        padding: 20mm 15mm 18mm 15mm;
        background-color: white;
        background-image: linear-gradient(to bottom, transparent 296.8mm, #cbd5e1 296.8mm, #cbd5e1 297.2mm, transparent 297.2mm);
        background-size: 100% 297mm;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        margin: 0 auto 50px auto;
        box-sizing: border-box;
        outline: none;
        position: relative;
    }
    
    .a4-document-editor img {
        cursor: pointer;
        transition: outline 0.15s ease-in-out;
    }
    
    .a4-document-editor img.selected-img {
        outline: 3px dashed #6366f1 !important;
        outline-offset: 3px;
    }
    
    .tamil-font {
        font-family: 'TAU-Paalai', serif;
    }
 
    .print-header, .print-footer, .header-cover {
        display: none;
    }
    
    @media print {
        @page {
            size: A4 portrait;
            margin: 20mm 15mm 18mm 15mm;
        }
        body * {
            visibility: hidden !important;
        }
        .a4-print-container, .a4-print-container * {
            visibility: visible !important;
        }
        .a4-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .a4-document-editor {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            background: transparent !important;
        }
        .no-print {
            display: none !important;
        }
 
        /* Running Header */
        .print-header {
            display: block !important;
            position: fixed !important;
            top: -15mm; /* top margin is 20mm, so -15mm puts header top at 5mm from physical page top */
            left: 0 !important;
            right: 0 !important;
            z-index: 1000;
        }
        .print-header-text {
            font-family: 'Times New Roman', serif;
            font-size: 9pt;
            text-align: right;
            margin-bottom: 2mm; /* Gap below the code: 2 mm */
            font-weight: 600; /* Semi Bold */
            line-height: 1;
            white-space: nowrap;
        }
        .print-header-divider {
            box-sizing: border-box;
            width: 100%;
            border-top: 1px solid #000 !important; /* Header Divider Line Thickness: 1px */
        }
 
        /* Running Footer */
        .print-footer {
            display: block !important;
            position: fixed !important;
            bottom: -14mm; /* bottom margin is 18mm, so -14mm puts footer bottom at 4mm from page bottom */
            left: 0 !important;
            right: 0 !important;
            z-index: 1000;
        }
        .print-footer-divider {
            box-sizing: border-box;
            width: 100%;
            border-top: 1px solid #000 !important;
            margin-bottom: 2.5mm;
        }
        .print-footer-text {
            font-family: 'Times New Roman', serif;
            font-size: 9pt;
            text-align: right;
            font-weight: normal;
            line-height: 1;
            white-space: nowrap;
        }
        .page-current::after {
            content: counter(page);
        }
 
        /* First Page Header Cover - Display on first page to cover header */
        .header-cover {
            display: block !important;
            position: absolute !important;
            top: -20mm !important;
            left: -15mm !important;
            right: -15mm !important;
            height: 20mm !important;
            background: white !important;
            z-index: 1001 !important;
        }
    }
`;

const PaginatedA4Editor: React.FC<PaginatedA4EditorProps> = ({ initialHtml, onSave, title, paperCode = '' }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [fontSize, setFontSize] = useState(14);
    const [currentFont, setCurrentFont] = useState('TAU-Paalai');
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
    const [imageWidthPercent, setImageWidthPercent] = useState(50);
    const [pageCount, setPageCount] = useState(1);
    const [isLoaded, setIsLoaded] = useState(false);
    const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

    // Clean legacy A4 pages wrapper
    const cleanLegacyHtml = (html: string) => {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const existingPages = temp.querySelectorAll('.a4-page-content');
        if (existingPages.length > 0) {
            return Array.from(existingPages).map(p => p.innerHTML).join('');
        }
        return html;
    };

    // Load initial HTML once
    useEffect(() => {
        if (initialHtml && editorRef.current && !isLoaded) {
            const cleaned = cleanLegacyHtml(initialHtml);
            editorRef.current.innerHTML = cleaned;
            setIsLoaded(true);
            updatePageCount();
        }
    }, [initialHtml, isLoaded]);

    // Reset load state when title or document changes
    useEffect(() => {
        setIsLoaded(false);
    }, [title]);

    // Handle clicks for image selection
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target instanceof HTMLImageElement) {
                // Remove previous selected class
                if (selectedImage && selectedImage !== target) {
                    selectedImage.classList.remove('selected-img');
                }
                
                setSelectedImage(target);
                target.classList.add('selected-img');
                
                // Read width percentage
                const widthStr = target.style.width;
                if (widthStr && widthStr.endsWith('%')) {
                    setImageWidthPercent(parseInt(widthStr));
                } else {
                    setImageWidthPercent(50);
                }
            } else if (
                target.closest('.image-toolbar-container') || 
                target.closest('.editor-toolbar') || 
                target.closest('button') || 
                target.closest('input') || 
                target.closest('select')
            ) {
                // Keep image selected when clicking on controls
            } else {
                if (selectedImage) {
                    selectedImage.classList.remove('selected-img');
                }
                setSelectedImage(null);
            }
        };

        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [selectedImage]);

    // Update page count based on scrollHeight
    const updatePageCount = () => {
        if (editorRef.current) {
            const height = editorRef.current.scrollHeight;
            const estimated = Math.max(1, Math.ceil(height / 1122));
            setPageCount(estimated);
        }
    };

    const handleInput = () => {
        updatePageCount();
    };

    const execCmd = (command: string, value: string = '') => {
        document.execCommand(command, false, value);
        handleInput();
    };

    const applyAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
        if (selectedImage) {
            if (align === 'center') {
                selectedImage.style.display = 'block';
                selectedImage.style.float = 'none';
                selectedImage.style.margin = '15px auto';
                selectedImage.style.maxWidth = '100%';
            } else if (align === 'left') {
                selectedImage.style.display = 'inline-block';
                selectedImage.style.float = 'left';
                selectedImage.style.margin = '10px 20px 10px 0';
                selectedImage.style.maxWidth = '50%';
            } else if (align === 'right') {
                selectedImage.style.display = 'inline-block';
                selectedImage.style.float = 'right';
                selectedImage.style.margin = '10px 0 10px 20px';
                selectedImage.style.maxWidth = '50%';
            } else {
                selectedImage.style.display = 'block';
                selectedImage.style.float = 'none';
                selectedImage.style.margin = '15px auto';
                selectedImage.style.maxWidth = '100%';
            }
            handleInput();
            return;
        }

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            let node = sel.anchorNode as HTMLElement;
            if (node.nodeType === 3) node = node.parentNode as HTMLElement;
            
            let foundBlock = false;
            if (editorRef.current) {
                while (node && node !== document.body && editorRef.current.contains(node)) {
                    const display = window.getComputedStyle(node).display;
                    if (display === 'block' || display === 'flex' || node.tagName === 'DIV' || node.tagName === 'P') {
                        node.style.textAlign = align;
                        foundBlock = true;
                        break;
                    }
                    node = node.parentNode as HTMLElement;
                }
            }
            if (!foundBlock) {
                execCmd(`justify${align.charAt(0).toUpperCase() + align.slice(1)}`);
            }
        }
    };

    const insertHtmlAtCursor = (html: string) => {
        let sel, range;
        if (window.getSelection) {
            sel = window.getSelection();
            if (sel?.getRangeAt && sel.rangeCount) {
                range = sel.getRangeAt(0);
                if (editorRef.current?.contains(range.commonAncestorContainer)) {
                    range.deleteContents();
                    const el = document.createElement("div");
                    el.innerHTML = html;
                    const frag = document.createDocumentFragment();
                    let node, lastNode;
                    while ((node = el.firstChild)) {
                        lastNode = frag.appendChild(node);
                    }
                    range.insertNode(frag);
                    if (lastNode) {
                        range = range.cloneRange();
                        range.setStartAfter(lastNode);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                } else {
                    editorRef.current?.focus();
                    const el = document.createElement("div");
                    el.innerHTML = html;
                    editorRef.current?.appendChild(el.firstChild || el);
                }
            } else {
                editorRef.current?.focus();
            }
        }
        handleInput();
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
                    const dataUrl = re.target?.result as string;
                    const imgHtml = `<img src="${dataUrl}" class="selected-img" style="width: 50%; max-width: 100%; height: auto; display: block; margin: 15px auto; cursor: pointer;" />`;
                    insertHtmlAtCursor(imgHtml);
                    
                    setTimeout(() => {
                        if (editorRef.current) {
                            const imgs = editorRef.current.querySelectorAll('img');
                            const match = Array.from(imgs).find(i => i.src === dataUrl);
                            if (match) {
                                if (selectedImage) selectedImage.classList.remove('selected-img');
                                setSelectedImage(match);
                                match.classList.add('selected-img');
                                setImageWidthPercent(50);
                            }
                        }
                    }, 100);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleDeleteImage = () => {
        if (selectedImage) {
            selectedImage.remove();
            setSelectedImage(null);
            handleInput();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            insertHtmlAtCursor('&nbsp;&nbsp;&nbsp;&nbsp;');
        }
        
        // Auto-run page counter on typing
        setTimeout(() => updatePageCount(), 50);
    };

    const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const font = e.target.value;
        setCurrentFont(font);
        
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            const span = document.createElement('span');
            span.style.fontFamily = font;
            const range = sel.getRangeAt(0);
            range.surroundContents(span);
        } else {
            execCmd('fontName', font);
        }
    };

    const handleFontSizeChange = (increment: number) => {
        setFontSize(prev => {
            const next = Math.min(36, Math.max(8, prev + increment));
            return next;
        });
        setTimeout(() => handleInput(), 10);
    };

    const getTotalHtml = () => {
        if (editorRef.current) {
            const temp = document.createElement('div');
            temp.innerHTML = editorRef.current.innerHTML;
            temp.querySelectorAll('img').forEach(img => {
                img.classList.remove('selected-img');
            });
            return temp.innerHTML;
        }
        return '';
    };

    const handleExportPDF = async () => {
        const element = editorRef.current;
        if (!element) return;

        Swal.fire({
            title: 'Generating 600 DPI Vector PDF…',
            text: 'Running print engine on server...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // Get clean HTML (no selection highlights)
        const contentHtml = (() => {
            const temp = document.createElement('div');
            temp.innerHTML = element.innerHTML;
            temp.querySelectorAll('img').forEach((img: any) => img.classList.remove('selected-img'));
            return temp.innerHTML;
        })();

        // Wrap HTML with styling and absolute font loading URLs
        const absoluteUrl = window.location.origin;
        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @font-face {
      font-family: 'TAU-Paalai';
      src: url('${absoluteUrl}/fonts/TAU-Paalai.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'TAU-Paalai';
      src: url('${absoluteUrl}/fonts/TAU-Paalai%20Bold.ttf') format('truetype');
      font-weight: bold;
      font-style: normal;
    }
    @font-face {
      font-family: 'TAU-Urai';
      src: url('${absoluteUrl}/fonts/TAU-Urai.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'TAU-Urai';
      src: url('${absoluteUrl}/fonts/TAU-Urai%20Bold.ttf') format('truetype');
      font-weight: bold;
      font-style: normal;
    }
    @page { 
      size: A4 portrait; 
      margin: 20mm 15mm 18mm 15mm;
    }
    body {
      margin: 0;
      padding: 0;
      background: white;
      font-family: 'TAU-Paalai', 'Times New Roman', 'Segoe UI Symbol', 'Noto Sans Symbols', serif;
      font-size: ${fontSize}pt;
      line-height: 1.6;
      color: #000;
    }
    h1, h2, h3, h4, .tamil-heading {
      font-family: 'TAU-Paalai', serif;
      font-weight: bold !important;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #000; padding: 4px 6px; }
  </style>
</head>
<body>
  <div class="print-content" style="padding-top: 5mm; padding-bottom: 5mm;">
    ${contentHtml}
  </div>
</body>
</html>`;

        try {
            const token = localStorage.getItem('blueprint_token');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const API_URL = isLocalhost ? 'http://localhost:5001/api' : `${window.location.origin}/api`;

            const res = await fetch(`${API_URL}/generate-pdf`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    html: fullHtml,
                    orientation: 'portrait',
                    filename: `${title.replace(/\s+/g, '_')}.pdf`,
                    paperCode
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Failed to generate PDF: ${res.status} ${errorText}`);
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            Swal.close();
        } catch (err) {
            console.error("PDF generation failed:", err);
            Swal.fire({
                title: 'Export Failed',
                text: err instanceof Error ? err.message : 'Failed to connect to the PDF service.',
                icon: 'error'
            });
        }
    };

    const handlePreviewPDF = async () => {
        if (previewPdfUrl) {
            setPreviewPdfUrl(null);
            return;
        }

        const element = editorRef.current;
        if (!element) return;

        Swal.fire({
            title: 'Generating Exact Preview…',
            text: 'Running print engine on server...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // Get clean HTML (no selection highlights)
        const contentHtml = (() => {
            const temp = document.createElement('div');
            temp.innerHTML = element.innerHTML;
            temp.querySelectorAll('img').forEach((img: any) => img.classList.remove('selected-img'));
            return temp.innerHTML;
        })();

        // Wrap HTML with styling and absolute font loading URLs
        const absoluteUrl = window.location.origin;
        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @font-face {
      font-family: 'TAU-Paalai';
      src: url('${absoluteUrl}/fonts/TAU-Paalai.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'TAU-Paalai';
      src: url('${absoluteUrl}/fonts/TAU-Paalai%20Bold.ttf') format('truetype');
      font-weight: bold;
      font-style: normal;
    }
    @font-face {
      font-family: 'TAU-Urai';
      src: url('${absoluteUrl}/fonts/TAU-Urai.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'TAU-Urai';
      src: url('${absoluteUrl}/fonts/TAU-Urai%20Bold.ttf') format('truetype');
      font-weight: bold;
      font-style: normal;
    }
    @page { 
      size: A4 portrait; 
      margin: 20mm 15mm 18mm 15mm;
    }
    body {
      font-family: 'TAU-Paalai', 'Times New Roman', serif;
      font-size: ${fontSize}px;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      color: black;
      background: white;
    }
    h1, h2, h3, h4, .tamil-heading {
      font-family: 'TAU-Paalai', serif;
    }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid black; padding: 6px; }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>
`;

        try {
            const token = localStorage.getItem('blueprint_token');
            const headers: any = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const API_URL = isLocalhost ? 'http://localhost:5001/api' : `${window.location.origin}/api`;

            const res = await fetch(`${API_URL}/generate-pdf`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    html: fullHtml,
                    orientation: 'portrait',
                    filename: `preview.pdf`,
                    paperCode
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Failed to generate PDF: ${res.status} ${errorText}`);
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setPreviewPdfUrl(url);
            Swal.close();
        } catch (err) {
            console.error("PDF generation failed:", err);
            Swal.fire({
                title: 'Preview Failed',
                text: err instanceof Error ? err.message : 'Failed to connect to the PDF service.',
                icon: 'error'
            });
        }
    };

    const handlePrint = async () => {
        const element = editorRef.current;
        if (!element) return;

        Swal.fire({
            title: 'Preparing Print Version…',
            text: 'Running print engine on server...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // Get clean HTML (no selection highlights)
        const contentHtml = (() => {
            const temp = document.createElement('div');
            temp.innerHTML = element.innerHTML;
            temp.querySelectorAll('img').forEach((img: any) => img.classList.remove('selected-img'));
            return temp.innerHTML;
        })();

        // Wrap HTML with styling and absolute font loading URLs
        const absoluteUrl = window.location.origin;
        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @font-face {
      font-family: 'TAU-Paalai';
      src: url('${absoluteUrl}/fonts/TAU-Paalai.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'TAU-Paalai';
      src: url('${absoluteUrl}/fonts/TAU-Paalai%20Bold.ttf') format('truetype');
      font-weight: bold;
      font-style: normal;
    }
    @font-face {
      font-family: 'TAU-Urai';
      src: url('${absoluteUrl}/fonts/TAU-Urai.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'TAU-Urai';
      src: url('${absoluteUrl}/fonts/TAU-Urai%20Bold.ttf') format('truetype');
      font-weight: bold;
      font-style: normal;
    }
    @page { 
      size: A4 portrait; 
      margin: 20mm 15mm 18mm 15mm;
    }
    body {
      margin: 0;
      padding: 0;
      background: white;
      font-family: 'TAU-Paalai', 'Times New Roman', 'Segoe UI Symbol', 'Noto Sans Symbols', serif;
      font-size: ${fontSize}pt;
      line-height: 1.6;
      color: #000;
    }
    h1, h2, h3, h4, .tamil-heading {
      font-family: 'TAU-Paalai', serif;
      font-weight: bold !important;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #000; padding: 4px 6px; }
  </style>
</head>
<body>
  <div class="print-content" style="padding-top: 5mm; padding-bottom: 5mm;">
    ${contentHtml}
  </div>
</body>
</html>`;

        try {
            const token = localStorage.getItem('blueprint_token');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const API_URL = isLocalhost ? 'http://localhost:5001/api' : `${window.location.origin}/api`;

            const res = await fetch(`${API_URL}/generate-pdf`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    html: fullHtml,
                    orientation: 'portrait',
                    filename: `${title.replace(/\s+/g, '_')}.pdf`,
                    paperCode
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Failed to generate PDF: ${res.status} ${errorText}`);
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            
            // Create hidden iframe
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.src = url;
            
            document.body.appendChild(iframe);
            
            iframe.onload = () => {
                Swal.close();
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                
                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    URL.revokeObjectURL(url);
                }, 60000);
            };
        } catch (err) {
            console.error("PDF printing failed:", err);
            Swal.fire({
                title: 'Print Preparation Failed',
                text: err instanceof Error ? err.message : 'Failed to connect to the PDF service.',
                icon: 'error'
            });
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-100">
            <style>{editorStyles}</style>

            {/* Toolbar */}
            <div className="bg-white border-b p-2 flex flex-wrap items-center justify-between shadow-sm z-20 no-print gap-2 editor-toolbar">
                <div className="flex flex-wrap items-center gap-2">
                    
                    {/* Undo / Redo */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button onMouseDown={(e) => { e.preventDefault(); execCmd('undo'); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 transition-colors" title="Undo"><Undo size={16} /></button>
                        <button onMouseDown={(e) => { e.preventDefault(); execCmd('redo'); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 transition-colors" title="Redo"><Redo size={16} /></button>
                    </div>

                    {/* Formatting */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 transition-colors" title="Bold"><Bold size={16} /></button>
                        <button onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 transition-colors" title="Italic"><Italic size={16} /></button>
                        <button onMouseDown={(e) => { e.preventDefault(); execCmd('underline'); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 transition-colors" title="Underline"><Underline size={16} /></button>
                    </div>

                    {/* Alignment */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button onMouseDown={(e) => { e.preventDefault(); applyAlignment('left'); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 transition-colors" title="Align Left"><AlignLeft size={16} /></button>
                        <button onMouseDown={(e) => { e.preventDefault(); applyAlignment('center'); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 transition-colors" title="Align Center"><AlignCenter size={16} /></button>
                        <button onMouseDown={(e) => { e.preventDefault(); applyAlignment('right'); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 transition-colors" title="Align Right"><AlignRight size={16} /></button>
                        <button onMouseDown={(e) => { e.preventDefault(); applyAlignment('justify'); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 transition-colors" title="Align Justify"><AlignJustify size={16} /></button>
                    </div>

                    {/* Font & Size */}
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <div className="flex items-center px-2">
                            <TypeIcon size={14} className="text-slate-400 mr-2" />
                            <select 
                                value={currentFont}
                                onChange={handleFontChange}
                                className="bg-transparent border-none text-sm font-bold text-slate-700 focus:outline-none w-32 cursor-pointer"
                            >
                                {fonts.map(f => (
                                    <option key={f.name} value={f.name}>{f.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        <button onMouseDown={(e) => { e.preventDefault(); handleFontSizeChange(-1); }} className="p-1 hover:bg-indigo-50 rounded-lg text-slate-700" title="Decrease Font Size"><Minus size={14} /></button>
                        <span className="font-bold text-sm text-indigo-600 min-w-[30px] text-center" title="Font Size (pt)">{fontSize}pt</span>
                        <button onMouseDown={(e) => { e.preventDefault(); handleFontSizeChange(1); }} className="p-1 hover:bg-indigo-50 rounded-lg text-slate-700" title="Increase Font Size"><Plus size={14} /></button>
                    </div>

                    {/* Image Upload */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button onMouseDown={(e) => { e.preventDefault(); handleImageUpload(); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-700 flex items-center gap-2 font-bold text-xs" title="Insert Image">
                            <ImageIcon size={16} /> <span className="hidden md:inline">Image</span>
                        </button>
                    </div>

                    {/* Image Controls (Contextual) */}
                    {selectedImage && (
                        <div className="flex items-center gap-2 bg-amber-50 p-1 rounded-xl border border-amber-200 animate-fade-in image-toolbar-container">
                            <span className="text-[10px] font-black text-amber-700 px-1 uppercase">Image Settings:</span>
                            
                            {/* Width Slider */}
                            <div className="flex items-center gap-1.5 px-2">
                                <ArrowLeftRight size={14} className="text-amber-600" />
                                <input 
                                    type="range" 
                                    min="10" 
                                    max="100" 
                                    value={imageWidthPercent}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        setImageWidthPercent(val);
                                        selectedImage.style.width = `${val}%`;
                                        selectedImage.style.height = 'auto';
                                        handleInput();
                                    }}
                                    className="accent-amber-600 h-1 w-20 bg-amber-100 rounded-lg appearance-none cursor-pointer"
                                    title="Width Percentage"
                                />
                                <span className="text-xs font-bold text-amber-800 w-8">{imageWidthPercent}%</span>
                            </div>
                            
                            <div className="w-px h-6 bg-amber-200 mx-0.5"></div>

                            {/* Alignment Shortcuts */}
                            <button onMouseDown={(e) => { e.preventDefault(); applyAlignment('left'); }} className="p-1.5 hover:bg-amber-100 rounded text-amber-800 text-xs font-bold" title="Float Left">Float L</button>
                            <button onMouseDown={(e) => { e.preventDefault(); applyAlignment('center'); }} className="p-1.5 hover:bg-amber-100 rounded text-amber-800 text-xs font-bold" title="Center Block">Center</button>
                            <button onMouseDown={(e) => { e.preventDefault(); applyAlignment('right'); }} className="p-1.5 hover:bg-amber-100 rounded text-amber-800 text-xs font-bold" title="Float Right">Float R</button>
                            
                            <div className="w-px h-6 bg-amber-200 mx-0.5"></div>

                            {/* Delete */}
                            <button onMouseDown={(e) => { e.preventDefault(); handleDeleteImage(); }} className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg" title="Delete Image">
                                <Trash2 size={15} />
                            </button>
                        </div>
                    )}
                    
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <button onMouseDown={(e) => { e.preventDefault(); onSave(getTotalHtml()); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-md transition-all active:scale-95">
                        <Save size={14} /> Save
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); handlePreviewPDF(); }} className={`flex items-center gap-2 px-4 py-2 ${previewPdfUrl ? 'bg-sky-600 hover:bg-sky-700' : 'bg-teal-600 hover:bg-teal-700'} text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95`}>
                        <Eye size={14} /> {previewPdfUrl ? 'Close Preview' : 'Exact PDF Preview'}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); handleExportPDF(); }} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 shadow-md transition-all active:scale-95">
                        <Download size={14} /> Download PDF
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); handlePrint(); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 shadow-md transition-all active:scale-95">
                        <Printer size={14} /> Print
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-auto p-4 sm:p-12 a4-container custom-scrollbar relative">
                <div className="flex flex-col items-center pb-20">
                    
                    {previewPdfUrl ? (
                        <div className="w-full h-full flex flex-col bg-slate-800 rounded-xl overflow-hidden shadow-2xl mt-4" style={{ height: '800px', width: '210mm' }}>
                            <div className="p-3 bg-slate-900 text-slate-300 text-xs font-bold flex justify-between items-center">
                                <span>Exact PDF Preview (Paginated)</span>
                                <button onClick={() => setPreviewPdfUrl(null)} className="hover:text-white px-3 py-1 bg-slate-700 rounded-md transition-colors">Close Preview</button>
                            </div>
                            <iframe src={previewPdfUrl} className="w-full flex-1 border-none bg-white" title="PDF Preview" />
                        </div>
                    ) : (
                        <div className="a4-print-container">
                            <div 
                                ref={editorRef}
                                className="a4-document-editor tamil-font"
                                contentEditable
                                onInput={handleInput}
                                onKeyDown={handleKeyDown}
                                suppressContentEditableWarning={true}
                                style={{
                                    fontFamily: `'${currentFont}', serif`,
                                    fontSize: `${fontSize}pt`,
                                    textAlign: 'justify',
                                }}
                                dangerouslySetInnerHTML={{ __html: initialHtml }}
                            />

                            {/* Running Footer */}
                            <div className="print-footer no-screen">
                                <div className="print-footer-divider"></div>
                                <div className="print-footer-text" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <span style={{ fontWeight: 'bold' }}>{paperCode || ''}</span>
                                    <span>Page <span className="page-current"></span> / {pageCount}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Page count status bar */}
            <div className="bg-slate-50 border-t py-1.5 px-4 text-xs font-bold text-slate-500 no-print flex items-center justify-between">
                <span>Font: {currentFont} ({fontSize}pt)</span>
                <span>Pages: ~{pageCount} (A4 equivalent)</span>
            </div>
        </div>
    );
};

export default PaginatedA4Editor;
