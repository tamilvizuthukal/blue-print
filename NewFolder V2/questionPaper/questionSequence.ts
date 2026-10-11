/**
 * questionPaper/questionSequence.ts
 * ---------------------------------------------------------------------------
 * THE canonical question numbering authority.
 *
 * Everything downstream (Mass View, the A4 editor, the PDF exporter, the
 * section range labels) reads its numbers from `buildQuestionSequence()`.
 * There is no second numbering algorithm in this project any more.
 *
 * Guarantees:
 *  1. Section order always follows `paperType.sections` array order.
 *     Sections are never re-sorted by marks.
 *  2. Display numbering is global and continuous (1, 2, 3, ... ) even when the
 *     stored `qNo` is duplicated, missing or non-numeric.
 *  3. An item that represents several questions consumes `questionCount`
 *     numbers; internal choice always consumes exactly ONE.
 *  4. Stored `qNo` is an ordering hint only, and only when it parses cleanly.
 *  5. Nothing is dropped silently: unmatched items are surfaced in a trailing
 *     "additional questions" section plus a warning.
 */

import type { Blueprint, BlueprintItem, QuestionPaperType } from '../types';
import { toRoman } from './htmlUtils';

export type SequenceWarningType =
  | 'DUPLICATE_QNO'
  | 'MISSING_QNO'
  | 'INVALID_QNO'
  | 'UNMATCHED_SECTION_ITEM'
  | 'PAPER_TYPE_MISSING'
  | 'EMPTY_SECTION'
  | 'SECTION_COUNT_MISMATCH'
  | 'QUESTION_COUNT_INVALID'
  | 'MISSING_QUESTION_TEXT'
  | 'MISSING_CHOICE_TEXT_B';

export interface SequenceWarning {
  type: SequenceWarningType;
  message: string;
  itemIds?: string[];
  sectionId?: string;
  details?: Record<string, string | number | boolean>;
}

export interface SequenceItem {
  itemId: string;
  item: BlueprintItem;
  /** First displayed question number (1-based, continuous). */
  displayNumber: number;
  /** Last displayed question number (equal to displayNumber when count === 1). */
  endNumber: number;
  sectionId: string;
  sectionIndex: number;
  questionCount: number;
  hasInternalChoice: boolean;
  storedQNo: string | null;
  storedQNoValue: number | null;
  /** Position inside the final paper (0-based). */
  orderIndex: number;
}

export interface SequenceSection {
  id: string;
  /** 0-based position in the rendered paper. */
  index: number;
  roman: string;
  marks: number;
  declaredCount: number;
  optionCount: number;
  instruction: string;
  items: SequenceItem[];
  rangeStart: number;
  rangeEnd: number;
  rangeLabel: string;
  declaredMarksTotal: number;
  actualMarksTotal: number;
  isUnmatched: boolean;
}

export interface QuestionSequence {
  sections: SequenceSection[];
  items: SequenceItem[];
  warnings: SequenceWarning[];
  totalQuestions: number;
  totalNumberedItems: number;
  sectionRanges: Record<string, { start: number; end: number; label: string }>;
}

export const UNMATCHED_SECTION_ID = 'qp-unmatched';

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const cleaned = text.replace(/^q#\s*/i, '').split(/[-\u2013]/)[0].trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeQuestionCount = (item: BlueprintItem): number => {
  const raw = Number(item?.questionCount);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.max(1, Math.round(raw));
};

/**
 * Within one section the ordering is deterministic:
 *  - items with a parsable stored `qNo` come first, in ascending numeric order
 *  - items without one keep their original array order, after the numbered ones
 * Ties are always broken by the original array position.
 */
const orderItemsWithinSection = (items: BlueprintItem[]): BlueprintItem[] => {
  return items
    .map((item, index) => ({ item, index, qNo: asNumber(item.qNo) }))
    .sort((a, b) => {
      if (a.qNo === null && b.qNo === null) return a.index - b.index;
      if (a.qNo === null) return 1;
      if (b.qNo === null) return -1;
      if (a.qNo !== b.qNo) return a.qNo - b.qNo;
      return a.index - b.index;
    })
    .map(entry => entry.item);
};

