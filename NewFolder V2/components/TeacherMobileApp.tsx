import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  ArrowLeft, BookOpen, Check, CheckCircle2, ChevronRight, Clipboard, Copy, List, ListOrdered,
  FileText, Grid2X2, Info, Layers3, ListChecks, LoaderCircle, LockKeyhole, Columns2,
  NotebookTabs, PencilLine, Search, SpellCheck2, Table2, BarChart3, Plus, UserRound, LogOut,
  Trash2, X, Save, CircleHelp, GraduationCap, ChartNoAxesCombined, ClipboardList, Sparkles
} from 'lucide-react';
import {
  Blueprint, BlueprintItem, ClassLevel, CognitiveProcess, Curriculum,
  Discourse, ExamTerm, ItemFormat, KnowledgeLevel, QuestionPaperType,
  Role, StructuredQuestionContent, User
} from '../types';
import {
  filterCurriculumByTerm, getAllAccessibleBlueprints,
  getBlueprintById, getCurrentAcademicYear, getDB, initDB, getDiscourses, getFilteredCurriculum,
  getQuestionPaperTypes, saveBlueprint, reviewQuestionWithGemini,
  QuestionReviewSuggestion
} from '../services/db';
import { ensureBlueprintItemsHaveQNo, sortBlueprintItems } from '../utils/reportCalculations';
import { BlueprintMatrix } from './BlueprintMatrix';
import { ReportsView } from './ReportsView';
import UserProfile from './UserProfile';
import { useExport } from '../hooks/useExport';
import './TeacherMobileApp.css';

type Screen = 'exams' | 'exam-home' | 'blueprint' | 'questions' | 'reports' | 'analysis' | 'profile';
type SpellTarget = 'question' | 'answer';
let lastRichEditorSelection: { element: HTMLDivElement; range: Range; target?: SpellTarget } | null = null;

function insertTextAtSavedCursor(target: SpellTarget, text: string): boolean {
  const saved = lastRichEditorSelection;
  if (!saved || saved.target !== target || !saved.element.isConnected || !saved.element.contains(saved.range.startContainer)) return false;
  const range = saved.range.cloneRange();
  range.deleteContents();
  const fragment = document.createDocumentFragment();
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((line, index) => {
    if (index) fragment.appendChild(document.createElement('br'));
    if (line) fragment.appendChild(document.createTextNode(line));
  });
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  const caret = document.createRange();
  if (lastNode?.parentNode) {
    caret.setStartAfter(lastNode);
    caret.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
    saved.range = caret.cloneRange();
  }
  saved.element.dispatchEvent(new Event('input', { bubbles: true }));
  saved.element.focus();
  return true;
}

type MatchData = NonNullable<StructuredQuestionContent['matchPairs']>;
type MCData = NonNullable<StructuredQuestionContent['multipleChoice']>;
type ContentMode = 'paragraph' | 'table' | 'list' | 'split_list';

