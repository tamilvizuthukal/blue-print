import React, { useEffect, useMemo, useState, useRef } from 'react';
import Swal from 'sweetalert2';
import { Check, Copy, FileText, Download, FileDown } from 'lucide-react';
import { getBlueprints, getQuestionPaperTypes, saveBlueprint, getUsers } from '../services/db';
import { sanitizeHtml } from '../services/security';
import { Blueprint, QuestionPaperType, User } from '../types';
import PaginatedA4Editor from './PaginatedA4Editor';
import { buildFullQuestionPaperHTML } from './pdfEngine';
import { getDefaultExamSelection, getExamSelectionKey, normalizeAcademicYear } from '../utils/examSelection';

const AdminQuestionConsolidator = () => {
    const [rawBlueprints, setRawBlueprints] = useState<Blueprint[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
    const [paperTypes, setPaperTypes] = useState<QuestionPaperType[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedExamKey, setSelectedExamKey] = useState('');
    const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
    const [copied, setCopied] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [workingText, setWorkingText] = useState('');

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
        const text = temp.innerText || temp.textContent || '';
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

    const handleSaveFromEditor = async (html: string) => {
        if (!selectedBlueprint) return;
        setIsSaving(true);
        try {
            const sanitizedHtml = sanitizeHtml(html);
            const updated = { ...selectedBlueprint, massViewHeader: sanitizedHtml };
            await saveBlueprint(updated);
            setWorkingText(sanitizedHtml);
            Swal.fire("Saved", "Changes saved to database!", "success");
        } catch (e) {
            Swal.fire("Error", "Save failed", "error");
        } finally {
            setIsSaving(false);
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
                                <p className="text-slate-500 text-sm mt-1">Full question paper will be loaded into the A4 editor.</p>
                            </div>
                        );
                    }
                    
                    return (
                        <PaginatedA4Editor 
                            initialHtml={workingText}
                            onSave={handleSaveFromEditor}
                            title={`Class ${selectedBlueprint.classLevel} ${selectedBlueprint.subject} - Set ${selectedBlueprint.setId || 'A'}`}
                            paperCode={paperCodeStr}
                        />
                    );
                })()}
            </div>

        </div>
    );
};

export default AdminQuestionConsolidator;