const buildRangeLabel = (start: number, end: number): string => {
  if (start === end) return `${start} ஆவது வினாவிற்கு`;
  return `${start} முதல் ${end} வரையுள்ள`;
};

export function buildQuestionSequence(
  blueprint: Partial<Blueprint> | null | undefined,
  paperType?: QuestionPaperType | null
): QuestionSequence {
  const warnings: SequenceWarning[] = [];
  const items: BlueprintItem[] = Array.isArray(blueprint?.items) ? (blueprint!.items as BlueprintItem[]) : [];
  const declaredSections = Array.isArray(paperType?.sections) ? (paperType!.sections as QuestionPaperType['sections']) : [];

  if (!paperType || declaredSections.length === 0) {
    warnings.push({
      type: 'PAPER_TYPE_MISSING',
      message: 'Paper type sections are unavailable; questions are numbered in blueprint order without section headers.',
    });
  }

  const orderedBlueprintItems = items;
  const bySection = new Map<string, BlueprintItem[]>();
  const unmatched: BlueprintItem[] = [];

  const knownSectionIds = new Set(declaredSections.map(section => section.id));
  orderedBlueprintItems.forEach(item => {
    const sectionId = item?.sectionId;
    if (sectionId && knownSectionIds.has(sectionId)) {
      const bucket = bySection.get(sectionId) || [];
      bucket.push(item);
      bySection.set(sectionId, bucket);
      return;
    }
    unmatched.push(item);
  });

  if (unmatched.length > 0) {
    warnings.push({
      type: 'UNMATCHED_SECTION_ITEM',
      message: `${unmatched.length} question(s) do not belong to any paper type section and were appended to the end of the paper.`,
      itemIds: unmatched.map(item => item.id),
      details: { count: unmatched.length },
    });
  }

  interface SectionPlan {
    id: string;
    marks: number;
    declaredCount: number;
    optionCount: number;
    instruction: string;
    items: BlueprintItem[];
    isUnmatched: boolean;
  }

  const plans: SectionPlan[] = declaredSections.map(section => ({
    id: section.id,
    marks: Number(section.marks) || 0,
    declaredCount: Number(section.count) || 0,
    optionCount: Number(section.optionCount) || 0,
    instruction: (section.instruction || '').trim(),
    items: bySection.get(section.id) || [],
    isUnmatched: false,
  }));

  if (unmatched.length > 0) {
    plans.push({
      id: UNMATCHED_SECTION_ID,
      marks: 0,
      declaredCount: 0,
      optionCount: 0,
      instruction: 'மேலும் வினாக்கள்',
      items: unmatched,
      isUnmatched: true,
    });
  }

  // ---------------------------------------------------------------- numbering
  const seenQNo = new Map<number, string[]>();
  const sequenceItems: SequenceItem[] = [];
  const sections: SequenceSection[] = [];
  let nextNumber = 1;
  let orderIndex = 0;

  plans.forEach((plan, planIndex) => {
    const orderedItems = orderItemsWithinSection(plan.items);

    if (orderedItems.length === 0 && !plan.isUnmatched) {
      warnings.push({
        type: 'EMPTY_SECTION',
        message: `Section ${planIndex + 1} has no questions and was skipped.`,
        sectionId: plan.id,
      });
      return;
    }

    const sectionItems: SequenceItem[] = [];

    orderedItems.forEach(item => {
      const questionCount = normalizeQuestionCount(item);
      if (!Number.isFinite(Number(item.questionCount)) || Number(item.questionCount) < 1) {
        warnings.push({
          type: 'QUESTION_COUNT_INVALID',
          message: `Question "${item.id}" has an invalid questionCount and was treated as a single question.`,
          itemIds: [item.id],
          details: { questionCount: String(item.questionCount ?? '') },
        });
      }

      const storedQNo = typeof item.qNo === 'string' && item.qNo.trim() ? item.qNo.trim() : null;
      const storedQNoValue = asNumber(item.qNo);

      if (storedQNo && storedQNoValue === null) {
        warnings.push({
          type: 'INVALID_QNO',
          message: `Stored qNo "${storedQNo}" is not numeric; it was ignored for ordering.`,
          itemIds: [item.id],
        });
      } else if (!storedQNo) {
        warnings.push({
          type: 'MISSING_QNO',
          message: `Question "${item.id}" has no stored qNo; display numbering was assigned automatically.`,
          itemIds: [item.id],
        });
      } else if (storedQNoValue !== null) {
        const bucket = seenQNo.get(storedQNoValue) || [];
        bucket.push(item.id);
        seenQNo.set(storedQNoValue, bucket);
      }

      if (!item.questionText || !String(item.questionText).trim()) {
        warnings.push({
          type: 'MISSING_QUESTION_TEXT',
          message: `Question "${item.id}" (display ${nextNumber}) has no question text.`,
          itemIds: [item.id],
        });
      }
      if (item.hasInternalChoice && (!item.questionTextB || !String(item.questionTextB).trim())) {
        warnings.push({
          type: 'MISSING_CHOICE_TEXT_B',
          message: `Internal choice question "${item.id}" (display ${nextNumber}) has no option B text.`,
          itemIds: [item.id],
        });
      }

      const displayNumber = nextNumber;
      nextNumber += questionCount;

      const sequenceItem: SequenceItem = {
        itemId: item.id,
        item,
        displayNumber,
        endNumber: displayNumber + questionCount - 1,
        sectionId: plan.id,
        sectionIndex: planIndex,
        questionCount,
        hasInternalChoice: Boolean(item.hasInternalChoice),
        storedQNo,
        storedQNoValue,
        orderIndex: orderIndex++,
      };
      sectionItems.push(sequenceItem);
      sequenceItems.push(sequenceItem);
    });

    const declaredQuestions = sectionItems.reduce((sum, entry) => sum + entry.questionCount, 0);
    if (!plan.isUnmatched && plan.declaredCount > 0 && declaredQuestions !== plan.declaredCount) {
      warnings.push({
        type: 'SECTION_COUNT_MISMATCH',
        message: `Section ${planIndex + 1} expects ${plan.declaredCount} question(s) but the blueprint contains ${declaredQuestions}.`,
        sectionId: plan.id,
        details: { declared: plan.declaredCount, actual: declaredQuestions },
      });
    }

    const rangeStart = sectionItems.length > 0 ? sectionItems[0].displayNumber : 0;
    const rangeEnd = sectionItems.length > 0 ? sectionItems[sectionItems.length - 1].endNumber : 0;

    sections.push({
      id: plan.id,
      index: planIndex,
      roman: toRoman(planIndex + 1),
      marks: plan.marks,
      declaredCount: plan.declaredCount,
      optionCount: plan.optionCount,
      instruction: plan.instruction,
      items: sectionItems,
      rangeStart,
      rangeEnd,
      rangeLabel: sectionItems.length > 0 ? buildRangeLabel(rangeStart, rangeEnd) : '',
      declaredMarksTotal: plan.declaredCount * plan.marks,
      actualMarksTotal: sectionItems.reduce((sum, entry) => sum + (Number(entry.item.totalMarks) || 0), 0),
      isUnmatched: plan.isUnmatched,
    });
  });

  seenQNo.forEach((ids, qNo) => {
    if (ids.length > 1) {
      warnings.push({
        type: 'DUPLICATE_QNO',
        message: `Stored qNo ${qNo} is used by ${ids.length} questions; the printed numbering is still continuous.`,
        itemIds: ids,
        details: { qNo, count: ids.length },
      });
    }
  });

  const sectionRanges: Record<string, { start: number; end: number; label: string }> = {};
  sections.forEach(section => {
    sectionRanges[section.id] = { start: section.rangeStart, end: section.rangeEnd, label: section.rangeLabel };
  });

  return {
    sections,
    items: sequenceItems,
    warnings,
    totalQuestions: sequenceItems.reduce((sum, entry) => sum + entry.questionCount, 0),
    totalNumberedItems: sequenceItems.length,
    sectionRanges,
  };
}