const idOf = () => globalThis.crypto?.randomUUID?.() || `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fitTextareaToContent = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = 'auto';
  const style = window.getComputedStyle(textarea);
  const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  textarea.style.height = `${textarea.scrollHeight + borders}px`;
};
const htmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const stripHtml = (value?: string) => (value || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').trim();
const isNonEmpty = (value?: string) => !!stripHtml(value).trim();
const formatLetter = (index: number) => ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ'][index] || String(index + 1);
const isSR1 = (format: ItemFormat) => String(format).toUpperCase().startsWith('SR1');
const isSR2 = (format: ItemFormat) => String(format).toUpperCase().startsWith('SR2');

function getMC(item: BlueprintItem): MCData {
  const existing = item.questionContent?.multipleChoice;
  const options = Array.from({ length: Math.max(4, existing?.options?.length || 0) }, (_, i) => existing?.options?.[i] || { id: idOf(), text: '' });
  const ids = (existing as any)?.correctOptionIds as string[] | undefined;
  return {
    prompt: existing?.prompt || item.questionText || '',
    options,
    correctOptionId: existing?.correctOptionId || ids?.[0] || '',
    correctOptionIds: ids || (existing?.correctOptionId ? [existing.correctOptionId] : [])
  };
}

function getMatch(item: BlueprintItem): MatchData {
  const m = item.questionContent?.matchPairs;
  const leftItems = m?.leftItems?.length ? m.leftItems : [{ id: idOf(), text: '' }, { id: idOf(), text: '' }];
  const rightItems = m?.rightItems?.length ? m.rightItems : [{ id: idOf(), text: '' }, { id: idOf(), text: '' }];
  return {
    prompt: m?.prompt || item.questionText || '', leftTitle: m?.leftTitle || '', rightTitle: m?.rightTitle || '',
    leftItems, rightItems, answerMappings: m?.answerMappings || []
  };
}

function questionTableHtml(rows: string[][], bordered: boolean, widths: number[] = []) {
  const count = Math.max(1, ...rows.map(row => row.length));
  return `<table style="width:100%;border-collapse:collapse"><tbody>${rows.map(row => `<tr>${Array.from({ length: count }, (_, i) => `<td style="${bordered ? 'border:1px solid #333;' : 'border:0;'}width:${widths[i] || Math.floor(100 / count)}%;padding:4px">${htmlEscape(row[i] || '').replace(/\n/g, '<br/>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function emptyContentBlock(mode: ContentMode) {
  if (mode === 'table') return { id: idOf(), type: mode, tableRows: [['', '']], rowMarks: [''], bordered: true, columnWidths: [100] };
  if (mode === 'list') return { id: idOf(), type: mode, items: [{ id: idOf(), text: '', marks: '' }] };
  if (mode === 'split_list') return { id: idOf(), type: mode, items: [{ id: idOf(), left: '', right: '', marks: '' }] };
  return { id: idOf(), type: mode, content: '', marks: '' };
}

function blockHTML(block: any, mode: ContentMode): string {
  const mark = (value: unknown) => value !== undefined && value !== '' ? `<span style="float:right;white-space:nowrap;margin-left:8px">(${htmlEscape(String(value))})</span>` : '';
  if (mode === 'table') {
    const rows = (block?.tableRows || [['']]) as string[][];
    const widths = block?.columnWidths || [];
    const columns = Math.max(1, ...rows.map(row => row.length));
    return `<table style="width:100%;border-collapse:collapse"><tbody>${rows.map((row, ri) => `<tr>${Array.from({ length: columns }, (_, ci) => `<td style="${block?.bordered === false ? 'border:0;' : 'border:1px solid #333;'}width:${widths[ci] || Math.floor(100 / columns)}%;padding:4px">${htmlEscape(row[ci] || '').replace(/\n/g, '<br/>')}</td>`).join('')}<td style="${block?.bordered === false ? 'border:0;' : 'border:1px solid #333;'}width:10%;padding:4px;text-align:right;white-space:nowrap">${mark(block?.rowMarks?.[ri])}</td></tr>`).join('')}</tbody></table>`;
  }
  if (mode === 'list') return `<ul>${(block?.items || []).map((item: any) => `<li>${htmlEscape(item.text || '')}${mark(item.marks)}</li>`).join('')}</ul>`;
  if (mode === 'split_list') return `<table style="width:100%;border-collapse:collapse"><tbody>${(block?.items || []).map((item: any) => `<tr><td style="padding:3px">${htmlEscape(item.left || '')}</td><td style="padding:3px">${htmlEscape(item.right || '')}${mark(item.marks)}</td></tr>`).join('')}</tbody></table>`;
  return `${block?.content || ''}${mark(block?.marks)}`;
}

function formatMobileMark(value: number | string | undefined): string {
  const mark = Number(value);
  if (!Number.isFinite(mark)) return String(value ?? '');
  if (mark === 0.5) return '½';
  if (Number.isInteger(mark)) return String(mark);
  if (mark % 1 === 0.5) return `${Math.floor(mark)}½`;
  return String(mark);
}

function MarkInput({ value, onChange, disabled, placeholder, ariaLabel }: { value: number | string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string; ariaLabel?: string }) {
  const normalize = (raw: string) => raw === '.5' || raw === '0.5' ? '½' : raw;
  return <input type="text" inputMode="decimal" className="tm-mark-input" aria-label={ariaLabel} placeholder={placeholder} disabled={disabled} value={value ?? ''} onChange={event => onChange(normalize(event.target.value))} />;
}

function RubricsPreview({ discourse }: { discourse?: Discourse }) {
  if (!discourse?.rubrics?.length) return null;
  return <div className="tm-rubric-preview"><strong>மதிப்பீட்டுக் குறிப்புகள் · {discourse.name}</strong>{discourse.rubrics.map((rubric, index) => <div key={`${rubric.point}-${index}`}><span>{rubric.point}</span><b>{formatMobileMark(rubric.marks)}{[1, 2].includes(Number(rubric.marks)) ? '' : ' மதிப்பெண்'}</b></div>)}</div>;
}

function normalizeCognitiveProcess(value?: CognitiveProcess): CognitiveProcess {
  const text = String(value || '');
  const match = Object.values(CognitiveProcess).find(option => option === text || option.replace(/^CP[₁₂₃₄₅₆₇]\s*/, '') === text.replace(/^CP\d\s*[-:]?\s*/i, '').trim());
  return match || CognitiveProcess.CP1;
}

function ContentModeSelector({ value, onChange, disabled = false, title }: { value: ContentMode; onChange: (mode: ContentMode) => void; disabled?: boolean; title: string }) {
  const modes: [ContentMode, string, React.ReactNode][] = [['paragraph', 'பத்தி', 'பத்தி'], ['table', 'டேபிள்', <Table2 size={15}/>], ['list', 'லிஸ்ட்', <List size={15}/>], ['split_list', 'ஸ்பிளிட் லிஸ்ட்', <Columns2 size={15}/>]];
  return <div className="tm-answer-mode-row"><span>{title}</span><div>{modes.map(([mode, label, content]) => <button key={mode} title={label} aria-label={label} disabled={disabled} className={value === mode ? 'active' : ''} onClick={() => onChange(mode)}>{content}</button>)}</div></div>;
}

function StructuredItemsEditor({ mode, block, disabled, onChange, value, onTextChange, pasteTarget }: { mode: ContentMode; block: any; disabled?: boolean; onChange: (block: any) => void; value?: string; onTextChange?: (value: string) => void; pasteTarget?: SpellTarget }) {
  const items = block?.items || [];
  if (mode === 'paragraph') return <div className="tm-paragraph-block">{onTextChange && <label className="tm-field-label"><span>விடை உரை</span><RichTextEditor pasteTarget={pasteTarget} value={value || ''} disabled={disabled} placeholder="விடையை இங்கே எழுதவும்…" onChange={onTextChange}/></label>}<label className="tm-row-mark"><span>இந்தப் பத்தியின் மதிப்பெண்</span><MarkInput disabled={disabled} value={block?.marks ?? ''} onChange={marks => onChange({ ...block, marks, content: value ?? block?.content })}/></label></div>;
  if (mode === 'table') {
    const rows = block?.tableRows || [['', '']];
    return <AnswerTableEditor rows={rows} rowMarks={block?.rowMarks || rows.map(() => '')} disabled={disabled} bordered={block?.bordered ?? true} widths={block?.columnWidths || []} onChange={tableRows => onChange({ ...block, tableRows, rowMarks: Array.from({ length: tableRows.length }, (_, index) => block?.rowMarks?.[index] ?? ''), bordered: block?.bordered ?? true, columnWidths: block?.columnWidths || [] })} onRowMarksChange={rowMarks => onChange({ ...block, tableRows: rows, rowMarks })} onBorderChange={bordered => onChange({ ...block, tableRows: rows, bordered })} onWidthChange={columnWidths => onChange({ ...block, tableRows: rows, columnWidths })}/>;
  }
  if (mode === 'list') return <div className="tm-structured-list">{items.map((item: any, index: number) => <div className="tm-structured-item" key={item.id || index}><span className="tm-option-letter">{formatLetter(index)}</span><input className="tm-plain-list-input" value={item.text || ''} disabled={disabled} placeholder={`லிஸ்ட் உருப்படி ${index + 1}`} onChange={e => onChange({ ...block, items: items.map((entry: any, i: number) => i === index ? { ...entry, text: e.target.value } : entry) })}/><label className="tm-row-mark"><span>மதிப்பெண்</span><MarkInput disabled={disabled} value={item.marks ?? ''} onChange={marks => onChange({ ...block, items: items.map((entry: any, i: number) => i === index ? { ...entry, marks } : entry) })}/></label><button className="tm-remove-item" disabled={disabled || items.length <= 1} onClick={() => onChange({ ...block, items: items.filter((_: any, i: number) => i !== index) })}><Trash2 size={14}/></button></div>)}<button className="tm-add-item" disabled={disabled} onClick={() => onChange({ ...block, items: [...items, { id: idOf(), text: '', marks: '' }] })}><Plus size={15}/> லிஸ்ட் உருப்படி சேர்</button></div>;
  return <div className="tm-structured-list"><div className="tm-split-list-heading"><span>ஸ்பிளிட் லிஸ்ட்</span><span>மதிப்பெண் · 10%</span></div>{items.map((item: any, index: number) => <div className="tm-split-entry" key={item.id || index}><div className="tm-split-entry-heading"><span className="tm-option-letter">{formatLetter(index)}.</span><button className="tm-remove-item" aria-label="உருப்படியை நீக்கு" title="உருப்படியை நீக்கு" disabled={disabled || items.length <= 1} onClick={() => onChange({ ...block, items: items.filter((_: any, i: number) => i !== index) })}><Trash2 size={14}/></button></div><div className="tm-split-item"><input className="tm-plain-list-input" value={item.left || ''} disabled={disabled} placeholder="இடது உரை" onChange={e => onChange({ ...block, items: items.map((entry: any, i: number) => i === index ? { ...entry, left: e.target.value } : entry) })}/><input className="tm-plain-list-input" value={item.right || ''} disabled={disabled} placeholder="வலது உரை" onChange={e => onChange({ ...block, items: items.map((entry: any, i: number) => i === index ? { ...entry, right: e.target.value } : entry) })}/><MarkInput ariaLabel={`வரிசை ${index + 1} மதிப்பெண்`} disabled={disabled} value={item.marks ?? ''} onChange={marks => onChange({ ...block, items: items.map((entry: any, i: number) => i === index ? { ...entry, marks } : entry) })}/></div></div>)}<button className="tm-add-item" disabled={disabled} onClick={() => onChange({ ...block, items: [...items, { id: idOf(), left: '', right: '', marks: '' }] })}><Plus size={15}/> ஸ்பிளிட் லிஸ்ட் உருப்படி சேர்</button></div>;
}

function isQuestionMetaComplete(item: BlueprintItem, optionB = false): boolean {
  const marks = optionB ? (item.marksPerQuestionB ?? item.marksPerQuestion) : item.marksPerQuestion;
  const time = optionB ? item.timeB : item.time;
  const type = optionB ? (item.itemFormatB || item.itemFormat) : item.itemFormat;
  const cognitive = optionB ? (item.cognitiveProcessB || item.cognitiveProcess) : item.cognitiveProcess;
  const discourse = optionB ? item.discourseIdB : item.discourseId;
  return !!type && Number(marks) > 0 && Number(time) > 0 && !!cognitive && (Number(marks) < 3 || !!discourse);
}

function isItemComplete(item: BlueprintItem, discourses?: Discourse[], subject?: string): boolean {
  if (!isQuestionMetaComplete(item) || (item.hasInternalChoice && !isQuestionMetaComplete(item, true))) return false;
  if (discourses && subject && item.marksPerQuestion >= 3 && !discourses.some(d => d.id === item.discourseId && d.subject === subject && d.marks === item.marksPerQuestion)) return false;
  const marksB = item.marksPerQuestionB ?? item.marksPerQuestion;
  if (discourses && subject && item.hasInternalChoice && marksB >= 3 && !discourses.some(d => d.id === item.discourseIdB && d.subject === subject && d.marks === marksB)) return false;
  if (!isNonEmpty(item.questionText)) return false;
  if (item.hasInternalChoice && (!isNonEmpty(item.questionTextB) || (!isNonEmpty(item.answerTextB) && !item.discourseIdB))) return false;
  if (isSR1(item.itemFormat)) { const mc = getMC(item); return mc.options.every(o => isNonEmpty(o.text)) && !!mc.correctOptionId; }
  if (isSR2(item.itemFormat)) {
    const mode = item.mobileQuestionMode || (item.questionContent?.type === 'match_pairs' ? 'match_pairs' : 'choose_statements');
    if (mode === 'match_pairs') { const m = getMatch(item); return m.leftItems.every(r => isNonEmpty(r.text)) && m.rightItems.every(r => isNonEmpty(r.text)) && m.leftItems.every(r => !!m.answerMappings.find(a => a.leftId === r.id)?.rightId) && (item.marksPerQuestion < 2 || !!item.discourseId || isNonEmpty(item.answerPrompt)); }
    const mc = getMC(item); return mc.options.every(o => isNonEmpty(o.text)) && (mc.correctOptionIds?.length || 0) > 0 && (item.marksPerQuestion < 2 || !!item.discourseId || isNonEmpty(item.answerPrompt));
  }
  const answerEntered = isNonEmpty(item.answerText) || !!item.discourseId;
  const titleOk = item.marksPerQuestion < 2 || !!item.discourseId || isNonEmpty(item.answerPrompt);
  return answerEntered && titleOk;
}

interface TeacherMobileAppProps {
  user: User;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
}

export default function TeacherMobileApp({ user, onLogout, onUpdateUser }: TeacherMobileAppProps) {
  const { handleDownloadPDF: exportPDF, handleDownloadWord: exportWord } = useExport();
  const [screen, setScreen] = useState<Screen>('exams');
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [paperTypes, setPaperTypes] = useState<QuestionPaperType[]>([]);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [discourses, setDiscourses] = useState<Discourse[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const savedBlueprintSnapshot = useRef<string | null>(null);
  const mobileRootRef = useRef<HTMLDivElement>(null);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBlueprint, setLoadingBlueprint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [activeQuestionId, setActiveQuestionId] = useState('');
  const questionPickerRef = useRef<HTMLDivElement>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [spellTarget, setSpellTarget] = useState<SpellTarget>('question');
  const [spellIssues, setSpellIssues] = useState<QuestionReviewSuggestion[]>([]);
  const [spellBusy, setSpellBusy] = useState(false);
  const [profileIsIncomplete, setProfileIsIncomplete] = useState(false);

  const profileFields: (keyof User)[] = ['name', 'email', 'phoneNumber', 'dob', 'pen', 'designation', 'joinDate', 'schoolName', 'district', 'bankAccountNumber', 'bankIfsc'];
  useEffect(() => {
    mobileRootRef.current?.querySelectorAll('textarea').forEach(fitTextareaToContent);
  }, [screen, blueprint]);

  useEffect(() => {
    const incomplete = profileFields.some(field => !user[field] || String(user[field]).trim() === '');
    setProfileIsIncomplete(incomplete);
    if (incomplete) setScreen('profile');
  }, [user]);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const [bps, pts, cur, ds] = await Promise.all([
        getAllAccessibleBlueprints(user.id), getQuestionPaperTypes(), getFilteredCurriculum(), getDiscourses()
      ]);
      setBlueprints(bps.filter(bp => !bp.isHidden).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setPaperTypes(pts);
      setCurriculums(cur);
      setDiscourses(ds || []);
    } catch (error) {
      await Swal.fire({ title: 'தரவை ஏற்ற முடியவில்லை', text: error instanceof Error ? error.message : 'தயவுசெய்து மீண்டும் முயற்சிக்கவும்.', icon: 'error', confirmButtonText: 'சரி' });
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { void loadLists(); }, [loadLists]);

  const currentPaperType = useMemo(() => paperTypes.find(p => p.id === blueprint?.questionPaperTypeId), [paperTypes, blueprint?.questionPaperTypeId]);
  const hasUnsavedChanges = blueprint !== null && JSON.stringify(blueprint) !== savedBlueprintSnapshot.current;
  const sortedItems = useMemo(() => blueprint ? sortBlueprintItems(blueprint.items, curriculum, currentPaperType) : [], [blueprint, curriculum, currentPaperType]);
  const activeItem = useMemo(() => sortedItems.find(item => item.id === activeQuestionId) || sortedItems[0] || null, [sortedItems, activeQuestionId]);
  const activeQuestionIndex = activeItem ? sortedItems.findIndex(item => item.id === activeItem.id) : -1;
  const previousQuestion = activeQuestionIndex > 0 ? sortedItems[activeQuestionIndex - 1] : undefined;
  const nextQuestion = activeQuestionIndex >= 0 ? sortedItems[activeQuestionIndex + 1] : undefined;
  useEffect(() => {
    if (screen !== 'questions' || !activeItem) return;
    const frame = window.requestAnimationFrame(() => {
      const picker = questionPickerRef.current;
      const card = picker?.querySelector<HTMLButtonElement>('button.active');
      if (!picker || !card) return;
      const pickerRect = picker.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const centeredLeft = picker.scrollLeft + cardRect.left - pickerRect.left - (picker.clientWidth - card.clientWidth) / 2;
      picker.scrollTo({ left: Math.max(0, centeredLeft), behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screen, activeItem?.id]);
  const availableDiscourses = useMemo(() => activeItem && blueprint ? discourses.filter(d => d.subject === blueprint.subject && d.marks === activeItem.marksPerQuestion) : [], [discourses, activeItem, blueprint]);
  const questionMetaReady = !!activeItem && isQuestionMetaComplete(activeItem) && (activeItem.marksPerQuestion < 3 || availableDiscourses.some(d => d.id === activeItem.discourseId));
  const questionMetaBReady = !!activeItem && isQuestionMetaComplete(activeItem, true) && ((activeItem.marksPerQuestionB ?? activeItem.marksPerQuestion) < 3 || discourses.some(d => d.id === activeItem.discourseIdB && d.subject === blueprint?.subject && d.marks === (activeItem.marksPerQuestionB ?? activeItem.marksPerQuestion)));
  const filteredExams = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return blueprints;
    return blueprints.filter(bp => [bp.questionPaperTypeName, bp.subject, bp.examTerm, bp.academicYear, bp.setId, String(bp.classLevel)].some(v => String(v || '').toLowerCase().includes(term)));
  }, [blueprints, search]);

  const openExam = async (listItem: Blueprint) => {
    setLoadingBlueprint(true);
    try {
      const full = await getBlueprintById(listItem.id);
      if (!full) throw new Error('இந்தத் தேர்வைத் திறக்க முடியவில்லை.');
      const cur = curriculums.find(c => c.classLevel === full.classLevel && c.subject === full.subject) || null;
      let filtered = cur;
      if (cur) {
        try { filtered = filterCurriculumByTerm(getDB() || await initDB(), cur, full.examTerm) || cur; }
        catch (error) { console.warn('Could not apply term curriculum filter in the mobile view; showing the available curriculum.', error); }
      }
      const qNumbered = ensureBlueprintItemsHaveQNo(full.items, filtered, paperTypes.find(p => p.id === full.questionPaperTypeId));
      const preparedItems = qNumbered.map(item => {
        const normalized = { ...item };
        normalized.cognitiveProcess = normalizeCognitiveProcess(item.cognitiveProcess);
        if (item.cognitiveProcessB) normalized.cognitiveProcessB = normalizeCognitiveProcess(item.cognitiveProcessB);
        if (Number(normalized.marksPerQuestion) <= 2 || Number(normalized.marksPerQuestionB ?? normalized.marksPerQuestion) <= 2) normalized.hasInternalChoice = false;
        const oldDiscourseA = discourses.find(d => d.id === normalized.discourseId);
        const oldRubricsA = oldDiscourseA?.rubrics?.map(r => `${r.point} — ${r.marks} மதிப்பெண்`).join('\n');
        if (oldRubricsA && normalized.answerText === oldRubricsA) { normalized.answerText = ''; normalized.answerBlocks = undefined; }
        if (oldDiscourseA && normalized.answerPrompt === oldDiscourseA.name) normalized.answerPrompt = '';
        if (normalized.marksPerQuestion < 3 || !discourses.some(d => d.id === normalized.discourseId && d.subject === full.subject && d.marks === normalized.marksPerQuestion)) {
          normalized.discourseId = undefined;
          normalized.enableDiscourse = false;
        }
        const marksB = normalized.marksPerQuestionB ?? normalized.marksPerQuestion;
        const oldDiscourseB = discourses.find(d => d.id === normalized.discourseIdB);
        const oldRubricsB = oldDiscourseB?.rubrics?.map(r => `${r.point} — ${r.marks} மதிப்பெண்`).join('\n');
        if (oldRubricsB && normalized.answerTextB === oldRubricsB) { normalized.answerTextB = ''; normalized.answerBlocksB = undefined; }
        if (oldDiscourseB && normalized.answerPromptB === oldDiscourseB.name) normalized.answerPromptB = '';
        if (normalized.hasInternalChoice && (marksB < 3 || !discourses.some(d => d.id === normalized.discourseIdB && d.subject === full.subject && d.marks === marksB))) {
          normalized.discourseIdB = undefined;
          normalized.enableDiscourseB = false;
        }
        return normalized;
      });
      const prepared = { ...full, items: preparedItems };
      savedBlueprintSnapshot.current = JSON.stringify(prepared);
      setBlueprint(prepared);
      setCurriculum(filtered);
      setActiveQuestionId(sortBlueprintItems(prepared.items, filtered, paperTypes.find(p => p.id === prepared.questionPaperTypeId))[0]?.id || '');
      setScreen('exam-home');
      setSpellIssues([]);
    } catch (error) {
      await Swal.fire({ title: 'தேர்வைத் திறக்க முடியவில்லை', text: error instanceof Error ? error.message : 'தரவுத் தொடர்பைச் சரிபார்க்கவும்.', icon: 'error', confirmButtonText: 'சரி' });
    } finally {
      setLoadingBlueprint(false);
    }
  };

  const updateItem = useCallback((id: string, field: keyof BlueprintItem | Partial<BlueprintItem>, value?: any) => {
    setBlueprint(previous => {
      if (!previous) return previous;
      const patch = typeof field === 'object' && field !== null ? field : { [field as keyof BlueprintItem]: value } as Partial<BlueprintItem>;
      const items = previous.items.map(item => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.marksPerQuestion !== undefined || patch.questionCount !== undefined) {
          next.totalMarks = (Number(next.marksPerQuestion) || 0) * (Number(next.questionCount) || 0);
          if (Number(next.marksPerQuestion) < 3 || (next.discourseId && !discourses.some(d => d.id === next.discourseId && d.subject === previous.subject && d.marks === next.marksPerQuestion))) {
            const previousDiscourse = discourses.find(d => d.id === item.discourseId);
            const previousRubrics = previousDiscourse?.rubrics?.map(r => `${r.point} — ${r.marks} மதிப்பெண்`).join('\n');
            if (previousRubrics && item.answerText === previousRubrics) { next.answerText = ''; next.answerBlocks = undefined; }
            if (previousDiscourse && item.answerPrompt === previousDiscourse.name) next.answerPrompt = '';
            next.discourseId = undefined;
            next.enableDiscourse = false;
          }
        }
        if (patch.marksPerQuestionB !== undefined && (Number(next.marksPerQuestionB) < 3 || (next.discourseIdB && !discourses.some(d => d.id === next.discourseIdB && d.subject === previous.subject && d.marks === next.marksPerQuestionB)))) {
          const previousDiscourse = discourses.find(d => d.id === item.discourseIdB);
          const previousRubrics = previousDiscourse?.rubrics?.map(r => `${r.point} — ${r.marks} மதிப்பெண்`).join('\n');
          if (previousRubrics && item.answerTextB === previousRubrics) { next.answerTextB = ''; next.answerBlocksB = undefined; }
          if (previousDiscourse && item.answerPromptB === previousDiscourse.name) next.answerPromptB = '';
          next.discourseIdB = undefined;
          next.enableDiscourseB = false;
        }
        if (next.hasInternalChoice) {
          if (patch.knowledgeLevel !== undefined) next.knowledgeLevelB = next.knowledgeLevel;
          if (patch.cognitiveProcess !== undefined) next.cognitiveProcessB = next.cognitiveProcess;
          if (!next.unitIdB) next.unitIdB = next.unitId;
          if (!next.subUnitIdB) next.subUnitIdB = next.subUnitId;
        }
        return next;
      });
      return { ...previous, items, isAnswerKeyConfirmed: false, updatedAt: new Date().toISOString() };
    });
  }, [discourses]);

  const moveItem = useCallback((itemId: string, newUnitId: string, newSectionId: string, newSubUnitId?: string) => {
    if (!curriculum) return;
    const unit = curriculum.units.find(u => u.id === newUnitId);
    if (!unit) return;
    setBlueprint(previous => previous ? ({
      ...previous,
      items: previous.items.map(item => item.id === itemId ? {
        ...item, unitId: newUnitId, subUnitId: newSubUnitId || unit.subUnits[0]?.id || item.subUnitId,
        unitIdB: item.hasInternalChoice ? newUnitId : undefined,
        subUnitIdB: item.hasInternalChoice ? (newSubUnitId || unit.subUnits[0]?.id || item.subUnitIdB) : undefined
      } : item), updatedAt: new Date().toISOString()
    }) : previous);
  }, [curriculum]);

  const saveCurrent = useCallback(async (showToast = true) => {
    if (!blueprint) return;
    const toSave = { ...blueprint, updatedAt: new Date().toISOString() };
    setSaving(true);
    try {
      await saveBlueprint(toSave);
      savedBlueprintSnapshot.current = JSON.stringify(toSave);
      setBlueprint(toSave);
      setBlueprints(old => old.map(bp => bp.id === toSave.id ? toSave : bp));
      if (showToast) await Swal.fire({ toast: true, position: 'top', title: 'சேமிக்கப்பட்டது', icon: 'success', timer: 1300, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ title: 'சேமிக்க முடியவில்லை', text: error instanceof Error ? error.message : 'பிறகு முயற்சிக்கவும்.', icon: 'error', confirmButtonText: 'சரி' });
      throw error;
    } finally {
      setSaving(false);
    }
  }, [blueprint]);

  const confirmBlueprint = async () => {
    if (!blueprint) return;
    const approved = { ...blueprint, isConfirmed: true };
    setBlueprint(approved);
    setSaving(true);
    try {
      await saveBlueprint(approved);
      savedBlueprintSnapshot.current = JSON.stringify(approved);
      setBlueprints(old => old.map(bp => bp.id === approved.id ? approved : bp));
      await Swal.fire({ title: 'Blueprint உறுதி செய்யப்பட்டது', icon: 'success', confirmButtonText: 'சரி' });
    } catch (error) {
      await Swal.fire({ title: 'சேமிக்க முடியவில்லை', text: error instanceof Error ? error.message : 'மீண்டும் முயற்சிக்கவும்.', icon: 'error' });
    } finally { setSaving(false); }
  };

  const confirmQuestionAnswers = async () => {
    if (!blueprint || completedCount !== blueprint.items.length) return;
    const result = await Swal.fire({ title: 'வினாக்களையும் விடைகளையும் உறுதி செய்யவா?', text: 'உறுதி செய்த பிறகும் மாற்றங்களைச் செய்து மீண்டும் சேமிக்கலாம்.', icon: 'question', showCancelButton: true, confirmButtonText: 'உறுதி செய்', cancelButtonText: 'திரும்பு' });
    if (!result.isConfirmed) return;
    const next = { ...blueprint, isAnswerKeyConfirmed: true };
    setBlueprint(next);
    setSaving(true);
    try {
      await saveBlueprint(next);
      savedBlueprintSnapshot.current = JSON.stringify(next);
      setBlueprints(old => old.map(bp => bp.id === next.id ? next : bp));
      await Swal.fire({ title: 'வினா மற்றும் விடைகள் உறுதி செய்யப்பட்டன', icon: 'success', confirmButtonText: 'சரி' });
    } catch (error) {
      await Swal.fire({ title: 'உறுதிப்படுத்த முடியவில்லை', text: error instanceof Error ? error.message : 'மீண்டும் முயற்சிக்கவும்.', icon: 'error' });
    } finally { setSaving(false); }
  };

  const syncMC = (item: BlueprintItem, mc: MCData, type: 'single' | 'multi') => {
    const ids = (mc.correctOptionIds || []).filter(id => mc.options.some(o => o.id === id));
    const correctId = type === 'single' ? mc.correctOptionId : (ids[0] || '');
    const correctOptions = type === 'single'
      ? mc.options.filter(o => o.id === correctId)
      : mc.options.filter(o => ids.includes(o.id));
    const answer = correctOptions.map(o => `${formatLetter(mc.options.findIndex(v => v.id === o.id))}) ${o.text}`).join('\n');
    const content: StructuredQuestionContent = { type: 'multiple_choice', multipleChoice: { ...mc, correctOptionId: correctId, correctOptionIds: type === 'single' ? (correctId ? [correctId] : []) : ids } };
    updateItem(item.id, {
      questionText: mc.prompt,
      questionContent: content,
      answerText: answer,
      answerPrompt: isSR1(item.itemFormat) ? '' : (isSR2(item.itemFormat) && (!item.answerPrompt || item.answerPrompt === item.questionText) ? mc.prompt : item.answerPrompt),
      enableInputAnswer: true,
      mobileQuestionMode: isSR1(item.itemFormat) ? 'multiple_choice' : 'choose_statements',
      mobileAnswerMode: 'paragraph',
      answerBlocks: undefined
    });
  };

  const syncMatch = (item: BlueprintItem, match: MatchData) => {
    const lines = match.leftItems.map((left, i) => {
      const mapping = match.answerMappings.find(m => m.leftId === left.id);
      const rightIdx = match.rightItems.findIndex(right => right.id === mapping?.rightId);
      if (rightIdx < 0) return '';
      return `${i + 1}. ${left.text} — ${formatLetter(rightIdx)}) ${match.rightItems[rightIdx].text}`;
    }).filter(Boolean);
    const content: StructuredQuestionContent = { type: 'match_pairs', matchPairs: match };
    updateItem(item.id, { questionText: match.prompt, questionContent: content, answerText: lines.join('\n'), mobileQuestionMode: 'match_pairs', enableInputAnswer: true });
  };

  const currentAnswerText = activeItem ? (activeItem.mobileAnswerMode === 'table'
    ? (((activeItem.answerBlocks?.find((block: any) => block.type === 'table')?.tableRows as string[][] | undefined) || []).map(row => row.join('\t')).join('\n'))
    : stripHtml(activeItem.answerText)) : '';
  const currentAnswerTextB = activeItem ? (activeItem.mobileAnswerModeB === 'table'
    ? (((activeItem.answerBlocksB?.find((block: any) => block.type === 'table')?.tableRows as string[][] | undefined) || []).map(row => row.join('\t')).join('\n'))
    : stripHtml(activeItem.answerTextB)) : '';
  const setAnswerMode = (optionB: boolean, mode: ContentMode) => {
    if (!activeItem) return;
    const currentBlocks = optionB ? activeItem.answerBlocksB : activeItem.answerBlocks;
    const currentMode = optionB ? activeItem.mobileAnswerModeB : activeItem.mobileAnswerMode;
    if (currentMode === mode) return;
    let block = currentBlocks?.find((entry: any) => entry.type === mode);
    if (!block) {
      block = emptyContentBlock(mode);
      if (mode === 'paragraph') block.content = optionB ? currentAnswerTextB : currentAnswerText;
      if (mode === 'table') {
        const text = optionB ? currentAnswerTextB : currentAnswerText;
        const rows = text.trim() ? text.split('\n').map(line => line.includes('\t') ? line.split('\t') : [line, '']) : [['', ''], ['', '']];
        block.tableRows = rows;
        block.rowMarks = rows.map(() => '');
        block.columnWidths = Array(Math.max(1, ...rows.map(row => row.length))).fill(Math.floor(100 / Math.max(1, ...rows.map(row => row.length))));
      }
    }
    const html = blockHTML(block, mode);
    if (optionB) updateItem(activeItem.id, { mobileAnswerModeB: mode, answerBlocksB: [block], answerTextB: html, enableInputAnswerB: true });
    else updateItem(activeItem.id, { mobileAnswerMode: mode, answerBlocks: [block], answerText: html, enableInputAnswer: true });
  };
  const updateAnswerBlock = (optionB: boolean, block: any) => {
    if (!activeItem) return;
    const mode = (optionB ? activeItem.mobileAnswerModeB : activeItem.mobileAnswerMode) || 'paragraph';
    const html = blockHTML(block, mode);
    if (optionB) updateItem(activeItem.id, { answerBlocksB: [block], answerTextB: html, enableInputAnswerB: true });
    else updateItem(activeItem.id, { answerBlocks: [block], answerText: html, enableInputAnswer: true });
  };
  const setQuestionTextMode = (optionB: boolean, mode: ContentMode) => {
    if (!activeItem) return;
    const text = optionB ? (activeItem.questionPromptB ?? stripHtml(activeItem.questionTextB)) : (activeItem.questionPrompt ?? stripHtml(activeItem.questionText));
    const oldMode = optionB ? activeItem.mobileQuestionTextModeB : activeItem.mobileQuestionTextMode;
    if (oldMode === mode) return;
    const currentBlocks = optionB ? activeItem.questionBlocksB : activeItem.questionBlocks;
    const block = currentBlocks?.find((entry: any) => entry.type === mode) || emptyContentBlock(mode);
    const prompt = text || '';
    const html = `${prompt ? `<p>${prompt}</p>` : ''}${blockHTML(block, mode)}`;
    updateItem(activeItem.id, optionB ? { mobileQuestionTextModeB: mode, questionPromptB: prompt, questionBlocksB: [block], questionTextB: html } : { mobileQuestionTextMode: mode, questionPrompt: prompt, questionBlocks: [block], questionText: html });
  };
  const updateQuestionTable = (optionB: boolean, rows: string[][], changes: { bordered?: boolean; columnWidths?: number[] } = {}) => {
    if (!activeItem) return;
    const current = optionB ? activeItem.questionBlocksB?.[0] : activeItem.questionBlocks?.[0];
    const bordered = changes.bordered ?? current?.bordered ?? true;
    const columnWidths = changes.columnWidths ?? current?.columnWidths ?? [];
    const block = { ...(current || {}), id: idOf(), type: 'table', tableRows: rows, bordered, columnWidths };
    block.rowMarks = block.rowMarks || rows.map(() => '');
    const html = `${optionB ? activeItem.questionPromptB || '' : activeItem.questionPrompt || ''}${blockHTML(block, 'table')}`;
    updateItem(activeItem.id, optionB ? { mobileQuestionTextModeB: 'table', questionBlocksB: [block], questionTextB: html } : { mobileQuestionTextMode: 'table', questionBlocks: [block], questionText: html });
  };
  const updateQuestionBlock = (optionB: boolean, block: any) => {
    if (!activeItem) return;
    const mode = (optionB ? activeItem.mobileQuestionTextModeB : activeItem.mobileQuestionTextMode) || 'paragraph';
    const prompt = optionB ? activeItem.questionPromptB || '' : activeItem.questionPrompt || '';
    const html = mode === 'paragraph' ? blockHTML(block, mode) : `${prompt ? `<p>${prompt}</p>` : ''}${blockHTML(block, mode)}`;
    updateItem(activeItem.id, optionB ? { questionBlocksB: [block], questionTextB: html } : { questionBlocks: [block], questionText: html });
  };
  const setQuestionText = (optionB: boolean, value: string) => {
    if (!activeItem) return;
    const mode = optionB ? activeItem.mobileQuestionTextModeB || 'paragraph' : activeItem.mobileQuestionTextMode || 'paragraph';
    const blocks = optionB ? activeItem.questionBlocksB : activeItem.questionBlocks;
    const block = blocks?.find((entry: any) => entry.type === mode) || emptyContentBlock(mode);
    if (mode === 'paragraph') block.content = value;
    if (mode === 'paragraph') block.content = value;
    const html = mode === 'paragraph' ? blockHTML(block, mode) : `${value ? `<p>${value}</p>` : ''}${blockHTML(block, mode)}`;
    if (optionB) { updateItem(activeItem.id, { questionPromptB: value, questionTextB: html, questionBlocksB: [block] }); return; }
    const patch: Partial<BlueprintItem> = { questionPrompt: value, questionText: html, questionBlocks: [block] };
    if (activeItem.questionContent?.type === 'multiple_choice') patch.questionContent = { ...activeItem.questionContent, multipleChoice: { ...activeItem.questionContent.multipleChoice!, prompt: value } };
    if (activeItem.questionContent?.type === 'match_pairs') patch.questionContent = { ...activeItem.questionContent, matchPairs: { ...activeItem.questionContent.matchPairs!, prompt: value } };
    if (isSR2(activeItem.itemFormat) && activeItem.mobileQuestionMode === 'choose_statements' && (!activeItem.answerPrompt || activeItem.answerPrompt === activeItem.questionText)) patch.answerPrompt = stripHtml(value);
    updateItem(activeItem.id, patch);
  };
  const activeQuestionComplete = useMemo(() => activeItem && blueprint ? isItemComplete(activeItem, discourses, blueprint.subject) : false, [activeItem, blueprint, discourses]);

  const updateMC = (item: BlueprintItem, patch: Partial<MCData>, kind: 'single' | 'multi') => {
    const current = getMC(item);
    const next: MCData = { ...current, ...patch };
    syncMC(item, next, kind);
  };

  const runSpelling = async (target: SpellTarget) => {
    if (!activeItem) return;
    const source = target === 'question' ? activeItem.questionText || '' : (activeItem.mobileAnswerMode === 'table'
      ? (((activeItem.answerBlocks?.find((block: any) => block.type === 'table')?.tableRows as string[][] | undefined) || []).flat().join(' '))
      : stripHtml(activeItem.answerText));
    if (!source.trim()) {
      await Swal.fire({ title: 'உரை இல்லை', text: target === 'question' ? 'முதலில் வினாவை உள்ளிடவும்.' : 'முதலில் விடையை உள்ளிடவும்.', icon: 'info', confirmButtonText: 'சரி' });
      return;
    }
    setSpellTarget(target);
    setSpellBusy(true);
    try {
      const review = await reviewQuestionWithGemini(target === 'question'
        ? { questionText: source, marks: activeItem.marksPerQuestion, time: activeItem.time }
        : { answerText: source, marks: activeItem.marksPerQuestion, time: activeItem.time });
      const issues = review.suggestions.filter(issue => issue.type === 'spelling');
      setSpellIssues(issues);
      if (!issues.length) {
        await Swal.fire({ title: 'பிழைகள் இல்லை', text: 'Gemini ஆய்வில் எழுத்துப்பிழை காணப்படவில்லை.', icon: 'success', timer: 1500, showConfirmButton: false });
      }
    } catch (error) {
      await Swal.fire({ title: 'சொல் சரிபார்ப்பு தோல்வி', text: error instanceof Error ? error.message : 'Gemini அமைப்பில் API key-ஐச் சேர்த்து மீண்டும் முயற்சிக்கவும்.', icon: 'error', confirmButtonText: 'சரி' });
    } finally { setSpellBusy(false); }
  };

  const runGeminiReview = async () => {
    if (!activeItem) return;
    setSpellBusy(true);
    setSpellTarget('question');
    try {
      const mc = getMC(activeItem);
      const result = await reviewQuestionWithGemini({
        questionText: activeItem.questionText, answerText: stripHtml(activeItem.answerText),
        options: isSR1(activeItem.itemFormat) || isSR2(activeItem.itemFormat) ? mc.options.map(o => o.text) : undefined,
        questionTextB: activeItem.questionTextB, answerTextB: activeItem.answerTextB,
        optionsB: activeItem.questionContentB?.multipleChoice?.options.map(o => o.text),
        marks: activeItem.marksPerQuestion, time: activeItem.time, questionType: activeItem.itemFormat,
        marksB: activeItem.marksPerQuestionB, timeB: activeItem.timeB, questionTypeB: activeItem.itemFormatB,
        discourseNotes: (discourses.find(d => d.id === activeItem.discourseId)?.rubrics || []).map(r => `${r.point} (${r.marks})`),
        discourseNotesB: (discourses.find(d => d.id === activeItem.discourseIdB)?.rubrics || []).map(r => `${r.point} (${r.marks})`)
      });
      setSpellIssues(result.suggestions);
      if (!result.suggestions.length) await Swal.fire({ title: 'ஆய்வு முடிந்தது', text: 'எழுத்து, வாக்கிய அமைப்பு அல்லது கருத்துப் பிழை எதுவும் கண்டறியப்படவில்லை.', icon: 'success', timer: 1800, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ title: 'Gemini ஆய்வு முடியவில்லை', text: error instanceof Error ? error.message : 'Gemini API அமைப்பைச் சரிபார்க்கவும்.', icon: 'error', confirmButtonText: 'சரி' });
    } finally { setSpellBusy(false); }
  };

  const applyReviewSuggestion = (suggestion: QuestionReviewSuggestion) => {
    if (!activeItem) return;
    const replace = (source: string) => {
      const index = source.indexOf(suggestion.original);
      return index < 0 ? source : `${source.slice(0, index)}${suggestion.suggestion}${source.slice(index + suggestion.original.length)}`;
    };
    if (suggestion.field === 'questionText' || suggestion.field === 'answerText' || suggestion.field === 'questionTextB' || suggestion.field === 'answerTextB') {
      const field = suggestion.field;
      const value = replace(field === 'answerText' || field === 'answerTextB' ? stripHtml(activeItem[field]) : activeItem[field] || '');
      const patch: Partial<BlueprintItem> = { [field]: value };
      if (field === 'questionText' && activeItem.questionContent?.type === 'multiple_choice') patch.questionContent = { ...activeItem.questionContent, multipleChoice: { ...activeItem.questionContent.multipleChoice!, prompt: value } };
      if (field === 'questionText' && activeItem.questionContent?.type === 'match_pairs') patch.questionContent = { ...activeItem.questionContent, matchPairs: { ...activeItem.questionContent.matchPairs!, prompt: value } };
      if (field === 'answerText' && activeItem.mobileAnswerMode === 'table') {
        const block = activeItem.answerBlocks?.find((entry: any) => entry.type === 'table') || {};
        const rows = ((block.tableRows as string[][] | undefined) || []).map(row => row.map(cell => replace(cell)));
        const bordered = block.bordered ?? true;
        const columnWidths = block.columnWidths || [];
        patch.answerText = questionTableHtml(rows, bordered, columnWidths);
        patch.answerBlocks = [{ ...block, id: idOf(), type: 'table', tableRows: rows, bordered, columnWidths }];
      } else if (field === 'answerText') patch.answerBlocks = [{ id: idOf(), type: 'paragraph', content: value }];
      if (field === 'answerTextB') patch.answerBlocksB = [{ id: idOf(), type: 'paragraph', content: value }];
      updateItem(activeItem.id, patch);
    } else {
      const fieldB = suggestion.field === 'optionB';
      const current = fieldB ? (activeItem.questionContentB?.multipleChoice || getMC({ ...activeItem, questionContent: activeItem.questionContentB })) : getMC(activeItem);
      const options = current.options.map((option, index) => index === suggestion.index ? { ...option, text: replace(option.text) } : option);
      const content: StructuredQuestionContent = { type: 'multiple_choice', multipleChoice: { ...current, options } };
      updateItem(activeItem.id, fieldB ? { questionContentB: content } : { questionContent: content });
    }
    setSpellIssues(old => old.filter(issue => issue !== suggestion));
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      await Swal.fire({ toast: true, position: 'top', title: 'நகலெடுக்கப்பட்டது', icon: 'success', timer: 1000, showConfirmButton: false });
    } catch {
      await Swal.fire({ title: 'Copy அனுமதி இல்லை', text: 'உரைப்பெட்டியில் long-press செய்து Copy தேர்வு செய்யவும்.', icon: 'info', confirmButtonText: 'சரி' });
    }
  };
  const pasteText = async (target: SpellTarget) => {
    if (!activeItem) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!insertTextAtSavedCursor(target, text)) {
        await Swal.fire({ toast: true, position: 'top', title: 'முதலில் உரை இன்புட்டில் கர்சரை வைக்கவும்', icon: 'info', timer: 1800, showConfirmButton: false });
      }
    } catch {
      await Swal.fire({ title: 'Paste அனுமதி இல்லை', text: 'உரைப்பெட்டியைத் தொட்டு long-press செய்து Paste தேர்வு செய்யவும்.', icon: 'info', confirmButtonText: 'சரி' });
    }
  };

  const goBack = () => {
    setShowInfo(false);
    setSpellIssues([]);
    if (screen === 'exams') return;
    if (screen === 'exam-home') { setBlueprint(null); savedBlueprintSnapshot.current = null; setCurriculum(null); setScreen('exams'); return; }
    if (screen === 'profile') return;
    setScreen('exam-home');
  };

  const completedCount = blueprint ? blueprint.items.filter(item => isItemComplete(item, discourses, blueprint.subject)).length : 0;

  const renderQuestionMetadata = (optionB: boolean) => {
    if (!activeItem || !blueprint) return null;
    const marks = optionB ? (activeItem.marksPerQuestionB ?? activeItem.marksPerQuestion) : activeItem.marksPerQuestion;
    const format = optionB ? (activeItem.itemFormatB || activeItem.itemFormat) : activeItem.itemFormat;
    const time = optionB ? activeItem.timeB : activeItem.time;
    const cognitive = optionB ? (activeItem.cognitiveProcessB || activeItem.cognitiveProcess) : activeItem.cognitiveProcess;
    const discourseId = optionB ? activeItem.discourseIdB : activeItem.discourseId;
    const matchingDiscourses = discourses.filter(d => d.subject === blueprint.subject && d.marks === marks);
    const markValues = [...new Set([
      marks,
      ...(currentPaperType?.sections || []).map(section => section.marks),
      ...discourses.filter(d => d.subject === blueprint.subject).map(d => d.marks)
    ].filter(value => Number(value) > 0))].sort((a, b) => a - b);
    const formatOptions: [ItemFormat, string][] = [
      [ItemFormat.SR1, 'SR1 - Multiple Choice'], [ItemFormat.SR2, 'SR2 - Match / Correct Statement'], [ItemFormat.CRS1, 'CSR1 - VSA'],
      [ItemFormat.CRS2, 'CSR2 - SA'], [ItemFormat.CRL, 'CRL1 - Essay']
    ];
    const chooseDiscourse = (id: string) => {
      const selected = matchingDiscourses.find(d => d.id === id);
      if (optionB) updateItem(activeItem.id, {
        discourseIdB: selected?.id, enableDiscourseB: !!selected,
        enableInputAnswerB: !!selected || activeItem.enableInputAnswerB,
        ...(activeItem.answerPromptB === discourses.find(d => d.id === activeItem.discourseIdB)?.name ? { answerPromptB: '' } : {})
      });
      else updateItem(activeItem.id, {
        discourseId: selected?.id, enableDiscourse: !!selected,
        ...(activeItem.answerPrompt === discourses.find(d => d.id === activeItem.discourseId)?.name ? { answerPrompt: '' } : {})
      });
    };
    return <>
      <div className="tm-form-grid tm-question-meta-grid tm-question-meta-primary">
        <label><span>Type</span><select value={format} onChange={e => updateItem(activeItem.id, optionB ? { itemFormatB: e.target.value as ItemFormat } : { itemFormat: e.target.value as ItemFormat })}>{formatOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Mark 🔒</span><select value={String(marks)} disabled title="Blueprint-ல் அமைக்கப்பட்ட மதிப்பெண் பூட்டப்பட்டுள்ளது">{markValues.map(mark => <option key={mark} value={mark}>{formatMobileMark(mark)}</option>)}</select></label>
        <label><span>Time (நிமி.)</span><input type="number" min={1} max={180} value={time || ''} placeholder="நிமிடம்" onChange={e => updateItem(activeItem.id, optionB ? { timeB: e.target.value ? Math.max(1, Number(e.target.value)) : undefined } : { time: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}/></label>
      </div>
      <div className="tm-form-grid tm-question-meta-grid tm-question-meta-secondary">
        <label><span>Discourse & Rubrics</span><select value={discourseId || ''} disabled={Number(marks) < 3 || matchingDiscourses.length === 0} onChange={e => chooseDiscourse(e.target.value)}>
          {Number(marks) < 3 ? <option value="">1–2 மதிப்பெண்: இல்லை</option> : <><option value="">Discourse தேர்வு</option>{matchingDiscourses.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</>}
        </select></label>
        <label><span>Cognitive</span><select value={cognitive} onChange={e => updateItem(activeItem.id, optionB ? { cognitiveProcessB: e.target.value as CognitiveProcess } : { cognitiveProcess: e.target.value as CognitiveProcess })}>{Object.values(CognitiveProcess).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      {Number(marks) >= 3 && matchingDiscourses.length === 0 && <p className="tm-meta-hint">{marks} மதிப்பெண்ணுக்கான Discourse / Rubrics-ஐ Admin Manager-ல் சேர்க்கவும்.</p>}
    </>;
  };

  const toggleInternalChoice = (enabled: boolean) => {
    if (!activeItem) return;
    if (enabled && (Number(activeItem.marksPerQuestion) <= 2 || Number(activeItem.marksPerQuestionB ?? activeItem.marksPerQuestion) <= 2)) return;
    const marksB = activeItem.marksPerQuestionB ?? activeItem.marksPerQuestion;
    const canReuseDiscourseA = activeItem.discourseId && discourses.some(d => d.id === activeItem.discourseId && d.marks === marksB);
    updateItem(activeItem.id, {
      hasInternalChoice: enabled,
      ...(enabled ? {
        itemFormatB: activeItem.itemFormatB || activeItem.itemFormat,
        marksPerQuestionB: activeItem.marksPerQuestionB ?? activeItem.marksPerQuestion,
        timeB: activeItem.timeB ?? activeItem.time,
        discourseIdB: activeItem.discourseIdB || (canReuseDiscourseA ? activeItem.discourseId : undefined),
        cognitiveProcessB: activeItem.cognitiveProcessB || activeItem.cognitiveProcess,
        unitIdB: activeItem.unitIdB || activeItem.unitId,
        subUnitIdB: activeItem.subUnitIdB || activeItem.subUnitId,
        knowledgeLevelB: activeItem.knowledgeLevelB || activeItem.knowledgeLevel
      } : {})
    });
  };

  const renderQuestionBody = (optionB: boolean) => {
    if (!activeItem) return null;
    const mode = (optionB ? activeItem.mobileQuestionTextModeB : activeItem.mobileQuestionTextMode) || 'paragraph';
    const blocks = optionB ? activeItem.questionBlocksB : activeItem.questionBlocks;
    const block = blocks?.find((entry: any) => entry.type === mode) || emptyContentBlock(mode);
    const prompt = optionB ? activeItem.questionPromptB ?? stripHtml(activeItem.questionTextB) : activeItem.questionPrompt ?? stripHtml(activeItem.questionText);
    const ready = optionB ? questionMetaBReady : questionMetaReady;
    return <>
      <ContentModeSelector title="வினா வடிவம்" value={mode} disabled={!ready} onChange={next => setQuestionTextMode(optionB, next)}/>
      <label className="tm-field-label"><span>வினா உரை</span><RichTextEditor pasteTarget="question" listIconsOnly value={prompt || ''} disabled={!ready} placeholder={optionB ? 'வினா B-ஐ எழுதவும்…' : 'வினாவை இங்கே உள்ளிடவும்…'} onChange={value => setQuestionText(optionB, value)}/></label>
      <StructuredItemsEditor mode={mode} block={block} disabled={!ready} onChange={next => updateQuestionBlock(optionB, next)}/>
    </>;
  };

  const renderAnswerBody = (optionB: boolean) => {
    if (!activeItem) return null;
    const mode = (optionB ? activeItem.mobileAnswerModeB : activeItem.mobileAnswerMode) || 'paragraph';
    const blocks = optionB ? activeItem.answerBlocksB : activeItem.answerBlocks;
    const block = blocks?.find((entry: any) => entry.type === mode) || emptyContentBlock(mode);
    const ready = optionB ? questionMetaBReady : questionMetaReady;
    return <>
      <ContentModeSelector title="விடை வடிவம்" value={mode} disabled={!ready} onChange={next => setAnswerMode(optionB, next)}/>
      <StructuredItemsEditor mode={mode} block={block} disabled={!ready} value={block?.content || (optionB ? activeItem.answerTextB : activeItem.answerText) || ''} onTextChange={value => updateAnswerBlock(optionB, { ...block, content: value })} onChange={next => updateAnswerBlock(optionB, next)} pasteTarget="answer"/>
    </>;
  };

  const statusText = (bp: Blueprint) => bp.isConfirmed ? 'உறுதி செய்யப்பட்டது' : 'திருத்தம் தேவை';
  return (
    <div ref={mobileRootRef} className="tm-mobile-root" onInput={event => {
      if (event.target instanceof HTMLTextAreaElement) fitTextareaToContent(event.target);
    }}>
      <div className="tm-app-shell">
        {screen !== 'exams' && screen !== 'profile' && (
          <header className="tm-topbar">
            <button className="tm-icon-button" aria-label="பின்னால்" onClick={goBack}><ArrowLeft size={22}/></button>
            <div className="tm-topbar-title"><span>{screen === 'exam-home' ? 'தேர்வு முகப்பு' : screen === 'blueprint' ? 'Blue Print' : screen === 'questions' ? 'Question Paper' : screen === 'reports' ? 'Reports View' : 'Analysis'}</span><small>{blueprint ? `${blueprint.subject} · வகுப்பு ${blueprint.classLevel} · ${blueprint.setId || 'Set A'}` : ''}</small></div>
            {blueprint && screen !== 'exam-home' && <button className={`tm-save-dot ${saving ? 'is-saving' : hasUnsavedChanges ? 'is-dirty' : 'is-clean'}`} onClick={() => void saveCurrent()} disabled={saving || !hasUnsavedChanges} aria-label={hasUnsavedChanges ? 'மாற்றங்களைச் சேமி' : 'சேமிக்க மாற்றங்கள் இல்லை'} title={hasUnsavedChanges ? 'மாற்றங்களைச் சேமி' : 'சேமிக்க மாற்றங்கள் இல்லை'}>{saving ? <LoaderCircle size={20} className="tm-spin"/> : <Save size={20}/>}</button>}
          </header>
        )}

        {screen === 'exams' && (
          <div className="tm-home-page">
            <header className="tm-home-header">
              <div className="tm-profile-row"><div className="tm-avatar">{(user.name || user.username || 'T').slice(0, 1).toUpperCase()}</div><div><p className="tm-eyebrow">TEACHER WORKSPACE</p><h1>வணக்கம், {user.name || user.username}</h1><p className="tm-subtext">உங்கள் தேர்வுகளைத் தேர்ந்தெடுக்கவும்</p></div><div className="tm-home-actions"><button className="tm-icon-button" onClick={() => setScreen('profile')} aria-label="சுயவிவரப் பக்கத்திற்குச் செல்லவும்"><UserRound size={19}/></button><button className="tm-icon-button tm-logout-button" onClick={onLogout} aria-label="வெளியேறவும்"><LogOut size={19}/></button></div></div>
              <div className="tm-search-box"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="தேர்வு, பாடம், வகுப்பு தேடவும்" /></div>
              <div className="tm-stats-row"><div><strong>{blueprints.length}</strong><span>தேர்வுகள்</span></div><div><strong>{blueprints.filter(bp => bp.isConfirmed).length}</strong><span>உறுதி</span></div><div><strong>{blueprints.reduce((sum, bp) => sum + bp.items.length, 0)}</strong><span>வினா பதிவுகள்</span></div></div>
            </header>
            <main className="tm-screen-content tm-exam-list tm-home-list">
              <div className="tm-section-title"><div><h2>என் தேர்வுகள்</h2><p>திறக்க ஒரு தேர்வைத் தேர்வு செய்யவும்</p></div><button className="tm-refresh-button" onClick={() => void loadLists()}><LoaderCircle size={16}/> புதுப்பி</button></div>
              {loading ? <div className="tm-empty-state"><LoaderCircle className="tm-spin" size={28}/><span>தேர்வுகள் ஏற்றப்படுகின்றன…</span></div> : filteredExams.length === 0 ? <div className="tm-empty-state"><BookOpen size={36}/><strong>தேர்வுகள் இல்லை</strong><span>Admin ஒதுக்கிய Blueprint-கள் இங்கே தோன்றும்.</span></div> : <div className="tm-exam-cards">{filteredExams.map((bp, idx) => <button className="tm-exam-card" key={bp.id} onClick={() => void openExam(bp)}><div className={`tm-exam-symbol tm-symbol-${idx % 5}`}><NotebookTabs size={23}/></div><div className="tm-exam-card-main"><div className="tm-exam-card-line"><strong>{bp.questionPaperTypeName || bp.examTerm}</strong><span className={`tm-status ${bp.isConfirmed ? 'tm-status-done' : ''}`}>{bp.isConfirmed ? <CheckCircle2 size={12}/> : <PencilLine size={12}/>} {statusText(bp)}</span></div><p>{bp.subject} · வகுப்பு {bp.classLevel}</p><div className="tm-exam-meta"><span>{bp.examTerm}</span><span>{bp.academicYear || getCurrentAcademicYear()}</span><span>{bp.setId || 'Set A'}</span></div><div className="tm-progress-track"><span style={{ width: `${Math.min(100, bp.items.filter(i => isNonEmpty(i.questionText)).length / Math.max(1, bp.items.length) * 100)}%` }}/></div></div><ChevronRight size={18} className="tm-chevron"/></button>)}</div>}
              <p className="tm-footnote"><LockKeyhole size={13}/> தேர்வுகள் நிர்வாகி ஒதுக்கிய அணுகல் உரிமைகளின் அடிப்படையில் காட்டப்படுகின்றன.</p>
            </main>
          </div>
        )}

        {screen === 'profile' && <div className="tm-profile-screen"><div className="tm-profile-head"><button className="tm-icon-button" onClick={() => { if (profileIsIncomplete) return; setScreen(blueprint ? 'exam-home' : 'exams'); }}><ArrowLeft size={22}/></button><div><strong>சுயவிவரம்</strong><small>Teacher details</small></div></div><UserProfile user={user} onUpdate={(updated) => { onUpdateUser(updated); setProfileIsIncomplete(profileFields.some(field => !updated[field] || String(updated[field]).trim() === '')); if (!profileFields.some(field => !updated[field] || String(updated[field]).trim() === '')) setScreen(blueprint ? 'exam-home' : 'exams'); }} onBack={() => { if (!profileIsIncomplete) setScreen(blueprint ? 'exam-home' : 'exams'); }} /></div>}

        {screen === 'exam-home' && blueprint && (
          <main className="tm-screen-content tm-exam-home">
            <div className="tm-exam-hero"><div className="tm-hero-icon"><GraduationCap size={27}/></div><div className="tm-hero-status">{blueprint.isConfirmed ? <><CheckCircle2 size={14}/> Confirmed</> : <><PencilLine size={14}/> In progress</>}</div><h1>{blueprint.questionPaperTypeName}</h1><p>{blueprint.examTerm}</p><div className="tm-hero-badges"><span>வகுப்பு {blueprint.classLevel}</span><span>{blueprint.subject}</span><span>{formatMobileMark(blueprint.totalMarks)} மதிப்பெண்கள்</span><span>{blueprint.setId || 'Set A'}</span></div></div>
            <div className="tm-section-title"><div><h2>எதைத் திறக்க வேண்டும்?</h2><p>தேர்வின் பணிப்பகுதி</p></div></div>
            <div className="tm-feature-grid">
              <button className="tm-feature-card tm-blueprint-feature" onClick={() => setScreen('blueprint')}><span className="tm-feature-icon"><Grid2X2 size={23}/></span><strong>Blue Print</strong><small>மேட்ரிக்ஸ் மற்றும் weightage</small><ChevronRight size={17}/></button>
              <button className="tm-feature-card tm-question-feature" onClick={() => setScreen('questions')}><span className="tm-feature-icon"><PencilLine size={23}/></span><strong>Question Paper</strong><small>வினா மற்றும் விடை திருத்தம்</small><ChevronRight size={17}/></button>
              <button className="tm-feature-card tm-report-feature" onClick={() => setScreen('reports')}><span className="tm-feature-icon"><FileText size={23}/></span><strong>Reports View</strong><small>Report மற்றும் Answer Key</small><ChevronRight size={17}/></button>
              <button className="tm-feature-card tm-analysis-feature" onClick={() => setScreen('analysis')}><span className="tm-feature-icon"><ChartNoAxesCombined size={23}/></span><strong>Analysis</strong><small>மதிப்பெண் மற்றும் நிறைவு நிலை</small><ChevronRight size={17}/></button>
            </div>
            <div className="tm-quick-summary"><div><span>வினா உரைகள்</span><strong>{blueprint.items.filter(i => isNonEmpty(i.questionText)).length}/{blueprint.items.length}</strong></div><div><span>விடை / Discourse</span><strong>{blueprint.items.filter(i => isNonEmpty(i.answerText) || !!i.discourseId).length}/{blueprint.items.length}</strong></div><div><span>மொத்த மதிப்பெண்</span><strong>{formatMobileMark(blueprint.totalMarks)}</strong></div></div>
            {blueprint.isLocked && <p className="tm-lock-note"><LockKeyhole size={15}/> இந்தத் தேர்வு பூட்டப்பட்டுள்ளது. திருத்த அனுமதி இல்லை.</p>}
          </main>
        )}

        {screen === 'blueprint' && blueprint && curriculum && currentPaperType && (
          <main className="tm-screen-content tm-matrix-screen"><BlueprintMatrix blueprint={blueprint} curriculum={curriculum} paperType={currentPaperType} isAdmin={false} readOnly={!!blueprint.isLocked} onUpdateItem={updateItem} onMoveItem={moveItem} onSave={() => saveCurrent()} onConfirm={confirmBlueprint} isSaving={saving} discourses={discourses} mobileGestures /></main>
        )}

        {screen === 'questions' && blueprint?.isLocked && <main className="tm-screen-content"><div className="tm-locked-screen"><LockKeyhole size={30}/><h2>இந்தத் தேர்வு பூட்டப்பட்டுள்ளது</h2><p>நிர்வாகி திறக்கும் வரை வினா மற்றும் விடைகளைத் திருத்த முடியாது.</p><button className="tm-primary-action" onClick={() => setScreen('exam-home')}>தேர்வு முகப்பிற்கு திரும்பு</button></div></main>}

        {screen === 'questions' && blueprint && curriculum && !blueprint.isLocked && (
          <main className="tm-question-screen tm-screen-content">
            <div className="tm-question-progress"><div><span>வினாக்கள்</span><strong>{completedCount}/{blueprint.items.length} முடிந்தது</strong></div><div className="tm-progress-track"><span style={{ width: `${completedCount / Math.max(1, blueprint.items.length) * 100}%` }}/></div></div>
            {completedCount === blueprint.items.length && <button className={`tm-confirm-answers ${blueprint.isAnswerKeyConfirmed ? 'confirmed' : ''}`} onClick={() => void confirmQuestionAnswers()} disabled={saving}><CheckCircle2 size={16}/>{blueprint.isAnswerKeyConfirmed ? 'வினா / விடை உறுதி செய்யப்பட்டது' : 'வினா / விடையை உறுதி செய்'}</button>}
            <div ref={questionPickerRef} className="tm-question-picker" aria-label="வினா தேர்வு">{sortedItems.map((item, index) => <button key={item.id} className={`${item.id === activeItem?.id ? 'active' : ''} ${isItemComplete(item, discourses, blueprint.subject) ? 'done' : ''}`} onClick={() => { setActiveQuestionId(item.id); setSpellIssues([]); }}><strong>{item.qNo || `Q${index + 1}`}</strong><small>{item.hasInternalChoice && item.marksPerQuestionB && item.marksPerQuestionB !== item.marksPerQuestion ? `${formatMobileMark(item.marksPerQuestion)}/${formatMobileMark(item.marksPerQuestionB)}M` : `${formatMobileMark(item.marksPerQuestion)}M`}</small></button>)}</div>
            {activeItem ? <>
              <section className="tm-editor-card tm-question-card">
                <div className="tm-card-heading"><div><span className="tm-step-chip">01</span><div><h2>வினா பகுதி</h2><p>Type · Mark · Time · Discourse · Cognitive</p></div></div><button className="tm-info-button" onClick={() => setShowInfo(true)}><Info size={17}/> தகவல்</button></div>
                {blueprint.isLocked ? <p className="tm-lock-note"><LockKeyhole size={15}/> இந்தத் தேர்வு பூட்டப்பட்டுள்ளது.</p> : <>
                  <div className={activeItem.hasInternalChoice ? 'tm-choice-side tm-choice-side-a' : ''}>{activeItem.hasInternalChoice && <strong>வினா A</strong>}{renderQuestionMetadata(false)}{renderQuestionBody(false)}</div>
                  {activeItem.marksPerQuestion > 2 && (activeItem.marksPerQuestionB ?? activeItem.marksPerQuestion) > 2 && <label className="tm-choice-toggle"><input type="checkbox" checked={!!activeItem.hasInternalChoice} onChange={e => toggleInternalChoice(e.target.checked)}/><span>Internal choice (A அல்லது B)</span></label>}
                  {activeItem.hasInternalChoice && <div className="tm-choice-side tm-choice-side-b"><strong>வினா B</strong>{renderQuestionMetadata(true)}{renderQuestionBody(true)}</div>}
                  <div className="tm-tools-row"><button onClick={() => void runSpelling('question')} disabled={spellBusy}><SpellCheck2 size={15}/>{spellBusy && spellTarget === 'question' ? 'சரிபார்க்கிறது…' : 'சொல் சரிபார்'}</button><button className="tm-gemini-review" onClick={() => void runGeminiReview()} disabled={spellBusy}><Sparkles size={15}/>{spellBusy ? 'ஆய்வு…' : 'Gemini முழு ஆய்வு'}</button><button onClick={() => void copyText(activeItem.questionText || '')}><Copy size={14}/> Copy</button><button onClick={() => void pasteText('question')}><Clipboard size={14}/> Paste</button></div>
                  {questionMetaReady && isSR1(activeItem.itemFormat) && <MCQEditor item={activeItem} kind="single" onChange={mc => updateMC(activeItem, mc, 'single')}/>}
                  {questionMetaReady && isSR2(activeItem.itemFormat) && <div className="tm-special-question"><label className="tm-field-label"><span>SR2 வினா வடிவம்</span><select value={activeItem.mobileQuestionMode || (activeItem.questionContent?.type === 'match_pairs' ? 'match_pairs' : 'choose_statements')} onChange={e => { const mode = e.target.value as 'match_pairs' | 'choose_statements'; if (mode === 'match_pairs') { const match = getMatch(activeItem); updateItem(activeItem.id, { mobileQuestionMode: mode, questionContent: { type: 'match_pairs', matchPairs: match }, answerText: '', answerBlocks: undefined, enableInputAnswer: true }); } else { const mc = getMC(activeItem); updateItem(activeItem.id, { mobileQuestionMode: mode, questionContent: { type: 'multiple_choice', multipleChoice: { ...mc, prompt: activeItem.questionText || mc.prompt, correctOptionIds: mc.correctOptionIds || [] } }, answerPrompt: activeItem.answerPrompt || activeItem.questionText || '', answerText: '', answerBlocks: undefined, enableInputAnswer: true }); } }}><option value="match_pairs">ஏற்றபடி இணைத்து எழுதுக (பொருத்துக)</option><option value="choose_statements">சரியான கூற்றைத் தேர்வு செய்க</option></select></label>
                    {(activeItem.mobileQuestionMode === 'match_pairs' || activeItem.questionContent?.type === 'match_pairs') ? <MatchEditor item={activeItem} onChange={match => syncMatch(activeItem, match)}/> : <MCQEditor item={activeItem} kind="multi" onChange={mc => updateMC(activeItem, mc, 'multi')}/>}</div>}
                </>}
              </section>

              <section className="tm-editor-card tm-answer-card">
                <div className="tm-card-heading"><div><span className="tm-step-chip tm-step-green">02</span><div><h2>விடை பகுதி</h2><p>{activeItem.hasInternalChoice ? 'வினா A / வினா B விடைகள்' : 'விடை மற்றும் மதிப்பீட்டுக் குறிப்புகள்'}</p></div></div><span className={`tm-answer-state ${activeQuestionComplete ? 'ready' : ''}`}>{activeQuestionComplete ? <CheckCircle2 size={14}/> : <CircleHelp size={14}/>} {activeQuestionComplete ? 'முடிந்தது' : 'நிரப்பவும்'}</span></div>
                <div className={activeItem.hasInternalChoice ? 'tm-choice-side tm-choice-answer-a' : ''}>{activeItem.hasInternalChoice && <strong>விடை A</strong>}
                  {!isSR1(activeItem.itemFormat) && !activeItem.discourseId && <label className="tm-field-label"><span>விடைத்தலைப்பு</span><input disabled={!questionMetaReady} value={activeItem.answerPrompt || ''} placeholder="விடையின் தலைப்பை எழுதவும்" onChange={e => updateItem(activeItem.id, { answerPrompt: e.target.value, mobileAnswerMode: activeItem.mobileAnswerMode || 'paragraph' })}/></label>}
                  {renderAnswerBody(false)}
                  <div className="tm-tools-row"><button onClick={() => void runSpelling('answer')} disabled={spellBusy}><SpellCheck2 size={15}/>{spellBusy && spellTarget === 'answer' ? 'சரிபார்க்கிறது…' : 'சொல் சரிபார்'}</button><button onClick={() => void copyText(currentAnswerText)}><Copy size={14}/> Copy</button><button onClick={() => void pasteText('answer')}><Clipboard size={14}/> Paste</button></div>
                  {activeItem.discourseId && activeItem.marksPerQuestion >= 3 && <RubricsPreview discourse={discourses.find(d => d.id === activeItem.discourseId)} />}
                  <label className="tm-further-info-toggle"><input type="checkbox" checked={!!activeItem.enableFurtherInfo} disabled={!questionMetaReady} onChange={e => updateItem(activeItem.id, { enableFurtherInfo: e.target.checked })}/><span>Further Information</span></label>
                  <label className="tm-field-label"><span>Further Information</span><textarea disabled={!questionMetaReady || !activeItem.enableFurtherInfo} rows={3} value={activeItem.furtherInfo || ''} placeholder="Further Information..." onChange={e => updateItem(activeItem.id, { furtherInfo: e.target.value })}/></label>
                </div>
                {activeItem.hasInternalChoice && <div className="tm-choice-side tm-choice-answer-b"><strong>விடை B</strong>{renderAnswerBody(true)}{activeItem.discourseIdB && (activeItem.marksPerQuestionB ?? activeItem.marksPerQuestion) >= 3 && <RubricsPreview discourse={discourses.find(d => d.id === activeItem.discourseIdB)} />}<label className="tm-further-info-toggle"><input type="checkbox" checked={!!activeItem.enableFurtherInfoB} disabled={!isQuestionMetaComplete(activeItem, true)} onChange={e => updateItem(activeItem.id, { enableFurtherInfoB: e.target.checked })}/><span>Further Information</span></label><label className="tm-field-label"><span>Further Information</span><textarea disabled={!isQuestionMetaComplete(activeItem, true) || !activeItem.enableFurtherInfoB} rows={3} value={activeItem.furtherInfoB || ''} placeholder="Further Information..." onChange={e => updateItem(activeItem.id, { furtherInfoB: e.target.value })}/></label></div>}
                {spellIssues.length > 0 && <div className="tm-spell-panel"><div className="tm-spell-panel-head"><strong><Sparkles size={16}/> {spellIssues.some(i => i.type !== 'spelling') ? 'Gemini வினா ஆய்வு' : 'எழுத்துப் பிழைகள்'}</strong><button onClick={() => setSpellIssues([])} aria-label="மூடு"><X size={16}/></button></div>{spellIssues.map((issue, index) => <div className="tm-spell-issue" key={`${issue.field}-${issue.index ?? ''}-${index}`}><div><b className="tm-error-word">{issue.original}</b><small>{issue.type === 'spelling' ? 'எழுத்துப்பிழை' : issue.type === 'sentence' ? 'வாக்கிய மேம்பாடு' : 'கருத்துப் பிழை'} · {issue.explanation}</small></div><div className="tm-spell-suggestions"><button className="tm-apply-review" onClick={() => applyReviewSuggestion(issue)}>{issue.suggestion} <Check size={13}/></button></div></div>)}</div>}
              </section>
              <div className="tm-question-stepper"><button disabled={!previousQuestion} onClick={() => { if (!previousQuestion) return; setActiveQuestionId(previousQuestion.id); setSpellIssues([]); }}><ArrowLeft size={16}/> முந்தைய வினா {previousQuestion?.qNo || ''}</button><button disabled={!nextQuestion} onClick={() => { if (!nextQuestion) return; setActiveQuestionId(nextQuestion.id); setSpellIssues([]); }} >அடுத்த வினா {nextQuestion?.qNo || ''} <ChevronRight size={16}/></button></div>
            </> : <div className="tm-empty-state"><BookOpen size={28}/><span>வினா தரவு இல்லை.</span></div>}
          </main>
        )}

        {screen === 'reports' && blueprint && curriculum && <main className="tm-screen-content tm-reports-screen"><ReportsView blueprint={blueprint} curriculum={curriculum} discourses={discourses} paperType={currentPaperType} onDownloadPDF={(type) => void exportPDF(blueprint, curriculum, type, false)} onDownloadWord={(type) => void exportWord(blueprint, curriculum, discourses, type)} isAdmin={false} onUpdateReportSettings={(settings, perReport) => setBlueprint(prev => prev ? { ...prev, reportSettings: settings, perReportSettings: perReport } : prev)} onSaveSettings={() => saveCurrent()} onUpdateItemField={(id, field, value) => updateItem(id, field, value)} onMoveItem={moveItem} onConfirmAnswerKey={async () => { if (!blueprint) return; const next = { ...blueprint, isAnswerKeyConfirmed: true }; setBlueprint(next); await saveBlueprint(next); savedBlueprintSnapshot.current = JSON.stringify(next); }}/></main>}

        {screen === 'analysis' && blueprint && curriculum && <AnalysisScreen blueprint={blueprint} curriculum={curriculum} paperType={currentPaperType} onGoQuestions={() => setScreen('questions')} />}

        {showInfo && activeItem && blueprint && <div className="tm-drawer-backdrop" role="presentation" onClick={() => setShowInfo(false)}><aside className="tm-info-drawer" role="dialog" aria-modal="true" aria-label="வினா தகவல்" onClick={e => e.stopPropagation()}><div className="tm-drawer-head"><div><span>QUESTION DETAILS</span><h2>வினா விவரங்கள்</h2></div><button className="tm-icon-button" onClick={() => setShowInfo(false)} aria-label="மூடு"><X size={21}/></button></div><div className="tm-drawer-scroll"><div className="tm-info-qno"><span>{activeItem.qNo || 'வினா'}</span><b>{formatMobileMark(activeItem.marksPerQuestion)} மதிப்பெண்கள்</b></div><InfoRow label="தேர்வு" value={blueprint.questionPaperTypeName}/><InfoRow label="பாடம்" value={blueprint.subject}/><InfoRow label="வகுப்பு" value={String(blueprint.classLevel)}/><InfoRow label="Term" value={blueprint.examTerm}/><InfoRow label="Unit" value={curriculum.units.find(u => u.id === activeItem.unitId)?.name || '—'}/><InfoRow label="பாடப்பகுதி" value={curriculum.units.flatMap(u => u.subUnits).find(s => s.id === activeItem.subUnitId)?.name || '—'}/><InfoRow label="Knowledge Level" value={activeItem.knowledgeLevel}/><InfoRow label="Cognitive Process" value={activeItem.cognitiveProcess}/><InfoRow label="வினா Type" value={activeItem.itemFormat}/><InfoRow label="Question count" value={String(activeItem.questionCount)}/><InfoRow label="மொத்த மதிப்பெண்" value={formatMobileMark(activeItem.totalMarks)}/><InfoRow label="Section" value={currentPaperType?.sections.find(s => s.id === activeItem.sectionId)?.instruction || currentPaperType?.sections.find(s => s.id === activeItem.sectionId)?.id || '—'}/><InfoRow label="Learning outcome" value={curriculum.units.find(u => u.id === activeItem.unitId)?.subUnits.find(s => s.id === activeItem.subUnitId)?.learningOutcomes || curriculum.units.find(u => u.id === activeItem.unitId)?.learningOutcomes || '—'}/><InfoRow label="Discourse" value={discourses.find(d => d.id === activeItem.discourseId)?.name || 'தேர்வு செய்யப்படவில்லை'}/><InfoRow label="உறுதி நிலை" value={activeQuestionComplete ? 'வினா + விடை முடிந்தது' : 'இன்னும் நிரப்ப வேண்டும்'}/></div><button className="tm-primary-action tm-drawer-done" onClick={() => setShowInfo(false)}>முடிந்தது</button></aside></div>}

      </div>
    </div>
  );
}

function MCQEditor({ item, kind, onChange }: { item: BlueprintItem; kind: 'single' | 'multi'; onChange: (mc: MCData) => void }) {
  const mc = getMC(item);
  const selectedIds = mc.correctOptionIds || (mc.correctOptionId ? [mc.correctOptionId] : []);
  return <div className="tm-mcq-editor"><div className="tm-mcq-heading"><div><strong>{kind === 'single' ? `${mc.options.length} தேர்வுகள்` : 'சரியான கூற்றுகள்'}</strong><small>{kind === 'single' ? 'ஒரே ஒரு சரியான விடையைத் தேர்வு செய்யவும்' : 'ஒன்றுக்கு மேற்பட்ட சரியான கூற்றுகளை தேர்வு செய்யலாம்'}</small></div><span>{selectedIds.length} தேர்வு</span></div>{mc.options.map((option, index) => <div className={`tm-option-row ${selectedIds.includes(option.id) ? 'selected' : ''}`} key={option.id}><span className="tm-option-letter">{formatLetter(index)}</span><textarea rows={2} value={option.text} placeholder={`தேர்வு ${index + 1}`} onChange={e => onChange({ ...mc, options: mc.options.map(o => o.id === option.id ? { ...o, text: e.target.value } : o) })}/><label className="tm-option-correct" aria-label="சரியான விடை"><input type={kind === 'single' ? 'radio' : 'checkbox'} name={`correct-${item.id}`} checked={kind === 'single' ? mc.correctOptionId === option.id : selectedIds.includes(option.id)} onChange={e => { if (kind === 'single') onChange({ ...mc, correctOptionId: e.target.checked ? option.id : '', correctOptionIds: e.target.checked ? [option.id] : [] }); else { const ids = e.target.checked ? [...selectedIds, option.id] : selectedIds.filter(id => id !== option.id); onChange({ ...mc, correctOptionIds: ids, correctOptionId: ids[0] || '' }); } }}/><span/></label></div>)}<button className="tm-add-item" onClick={() => onChange({ ...mc, options: [...mc.options, { id: idOf(), text: '' }] })}><Plus size={15}/> ஆப்ஷன் சேர்</button><p className="tm-mcq-footnote"><CheckCircle2 size={14}/> {kind === 'single' ? 'சரியான தேர்வு Answer Key-ல் தானாக வரும்.' : 'தேர்வு செய்த அனைத்து கூற்றுகளும் Answer Key-ல் தானாக வரும்.'}</p></div>;
}

function MatchEditor({ item, onChange }: { item: BlueprintItem; onChange: (m: MatchData) => void }) {
  const data = getMatch(item);
  const patchLeft = (id: string, text: string) => onChange({ ...data, leftItems: data.leftItems.map(row => row.id === id ? { ...row, text } : row) });
  const patchRight = (id: string, text: string) => onChange({ ...data, rightItems: data.rightItems.map(row => row.id === id ? { ...row, text } : row) });
  return <div className="tm-match-editor"><div className="tm-match-labels"><span>பொருத்த வேண்டியவை</span><span>பொருத்தங்கள்</span></div>{Array.from({ length: Math.max(data.leftItems.length, data.rightItems.length) }, (_, i) => <div className="tm-match-row" key={data.leftItems[i]?.id || data.rightItems[i]?.id || i}><div>{data.leftItems[i] && <textarea rows={2} value={data.leftItems[i].text} placeholder="உள்ளீடு" onChange={e => patchLeft(data.leftItems[i].id, e.target.value)}/>}</div><div>{data.rightItems[i] && <textarea rows={2} value={data.rightItems[i].text} placeholder="பொருத்தம்" onChange={e => patchRight(data.rightItems[i].id, e.target.value)}/>}</div></div>)}<div className="tm-match-actions"><button onClick={() => onChange({ ...data, leftItems: [...data.leftItems, { id: idOf(), text: '' }] })}><Plus size={14}/> இடது உரை சேர்</button><button onClick={() => onChange({ ...data, rightItems: [...data.rightItems, { id: idOf(), text: '' }] })}><Plus size={14}/> வலது உரை சேர்</button></div><div className="tm-mapping-panel"><strong>விடை பொருத்தம்</strong><p>ஒவ்வொரு உரைக்கும் சரியான பொருத்தத்தைத் தேர்வு செய்யவும்.</p>{data.leftItems.map((left, index) => <label className="tm-mapping-row" key={left.id}><span>{index + 1}. {left.text || 'வினா உரை'}</span><select value={data.answerMappings.find(m => m.leftId === left.id)?.rightId || ''} onChange={e => onChange({ ...data, answerMappings: [...data.answerMappings.filter(m => m.leftId !== left.id), ...(e.target.value ? [{ leftId: left.id, rightId: e.target.value }] : [])] })}><option value="">பொருத்தம் தேர்வு செய்க</option>{data.rightItems.map((right, i) => <option key={right.id} value={right.id}>{formatLetter(i)}) {right.text || `பொருத்தம் ${i + 1}`}</option>)}</select></label>)}</div></div>;
}

function AnswerTableEditor({ rows: sourceRows, rowMarks = [], disabled = false, bordered = true, widths = [], onChange, onRowMarksChange, onBorderChange, onWidthChange }: { rows: string[][]; rowMarks?: (string | number)[]; disabled?: boolean; bordered?: boolean; widths?: number[]; onChange: (rows: string[][]) => void; onRowMarksChange?: (marks: (string | number)[]) => void; onBorderChange?: (bordered: boolean) => void; onWidthChange?: (widths: number[]) => void }) {
  const rows = (sourceRows.length ? sourceRows : [['', ''], ['', '']]).map(row => [...row]);
  const columns = Math.max(2, ...rows.map(row => row.length));
  const normalizedRows = rows.map(row => Array.from({ length: columns }, (_, i) => row[i] || ''));
  const updateCell = (r: number, c: number, value: string) => onChange(normalizedRows.map((row, ri) => row.map((cell, ci) => ri === r && ci === c ? value : cell)));
  return <div className="tm-answer-table-editor"><label className="tm-table-border-toggle"><input type="checkbox" disabled={disabled} checked={bordered} onChange={e => onBorderChange?.(e.target.checked)}/> எல்லை கோடுகளைக் காட்டு</label><div className={`tm-table-scroll ${bordered ? 'has-borders' : 'no-borders'}`}><table><tbody>{normalizedRows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} style={{ width: `${widths[ci] || Math.floor(100 / columns)}%` }}><textarea disabled={disabled} rows={2} value={cell} placeholder={ri === 0 ? `தலைப்பு ${ci + 1}` : 'உள்ளீடு'} onChange={e => updateCell(ri, ci, e.target.value)}/></td>)}<td className="tm-table-score-cell"><MarkInput disabled={disabled} value={rowMarks[ri] ?? ''} placeholder="மதிப்பெண்" aria-label={`வரிசை ${ri + 1} மதிப்பெண்`} onChange={mark => { const marks = Array.from({ length: normalizedRows.length }, (_, index) => rowMarks[index] ?? ''); marks[ri] = mark; onRowMarksChange?.(marks); }}/></td></tr>)}</tbody></table></div><div className="tm-column-widths">{Array.from({ length: columns }, (_, i) => <label key={i}><span>காலம் {i + 1} (%)</span><input disabled={disabled} type="number" min={5} max={95} value={widths[i] || Math.floor(100 / columns)} onChange={e => { const next = Array.from({ length: columns }, (_, j) => widths[j] || Math.floor(100 / columns)); next[i] = Math.max(5, Math.min(95, Number(e.target.value) || 5)); onWidthChange?.(next); }}/></label>)}</div><div className="tm-table-actions"><button disabled={disabled} onClick={() => onChange([...normalizedRows, Array.from({ length: columns }, () => '')])}><Plus size={14}/> வரிசை</button><button disabled={disabled} onClick={() => { onChange(normalizedRows.map(row => [...row, ''])); onWidthChange?.([...widths, Math.floor(100 / (columns + 1))]); }}><Plus size={14}/> நெடுவரிசை</button><button disabled={disabled} onClick={() => onChange(normalizedRows.length > 1 ? normalizedRows.slice(0, -1) : normalizedRows)}><Trash2 size={14}/> கடைசி வரிசை</button></div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="tm-info-row"><span>{label}</span><strong>{value || '—'}</strong></div>;
}

function RichTextEditor({ value, disabled, placeholder, onChange, listIconsOnly = true, pasteTarget }: { value: string; disabled?: boolean; placeholder: string; onChange: (value: string) => void; listIconsOnly?: boolean; pasteTarget?: SpellTarget }) {
  const editor = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  useEffect(() => { if (editor.current && editor.current.innerHTML !== value) editor.current.innerHTML = value; }, [value]);
  const refreshFormats = () => {
    const root = editor.current;
    const selection = window.getSelection();
    if (!root || !selection?.anchorNode || !root.contains(selection.anchorNode)) return;
    lastRichEditorSelection = { element: root, range: selection.getRangeAt(0).cloneRange(), target: pasteTarget };
    const parent = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode as Element : selection.anchorNode.parentElement;
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      unordered: !!parent?.closest('ul'),
      ordered: !!parent?.closest('ol')
    });
  };
  const handleEditorFocus = () => {
    const root = editor.current;
    if (root && !root.textContent?.trim()) {
      // Chromium can carry an active inline format from a previously focused
      // contentEditable. Clear those toggles before typing into a blank field.
      ['bold', 'italic', 'underline'].forEach(commandName => {
        if (document.queryCommandState(commandName)) document.execCommand(commandName, false);
      });
    }
    refreshFormats();
  };
  useEffect(() => {
    document.addEventListener('selectionchange', refreshFormats);
    return () => document.removeEventListener('selectionchange', refreshFormats);
  });
  const command = (name: string, value?: string) => {
    editor.current?.focus();
    document.execCommand(name, false, value);
    onChange(editor.current?.innerHTML || '');
    window.requestAnimationFrame(refreshFormats);
  };
  return <div className={`tm-rich-editor ${disabled ? 'is-disabled' : ''}`}>
    <div className="tm-rich-toolbar" aria-label="உரை வடிவமைப்பு">
      <button type="button" className={activeFormats.bold ? 'is-active' : ''} aria-pressed={!!activeFormats.bold} title="Bold" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => command('bold')}><b>B</b></button>
      <button type="button" className={activeFormats.italic ? 'is-active' : ''} aria-pressed={!!activeFormats.italic} title="Italic" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => command('italic')}><i>I</i></button>
      <button type="button" className={activeFormats.underline ? 'is-active' : ''} aria-pressed={!!activeFormats.underline} title="Underline" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => command('underline')}><u>U</u></button>
      <button type="button" className={activeFormats.unordered ? 'is-active' : ''} aria-pressed={!!activeFormats.unordered} title="Unordered list" aria-label="Unordered list" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => command('insertUnorderedList')}><List size={15}/>{!listIconsOnly && ' பட்டியல்'}</button>
      <button type="button" className={activeFormats.ordered ? 'is-active' : ''} aria-pressed={!!activeFormats.ordered} title="Ordered list" aria-label="Ordered list" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => command('insertOrderedList')}><ListOrdered size={15}/>{!listIconsOnly && ' பட்டியல்'}</button>
    </div>
    <div ref={editor} className="tm-rich-content" data-paste-target={pasteTarget} contentEditable={!disabled} suppressContentEditableWarning data-placeholder={placeholder} onInput={e => { onChange(e.currentTarget.innerHTML); refreshFormats(); }} onKeyUp={refreshFormats} onMouseUp={refreshFormats} onFocus={handleEditorFocus} />
  </div>;
}

