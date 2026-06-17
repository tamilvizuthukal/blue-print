import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Info, RefreshCw, ClipboardCheck, Save, Sparkles, Plus, Settings, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { 
  KnowledgeLevel, 
  ItemFormat, 
  CognitiveProcess, 
  Blueprint, 
  Curriculum, 
  BlueprintItem, 
  QuestionPatternSection as PaperSection,
  QuestionPaperType as PaperType,
  Unit,
  SubUnit
} from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Bloom's KL weightage targets — computed per totalMarks in validation */
const KL_TARGETS: Record<KnowledgeLevel, number> = {
  [KnowledgeLevel.BASIC]: 0.30,
  [KnowledgeLevel.AVERAGE]: 0.50,
  [KnowledgeLevel.PROFOUND]: 0.20,
};

const KL_COLORS: Record<KnowledgeLevel, { bg: string; border: string; text: string; badge: string }> = {
  [KnowledgeLevel.BASIC]: { bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
  [KnowledgeLevel.AVERAGE]: { bg: 'bg-yellow-50', border: 'border-l-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  [KnowledgeLevel.PROFOUND]: { bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
};

const MARK_COLORS: Record<number, string> = {
  1: 'bg-blue-100 border-blue-400 text-blue-900',
  2: 'bg-emerald-100 border-emerald-400 text-emerald-900',
  3: 'bg-amber-100 border-amber-400 text-amber-900',
  4: 'bg-indigo-100 border-indigo-400 text-indigo-900',
  5: 'bg-rose-100 border-rose-400 text-rose-900',
  6: 'bg-teal-100 border-teal-400 text-teal-900',
  7: 'bg-purple-100 border-purple-400 text-purple-900',
  8: 'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-900',
  10: 'bg-pink-100 border-pink-400 text-pink-900',
};

const KL_BOTTOM_COLORS: Record<KnowledgeLevel, string> = {
  [KnowledgeLevel.BASIC]: 'bg-green-500',
  [KnowledgeLevel.AVERAGE]: 'bg-yellow-500',
  [KnowledgeLevel.PROFOUND]: 'bg-red-500',
};

// ─── Language Subject Helper ─────────────────────────────────────────────────

/** CP3 (Computational Thinking) is not applicable to language subjects. */
const LANGUAGE_KEYWORDS = [
  'tamil', 'english', 'hindi', 'sanskrit', 'french', 'urdu',
  'arabic', 'telugu', 'kannada', 'malayalam', 'language', 'மொழி', 'lang'
];

export const isLanguageSubject = (subject: string): boolean => {
  const lower = (subject || '').toLowerCase();
  return LANGUAGE_KEYWORDS.some(kw => lower.includes(kw));
};

/** Returns the allowed CognitiveProcess list — CP3 (Computational Thinking) is
 *  excluded from ALL subjects as per blueprint policy. */
const getAllowedCPs = (_subject?: string): CognitiveProcess[] =>
  Object.values(CognitiveProcess).filter(cp => cp !== CognitiveProcess.CP3);

const DEFAULT_ALLOWED_CP = CognitiveProcess.CP1;

const getSafeCP = (value?: CognitiveProcess): CognitiveProcess => {
  if (value && value !== CognitiveProcess.CP3) return value;
  return DEFAULT_ALLOWED_CP;
};

const getPreferredKLs = (mark: number): KnowledgeLevel[] => {
  // All 3 KLs are now allowed for all mark values including 1M
  if (mark === 1) return [KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE, KnowledgeLevel.PROFOUND];
  if (mark <= 2) return [KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE];
  if (mark === 3) return [KnowledgeLevel.AVERAGE, KnowledgeLevel.BASIC, KnowledgeLevel.PROFOUND];
  return [KnowledgeLevel.PROFOUND, KnowledgeLevel.AVERAGE];
};

interface RelativeSelectOption {
  value: string;
  label: string;
}

interface RelativeSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | RelativeSelectOption)[];
  className?: string;
  themeColor?: 'indigo' | 'purple';
}

