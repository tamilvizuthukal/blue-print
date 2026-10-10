import React, { useEffect, useMemo, useState, useRef } from 'react';
import Swal from 'sweetalert2';
import { Check, Copy, FileText, Download, FileDown } from 'lucide-react';
import { getBlueprints, getQuestionPaperTypes, getUsers, saveBlueprint } from '../services/db';
import { Blueprint, QuestionPaperType, User } from '../types';
import { buildFullQuestionPaperHTML } from '../New folder/components/pdfEngine';
import { buildMeasuredQuestionPaperDocument } from '../New folder/questionPaper/questionPaperDocument';
import type { QuestionPaperDocument } from '../New folder/questionPaper/questionPaperDocument';
import { getDefaultExamSelection, getExamSelectionKey, normalizeAcademicYear } from '../utils/examSelection';

const removeScriptsFromHtml = (html: string) => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    return `<!DOCTYPE html>${parsed.documentElement.outerHTML}`;
};

const AdminQuestionConsolidator = () => {
    const [rawBlueprints, setRawBlueprints] = useState<Blueprint[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
    const [paperTypes, setPaperTypes] = useState<QuestionPaperType[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedExamKey, setSelectedExamKey] = useState('');
    const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
    const [copied, setCopied] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [workingText, setWorkingText] = useState('');
    const [questionPaperLayoutDraft, setQuestionPaperLayoutDraft] = useState<Record<string, any>>({});
    const [massViewDocument, setMassViewDocument] = useState<QuestionPaperDocument | null>(null);

    const blueprints = useMemo(() => {
        // Group all raw blueprints by key first to aggregate all teachers (owners)
        const groups: Record<string, Blueprint[]> = {};
        rawBlueprints.forEach(bp => {
            const academicYear = normalizeAcademicYear(bp.academicYear || getDefaultExamSelection().academicYear);
            const key = `${bp.classLevel}-${bp.subject}-${bp.questionPaperTypeId}-${bp.setId || 'Set A'}-${bp.examTerm}-${academicYear}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(bp);
        });

        // Filter the grouped exams based on the selected status filter (checking question confirmation)
        const filteredGroups = Object.entries(groups).filter(([key, group]) => {
            if (statusFilter === 'confirmed') {
                return group.some(bp => bp.isQuestionConfirmed === true);
            }
            if (statusFilter === 'unconfirmed') {
                return group.some(bp => bp.isQuestionConfirmed !== true);
            }
            return true; // 'all'
        });

        // Map each group to a representative blueprint containing allOwners
        const uniqueList = filteredGroups.map(([key, group]) => {
            const sortedGroup = [...group].sort((a, b) => {
                if (a.isQuestionConfirmed && !b.isQuestionConfirmed) return -1;
                if (!a.isQuestionConfirmed && b.isQuestionConfirmed) return 1;
                return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
            });
            const representative = { ...sortedGroup[0] };
            (representative as any).allOwners = group.map(b => b.ownerId).filter(Boolean);
            return representative;
        });

        const sortedList = uniqueList.sort((a, b) => {
            const parseClass = (c: any) => {
                if (c === 'SSLC') return 11;
                return parseInt(c) || 0;
            };
            const classDiff = parseClass(a.classLevel) - parseClass(b.classLevel);
            if (classDiff !== 0) return classDiff;

            const setA = (a.setId || '').toUpperCase();
            const setB = (b.setId || '').toUpperCase();
            const setDiff = setA.localeCompare(setB);
            if (setDiff !== 0) return setDiff;

            return a.subject.localeCompare(b.subject);
        });

        return sortedList;
    }, [rawBlueprints, statusFilter]);

    const examOptions = useMemo(() => {
        const latestByExam = new Map<string, { key: string; examTerm: string; academicYear: string; latestAt: number }>();
        blueprints.forEach(bp => {
            const academicYear = normalizeAcademicYear(bp.academicYear || getDefaultExamSelection().academicYear);
            const key = getExamSelectionKey(bp.examTerm, academicYear);
            const latestAt = Math.max(0, ...rawBlueprints
                .filter(raw => getExamSelectionKey(
                    raw.examTerm,
                    raw.academicYear || getDefaultExamSelection().academicYear
                ) === key)
                .map(raw => new Date(raw.createdAt || raw.updatedAt).getTime() || 0));
            const current = latestByExam.get(key);
            if (!current || latestAt > current.latestAt) {
                latestByExam.set(key, { key, examTerm: bp.examTerm, academicYear, latestAt });
            }
        });
        return Array.from(latestByExam.values()).sort((a, b) => b.latestAt - a.latestAt);
    }, [blueprints, rawBlueprints]);

    useEffect(() => {
        if (examOptions.length === 0) {
            setSelectedExamKey('');
            return;
        }
        if (examOptions.some(option => option.key === selectedExamKey)) return;

        const defaultSelection = getDefaultExamSelection();
        const defaultKey = getExamSelectionKey(defaultSelection.examTerm, defaultSelection.academicYear);
        setSelectedExamKey(examOptions.some(option => option.key === defaultKey) ? defaultKey : examOptions[0].key);
    }, [examOptions, selectedExamKey]);

    const examFilteredBlueprints = useMemo(() =>
        blueprints.filter(bp => getExamSelectionKey(
            bp.examTerm,
            normalizeAcademicYear(bp.academicYear || getDefaultExamSelection().academicYear)
        ) === selectedExamKey),
    [blueprints, selectedExamKey]);

    useEffect(() => {
        if (selectedBlueprintId && !examFilteredBlueprints.some(bp => bp.id === selectedBlueprintId)) {
            setSelectedBlueprintId('');
        }
    }, [examFilteredBlueprints, selectedBlueprintId]);

    const formatText = (text: string) => {
        if (!text) return '';
        return text.split('\n').map(line => {
            const tabbedLine = line.replace(/\t/g, '    ');
            if (!tabbedLine.trim()) return '';
            return tabbedLine.replace(/([A-Za-z0-9\-\:\(\)\.\,\|]+)/g, '<span style="font-family: \'Times New Roman\', serif;">$1</span>');
        }).join('<br/>');
    };

    const formatQuestionFonts = (html: string) => {
        if (!html) return '';
        if (typeof document === 'undefined') return html;
        try {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            const walk = (node: Node) => {
                if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).style.fontFamily?.includes('Times New Roman')) {
                    return;
                }
                
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent || '';
                    const regex = /([A-Za-z0-9\-\:\(\)\.\,\|]+)/g;
                    if (regex.test(text)) {
                        const span = document.createElement('span');
                        span.innerHTML = text.replace(regex, '<span style="font-family: \'Times New Roman\', serif;">$1</span>');
                        node.parentNode?.replaceChild(span, node);
                    }
                } else {
                    const children = Array.from(node.childNodes);
                    children.forEach(walk);
                }
            };
            
            walk(temp);
            return temp.innerHTML;
        } catch (e) {
            console.error("Error formatting question fonts:", e);
            return html;
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        const formattedHtml = formatText(text);
        document.execCommand('insertHTML', false, formattedHtml);
    };

    const refreshData = async () => {
        setIsRefreshing(true);
        try {
            const [bps, pts, allUsers] = await Promise.all([
                getBlueprints('all'), 
                getQuestionPaperTypes(),
                getUsers()
            ]);
            setRawBlueprints(bps || []);
            setPaperTypes(pts || []);
            setUsers(allUsers || []);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => { refreshData(); }, []);

    const userMap = useMemo(() => {
        const map: Record<string, string> = {};
        users.forEach(u => {
            map[u.id] = u.name;
        });
        return map;
    }, [users]);

    const selectedBlueprint = useMemo(() => examFilteredBlueprints.find(bp => bp.id === selectedBlueprintId), [examFilteredBlueprints, selectedBlueprintId]);
    const selectedPaperType = useMemo(() => paperTypes.find(t => t.id === selectedBlueprint?.questionPaperTypeId), [paperTypes, selectedBlueprint]);
    useEffect(() => {
        setQuestionPaperLayoutDraft((selectedBlueprint as any)?.questionPaperLayout || {});
    }, [selectedBlueprint?.id]);
    const questionPaperLayout = useMemo(() => ({
        ...questionPaperLayoutDraft,
        pageSize: 'A4',
        orientation: 'portrait',
    }), [questionPaperLayoutDraft]);
    useEffect(() => {
        let active = true;
        if (!selectedBlueprint) {
            setMassViewDocument(null);
            return () => { active = false; };
        }
        setMassViewDocument(null);
        buildMeasuredQuestionPaperDocument({
            blueprint: selectedBlueprint,
            paperType: selectedPaperType,
            layout: questionPaperLayout,
            screenPreview: true,
            standalone: true,
        }).then(document => { if (active) setMassViewDocument(document); })
          .catch(error => { if (active) console.error('Question paper preview pagination failed:', error); });
        return () => { active = false; };
    }, [selectedBlueprint, selectedPaperType, questionPaperLayout]);
    const massViewPreviewHtml = useMemo(() => massViewDocument
        ? removeScriptsFromHtml(massViewDocument.html)
        : '', [massViewDocument]);

    const paperCodeStr = useMemo(() => {
        if (!selectedBlueprint) return '';
        const subject = selectedBlueprint.subject.includes('BT') ? 'BT' : 'AT';
        const codeMap: Record<string, string> = {
            '10-AT': 'T-1002', '10-BT': 'T-1012', '9-AT': 'T-902', '9-BT': 'T-912', '8-AT': 'T-802', '8-BT': 'T-812'
        };
        return codeMap[`${selectedBlueprint.classLevel}-${subject}`] || `T-${selectedBlueprint.classLevel}${subject === 'AT' ? '02' : '12'}`;
    }, [selectedBlueprint]);

    useEffect(() => {
        if (selectedBlueprint) {
            setWorkingText(buildFullQuestionPaperHTML(selectedBlueprint, selectedPaperType, paperCodeStr));
        }
    }, [selectedBlueprint, selectedPaperType, paperCodeStr]);

    const handleDownloadIndd = (type: 'AT' | 'BT') => {
        const filename = type === 'AT' ? 'Question Paper AT.indd' : 'Question Paper BT.indd';
        const link = document.createElement('a');
        link.href = '/' + encodeURI(filename);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCopy = async () => {
        const temp = document.createElement('div');
        temp.innerHTML = workingText;
        const firstSection = temp.querySelector('.pdf-section-header');
        if (firstSection) {
            while (firstSection.previousSibling) firstSection.previousSibling.remove();
        } else {
            const firstQuestion = temp.querySelector('.pdf-question-block')
                || Array.from(temp.children).find(element =>
                    element instanceof HTMLElement
                    && element.style.display === 'flex'
                    && !!element.querySelector(':scope > div[style*="width"]')
                );
            if (firstQuestion) {
                while (firstQuestion.previousSibling) firstQuestion.previousSibling.remove();
            }
        }
        const parts: string[] = [];
        const collectText = (node: Node, insideQuestionText = false) => {
            if (node.nodeType === Node.TEXT_NODE) {
                parts.push(node.textContent || '');
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const element = node as HTMLElement;
            if (element.tagName === 'BR') {
                parts.push('\n');
                return;
            }
            const isNoteItem = element.parentElement?.closest('.pdf-notes-box') && element.style.display === 'flex';
            const isQuestionText = element.tagName === 'DIV' && element.style.flexGrow === '1' && element.style.textAlign === 'justify';
            const inQuestionText = insideQuestionText || isQuestionText;
            const isParagraphBreak = inQuestionText && (element.tagName === 'P' || element.tagName === 'DIV');
            const isQuestion = element.classList.contains('pdf-question-block') || (element.tagName === 'DIV' && element.style.display === 'flex' && element.querySelector(':scope > div[style*="width"]'));
            const isTableRow = element.tagName === 'TR';
            if (isNoteItem || isQuestion || isTableRow || isParagraphBreak) parts.push('\n');
            else if (element.tagName === 'DIV' || /^H[1-6]$/.test(element.tagName) || element.tagName === 'P') parts.push(' ');
            element.childNodes.forEach(child => collectText(child, inQuestionText));
            if (element.tagName === 'TD' || element.tagName === 'TH') parts.push('\t');
            if (isNoteItem || isQuestion || isTableRow || isParagraphBreak) parts.push('\n');
            else if (element.tagName === 'DIV' || /^H[1-6]$/.test(element.tagName) || element.tagName === 'P') parts.push(' ');
        };
        temp.childNodes.forEach(collectText);
        const normalizedLines = parts.join('')
            .replace(/\u00a0/g, ' ')
            .replace(/\t+/g, '    ')
            .replace(/ {2,}/g, ' ')
            .replace(/◆\s*/g, '◆ ')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
        const joinedLines: string[] = [];
        for (let index = 0; index < normalizedLines.length; index += 1) {
            const line = normalizedLines[index];
            const questionNumber = line.match(/^(\d+)[.)]?$/);
            if (questionNumber && normalizedLines[index + 1]) {
                joinedLines.push(`${questionNumber[1]}. ${normalizedLines[index + 1]}`);
                index += 1;
            } else if (/^[அஆஇஈஉஊஎஏஐஒஓஔ]\)$/.test(line) && normalizedLines[index + 1]) {
                joinedLines.push(`${line} ${normalizedLines[index + 1]}`);
                index += 1;
            } else {
                joinedLines.push(line);
            }
        }
        const text = joinedLines.join('\n').trim();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadWord = (html: string) => {
        if (!selectedBlueprint) return;
        const setLetter = (selectedBlueprint.setId || 'A').replace(/SET\s+/i, '').trim().charAt(0).toUpperCase();
        const filename = `QuestionPaper_${selectedBlueprint.classLevel}_${selectedBlueprint.subject}_Set_${setLetter}.doc`;

        // Wrap and download with proper layout matching the question paper format
        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
              <head>
              <meta charset="utf-8" />
              <title>${selectedBlueprint.subject} Question Paper</title>
              <!--[if gte mso 9]>
              <xml>
              <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
              </w:WordDocument>
              </xml>
              <![endif]-->
              <style>
              @page {
                  size: A4 portrait;
                  margin: 20mm 15mm 18mm 15mm;
                  mso-header-margin: 10mm;
                  mso-footer-margin: 10mm;
                  mso-title-page: no;
              }
              @font-face {
                  font-family: 'TAU-Paalai';
                  src: local('TAU-Paalai');
              }
              @font-face {
                  font-family: 'TAU-Urai';
                  src: local('TAU-Urai');
              }
              body {
                  font-family: 'TAU-Paalai', 'Times New Roman', serif;
                  font-size: 14pt;
                  line-height: 1.8;
                  color: #000000;
                  margin: 0;
                  padding: 0;
              }
              h1, h2, h3, h4, .tamil-heading {
                  font-family: 'TAU-Urai', 'Times New Roman', serif;
                  font-weight: bold;
                  text-align: center;
                  margin: 8pt 0;
              }
              h1 { font-size: 18pt; }
              h2 { font-size: 16pt; }
              h3 { font-size: 14pt; }
              p { 
                  margin: 0 0 8pt 0; 
                  text-align: justify;
              }
              table { 
                  border-collapse: collapse; 
                  width: 100%; 
                  margin: 8pt 0;
              }
              td, th { 
                  border: 1px solid #000000; 
                  padding: 6px 8px; 
                  font-size: 12pt;
              }
              .question-block, tr {
                  page-break-inside: avoid;
              }
              .section-header {
                  font-weight: bold;
                  font-size: 14pt;
                  margin: 12pt 0 6pt 0;
                  text-align: left;
              }
              .marks-info {
                  font-weight: bold;
                  text-align: right;
              }
              .notes-box {
                  border: 1px solid #000000;
                  padding: 8pt;
                  margin: 10pt 0;
              }
              .info-table {
                  border: none;
                  width: 100%;
              }
              .info-table td {
                  border: none;
                  padding: 2pt 4pt;
              }
              img { max-width: 100%; height: auto; }
              ul, ol { margin: 4pt 0 8pt 20pt; }
              li { margin-bottom: 4pt; }
              </style>
              </head>
              <body>
              <div>
              ${html}
              </div>
              </body>
              </html>`;

        const blob = new Blob(['\ufeff' + header], {
            type: 'application/msword'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Swal.fire("Exported", "Word document downloaded successfully!", "success");
    };

    const updateQuestionLayout = (itemId: string, key: string, value: number | boolean | undefined) => {
        setQuestionPaperLayoutDraft((current: Record<string, any>) => {
            const questionOverrides = { ...(current.questionOverrides || {}) };
            const nextOverride = { ...(questionOverrides[itemId] || {}) };
            if (value === undefined) delete nextOverride[key];
            else nextOverride[key] = value;
            if (Object.keys(nextOverride).length) questionOverrides[itemId] = nextOverride;
            else delete questionOverrides[itemId];
            return { ...current, questionOverrides };
        });
    };

    const handleSaveQuestionLayout = async () => {
        if (!selectedBlueprint) return;
        try {
            await saveBlueprint({ ...selectedBlueprint, questionPaperLayout: questionPaperLayoutDraft } as any);
            setRawBlueprints(current => current.map(bp => bp.id === selectedBlueprint.id
                ? { ...bp, questionPaperLayout: questionPaperLayoutDraft } as any
                : bp));
            Swal.fire({ title: 'Layout saved', text: 'Per-question spacing settings were saved.', icon: 'success', timer: 1600, showConfirmButton: false });
        } catch (error) {
            Swal.fire('Could not save layout', error instanceof Error ? error.message : 'Please try again.', 'error');
        }
    };

    const handleExportPdf = async () => {
        if (!selectedBlueprint) return;
        setIsExportingPdf(true);
        Swal.fire({ title: 'Generating A4 PDF…', text: 'Rendering question paper in portrait layout.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const paperDocument = await buildMeasuredQuestionPaperDocument({
                blueprint: selectedBlueprint,
                paperType: selectedPaperType,
                layout: questionPaperLayout,
                screenPreview: false,
                standalone: true,
            });
            const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
            const apiUrl = isLocal ? 'http://localhost:5001/api' : `${window.location.origin}/api`;
            const token = localStorage.getItem('blueprint_token');
            const response = await fetch(`${apiUrl}/generate-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    html: removeScriptsFromHtml(paperDocument.html),
                    orientation: 'portrait',
                    canonicalPaper: true,
                    filename: `QuestionPaper_${selectedBlueprint.classLevel}_${selectedBlueprint.subject}_${selectedBlueprint.setId || 'A'}.pdf`,
                }),
            });
            if (!response.ok) throw new Error(`PDF export failed (${response.status}): ${await response.text()}`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `QuestionPaper_${selectedBlueprint.classLevel}_${selectedBlueprint.subject}_${selectedBlueprint.setId || 'A'}.pdf`.replace(/[^\w.-]+/g, '_');
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            Swal.fire({ title: 'PDF ready', text: 'A4 portrait PDF downloaded.', icon: 'success', timer: 1800, showConfirmButton: false });
        } catch (error) {
            Swal.fire("PDF Export Failed", error instanceof Error ? error.message : "Could not render the PDF.", "error");
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <div className="relative border-sky-100 bg-white p-4 flex flex-col h-full space-y-4">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 no-print">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg">
                            <FileText size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Mass View</h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleDownloadIndd('AT')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md"
                            title="Download Question Paper AT.indd"
                        >
                            <Download size={16} />
                            AT
                        </button>
                        <button
                            onClick={() => handleDownloadIndd('BT')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-md"
                            title="Download Question Paper BT.indd"
                        >
                            <Download size={16} />
                            BT
                        </button>
                        <button
                            onClick={handleExportPdf}
                            disabled={!selectedBlueprint || isExportingPdf}
                            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-all shadow-md disabled:opacity-50"
                            title="Export question paper as A4 portrait PDF"
                        >
                            <FileDown size={16} />
                            {isExportingPdf ? 'PDF…' : 'Export PDF'}
                        </button>
                        
                        <button
                            onClick={handleCopy}
                            disabled={!workingText}
                            className={`inline-flex h-9 px-4 items-center justify-center rounded-xl font-bold transition-all ${copied ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm'} text-sm`}
                        >
                            {copied ? <Check size={18} className="mr-2" /> : <Copy size={18} className="mr-2" />}
                            {copied ? 'Copied' : 'Copy Text'}
                        </button>
                        
                        <button
                            onClick={() => handleDownloadWord(workingText)}
                            disabled={!selectedBlueprint || !workingText}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md"
                        >
                            <FileDown size={18} />
                            Word
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Filter Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'confirmed' | 'unconfirmed')}
                            className="px-3 py-2 border border-sky-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 bg-gray-50 text-sm font-bold text-slate-700 shadow-sm"
                        >
                            <option value="all">All</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="unconfirmed">Unconfirmed</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Select Exam:</span>
                        <select
                            value={selectedExamKey}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedExamKey(e.target.value)}
                            className="min-w-0 max-w-xs px-3 py-2.5 border border-sky-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 bg-gray-50 text-sm font-bold text-slate-700 shadow-sm"
                        >
                            {examOptions.map(option => (
                                <option key={option.key} value={option.key}>{option.examTerm} ({option.academicYear})</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Select Question Paper:</span>
                        <select
                            value={selectedBlueprintId}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedBlueprintId(e.target.value)}
                            className="flex-1 max-w-2xl px-4 py-2.5 border border-sky-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 bg-gray-50 text-sm font-bold text-slate-700 shadow-sm truncate"
                        >
                            <option value="">Select Exam to Load...</option>
                            {examFilteredBlueprints.map(bp => {
                                const allOwners = (bp as any).allOwners || [bp.ownerId];
                                const assignedTeachers = users.filter(u => allOwners.includes(u.id) && u.role !== 'ADMIN');
                                const teacherNames = assignedTeachers.map(u => u.name).join(', ');
                                const paperType = paperTypes.find(pt => pt.id === bp.questionPaperTypeId);
                                const paperTypeName = paperType ? paperType.name : bp.questionPaperTypeName || 'Unknown Type';
                                const displaySet = (() => {
                                    const s = bp.setId || 'A';
                                    if (s.startsWith('SET')) return s;
                                    if (s === 'GENERAL') return 'GENERAL SET';
                                    return `SET ${s}`;
                                })();
                                return (
                                    <option key={bp.id} value={bp.id}>
                                        Class {bp.classLevel} . {bp.subject} . {displaySet} . {paperTypeName} ({assignedTeachers.length}) ({teacherNames || 'Unknown'})
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative flex flex-col min-h-0 rounded-xl overflow-hidden border border-sky-50">
                {(() => {
                    if (!selectedBlueprintId || !selectedBlueprint) {
                        return (
                            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-sky-100 rounded-3xl bg-sky-50/30 m-8">
                                <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                                    <FileText size={40} className="text-sky-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">Select an exam to view</h3>
                                <p className="text-slate-500 text-sm mt-1">Full question paper will appear here.</p>
                            </div>
                        );
                    }
                    
                    return (
                        <div className="flex-1 overflow-auto bg-slate-100 p-4 sm:p-8">
                            <details className="mx-auto mb-4 max-w-[900px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm no-print">
                                <summary className="cursor-pointer font-bold text-slate-800">Per-question spacing and page breaks</summary>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <p className="text-xs text-slate-500">Adjust gap before/after each question and line spacing. Values are saved with this blueprint.</p>
                                    <button onClick={handleSaveQuestionLayout} className="shrink-0 rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-800">Save layout</button>
                                </div>
                                <div className="mt-3 space-y-2">
                                    {selectedBlueprint.items.map((item, index) => {
                                        const itemId = String(item.id);
                                        const override = questionPaperLayout.questionOverrides?.[itemId] || {};
                                        const number = item.qNo || item.questionNumber || String(index + 1);
                                        const readNumber = (value: unknown, fallback: number) => value === undefined || value === '' ? fallback : Number(value);
                                        return <div key={itemId} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-[minmax(130px,1fr)_100px_100px_100px_110px]">
                                            <div className="truncate text-sm font-semibold text-slate-700" title={item.questionText || ''}>Q{number}. {String(item.questionText || 'Question').replace(/<[^>]*>/g, ' ').trim()}</div>
                                            <label className="text-[11px] text-slate-500">Gap before (mm)<input type="number" min="0" max="40" step="0.5" value={readNumber(override.spacingBefore, 0)} onChange={event => updateQuestionLayout(itemId, 'spacingBefore', event.target.value === '' ? undefined : Number(event.target.value))} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800" /></label>
                                            <label className="text-[11px] text-slate-500">Gap after (mm)<input type="number" min="0" max="40" step="0.5" value={readNumber(override.spacingAfter, Number(questionPaperLayout.questionSpacing) || 4)} onChange={event => updateQuestionLayout(itemId, 'spacingAfter', event.target.value === '' ? undefined : Number(event.target.value))} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800" /></label>
                                            <label className="text-[11px] text-slate-500">Line spacing<input type="number" min="1" max="2.5" step="0.1" value={readNumber(override.lineHeight, Number(questionPaperLayout.typography?.bodyLineHeight) || 1.6)} onChange={event => updateQuestionLayout(itemId, 'lineHeight', event.target.value === '' ? undefined : Number(event.target.value))} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800" /></label>
                                            <label className="flex items-center gap-2 pt-3 text-xs text-slate-600"><input type="checkbox" checked={Boolean(override.breakBefore)} onChange={event => updateQuestionLayout(itemId, 'breakBefore', event.target.checked || undefined)} />Start on new page</label>
                                        </div>;
                                    })}
                                </div>
                            </details>
                            {massViewDocument ? <iframe
                                title="A4 portrait question paper preview"
                                srcDoc={massViewPreviewHtml}
                                sandbox="allow-same-origin"
                                className="mx-auto block w-full max-w-[900px] border-0 bg-transparent"
                                style={{ height: `${Math.max(1, massViewDocument.totalPages) * 1180}px` }}
                            /> : <div className="py-12 text-center text-sm text-slate-500">Measuring question layout and preparing pages…</div>}
                        </div>
                    );
                })()}
            </div>

        </div>
    );
};

export default AdminQuestionConsolidator;