function AnalysisScreen({ blueprint, curriculum, paperType, onGoQuestions }: { blueprint: Blueprint; curriculum: Curriculum; paperType?: QuestionPaperType; onGoQuestions: () => void }) {
  const questionsWritten = blueprint.items.filter(item => isNonEmpty(item.questionText)).length;
  const answersWritten = blueprint.items.filter(item => isNonEmpty(item.answerText) || !!item.discourseId).length;
  const formatSections = (paperType?.sections || []).map(section => {
    const items = blueprint.items.filter(item => item.sectionId === section.id);
    const actual = items.reduce((sum, item) => sum + item.totalMarks, 0);
    const count = items.reduce((sum, item) => sum + item.questionCount, 0);
    return { section, items, actual, count };
  });
  const unitRows = curriculum.units.map(unit => ({ unit, marks: blueprint.items.filter(item => item.unitId === unit.id).reduce((sum, item) => sum + item.totalMarks, 0) }));
  const cognitiveRows = Object.values(CognitiveProcess).map(cp => ({ name: cp, marks: blueprint.items.filter(item => item.cognitiveProcess === cp).reduce((sum, item) => sum + item.totalMarks, 0) })).filter(r => r.marks > 0);
  const readiness = Math.round(((questionsWritten + answersWritten) / Math.max(1, blueprint.items.length * 2)) * 100);
  return <main className="tm-screen-content tm-analysis-screen"><div className="tm-section-title"><div><h2>Analysis</h2><p>தேர்வு அமைப்பு மற்றும் உள்ளீட்டு நிலை</p></div><button className="tm-refresh-button" onClick={onGoQuestions}><PencilLine size={15}/> திருத்தவும்</button></div><div className="tm-analysis-hero"><span>மொத்த மதிப்பெண்கள்</span><strong>{formatMobileMark(blueprint.totalMarks)}</strong><div className="tm-progress-track"><span style={{ width: `${readiness}%` }}/></div><p>{readiness}% உள்ளீடு நிறைவு — {blueprint.items.length} blueprint item-கள்</p></div><div className="tm-analysis-kpis"><div><strong>{questionsWritten}/{blueprint.items.length}</strong><span>வினா உரைகள்</span></div><div><strong>{answersWritten}/{blueprint.items.length}</strong><span>விடை / Discourse</span></div><div><strong>{blueprint.items.filter(i => i.hasInternalChoice).length}</strong><span>Internal choices</span></div></div><section className="tm-analysis-section"><h3><Layers3 size={17}/> பிரிவு வாரியான நிலை</h3>{formatSections.map(({ section, actual, count }) => <div className="tm-analysis-row" key={section.id}><div><strong>{formatMobileMark(section.marks)} மதிப்பெண்</strong><small>{count}/{section.count} வினாக்கள்</small></div><div className="tm-analysis-bar"><span style={{ width: `${Math.min(100, section.count ? count / section.count * 100 : 0)}%` }}/></div><b>{formatMobileMark(actual)}M</b></div>)}</section><section className="tm-analysis-section"><h3><BookOpen size={17}/> Unit மதிப்பெண் பகிர்வு</h3>{unitRows.map(({ unit, marks }) => <div className="tm-analysis-row" key={unit.id}><div><strong>{unit.unitNumber}. {unit.name}</strong><small>{Math.round(marks / Math.max(1, blueprint.totalMarks) * 100)}%</small></div><div className="tm-analysis-bar"><span style={{ width: `${Math.min(100, marks / Math.max(1, blueprint.totalMarks) * 100)}%` }}/></div><b>{formatMobileMark(marks)}M</b></div>)}</section><section className="tm-analysis-section"><h3><BarChart3 size={17}/> Cognitive செயல்முறை</h3>{cognitiveRows.map(row => <div className="tm-analysis-row" key={row.name}><div><strong>{row.name}</strong><small>{Math.round(row.marks / Math.max(1, blueprint.totalMarks) * 100)}%</small></div><div className="tm-analysis-bar"><span style={{ width: `${Math.min(100, row.marks / Math.max(1, blueprint.totalMarks) * 100)}%` }}/></div><b>{formatMobileMark(row.marks)}M</b></div>)}</section><button className="tm-primary-action tm-analysis-cta" onClick={onGoQuestions}><PencilLine size={17}/> வினா / விடையைத் தொடரவும்</button></main>;
}