const RelativeSelect: React.FC<RelativeSelectProps> = ({
  value,
  onChange,
  options,
  className = '',
  themeColor = 'indigo'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions = useMemo((): RelativeSelectOption[] => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find(o => o.value === value) || normalizedOptions[0];
  }, [normalizedOptions, value]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Dropdown has max-height of 200px. Let's use 210px as threshold.
      if (spaceBelow < 210 && spaceAbove > spaceBelow) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleOutsideClick);
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
      };
    }
  }, [isOpen]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(val);
    setIsOpen(false);
  };

  const focusColor = themeColor === 'purple' ? 'focus:ring-purple-400 border-purple-200' : 'focus:ring-indigo-400 border-indigo-200';
  const buttonBorder = themeColor === 'purple' ? 'border-purple-300 hover:border-purple-400' : 'border-slate-300 hover:border-slate-400';
  const activeText = themeColor === 'purple' ? 'text-purple-700 bg-purple-50 font-semibold' : 'text-indigo-700 bg-indigo-50 font-semibold';
  const hoverBg = themeColor === 'purple' ? 'hover:bg-purple-50 hover:text-purple-700' : 'hover:bg-indigo-50 hover:text-indigo-700';

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        className={`w-full flex items-center justify-between bg-white text-slate-800 text-xs border ${buttonBorder} rounded-lg p-2 text-left shadow-sm focus:outline-none focus:ring-2 ${focusColor} transition-all cursor-pointer ${className}`}
      >
        <span className="truncate font-medium">{selectedOption?.label}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 max-h-[200px] overflow-y-auto custom-scrollbar ${openUpwards ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {normalizedOptions.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => handleSelect(opt.value, e)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer block truncate ${
                  isSelected ? activeText : 'text-slate-600 ' + hoverBg
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const computeExactKlTargets = (totalMarks: number): Record<KnowledgeLevel, number> => {
  const exactEntries = ([
    [KnowledgeLevel.BASIC, totalMarks * KL_TARGETS[KnowledgeLevel.BASIC]],
    [KnowledgeLevel.AVERAGE, totalMarks * KL_TARGETS[KnowledgeLevel.AVERAGE]],
    [KnowledgeLevel.PROFOUND, totalMarks * KL_TARGETS[KnowledgeLevel.PROFOUND]],
  ] as const).map(([level, exact]) => ({
    level,
    floor: Math.floor(exact),
    remainder: exact - Math.floor(exact),
  }));

  const result = exactEntries.reduce((acc, entry) => {
    acc[entry.level] = entry.floor;
    return acc;
  }, {
    [KnowledgeLevel.BASIC]: 0,
    [KnowledgeLevel.AVERAGE]: 0,
    [KnowledgeLevel.PROFOUND]: 0,
  } as Record<KnowledgeLevel, number>);

  let remaining = totalMarks - Object.values(result).reduce((sum, value) => sum + value, 0);
  exactEntries
    .sort((a, b) => b.remainder - a.remainder || a.level.localeCompare(b.level))
    .forEach(entry => {
      if (remaining > 0) {
        result[entry.level] += 1;
        remaining -= 1;
      }
    });

  return result;
};

const sanitizeBlueprintItem = (item: BlueprintItem): Partial<BlueprintItem> => {
  const patch: Partial<BlueprintItem> = {};
  const safeCP = getSafeCP(item.cognitiveProcess);
  const safeCPB = getSafeCP(item.cognitiveProcessB || item.cognitiveProcess);

  if (item.cognitiveProcess !== safeCP) patch.cognitiveProcess = safeCP;
  if ((item.cognitiveProcessB || item.cognitiveProcess) !== safeCPB) patch.cognitiveProcessB = safeCPB;

  if (item.marksPerQuestion === 1 && item.hasInternalChoice) {
    patch.hasInternalChoice = false;
  }

  if (item.hasInternalChoice) {
    if (!item.unitIdB) patch.unitIdB = item.unitId;
    if (!item.subUnitIdB) patch.subUnitIdB = item.subUnitId;
    if (!item.knowledgeLevelB) patch.knowledgeLevelB = item.knowledgeLevel;
    if (!item.cognitiveProcessB || item.cognitiveProcessB === CognitiveProcess.CP3) patch.cognitiveProcessB = safeCP;
    if (!item.itemFormatB) patch.itemFormatB = item.itemFormat;
  } else if (item.unitIdB || item.subUnitIdB || item.knowledgeLevelB || item.cognitiveProcessB || item.itemFormatB) {
    patch.unitIdB = undefined;
    patch.subUnitIdB = undefined;
    patch.knowledgeLevelB = undefined;
    patch.cognitiveProcessB = undefined;
    patch.itemFormatB = undefined;
  }

  return patch;
};

const assignKnowledgeLevelsExactly = (items: BlueprintItem[], totalMarks: number): BlueprintItem[] => {
  if (!items.length) return items;

  const targets = computeExactKlTargets(totalMarks);
  const indexed = items.map((item, index) => ({ item, index }));
  const sorted = [...indexed].sort((a, b) => b.item.totalMarks - a.item.totalMarks);
  const memo = new Map<string, KnowledgeLevel[] | null>();

  const search = (
    idx: number,
    basicRemain: number,
    averageRemain: number,
    profoundRemain: number,
  ): KnowledgeLevel[] | null => {
    if (idx === sorted.length) {
      return basicRemain === 0 && averageRemain === 0 && profoundRemain === 0 ? [] : null;
    }

    const key = `${idx}|${basicRemain}|${averageRemain}|${profoundRemain}`;
    if (memo.has(key)) return memo.get(key)!;

    const current = sorted[idx].item.totalMarks;
    const options = getPreferredKLs(sorted[idx].item.marksPerQuestion);

    for (const kl of options) {
      const nextBasic = basicRemain - (kl === KnowledgeLevel.BASIC ? current : 0);
      const nextAverage = averageRemain - (kl === KnowledgeLevel.AVERAGE ? current : 0);
      const nextProfound = profoundRemain - (kl === KnowledgeLevel.PROFOUND ? current : 0);
      if (nextBasic < 0 || nextAverage < 0 || nextProfound < 0) continue;

      const remainder = search(idx + 1, nextBasic, nextAverage, nextProfound);
      if (remainder) {
        const found = [kl, ...remainder];
        memo.set(key, found);
        return found;
      }
    }

    memo.set(key, null);
    return null;
  };

  const exact = search(0, targets[KnowledgeLevel.BASIC], targets[KnowledgeLevel.AVERAGE], targets[KnowledgeLevel.PROFOUND]);
  const result = items.map(item => ({ ...item }));

  if (exact) {
    sorted.forEach((entry, idx) => {
      const chosen = exact[idx];
      result[entry.index].knowledgeLevel = chosen;
      if (result[entry.index].hasInternalChoice) {
        result[entry.index].knowledgeLevelB = chosen;
      }
    });
    return result;
  }

  const running = {
    [KnowledgeLevel.BASIC]: 0,
    [KnowledgeLevel.AVERAGE]: 0,
    [KnowledgeLevel.PROFOUND]: 0,
  } as Record<KnowledgeLevel, number>;

  sorted.forEach(entry => {
    const mark = entry.item.totalMarks;
    const choice = getPreferredKLs(entry.item.marksPerQuestion)
      .slice()
      .sort((a, b) => {
        const aGap = targets[a] - running[a];
        const bGap = targets[b] - running[b];
        return bGap - aGap;
      })[0];
    running[choice] += mark;
    result[entry.index].knowledgeLevel = choice;
    if (result[entry.index].hasInternalChoice) {
      result[entry.index].knowledgeLevelB = choice;
    }
  });

  return result;
};

// ─── Validation Engine ───────────────────────────────────────────────────────

interface ValidationError {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  detail?: string;
}

interface ValidationResult {
  errors: ValidationError[];
  klSummary: Record<KnowledgeLevel, { marks: number; target: number }>;
  sectionSummary: { sectionId: string; marks: number; count: number; filled: number }[];
  orStatus: Record<string, { filled: number; required: number; label: string }>;
  grandTotal: number;
  isValid: boolean;
  subUnitCoverage: { unitId: string; subUnitId: string; marks: number; pct: number }[];
  analytics: {
    unitTargets: { unitId: string; unitName: string; actual: number; ideal: number; deviation: number; pct: number }[];
    subUnitTargets: { unitId: string; unitName: string; subUnitId: string; subUnitName: string; actual: number; ideal: number; deviation: number; pct: number }[];
    sectionTargets: { sectionId: string; label: string; actualQuestions: number; expectedQuestions: number; actualMarks: number }[];
    datasetMeta: { unitCount: number; subUnitCount: number; questionCount: number };
  };
}

function validateBlueprint(blueprint: Blueprint, paperType: PaperType, curriculum: Curriculum): ValidationResult {
  const rawErrors: ValidationError[] = [];
  const items = blueprint.items;

  // deduplicated push
  const pushError = (err: ValidationError) => {
    if (!rawErrors.some(e => e.code === err.code && e.message === err.message)) {
      rawErrors.push(err);
    }
  };

  // safe empty klSummary
  const emptyKlSummary = (): ValidationResult['klSummary'] =>
    Object.fromEntries(
      Object.values(KnowledgeLevel).map(kl => [kl, { marks: 0, target: 0 }])
    ) as ValidationResult['klSummary'];

  if (!paperType?.sections) {
    return {
      errors: [{ type: 'error', code: 'PAPER_TYPE_MISSING', message: 'பேப்பர் டைப் கிடைக்கவில்லை.' }],
      klSummary: emptyKlSummary(), sectionSummary: [], orStatus: {}, grandTotal: 0, isValid: false, subUnitCoverage: [],
      analytics: { unitTargets: [], subUnitTargets: [], sectionTargets: [], datasetMeta: { unitCount: 0, subUnitCount: 0, questionCount: 0 } }
    };
  }
  if (!curriculum?.units) {
    return {
      errors: [{ type: 'error', code: 'CURRICULUM_MISSING', message: 'பாடத்திட்டம் கிடைக்கவில்லை.' }],
      klSummary: emptyKlSummary(), sectionSummary: [], orStatus: {}, grandTotal: 0, isValid: false, subUnitCoverage: [],
      analytics: { unitTargets: [], subUnitTargets: [], sectionTargets: [], datasetMeta: { unitCount: 0, subUnitCount: 0, questionCount: 0 } }
    };
  }

  // ── 1. Grand total ──────────────────────────────────────────────────────────
  const grandTotal = items.reduce((acc, i) => acc + i.totalMarks, 0);
  if (items.length > 0 && grandTotal !== blueprint.totalMarks) {
    pushError({
      type: 'error', code: 'TOTAL_MISMATCH',
      message: `மொத்த மதிப்பெண் ${grandTotal}M ≠ எதிர்பார்க்கப்பட்ட ${blueprint.totalMarks}M`,
      detail: 'Blueprint மதிப்பெண்ணை சரியாக பகிர்ந்தளிக்கவும்.',
    });
  }

  // ── 2. Knowledge Level distribution ────────────────────────────────────────
  const klMarks: Record<KnowledgeLevel, number> = {
    [KnowledgeLevel.BASIC]: 0, [KnowledgeLevel.AVERAGE]: 0, [KnowledgeLevel.PROFOUND]: 0,
  };
  items.forEach(item => { klMarks[item.knowledgeLevel] += item.totalMarks; });

  let perfectKL = items.length > 0;
  const klSummary = emptyKlSummary();

  const KL_EXACT = computeExactKlTargets(blueprint.totalMarks);

  ([KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE, KnowledgeLevel.PROFOUND] as KnowledgeLevel[]).forEach(kl => {
    const target = KL_EXACT[kl];
    const marks = klMarks[kl] || 0;
    klSummary[kl] = { marks, target };

    if (items.length === 0) return;

    if (marks === 0) {
      perfectKL = false;
      pushError({
        type: 'error', code: `KL_MISSING_${kl.toUpperCase()}`,
        message: `${kl}: 0M — கட்டாயம் ${target}M (${Math.round(KL_TARGETS[kl] * 100)}%) இருக்க வேண்டும்`,
        detail: `${kl} நிலை வினாக்கள் இல்லை. இது கட்டாய தேவை.`
      });
    } else if (marks !== target) {
      perfectKL = false;
      const diff = marks - target;
      pushError({
        type: 'error', code: `KL_DEVIATION_${kl.toUpperCase()}`,
        message: `${kl}: ${marks}M — தேவை சரியாக ${target}M (${diff > 0 ? '+' : ''}${diff}M வேறுபாடு)`,
        detail: `Blueprint விதி: ${kl} = ${Math.round(KL_TARGETS[kl] * 100)}% = ${target}M சரியாக இருக்க வேண்டும்.`
      });
    }
  });

  if (perfectKL && items.length > 0) {
    pushError({
      type: 'info', code: 'EXCELLENCE_KL',
      message: "Bloom's Target மிகச்சரியாக உள்ளது",
      detail: 'அனைத்து Knowledge Level களும் இலக்கிற்கு ஏற்ப உள்ளன.'
    });
  }

  // ── 3. Section fill validation ──────────────────────────────────────────────
  const sectionSummary: ValidationResult['sectionSummary'] = paperType.sections.map(s => {
    const filled = items.filter(i => i.sectionId === s.id).reduce((acc, i) => acc + i.questionCount, 0);
    if (items.length > 0 && filled !== s.count) {
      pushError({
        type: filled > s.count ? 'error' : 'warning',
        code: `SEC_COUNT_${s.id}`,
        message: `${s.marks}M பிரிவு: ${filled}/${s.count} வினாக்கள்`,
        detail: filled > s.count ? 'பிரிவு வரம்பை மீறியுள்ளது.' : 'பிரிவு முழுமையாக நிரப்பப்படவில்லை.',
      });
    }
    return { sectionId: s.id, marks: s.marks, count: s.count, filled };
  });
  const sectionTargets = paperType.sections.map(s => ({
    sectionId: s.id,
    label: `${s.marks}M`,
    actualQuestions: items.filter(i => i.sectionId === s.id).reduce((acc, i) => acc + i.questionCount, 0),
    expectedQuestions: s.count,
    actualMarks: items.filter(i => i.sectionId === s.id).reduce((acc, i) => acc + i.totalMarks, 0),
  }));

  // ── 4. Internal Choice (OR) validation ─────────────────────────────────────
  // Rule: Each section with optionCount > 0 needs exactly 1 OR question.
  // OR counts must use questionCount (not item count).
  const orStatus: ValidationResult['orStatus'] = {};
  paperType.sections.forEach(s => {
    if (s.optionCount > 0) {
      const orItems = items.filter(i => i.sectionId === s.id && i.hasInternalChoice);
      const orQCount = orItems.reduce((acc, i) => acc + i.questionCount, 0);
      orStatus[s.id] = { filled: orQCount, required: s.optionCount, label: `${s.marks}M` };
      if (items.length > 0) {
        if (orQCount === 0) {
          pushError({
            type: 'warning', code: `OR_MISSING_${s.id}`,
            message: `${s.marks}M: ஆப்ஷன் வினா (OR) இல்லை`,
            detail: `${s.optionCount} வினாவிற்கு internal choice அமைக்கவும்.`
          });
        } else if (orQCount > s.optionCount) {
          pushError({
            type: 'error', code: `OR_EXCESS_${s.id}`,
            message: `${s.marks}M: OR ${orQCount} — அனுமதிக்கப்பட்டது ${s.optionCount} மட்டுமே`,
            detail: 'கூடுதல் OR வினாக்களை நீக்கவும்.'
          });
        } else {
          pushError({
            type: 'info', code: `OR_OK_${s.id}`,
            message: `${s.marks}M: OR சரியாக உள்ளது (${orQCount}/${s.optionCount})`,
            detail: 'Internal choice சரியாக அமைக்கப்பட்டுள்ளது.'
          });
        }
      }
    }
  });

  // ── 5. OR Sub-unit & Unit spread validation ─────────────────────────────────
  // Rule A (always)   : ஒரே sub-unit-ல் ஒரே section-இல் OR > 1 வரக்கூடாது
  // Rule B (multi)    : ஒரே பாடத்தில் OR > 60% குவியக்கூடாது
  // Rule C (single)   : ஒரே sub-unit-ல் OR > 1 வரக்கூடவே கூடாது
  const choiceItems = items.filter(i => i.hasInternalChoice);
  const totalUnitCount = curriculum.units.length;

  if (choiceItems.length > 0 && items.length > 0) {
    const subUnitOrMap = new Map<string, string[]>();
    choiceItems.forEach(item => {
      const targetSubUnit = item.subUnitIdB || item.subUnitId;
      const existing = subUnitOrMap.get(targetSubUnit) || [];
      subUnitOrMap.set(targetSubUnit, [...existing, item.sectionId]);
    });
    subUnitOrMap.forEach((sectionIds, subUnitId) => {
      if (sectionIds.length > 1) {
        const subName = curriculum.units.flatMap(u => u.subUnits).find(su => su.id === subUnitId)?.name || subUnitId;
        pushError({
          type: 'warning', code: `OR_SUBUNIT_CLASH_${subUnitId}`,
          message: `"${subName}" — ஒரே பாடப்பகுதியில் ${sectionIds.length} OR வினாக்கள்`,
          detail: 'OR வினாக்களை வெவ்வேறு பாடப்பகுதிகளில் பரவச் செய்யவும்.'
        });
      }
    });

    if (totalUnitCount > 1) {
      // Multi-subject: flag if one unit holds > 60% of all ORs
      const unitOrMap = new Map<string, number>();
      choiceItems.forEach(item => {
        const targetUnit = item.unitIdB || item.unitId;
        unitOrMap.set(targetUnit, (unitOrMap.get(targetUnit) || 0) + item.questionCount);
      });
      const totalOrQ = choiceItems.reduce((acc, i) => acc + i.questionCount, 0);
      unitOrMap.forEach((cnt, unitId) => {
        const unit = curriculum.units.find(u => u.id === unitId);
        const unitName = unit?.name || unitId;
        const pct = totalOrQ > 0 ? Math.round((cnt / totalOrQ) * 100) : 0;
        if (pct > 60) {
          pushError({
            type: 'warning', code: `OR_UNIT_CONCENTRATION_${unitId}`,
            message: `"${unitName}" — OR வினாக்களில் ${pct}% குவிந்துள்ளது (பல பாடங்கள்)`,
            detail: 'பல பாடங்கள் உள்ளதால் OR வினாக்களை வெவ்வேறு பாடங்களில் சீராக பரவச் செய்யவும்.'
          });
        }
      });
    } else {
      // Single-subject: every OR must come from a DIFFERENT sub-unit
      const singleSubMap = new Map<string, number>();
      choiceItems.forEach(item => {
        const targetSubUnit = item.subUnitIdB || item.subUnitId;
        singleSubMap.set(targetSubUnit, (singleSubMap.get(targetSubUnit) || 0) + item.questionCount);
      });
      singleSubMap.forEach((cnt, subUnitId) => {
        if (cnt > 1) {
          const subName = curriculum.units.flatMap(u => u.subUnits).find(su => su.id === subUnitId)?.name || subUnitId;
          pushError({
            type: 'warning', code: `OR_SINGLE_SUBUNIT_PILE_${subUnitId}`,
            message: `"${subName}" — ஒரே பாடப்பகுதியில் ${cnt} OR வினாக்கள் (ஒரே பாடம்)`,
            detail: 'ஒரே பாடம் மட்டும் உள்ளதால் ஒவ்வொரு OR வினாவும் வெவ்வேறு பாடப்பகுதியில் இருக்க வேண்டும்.'
          });
        }
      });
    }

    choiceItems.forEach(item => {
      if (item.unitIdB && item.unitIdB !== item.unitId) {
        pushError({
          type: 'error', code: `OPTION_UNIT_MISMATCH_${item.id}`,
          message: `${item.marksPerQuestion}M OR: Option B வேறு unit-க்கு நகர்ந்துள்ளது`,
          detail: 'OR option அதே unit-க்குள் உள்ள sub-unit-ல் மட்டும் அமைக்க வேண்டும்.'
        });
      }
      if (item.knowledgeLevelB && item.knowledgeLevel !== item.knowledgeLevelB) {
        pushError({
          type: 'error', code: `OPTION_KL_MISMATCH_${item.id}`,
          message: `${item.marksPerQuestion}M OR: A(${item.knowledgeLevel}) ≠ B(${item.knowledgeLevelB})`,
          detail: 'Option A மற்றும் B ஒரே KL-ல் இருக்க வேண்டும்.'
        });
      }
    });

    const subUnitClashes = [...subUnitOrMap.values()].filter(v => v.length > 1).length;
    if (subUnitClashes === 0 && choiceItems.length > 1) {
      pushError({
        type: 'info', code: 'EXCELLENCE_OR',
        message: 'OR வினாக்கள் சரியாக பரவியுள்ளன',
        detail: 'சாய்ஸ் வினாக்கள் வெவ்வேறு பாடப்பகுதிகளில் சீராக உள்ளன.'
      });
    }
  }

  // ── 5b. examTerm-based OR distribution ─────────────────────────────────────
  // BT (1st term): single unit — OR must come from DIFFERENT sub-units
  // AT (3rd term): 5-6 units — OR must spread across ≥3 units, max 1 OR per unit
  if (choiceItems.length > 0 && items.length > 0) {
    const examTermLower = (blueprint.examTerm || '').toLowerCase();
    const isATTerm = examTermLower.includes('at') || examTermLower.includes('third') || examTermLower.includes('மூன்று');
    const isBTTerm = examTermLower.includes('bt') || examTermLower.includes('first') || examTermLower.includes('முதல்');

    if (isATTerm && curriculum.units.length >= 3) {
      // AT: max 1 OR per unit
      const atUnitOrMap = new Map<string, number>();
      choiceItems.forEach(item => {
        const targetUnit = item.unitIdB || item.unitId;
        atUnitOrMap.set(targetUnit, (atUnitOrMap.get(targetUnit) || 0) + item.questionCount);
      });
      atUnitOrMap.forEach((cnt, unitId) => {
        if (cnt > 1) {
          const unit = curriculum.units.find(u => u.id === unitId);
          pushError({
            type: 'error', code: `AT_OR_UNIT_EXCESS_${unitId}`,
            message: `"${unit?.name || unitId}" — ஒரே யூனிட்டில் ${cnt} OR வினாக்கள் (AT)`,
            detail: 'AT பருவத்தில் ஒரு யூனிட்டில் அதிகபட்சம் 1 OR வினா மட்டுமே இருக்க வேண்டும்.'
          });
        }
      });
      // AT: OR spread across ≥3 units
      const atUnitsWithOR = atUnitOrMap.size;
      if (atUnitsWithOR < 3) {
        pushError({
          type: 'warning', code: 'AT_OR_SPREAD_INSUFFICIENT',
          message: `OR வினாக்கள் ${atUnitsWithOR} யூனிட்(கள்)ல் மட்டுமே உள்ளன`,
          detail: 'AT (மூன்றாம் பருவம்): குறைந்தது 3 யூனிட்களில் OR வினாக்கள் பரவியிருக்க வேண்டும்.'
        });
      } else if (atUnitsWithOR >= 3 && [...atUnitOrMap.values()].every(v => v <= 1)) {
        pushError({
          type: 'info', code: 'AT_OR_SPREAD_OK',
          message: `AT OR வினாக்கள் ${atUnitsWithOR} யூனிட்களில் சரியாக பரவியுள்ளன`,
          detail: 'AT term OR distribution சரியாக உள்ளது.'
        });
      }
    }

    if (isBTTerm || curriculum.units.length === 1) {
      // BT / Single-unit: every OR must come from a different sub-unit
      const btSubOrMap = new Map<string, number>();
      choiceItems.forEach(item => {
        const targetSubUnit = item.subUnitIdB || item.subUnitId;
        btSubOrMap.set(targetSubUnit, (btSubOrMap.get(targetSubUnit) || 0) + item.questionCount);
      });
      btSubOrMap.forEach((cnt, subUnitId) => {
        if (cnt > 1) {
          const subName = curriculum.units.flatMap(u => u.subUnits).find(su => su.id === subUnitId)?.name || subUnitId;
          pushError({
            type: 'error', code: `BT_OR_SUBUNIT_EXCESS_${subUnitId}`,
            message: `"${subName}" — ஒரே துணைப்பாடத்தில் ${cnt} OR வினாக்கள் (BT)`,
            detail: 'BT பருவத்தில் ஒரு துணைப்பாடத்தில் 1 OR வினா மட்டுமே இருக்க வேண்டும். வெவ்வேறு sub-units-ஐ தேர்வு செய்யவும்.'
          });
        }
      });
    }
  }


  const subUnitCoverage: ValidationResult['subUnitCoverage'] = [];
  const unitTargets: ValidationResult['analytics']['unitTargets'] = [];
  const subUnitTargets: ValidationResult['analytics']['subUnitTargets'] = [];
  let uncoveredSubUnits = 0;
  const totalSubUnitCount = curriculum.units.reduce((sum, unit) => sum + unit.subUnits.length, 0);
  const idealUnitMarks = curriculum.units.length > 0 ? blueprint.totalMarks / curriculum.units.length : 0;
  const idealSubUnitMarks = totalSubUnitCount > 0 ? blueprint.totalMarks / totalSubUnitCount : 0;
  const balancingTolerance = Math.max(...paperType.sections.map(s => s.marks), 2);

  curriculum.units.forEach(unit => {
    const unitMarks = items
      .filter(i => i.unitId === unit.id || (i.hasInternalChoice && i.unitIdB === unit.id))
      .reduce((acc, i) => acc + i.totalMarks, 0);
    const unitPct = blueprint.totalMarks > 0 ? Math.round((unitMarks / blueprint.totalMarks) * 100) : 0;
    const unitDeviation = Math.round((unitMarks - idealUnitMarks) * 10) / 10;
    unitTargets.push({
      unitId: unit.id,
      unitName: unit.name,
      actual: unitMarks,
      ideal: Math.round(idealUnitMarks * 10) / 10,
      deviation: unitDeviation,
      pct: unitPct,
    });

    if (items.length > 0 && Math.abs(unitDeviation) > balancingTolerance) {
      pushError({
        type: 'warning',
        code: `UNIT_BALANCE_${unit.id}`,
        message: `"${unit.name}" — ideal ${Math.round(idealUnitMarks)}M-இல் இருந்து ${unitDeviation > 0 ? '+' : ''}${unitDeviation}M வேறுபாடு`,
        detail: 'எல்லா யூனிட்களுக்கும் சமநிலை மதிப்பெண் பகிர்வு பரிந்துரைக்கப்படுகிறது.',
      });
    }

    unit.subUnits.forEach(su => {
      const suMarks = items
        .filter(i => (i.unitId === unit.id && i.subUnitId === su.id) || (i.hasInternalChoice && i.unitIdB === unit.id && i.subUnitIdB === su.id))
        .reduce((acc, i) => acc + i.totalMarks, 0);
      const pct = blueprint.totalMarks > 0 ? Math.round((suMarks / blueprint.totalMarks) * 100) : 0;
      subUnitCoverage.push({ unitId: unit.id, subUnitId: su.id, marks: suMarks, pct });
      const subDeviation = Math.round((suMarks - idealSubUnitMarks) * 10) / 10;
      subUnitTargets.push({
        unitId: unit.id,
        unitName: unit.name,
        subUnitId: su.id,
        subUnitName: su.name,
        actual: suMarks,
        ideal: Math.round(idealSubUnitMarks * 10) / 10,
        deviation: subDeviation,
        pct,
      });
      if (suMarks === 0 && items.length > 0) {
        uncoveredSubUnits++;
        pushError({
          type: 'warning', code: `SUBUNIT_EMPTY_${su.id}`,
          message: `"${su.name}" — வினாக்கள் ஒதுக்கப்படவில்லை`,
          detail: 'இந்த பாடப்பகுதியிலிருந்து குறைந்தது ஒரு வினா சேர்க்கவும்.'
        });
      } else if (items.length > 0 && Math.abs(subDeviation) > balancingTolerance) {
        pushError({
          type: 'info',
          code: `SUBUNIT_BALANCE_${su.id}`,
          message: `"${su.name}" — ideal ${Math.round(idealSubUnitMarks)}M-இல் இருந்து ${subDeviation > 0 ? '+' : ''}${subDeviation}M வேறுபாடு`,
          detail: 'Sub-unit சமநிலைக்கு இது ஒரு deviation signal ஆக கருதப்படுகிறது.',
        });
      }
    });
  });

  if (uncoveredSubUnits === 0 && items.length > 0) {
    pushError({
      type: 'info', code: 'EXCELLENCE_COVERAGE',
      message: 'அனைத்து பாடப்பகுதிகளும் உள்ளடக்கப்பட்டுள்ளன',
      detail: 'எல்லா sub-units-லும் வினாக்கள் ஒதுக்கப்பட்டுள்ளன.'
    });
  }

  // ── 7. Unit mark concentration check ──────────────────────────────────────
  if (curriculum.units.length > 1 && items.length > 0) {
    curriculum.units.forEach(unit => {
      const uMarks = items.filter(i => i.unitId === unit.id).reduce((acc, i) => acc + i.totalMarks, 0);
      const uPct = blueprint.totalMarks > 0 ? Math.round((uMarks / blueprint.totalMarks) * 100) : 0;
      if (uPct > 50) {
        pushError({
          type: 'warning', code: `UNIT_OVERWEIGHT_${unit.id}`,
          message: `"${unit.name}" — ${uPct}% மதிப்பெண்கள் (அதிகம்)`,
          detail: 'ஒரு பாடத்தில் 50%-க்கும் அதிகம் வினாக்கள் குவிவதை தவிர்க்கவும்.'
        });
      }
    });
  }

  // ── 8. Sub-unit mark balance check ────────────────────────────────────────
  if (items.length > 0) {
    const allSubMarks = subUnitCoverage.filter(s => s.marks > 0).map(s => s.marks);
    if (allSubMarks.length > 1) {
      const maxM = Math.max(...allSubMarks);
      const minM = Math.min(...allSubMarks);
      // Allow ±marks-of-one-section difference as reasonable imbalance
      const sectionMarkValues = paperType.sections.map(s => s.marks);
      const maxAllowedDiff = Math.max(...sectionMarkValues, 2);
      if ((maxM - minM) > maxAllowedDiff * 2) {
        pushError({
          type: 'info', code: 'SUBUNIT_IMBALANCE',
          message: `பாடப்பகுதி மதிப்பெண் வேறுபாடு: ${minM}M – ${maxM}M`,
          detail: 'இது சாதாரணமானது. தேவைப்பட்டால் மதிப்பெண்களை சமப்படுத்தலாம்.'
        });
      }
    }
  }

  // ── 9. itemFormat for OR B side missing ────────────────────────────────────
  if (items.length > 0) {
    choiceItems.forEach(item => {
      if (!item.itemFormatB) {
        pushError({
          type: 'info', code: `OR_FORMAT_B_MISSING_${item.id}`,
          message: `${item.marksPerQuestion}M OR: Option B format அமைக்கப்படவில்லை`,
          detail: 'Option B-க்கு Item Format தேர்வு செய்யவும்.'
        });
      }
    });
  }

  // ── 10. CP3 (Computational Thinking) is not allowed in any question ──────────
  if (items.length > 0) {
    const cp3Items = items.filter(i =>
      i.cognitiveProcess === CognitiveProcess.CP3 ||
      (i.hasInternalChoice && i.cognitiveProcessB === CognitiveProcess.CP3)
    );
    if (cp3Items.length > 0) {
      pushError({
        type: 'error', code: 'CP3_NOT_ALLOWED',
        message: `"Computational Thinking (CP3)" எந்த வினாவிலும் பயன்படுத்தக் கூடாது (${cp3Items.length} வினாக்கள்)`,
        detail: 'CP3 blueprint விதிகளுக்கு அனுமதிக்கப்படவில்லை. Auto-fix மூலம் சரிசெய்யலாம்.'
      });
    }
  }

  // ── 11. KL total sanity ────────────────────────────────────────────────────
  if (items.length > 0) {
    const klSum = Object.values(klMarks).reduce((a, b) => a + b, 0);
    if (klSum !== blueprint.totalMarks) {
      pushError({
        type: 'warning', code: 'KL_SUM_MISMATCH',
        message: `KL மொத்தம் ${klSum}M ≠ மொத்த மதிப்பெண் ${blueprint.totalMarks}M`,
        detail: 'Knowledge Level மதிப்பெண்கள் மொத்தம் சரியாக இல்லை. Auto-fill பயன்படுத்தவும்.'
      });
    }
  }

  // ── 12. Cognitive Process diversity ───────────────────────────────────────
  if (items.length > 4) {
    const allowedCPs = getAllowedCPs(blueprint.subject);
    const cpCounts = new Map<string, number>();
    items.forEach(i => cpCounts.set(i.cognitiveProcess, (cpCounts.get(i.cognitiveProcess) || 0) + 1));
    const dominantCP = [...cpCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const dominantPct = Math.round((dominantCP[1] / items.length) * 100);
    if (dominantPct > 50) {
      pushError({
        type: 'info', code: 'CP_IMBALANCE',
        message: `"${dominantCP[0]}" — ${dominantPct}% வினாக்கள் (அதிகம்)`,
        detail: `${allowedCPs.length} வகை Cognitive Process-களை சீராக பயன்படுத்துவது சிறந்தது.`
      });
    } else if (cpCounts.size >= Math.min(4, allowedCPs.length)) {
      pushError({
        type: 'info', code: 'EXCELLENCE_CP',
        message: `Cognitive Process: ${cpCounts.size} வகைகள் பயன்படுத்தப்பட்டுள்ளன`,
        detail: 'சிறந்த Cognitive diversity கடைப்பிடிக்கப்படுகிறது.'
      });
    }
  }

  // ── 13. Higher-order thinking (Profound ≥ 15%) ────────────────────────────
  if (items.length > 0) {
    const profoundPct = blueprint.totalMarks > 0
      ? Math.round((klMarks[KnowledgeLevel.PROFOUND] / blueprint.totalMarks) * 100) : 0;
    if (profoundPct < 15) {
      pushError({
        type: 'info', code: 'LOW_PROFOUND',
        message: `Profound மட்டம்: ${profoundPct}% — கீழ் வரம்பில் உள்ளது`,
        detail: 'உயர்நிலை சிந்தனை வினாக்கள் (Profound) குறைந்தது 15% இருக்க பரிந்துரைக்கப்படுகிறது.'
      });
    }
  }

  // ── 14. Section mark concentration (no section > 50% of total) ────────────
  if (items.length > 0) {
    paperType.sections.forEach(s => {
      const sMarks = items.filter(i => i.sectionId === s.id).reduce((acc, i) => acc + i.totalMarks, 0);
      const sPct = blueprint.totalMarks > 0 ? Math.round((sMarks / blueprint.totalMarks) * 100) : 0;
      if (sPct > 50) {
        pushError({
          type: 'warning', code: `SECTION_OVERWEIGHT_${s.id}`,
          message: `${s.marks}M பிரிவு — ${sPct}% மதிப்பெண்கள் (அதிகம்)`,
          detail: 'ஒரே பிரிவில் 50%-க்கு அதிகமான மதிப்பெண்கள் குவிவதை தவிர்க்கவும்.'
        });
      }
    });
  }

  // ── 15. Blueprint completeness score ──────────────────────────────────────
  if (items.length > 0) {
    const finalErrors = rawErrors.filter(e => e.type === 'error').length;
    const finalWarnings = rawErrors.filter(e => e.type === 'warning').length;
    const score = Math.max(0, 100 - finalErrors * 20 - finalWarnings * 5);
    if (score === 100) {
      pushError({
        type: 'info', code: 'BLUEPRINT_PERFECT',
        message: '🏆 Blueprint 100% சரியாக உள்ளது!',
        detail: 'அனைத்து விதிகளும் பூர்த்தி செய்யப்பட்டுள்ளன. உறுதிப்படுத்தலாம்.'
      });
    } else if (score >= 80) {
      pushError({
        type: 'info', code: 'BLUEPRINT_GOOD',
        message: `Blueprint தரம்: ${score}/100`,
        detail: 'சிறிய திருத்தங்களுடன் Blueprint தயாராகும்.'
      });
    }
  }

  return {
    errors: rawErrors,
    klSummary,
    sectionSummary,
    orStatus,
    grandTotal,
    isValid: rawErrors.filter(e => e.type === 'error').length === 0,
    subUnitCoverage,
    analytics: {
      unitTargets,
      subUnitTargets,
      sectionTargets,
      datasetMeta: {
        unitCount: curriculum.units.length,
        subUnitCount: totalSubUnitCount,
        questionCount: items.reduce((sum, item) => sum + item.questionCount, 0),
      },
    },
  };
}

// ─── Auto-fill Engine ────────────────────────────────────────────────────────
/**
 * Produces corrected items array:
 * 1. KL targets satisfied (Basic 30%, Average 50%, Profound 20%)
 * 2. CP3 removed for language subjects; reassigned with allowed CPs
 * 3. OR: exactly s.optionCount per section, spread across different sub-units
 * 4. No OR in same sub-unit twice
 */
export function autoFillBlueprint(
  items: BlueprintItem[],
  paperType: PaperType,
  curriculum: Curriculum,
  totalMarks: number,
  subject?: string,
  examTerm?: string
): BlueprintItem[] {
  if (!items.length || !paperType || !curriculum) return items;

  let result = items.map(item => ({ ...item }));
  const allowedCPs = getAllowedCPs(subject ?? curriculum.subject ?? '');

  // Step 0: Fix any CP3 usage — CP3 is not allowed in any blueprint
  {
    const allowedNonCP3 = getAllowedCPs();
    let cpIdx = 0;
    result.forEach(item => {
      if (item.cognitiveProcess === CognitiveProcess.CP3) {
        item.cognitiveProcess = allowedNonCP3[cpIdx % allowedNonCP3.length];
        cpIdx++;
      }
      if (item.cognitiveProcessB === CognitiveProcess.CP3) {
        item.cognitiveProcessB = allowedNonCP3[cpIdx % allowedNonCP3.length];
        cpIdx++;
      }
    });
  }

  // Step 1: Fix KL distribution exactly wherever possible
  result = assignKnowledgeLevelsExactly(result, totalMarks);

  // Step 2: Fix OR — clear all existing, then assign correctly
  result.forEach(item => {
    item.hasInternalChoice = false;
    item.unitIdB = undefined;
    item.subUnitIdB = undefined;
    item.knowledgeLevelB = undefined;
    item.cognitiveProcessB = undefined;
    item.itemFormatB = undefined;
  });

  const examTermLower = (examTerm || '').toLowerCase();
  const isATTerm = examTermLower.includes('at') || examTermLower.includes('third') || examTermLower.includes('மூன்று');
  const usedSubUnits = new Set<string>();
  const usedUnits = new Set<string>(); // for AT: max 1 OR per unit

  paperType.sections.forEach(section => {
    if (section.optionCount <= 0) return;

    const sectionItems = result.filter(i => i.sectionId === section.id);
    let assigned = 0;

    // Pick items from different sub-units (and different units for AT)
    for (const item of sectionItems) {
      if (assigned >= section.optionCount) break;
      const unitAlreadyUsed = isATTerm && usedUnits.has(item.unitId);
      if (!usedSubUnits.has(item.subUnitId) && !unitAlreadyUsed) {
        const optionSubUnits = curriculum.units.find(u => u.id === item.unitId)?.subUnits.filter(su => su.id !== item.subUnitId) || [];
        const fallbackSubUnit = optionSubUnits[0]?.id || item.subUnitId;
        item.hasInternalChoice = true;
        item.unitIdB = item.unitId;
        item.subUnitIdB = fallbackSubUnit;
        item.knowledgeLevelB = item.knowledgeLevel;
        item.cognitiveProcessB = getSafeCP(item.cognitiveProcess);
        item.itemFormatB = item.itemFormat;
        usedSubUnits.add(item.subUnitId);
        usedUnits.add(item.unitId);
        assigned++;
      }
    }

    // If couldn't find unique sub-units, allow same sub-unit (fallback)
    if (assigned < section.optionCount) {
      for (const item of sectionItems) {
        if (assigned >= section.optionCount) break;
        if (!item.hasInternalChoice) {
          const optionSubUnits = curriculum.units.find(u => u.id === item.unitId)?.subUnits.filter(su => su.id !== item.subUnitId) || [];
          item.hasInternalChoice = true;
          item.unitIdB = item.unitId;
          item.subUnitIdB = optionSubUnits[0]?.id || item.subUnitId;
          item.knowledgeLevelB = item.knowledgeLevel;
          item.cognitiveProcessB = getSafeCP(item.cognitiveProcess);
          item.itemFormatB = item.itemFormat;
          assigned++;
        }
      }
    }
  });

  return result.map(item => ({ ...item, ...sanitizeBlueprintItem(item) }));
}

// ─── KL Badge ────────────────────────────────────────────────────────────────
interface KLBadgeProps { level: KnowledgeLevel; short?: boolean }
const KLBadge: React.FC<KLBadgeProps> = ({ level, short }) => {
  const c = KL_COLORS[level];
  return (
    <span className={`text-[9px] uppercase font-bold px-1 rounded ${c.badge}`}>
      {short ? level[0] : level}
    </span>
  );
};

// ─── Validation Panel ────────────────────────────────────────────────────────
interface ValidationPanelProps {
  result: ValidationResult;
  paperType: PaperType;
  onAutoFill?: () => void;
  onHighlightSubUnit?: (subUnitId: string) => void;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({ result, paperType, onAutoFill, onHighlightSubUnit }) => {
  const [checked, setChecked] = useState(false);

  const errors = result.errors.filter(e => e.type === 'error');
  const warnings = result.errors.filter(e => e.type === 'warning');
  const infos = result.errors.filter(e => e.type === 'info');

  const handleCheck = () => setChecked(true);

  const handleWarningClick = (warning: ValidationError) => {
    if (!warning.code?.startsWith('SUBUNIT_EMPTY_')) return;
    const subUnitId = warning.code.replace('SUBUNIT_EMPTY_', '');
    onHighlightSubUnit?.(subUnitId);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-sm bg-white h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Validation</span>
        {checked && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${result.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {result.isValid ? '✓ சரியாக உள்ளது' : `${errors.length} பிழை`}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* KL Progress bars — always visible */}
        {([KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE, KnowledgeLevel.PROFOUND] as KnowledgeLevel[]).map(kl => {
          const { marks, target } = result.klSummary[kl] || { marks: 0, target: 0 };
          const pct = Math.min(100, (marks / Math.max(target, 1)) * 100);
          const c = KL_COLORS[kl];
          const ok = marks === target;
          return (
            <div key={kl}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-semibold ${c.text}`}>{kl}</span>
                <span className={`text-xs font-bold ${ok ? 'text-green-600' : 'text-red-500'}`}>
                  {marks}/{target}M
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${ok ? 'bg-green-500' : marks > target ? 'bg-red-400' : 'bg-amber-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {Math.round(KL_TARGETS[kl] * 100)}% இலக்கு
              </div>
            </div>
          );
        })}

        <hr className="border-gray-100" />

        {/* OR Status chips */}
        {Object.keys(result.orStatus).length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">OR நிலை</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(result.orStatus) as [string, { filled: number; required: number; label: string }][]).map(([sId, info]) => (
                <span key={sId}
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${info.filled === info.required ? 'bg-green-50 text-green-700 border-green-300'
                    : info.filled > info.required ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-orange-50 text-orange-700 border-orange-300'}`}>
                  {info.label}: {info.filled}/{info.required}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Check button */}
        {!checked && (
          <button
            onClick={handleCheck}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <ClipboardCheck size={14} /> Blueprint சரிபார்க்கவும்
          </button>
        )}

        {/* Results — shown only after check */}
        {checked && (
          <div className="space-y-2">
            {/* Re-check button */}
            <button
              onClick={() => setChecked(false)}
              className="w-full py-1.5 border border-gray-200 text-gray-500 text-[10px] font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              மீண்டும் சரிபார்க்கவும்
            </button>

            {result.errors.length === 0 ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 p-2.5 rounded-lg">
                <CheckCircle size={14} className="shrink-0" />
                <span className="text-xs font-semibold">அனைத்தும் சரியாக உள்ளது!</span>
              </div>
            ) : (
              <>
                {/* Errors */}
                {errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-red-600 uppercase tracking-wider flex items-center gap-1">
                      <X size={10} /> பிழைகள் ({errors.length})
                    </div>
                    {errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                        <X size={12} className="mt-0.5 shrink-0 text-red-500" />
                        <div>
                          <div className="text-xs font-bold text-red-700">{e.message}</div>
                          {e.detail && <div className="text-[10px] text-red-500 mt-0.5">{e.detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-orange-600 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle size={10} /> கவனிக்கவும் ({warnings.length})
                    </div>
                    {warnings.map((e, i) => {
                      const isClickable = e.code?.startsWith('SUBUNIT_EMPTY_');
                      return (
                        <div
                          key={i}
                          onClick={isClickable ? () => handleWarningClick(e) : undefined}
                          title={isClickable ? 'Click to highlight this sub-unit row' : undefined}
                          className={`flex items-start gap-2 p-2 rounded-lg bg-orange-50 border border-orange-200 ${isClickable ? 'cursor-pointer hover:bg-orange-100' : ''}`}
                        >
                          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-orange-500" />
                          <div>
                            <div className="text-xs font-bold text-orange-700">{e.message}</div>
                            {e.detail && <div className="text-[10px] text-orange-500 mt-0.5">{e.detail}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Info / Good items */}
                {infos.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-green-600 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle size={10} /> நன்மைகள் ({infos.length})
                    </div>
                    {infos.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
                        <CheckCircle size={12} className="mt-0.5 shrink-0 text-green-500" />
                        <div>
                          <div className="text-xs font-bold text-green-700">{e.message}</div>
                          {e.detail && <div className="text-[10px] text-green-600 mt-0.5">{e.detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Auto-fill button */}
            <button
              onClick={() => onAutoFill?.()}
              disabled={!onAutoFill}
              className="w-full py-2 border-2 border-amber-400 bg-amber-50 text-amber-800 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={12} /> Auto-fix Blueprint
            </button>
          </div>
        )}

        {/* Rules Quick-Ref */}
        <hr className="border-gray-100" />
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">விதிகள்</div>
          <table className="w-full text-[10px]">
            <tbody>
              {([KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE, KnowledgeLevel.PROFOUND] as KnowledgeLevel[]).map(kl => {
                const t = result.klSummary[kl]?.target || 0;
                return (
                  <tr key={kl} className="border-b border-gray-50">
                    <td className="py-0.5 text-gray-600 font-medium">{kl}</td>
                    <td className="py-0.5 text-gray-400">{t}M ({Math.round(KL_TARGETS[kl] * 100)}%)</td>
                  </tr>
                );
              })}
              <tr>
                <td className="py-0.5 text-gray-600 font-medium">OR</td>
                <td className="py-0.5 text-gray-400">Section optionCount-க்கு ஏற்ப</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-600 font-medium">CP3</td>
                <td className="py-0.5 text-red-400 font-semibold">அனுமதியில்லை</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-600 font-medium">BT OR</td>
                <td className="py-0.5 text-gray-400">Sub-unit வாரியாக</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-600 font-medium">AT OR</td>
                <td className="py-0.5 text-gray-400">≥3 Units, max 1/Unit</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface AnalyticsPanelProps {
  result: ValidationResult;
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ result }) => {
  const [open, setOpen] = useState(true);
  const topUnitDrift = [...result.analytics.unitTargets]
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
    .slice(0, 4);
  const topSubUnitDrift = [...result.analytics.subUnitTargets]
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-slate-800 font-bold text-sm"
      >
        <span className="flex items-center gap-2"><Sparkles size={14} /> Blueprint Analysis Dataset</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="p-3 space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-[10px] uppercase text-slate-500 font-bold">Units</div>
              <div className="text-lg font-black text-slate-800">{result.analytics.datasetMeta.unitCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-[10px] uppercase text-slate-500 font-bold">Sub-units</div>
              <div className="text-lg font-black text-slate-800">{result.analytics.datasetMeta.subUnitCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-[10px] uppercase text-slate-500 font-bold">Questions</div>
              <div className="text-lg font-black text-slate-800">{result.analytics.datasetMeta.questionCount}</div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Unit Balance</div>
            <div className="space-y-1.5">
              {topUnitDrift.map(unit => (
                <div key={unit.unitId} className="rounded-lg border border-slate-100 px-2 py-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-slate-700">{unit.unitName}</span>
                    <span className={`font-black ${Math.abs(unit.deviation) <= 1 ? 'text-green-600' : unit.deviation > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                      {unit.actual}M / ideal {unit.ideal}M
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Sub-unit Drift</div>
            <div className="space-y-1.5">
              {topSubUnitDrift.map(sub => (
                <div key={sub.subUnitId} className="rounded-lg border border-slate-100 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-semibold text-slate-700 leading-tight">
                      {sub.subUnitName}
                      <span className="text-[10px] text-slate-500 font-medium"> ({sub.unitName})</span>
                    </div>
                    <span className={`text-[10px] font-bold ${sub.deviation === 0 ? 'text-green-600' : sub.deviation > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                      {sub.deviation > 0 ? '+' : ''}{sub.deviation}M
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {sub.actual}M / ideal {sub.ideal}M
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Item Card ────────────────────────────────────────────────────────────────

interface ItemCardProps {
  item: BlueprintItem;
  curriculum: Curriculum;
  readOnly: boolean;
  isEditing: boolean;
  isActive: boolean;
  isDragging: boolean;
  renderAsOptionB?: boolean;
  onEdit: () => void;
  onClose: () => void;
  onToggleActive: () => void;
  onUpdate: (id: string, field: keyof BlueprintItem, value: unknown) => void;
  onRemove?: (id: string) => void;
  onDragStart: (e: React.DragEvent, item: BlueprintItem, isOptionB?: boolean) => void;
  onDragEnd: () => void;
}

const ItemCard: React.FC<ItemCardProps> = ({
  item, curriculum, readOnly, isEditing, isActive, isDragging, renderAsOptionB = false, onEdit, onClose, onToggleActive, onUpdate, onRemove, onDragStart, onDragEnd,
}) => {
  const activeLevel = renderAsOptionB ? (item.knowledgeLevelB || item.knowledgeLevel) : item.knowledgeLevel;
  const activeCP = renderAsOptionB ? (item.cognitiveProcessB || item.cognitiveProcess) : item.cognitiveProcess;
  const activeFormat = renderAsOptionB ? (item.itemFormatB || item.itemFormat) : item.itemFormat;
  const markColor = MARK_COLORS[item.marksPerQuestion] || 'bg-gray-100 border-gray-400 text-gray-900';
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [popStyle, setPopStyle] = React.useState<React.CSSProperties>({ top: '100%', left: 0 });

  React.useEffect(() => {
    if (!isEditing || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popW = 480; // edit-drawer width
    const popH = 420; // estimated height

    const style: React.CSSProperties = {};
    // Vertical placement
    if (rect.bottom + popH > vh && rect.top > popH) {
      style.bottom = '100%';
      style.top = 'auto';
      style.marginBottom = '4px';
    } else {
      style.top = '100%';
      style.bottom = 'auto';
      style.marginTop = '4px';
    }
    // Horizontal placement
    if (rect.left + popW > vw) {
      style.right = 0;
      style.left = 'auto';
    } else {
      style.left = 0;
      style.right = 'auto';
    }
    setPopStyle(style);
  }, [isEditing]);

  const allowedCPs = getAllowedCPs();
  const optionSubUnits = curriculum.units.find(u => u.id === item.unitId)?.subUnits || [];

  const isSameSubUnit = !item.subUnitIdB || item.subUnitId === item.subUnitIdB;
  const showInlineOr = item.hasInternalChoice && !renderAsOptionB && isSameSubUnit;

  const handleFormatChange = (field: 'itemFormat' | 'itemFormatB', val: ItemFormat) => {
    const marks = item.marksPerQuestion;
    const normalizedVal = (val as string).toUpperCase();

    const isSR1 = normalizedVal.includes('SR1') || normalizedVal.includes('MCI');
    const isSR2 = normalizedVal.includes('SR2') || normalizedVal.includes('MI');
    const isCRS1 = normalizedVal.includes('CRS1') || normalizedVal.includes('VSA');
    const isCRS2 = normalizedVal.includes('CRS2') || normalizedVal.includes('SA');

    if (marks === 1 || marks === 2) {
      if (!isSR1 && !isSR2 && !isCRS1) {
        Swal.fire({
          title: 'பொருந்தாது!',
          text: `${marks} மதிப்பெண் பிரிவுக்கு MCI (SR1), MI (SR2), VSA (CRS1) மட்டுமே பொருந்தும்.`,
          icon: 'error',
          confirmButtonColor: '#4f46e5',
          confirmButtonText: 'சரி',
          customClass: {
            title: 'swal-tau-urai-title',
            htmlContainer: 'swal-tau-paalai-content'
          }
        });
        return;
      }
    } else if (marks === 3) {
      if (isSR1 || isSR2) {
        Swal.fire({
          title: 'பொருந்தாது!',
          text: `3 மதிப்பெண் பிரிவுக்கு SR1, SR2 Item Format-கள் பொருந்தாது.`,
          icon: 'error',
          confirmButtonColor: '#4f46e5',
          confirmButtonText: 'சரி',
          customClass: {
            title: 'swal-tau-urai-title',
            htmlContainer: 'swal-tau-paalai-content'
          }
        });
        return;
      } else {
        Swal.fire({
          title: 'உறுதிப்படுத்தல்',
          text: 'இந்த Item Format இந்த பிரிவுக்கு பொருத்தமானதா என்பதை உறுதிசெய்து அமைக்கவும்.',
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#4f46e5',
          cancelButtonColor: '#64748b',
          confirmButtonText: 'ஆம், அமை',
          cancelButtonText: 'ரத்து செய்',
          customClass: {
            title: 'swal-tau-urai-title',
            htmlContainer: 'swal-tau-paalai-content'
          }
        }).then((result) => {
          if (result.isConfirmed) {
            onUpdate(item.id, field, val);
          }
        });
        return;
      }
    } else if (marks === 5 || marks === 6) {
      if (isSR1 || isSR2 || isCRS1 || isCRS2) {
        Swal.fire({
          title: 'பொருந்தாது!',
          text: `${marks} மதிப்பெண் பிரிவுக்கு இந்த Item Format பொருந்தாது. CRL இந்த பிரிவுக்கு பொருத்தமானது.`,
          icon: 'warning',
          confirmButtonColor: '#4f46e5',
          confirmButtonText: 'சரி',
          customClass: {
            title: 'swal-tau-urai-title',
            htmlContainer: 'swal-tau-paalai-content'
          }
        });
        return;
      }
    }

    onUpdate(item.id, field, val);
  };

  return (
    <div className="space-y-1" ref={cardRef}>
      {/* Main card */}
      <div
        id={renderAsOptionB ? `item-b-${item.id}` : `item-${item.id}`}
        draggable={!readOnly}
        onDragStart={e => onDragStart(e, item, renderAsOptionB)}
        onDragEnd={onDragEnd}
        onClick={() => { onToggleActive(); !readOnly && onEdit(); }}
        className={`pb-2 p-1.5 rounded-md text-xs border shadow-sm w-full relative transition-all overflow-hidden group/item ${markColor} ${!readOnly ? 'hover:shadow-md cursor-pointer active:scale-95' : 'cursor-default'} ${isActive ? 'ring-2 ring-fuchsia-400 animate-pulse' : ''} ${isDragging ? 'opacity-50' : ''}`}
      >
        <div className={`absolute bottom-0 left-0 w-full h-1.5 ${KL_BOTTOM_COLORS[activeLevel]} opacity-90`} />
        
        <div className="font-bold flex justify-between items-center px-0.5">
          {item.hasInternalChoice || renderAsOptionB ? (
            <span className="flex items-center gap-0.5 bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white px-1.5 py-0.5 rounded-full text-[9px] shadow-sm animate-pulse">
              <Sparkles size={8} /> OR
            </span>
          ) : (
            <span>{item.questionCount}Q</span>
          )}
          <span className="text-[10px] opacity-70">({item.totalMarks}M)</span>
        </div>
        <div className="flex justify-between items-center mt-1 gap-1">
          <span className="font-semibold text-[9px] opacity-80">{activeLevel.substring(0, 3).toUpperCase()}</span>
          <span className="text-[8px] opacity-70 font-semibold">{activeCP.split(' ')[0]}</span>
          <span className="text-[8px] opacity-80 font-bold">{activeFormat}</span>
        </div>
        {!readOnly && !renderAsOptionB && (
          <button
            onClick={e => { e.stopPropagation(); onRemove?.(item.id); }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 hover:bg-red-600 transition-opacity text-[9px] font-bold z-10 group-hover/item:opacity-100"
            title="Remove"
          >
            ×
          </button>
        )}
      </div>

      {/* OR (Option B) card */}
      {showInlineOr && (
        <div
          id={`item-b-${item.id}`}
          draggable={!readOnly}
          onDragStart={e => { e.stopPropagation(); onDragStart(e, item, true); }}
          onDragEnd={onDragEnd}
          className={`pb-2 p-1.5 rounded-md text-xs text-center border shadow-sm w-full relative transition-all border-dashed bg-fuchsia-50 border-fuchsia-400 overflow-hidden group/or ${!readOnly ? 'cursor-pointer hover:shadow-md active:scale-95' : 'cursor-default'}`}
          onClick={() => { onToggleActive(); !readOnly && onEdit(); }}
        >
          <div className={`absolute bottom-0 left-0 w-full h-1.5 ${KL_BOTTOM_COLORS[item.knowledgeLevelB || item.knowledgeLevel]} opacity-90`} />

          <div className="font-bold flex justify-between items-center px-0.5 text-fuchsia-800">
            <span className="flex items-center gap-0.5 bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white px-1.5 py-0.5 rounded-full text-[9px] shadow-sm animate-pulse">
              <Sparkles size={8} /> OR
            </span>
            <span className="text-[10px] opacity-70">({item.totalMarks}M)</span>
          </div>
          <div className="flex justify-between items-center mt-1 gap-1">
            <span className="font-semibold text-[9px] opacity-80 text-fuchsia-800">{(item.knowledgeLevelB || item.knowledgeLevel).substring(0, 3).toUpperCase()}</span>
            <span className="text-[8px] opacity-70 font-semibold text-fuchsia-800">{(item.cognitiveProcessB || item.cognitiveProcess).split(' ')[0]}</span>
            <span className="text-[8px] opacity-80 font-bold text-fuchsia-800">{item.itemFormatB || item.itemFormat}</span>
          </div>
          {!readOnly && (
            <button
              onClick={e => { e.stopPropagation(); onUpdate(item.id, 'hasInternalChoice', false); }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center opacity-0 hover:bg-purple-600 transition-opacity text-[9px] font-bold z-10 group-hover/or:opacity-100"
              title="Remove OR"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Edit popover */}
      {isEditing && !renderAsOptionB && createPortal(
        <div 
          className="fixed inset-0 z-[9990] overflow-y-auto bg-slate-900/60 backdrop-blur-sm no-print"
          onClick={onClose}
        >
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 sm:w-[540px] w-full max-w-full border border-slate-100 overflow-visible space-y-4 text-sm relative text-left animate-fade-in text-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Settings size={18} className="text-indigo-600" />
                  Edit Item ({item.marksPerQuestion}M)
                </span>
                <button 
                  onClick={onClose} 
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1 hover:bg-slate-50 rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible pr-1">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Question Count</label>
                  <input
                    type="number" min="0" max="10"
                    value={isNaN(item.questionCount) ? '' : item.questionCount}
                    onChange={e => onUpdate(item.id, 'questionCount', Number(e.target.value) || 0)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Knowledge Level (A)</label>
                  <RelativeSelect
                    value={item.knowledgeLevel}
                    onChange={val => onUpdate(item.id, 'knowledgeLevel', val as KnowledgeLevel)}
                    options={Object.values(KnowledgeLevel)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Cognitive Process (A)</label>
                  <RelativeSelect
                    value={item.cognitiveProcess}
                    onChange={val => onUpdate(item.id, 'cognitiveProcess', val as CognitiveProcess)}
                    options={allowedCPs}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Item Format</label>
                  <RelativeSelect
                    value={item.itemFormat}
                    onChange={val => handleFormatChange('itemFormat', val as ItemFormat)}
                    options={Object.values(ItemFormat)}
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 py-1">
                  <input type="checkbox" id={`or-${item.id}`}
                    checked={item.hasInternalChoice}
                    onChange={e => onUpdate(item.id, 'hasInternalChoice', e.target.checked)}
                    disabled={item.marksPerQuestion === 1}
                    className="rounded text-indigo-600 focus:ring-indigo-400 border-slate-300" />
                  <label htmlFor={`or-${item.id}`} className="text-xs text-slate-700 font-medium cursor-pointer">Internal Choice (OR)</label>
                </div>

                {item.hasInternalChoice && (
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-purple-100">
                    <div className="sm:col-span-2 text-[10px] font-bold text-purple-600 uppercase tracking-wider">Option B Settings</div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-semibold uppercase">Option B Sub-unit</label>
                      <RelativeSelect
                        value={item.subUnitIdB || item.subUnitId}
                        onChange={val => {
                          onUpdate(item.id, 'unitIdB', item.unitId);
                          onUpdate(item.id, 'subUnitIdB', val);
                        }}
                        options={optionSubUnits.map(v => ({ value: v.id, label: v.name }))}
                        themeColor="purple"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-semibold uppercase">Knowledge Level (B)</label>
                      <input
                        value={item.knowledgeLevel}
                        readOnly
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-semibold uppercase">Cognitive Process (B)</label>
                      <RelativeSelect
                        value={item.cognitiveProcessB || item.cognitiveProcess}
                        onChange={val => onUpdate(item.id, 'cognitiveProcessB', val as CognitiveProcess)}
                        options={allowedCPs}
                        themeColor="purple"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-semibold uppercase">Item Format (B)</label>
                      <RelativeSelect
                        value={item.itemFormatB || item.itemFormat}
                        onChange={val => handleFormatChange('itemFormatB', val as ItemFormat)}
                        options={Object.values(ItemFormat)}
                        themeColor="purple"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-end">
                <button 
                  onClick={onClose}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── Summary Bar ──────────────────────────────────────────────────────────────

interface SummaryBarProps {
  result: ValidationResult;
  totalMarks: number;
  readOnly?: boolean;
  hideButtons?: boolean;
  onRegenerate?: () => void;
  onConfirm?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}
const SummaryBar: React.FC<SummaryBarProps> = ({ result, totalMarks, readOnly, hideButtons, onRegenerate, onConfirm, onSave, isSaving }) => {
  const filled = result.grandTotal;
  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs bg-gray-50/50 p-2 rounded-xl border border-gray-100 shadow-sm">
      {([KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE, KnowledgeLevel.PROFOUND] as KnowledgeLevel[]).map(kl => {
        const { marks, target } = result.klSummary[kl] || { marks: 0, target: 0 };
        const c = KL_COLORS[kl];
        const ok = marks === target;
        return (
          <div key={kl} className={`px-3 py-1.5 rounded-full border font-bold ${ok && marks > 0 ? c.badge : 'bg-white text-gray-400 border-gray-200'}`}>
            {kl.toUpperCase()}: {marks}/{target}M
          </div>
        );
      })}

      {!readOnly && !hideButtons && (
        <div className="flex items-center gap-2 ml-2 border-l pl-4 border-gray-200">
          <button onClick={() => onRegenerate?.()} disabled={!onRegenerate}
            className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-100 flex items-center gap-1.5 transition-all text-[10px] shadow-sm">
            <RefreshCw size={12} /> Reset
          </button>
          <button onClick={() => onSave?.()} disabled={isSaving || !onSave}
            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-1.5 transition-all text-[10px] shadow-sm shadow-emerald-100 disabled:opacity-50">
            {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} {isSaving ? 'Saving' : 'Save'}
          </button>
          <button onClick={() => onConfirm?.()} disabled={!onConfirm}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-1.5 transition-all text-[10px] shadow-sm shadow-blue-100">
            <CheckCircle size={12} /> Confirm
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2 pr-2">
        <div className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Grand Total:</div>
        <div className={`font-black text-sm md:text-lg ${filled === totalMarks ? 'text-green-600' : 'text-red-600'}`}>
          {filled}/{totalMarks}M
        </div>
      </div>
    </div>
  );
};

// ─── Blueprint Summary Table ──────────────────────────────────────────────────

interface BlueprintSummaryTableProps {
  blueprint: Blueprint;
  validation: ValidationResult;
}

const BlueprintSummaryTable: React.FC<BlueprintSummaryTableProps> = ({ blueprint, validation }) => {
  const items = blueprint.items;
  const [open, setOpen] = useState(true);

  // Reorder and include all categories even if count is 0
  const klRows = Object.values(KnowledgeLevel).map(kl => ({
    label: kl,
    count: items.filter(i => i.knowledgeLevel === kl).reduce((acc, i) => acc + i.questionCount, 0),
    marks: validation.klSummary[kl]?.marks || 0,
  }));

  const formatRows = Object.values(ItemFormat).map(f => {
    // Match by exact value or if the item format is the short code (SR1, etc)
    const relevantItems = items.filter(i => 
      i.itemFormat === f || 
      i.itemFormat === (f as string).split(' ')[0] ||
      (f as string).includes(`(${i.itemFormat})`)
    );
    return {
      label: f,
      count: relevantItems.reduce((acc, i) => acc + i.questionCount, 0),
      marks: relevantItems.reduce((acc, i) => acc + i.totalMarks, 0),
    };
  });

  const cpRows = Object.values(CognitiveProcess).map(cp => {
    const code = cp.split(' ')[0]; // CP1, CP2...
    const relevantItems = items.filter(i => 
      i.cognitiveProcess === cp || 
      i.cognitiveProcess === code ||
      (i.cognitiveProcess as string)?.startsWith(code)
    );
    return {
      label: cp,
      count: relevantItems.reduce((acc, i) => acc + i.questionCount, 0),
      marks: relevantItems.reduce((acc, i) => acc + i.totalMarks, 0),
    };
  });

  // FIX: correct withOR/withoutOR counts
  const withORItems = items.filter(i => i.hasInternalChoice);
  const withoutORItems = items.filter(i => !i.hasInternalChoice);
  const withORCount = withORItems.reduce((a, i) => a + i.questionCount, 0);
  const withoutORCount = withoutORItems.reduce((a, i) => a + i.questionCount, 0);
  const withORMarks = withORItems.reduce((a, i) => a + i.totalMarks, 0);
  const withoutORMarks = withoutORItems.reduce((a, i) => a + i.totalMarks, 0);

  // FIX: correct totalItems (no double-count)
  const totalItems = items.reduce((acc, i) => acc + i.questionCount, 0);
  const totalM = validation.grandTotal;

  return (
    <div className="border border-blue-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 text-blue-800 font-bold text-sm hover:bg-blue-100 transition-colors">
        <span className="flex items-center gap-2"><Info size={14} /> Blueprint Summary</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-normal text-blue-500">Grand Total: {totalItems} Items | {totalM} Marks</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y divide-x divide-gray-200 border-t border-gray-200">
          <SummaryColumn title="Knowledge Level"
            rows={klRows} />
          <SummaryColumn title="Item Format"
            rows={formatRows} />
          <SummaryColumn title="Option / Choice"
            rows={[
              { label: 'With Choice', count: withORCount, marks: withORMarks },
              { label: 'Without Choice', count: withoutORCount, marks: withoutORMarks },
            ]} />
          <SummaryColumn title="Cognitive Process"
            rows={cpRows.map(r => ({ label: r.label, count: r.count, marks: r.marks }))} />
        </div>
      )}
    </div>
  );
};

interface SummaryColumnProps {
  title: string;
  rows: { label: string; count: number; marks: number }[];
}
const SummaryColumn: React.FC<SummaryColumnProps> = ({ title, rows }) => {
  const totalQns = rows.reduce((sum, r) => sum + r.count, 0);
  const totalMarks = rows.reduce((sum, r) => sum + r.marks, 0);

  return (
    <div className="p-3">
      <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-2">{title}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 text-[10px]">
            <th className="text-left font-normal pb-1"></th>
            <th className="text-center font-normal pb-1">Qns</th>
            <th className="text-center font-normal pb-1">Marks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isTamil = /[\u0B80-\u0BFF]/.test(r.label);
            return (
              <tr key={i} className="border-t border-gray-100">
                <td className={`py-1 text-gray-700 font-medium ${isTamil ? 'tamil-font' : 'text-[9px] leading-tight'}`}
                  lang={isTamil ? 'ta' : 'en'}>{r.label}</td>
                <td className="py-1 text-center text-gray-600">{r.count}</td>
                <td className="py-1 text-center font-bold text-gray-800">{r.marks}</td>
              </tr>
            );
          })}
          {/* Total Row */}
          <tr className="border-t-2 border-gray-200 bg-gray-50/50">
            <td className="py-1.5 text-gray-900 font-black uppercase text-[9px]">Total</td>
            <td className="py-1.5 text-center text-gray-900 font-black">{totalQns}</td>
            <td className="py-1.5 text-center text-blue-700 font-black">{totalMarks}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ─── BlueprintMatrix (main export) ────────────────────────────────────────────

interface BlueprintMatrixProps {
  blueprint: Blueprint;
  curriculum: Curriculum;
  paperType: PaperType;
  isAdmin?: boolean;
  onUpdateItem: (id: string, field: keyof BlueprintItem, value: unknown) => void;
  onMoveItem: (itemId: string, unitId: string, sectionId: string, subUnitId: string) => void;
  onRemoveItem?: (id: string) => void;
  onAddItem?: (unitId: string, subUnitId: string, sectionId: string) => void;
  onAutoFill?: () => void;
  readOnly?: boolean;
  onRegenerate?: () => void;
  hideActionButtons?: boolean;
  onConfirm?: () => void | Promise<void>;
  onSave?: () => void | Promise<void>;
  isSaving?: boolean;
}

export const BlueprintMatrix: React.FC<BlueprintMatrixProps> = ({
  blueprint,
  curriculum,
  paperType,
  isAdmin = false,
  onUpdateItem,
  onMoveItem,
  onRemoveItem,
  onAddItem,
  onAutoFill,
  readOnly = false,
  onRegenerate,
  onConfirm,
  onSave,
  isSaving = false,
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [activeOptionGroupId, setActiveOptionGroupId] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const sections = useMemo(
    () => [...(paperType?.sections || [])].sort((a, b) => a.marks - b.marks),
    [paperType],
  );

  const validation = useMemo(
    () => validateBlueprint(blueprint, paperType, curriculum),
    [blueprint, paperType, curriculum],
  );

  React.useEffect(() => {
    if (readOnly) return;
    blueprint.items.forEach(item => {
      const patch = sanitizeBlueprintItem(item);
      (Object.entries(patch) as [keyof BlueprintItem, BlueprintItem[keyof BlueprintItem]][]).forEach(([field, value]) => {
        onUpdateItem(item.id, field, value);
      });
    });
  }, [blueprint.items, onUpdateItem, readOnly]);

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, item: BlueprintItem, isOptionB: boolean = false) => {
    if (readOnly) return;
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.setData('isOptionB', isOptionB ? 'true' : 'false');
    e.dataTransfer.effectAllowed = 'move';
    setDraggingItemId(isOptionB ? `${item.id}:b` : item.id);
  }, [readOnly]);

  const handleDragEnd = useCallback(() => {
    setDraggingItemId(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [readOnly]);

  const handleDrop = useCallback((e: React.DragEvent, unitId: string, subUnitId: string, sectionId: string) => {
    if (readOnly) return;
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    const isOptionB = e.dataTransfer.getData('isOptionB') === 'true';
    setDropTarget(null);
    setDraggingItemId(null);
    if (!itemId) return;

    const item = blueprint.items.find(i => i.id === itemId);
    if (!item) return;

    // Validation for unit change in option questions (Admin only)
    const isInternalChoice = item.hasInternalChoice || isOptionB;
    if (isAdmin && isInternalChoice && item.unitId !== unitId) {
      Swal.fire({
        title: 'யூனிட் மாற்ற முடியாது!',
        text: 'கண்டிப்பாக ஆப்ஷன் வினாக்கள் (A & B) ஒரே யூனிட்டில் அமைக்கப்பட வேண்டும். சப்யூனிட்டுகள் மாறலாம், ஆனால் யூனிட் மாறக்கூடாது.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'சரி',
        customClass: {
          title: 'swal-tau-urai-title',
          htmlContainer: 'swal-tau-paalai-content'
        }
      });
      return;
    }
    
    if (isOptionB) {
      onUpdateItem(itemId, 'unitIdB', unitId);
      onUpdateItem(itemId, 'subUnitIdB', subUnitId);
    } else {
      onMoveItem(itemId, unitId, sectionId, subUnitId);
    }
  }, [readOnly, onMoveItem, onUpdateItem, blueprint.items, isAdmin]);

  // ── Cell helpers ─────────────────────────────────────────────────────────────
  const getCellItems = useCallback((unitId: string, subUnitId: string, sectionId: string): BlueprintItem[] =>
    blueprint.items.filter(i => i.unitId === unitId && i.subUnitId === subUnitId && i.sectionId === sectionId),
    [blueprint.items]);

  const getOptionBItems = useCallback((unitId: string, subUnitId: string, sectionId: string): BlueprintItem[] =>
    blueprint.items.filter(i =>
      i.hasInternalChoice &&
      i.unitIdB === unitId &&
      i.subUnitIdB === subUnitId &&
      i.sectionId === sectionId &&
      !(i.unitId === unitId && i.subUnitId === subUnitId)
    ),
    [blueprint.items]);

  const getSubUnitTotal = useCallback((unitId: string, subUnitId: string): number =>
    blueprint.items.filter(i => i.unitId === unitId && i.subUnitId === subUnitId)
      .reduce((acc, i) => acc + i.totalMarks, 0),
    [blueprint.items]);

  const getUnitTotal = useCallback((unitId: string): number =>
    blueprint.items.filter(i => i.unitId === unitId)
      .reduce((acc, i) => acc + i.totalMarks, 0),
    [blueprint.items]);

  const getUnitPercent = useCallback((unitId: string): number => {
    const t = getUnitTotal(unitId);
    return blueprint.totalMarks > 0 ? Math.round((t / blueprint.totalMarks) * 100) : 0;
  }, [getUnitTotal, blueprint.totalMarks]);

  const getSubUnitPercent = useCallback((unitId: string, subUnitId: string): number => {
    const t = getSubUnitTotal(unitId, subUnitId);
    return blueprint.totalMarks > 0 ? Math.round((t / blueprint.totalMarks) * 100) : 0;
  }, [getSubUnitTotal, blueprint.totalMarks]);

  const [highlightedSubUnitId, setHighlightedSubUnitId] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);

  const handleHighlightSubUnit = useCallback((subUnitId: string) => {
    setHighlightedSubUnitId(subUnitId);
  }, []);

  useEffect(() => {
    if (!highlightedSubUnitId) return;
    if (highlightTimer.current) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => {
      setHighlightedSubUnitId(null);
      highlightTimer.current = null;
    }, 4000);
    return () => {
      if (highlightTimer.current) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, [highlightedSubUnitId]);

  return (
    <div className="flex flex-col space-y-4 text-black">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold uppercase border-b-2 border-black inline-block px-6 pb-1 tracking-widest">
          Blue Print
        </h2>
        <div className="flex justify-center flex-wrap gap-6 mt-3 text-sm font-bold text-gray-700">
          <span>Class: {blueprint.classLevel}</span>
          <span>Subject: {blueprint.subject}</span>
          {blueprint.examTerm && <span>Term: {blueprint.examTerm}</span>}
          <span>Set: {blueprint.setId || 'A'}</span>
          <span>Max Marks: {blueprint.totalMarks}</span>
        </div>
      </div>

      {/* Summary Bar */}
      <SummaryBar
        result={validation}
        totalMarks={blueprint.totalMarks}
        readOnly={readOnly}
        onRegenerate={onRegenerate}
        hideButtons={blueprint.isConfirmed}
        onConfirm={onConfirm}
        onSave={onSave}
        isSaving={isSaving}
      />

      {/* Matrix + Validation side-by-side */}
      <div className="flex flex-col xl:flex-row gap-4 items-start w-full">
        {/* Left side: Table + Summary */}
        <div className="w-full xl:flex-1 flex flex-col gap-4">
          {/* Matrix table container */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-sm custom-scrollbar" id="matrix-scroll-container">
            <table className="w-full text-[10px] border-collapse border border-gray-300 table-fixed">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="border border-slate-700 p-1 w-[2%] text-center">#</th>
                  <th className="border border-slate-700 p-1 text-left w-[4%] text-[9px]">UNIT</th>
                  <th className="border border-slate-700 p-1 text-left w-[20%]">SUB UNIT</th>
                  <th className="border border-slate-700 p-1 text-center bg-amber-500 text-black font-black w-[4%]">M</th>
                  {sections.map(s => {
                    const sectionWidth = Math.floor(70 / sections.length);
                    return (
                      <th key={s.id} style={{ width: `${sectionWidth}%` }} className="border border-slate-700 p-1 text-center">
                        <div className="font-black text-[10px] leading-tight">{s.marks}M</div>
                        <div className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">({s.count} Q)</div>
                        {s.optionCount > 0 && (
                          <div className="text-[7px] text-purple-400 font-bold tracking-tighter">OR:{s.optionCount}</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {curriculum.units.map(unit => {
                  const unitPct = getUnitPercent(unit.id);
                  const unitTotal = getUnitTotal(unit.id);
                  return (
                    <React.Fragment key={unit.id}>
                      {unit.subUnits.map((subUnit, sIdx) => {
                        const subTotal = getSubUnitTotal(unit.id, subUnit.id);
                        const subPct = getSubUnitPercent(unit.id, subUnit.id);
                        return (
                          <tr key={subUnit.id} className={`group/row transition-colors ${highlightedSubUnitId === subUnit.id ? 'bg-red-100 ring-1 ring-red-300' : 'hover:bg-slate-50'}`}>
                            {sIdx === 0 && (
                              <td rowSpan={unit.subUnits.length}
                                className="border border-gray-200 p-1 text-center font-black text-slate-400 bg-white align-middle text-[10px]">
                                {unit.unitNumber}
                              </td>
                            )}
                            {sIdx === 0 && (
                              <td rowSpan={unit.subUnits.length}
                                className="border border-gray-200 p-0.5 text-center bg-white align-middle">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <div className="font-black text-indigo-800 [writing-mode:vertical-rl] rotate-180 py-1 whitespace-nowrap text-[7px] uppercase tracking-wider">
                                    {unit.name}
                                  </div>
                                  <div className="text-[7px] text-indigo-500 font-black">{unitPct}%</div>
                                </div>
                              </td>
                            )}

                            {/* Sub-unit name + per-lesson progress */}
                            <td className="border border-gray-200 p-1 align-top bg-white/50">
                              <div className="flex flex-col gap-0.5">
                                <div className="text-slate-600 font-medium text-[10px] leading-tight tamil-font break-words">{subUnit.name}</div>
                                {subTotal > 0 && (
                                  <div className="flex items-center gap-1">
                                    <div className="flex-1 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-indigo-500 rounded-full"
                                        style={{ width: `${Math.min(subPct, 100)}%` }} />
                                    </div>
                                    <span className="text-[7px] font-black text-indigo-500">{subPct}%</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Sub-unit marks total */}
                            <td className="border border-gray-200 p-1 text-center font-black bg-amber-50/30 text-slate-700 text-[10px]">
                              {subTotal || '-'}
                            </td>

                            {/* Section cells */}
                            {sections.map(section => {
                              const cellItems = getCellItems(unit.id, subUnit.id, section.id);
                              const optionBItems = getOptionBItems(unit.id, subUnit.id, section.id);
                              const cellKey = `${unit.id}:${subUnit.id}:${section.id}`;
                              return (
                                <td key={section.id}
                                  className={`border border-gray-200 p-0.5 align-top min-h-[2rem] relative group/cell transition-colors ${dropTarget === cellKey ? 'bg-blue-50 ring-2 ring-blue-300' : ''}`}
                                  onDragOver={e => {
                                    handleDragOver(e);
                                    setDropTarget(cellKey);
                                  }}
                                  onDragLeave={() => setDropTarget(current => current === cellKey ? null : current)}
                                  onDrop={e => handleDrop(e, unit.id, subUnit.id, section.id)}>
                                  <div className="space-y-0.5 relative" style={{ overflow: 'visible' }}>
                                    {cellItems.map(item => (
                                      <div key={item.id} className="relative">
                                        <ItemCard
                                          item={item}
                                          curriculum={curriculum}
                                          readOnly={readOnly}
                                          isEditing={editingItemId === item.id}
                                          isActive={activeOptionGroupId === item.id}
                                          isDragging={draggingItemId === item.id}
                                          onEdit={() => setEditingItemId(item.id)}
                                          onClose={() => setEditingItemId(null)}
                                          onToggleActive={() => setActiveOptionGroupId(prev => prev === item.id ? null : item.id)}
                                          onUpdate={onUpdateItem}
                                          onRemove={onRemoveItem}
                                          onDragStart={handleDragStart}
                                          onDragEnd={handleDragEnd}
                                        />
                                      </div>
                                    ))}
                                    {optionBItems.map(item => (
                                      <div key={`${item.id}-option-b`} className="relative">
                                        <ItemCard
                                          item={item}
                                          curriculum={curriculum}
                                          readOnly={readOnly}
                                          isEditing={false}
                                          isActive={activeOptionGroupId === item.id}
                                          isDragging={draggingItemId === item.id}
                                          renderAsOptionB
                                          onEdit={() => setEditingItemId(item.id)}
                                          onClose={() => setEditingItemId(null)}
                                          onToggleActive={() => setActiveOptionGroupId(prev => prev === item.id ? null : item.id)}
                                          onUpdate={onUpdateItem}
                                          onRemove={onRemoveItem}
                                          onDragStart={handleDragStart}
                                          onDragEnd={handleDragEnd}
                                        />
                                      </div>
                                    ))}
                                    {!readOnly && (
                                      <button
                                        onClick={() => onAddItem?.(unit.id, subUnit.id, section.id)}
                                        className="w-full text-[10px] text-slate-200 hover:text-indigo-500 hover:bg-indigo-50 border border-dashed border-slate-100 hover:border-indigo-200 rounded py-0 transition-all opacity-0 group/row:opacity-100 group/cell:opacity-100"
                                        title="Add question">
                                        +
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                      {/* Unit total row */}
                      <tr className="bg-indigo-50/50 text-indigo-900 font-black text-center text-[9px]">
                        <td colSpan={3} className="border border-indigo-100 p-0.5 text-right uppercase tracking-widest pr-2 italic opacity-60">
                          Unit {unit.unitNumber} Total:
                        </td>
                        <td className="border border-indigo-100 p-0.5 bg-amber-400 text-black font-black">
                          {unitTotal}
                        </td>
                        {sections.map(s => {
                          const count = blueprint.items
                            .filter(i => i.unitId === unit.id && i.sectionId === s.id)
                            .reduce((acc, i) => acc + i.questionCount, 0);
                          return (
                            <td key={s.id} className="border border-indigo-100 p-0.5 text-indigo-400">
                              {count || ''}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Grand Total row */}
                <tr className="bg-slate-900 text-white font-black text-center text-[10px]">
                  <td colSpan={3} className="border border-slate-700 p-2 text-right uppercase tracking-widest pr-4">
                    Aggregates
                  </td>
                  <td className={`border border-slate-700 p-2 ${validation.grandTotal === blueprint.totalMarks ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                    {validation.grandTotal}
                  </td>
                  {sections.map(s => {
                    const total = blueprint.items.filter(i => i.sectionId === s.id).reduce((acc, i) => acc + i.questionCount, 0);
                    const totalM = blueprint.items.filter(i => i.sectionId === s.id).reduce((acc, i) => acc + i.totalMarks, 0);
                    return (
                      <td key={s.id} className="border border-slate-700 p-1 align-middle">
                        <div className="text-[11px]">{total}</div>
                        <div className="text-[8px] opacity-60 font-normal tracking-tighter">{totalM}M</div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Blueprint Summary Table directly under the table container */}
          <div className="mt-0">
            <BlueprintSummaryTable blueprint={blueprint} validation={validation} />
          </div>
          <AnalyticsPanel result={validation} />
        </div>

        {/* Validation panel - stays on the right on large screens */}
        <div className="w-full xl:w-64 shrink-0">
          <ValidationPanel
            result={validation}
            paperType={paperType}
            onAutoFill={onAutoFill}
            onHighlightSubUnit={handleHighlightSubUnit}
          />
        </div>
      </div>
    </div>
  );
};

export default BlueprintMatrix;
