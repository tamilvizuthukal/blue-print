/**
 * questionPaper/questionBlocks.ts
 * ---------------------------------------------------------------------------
 * Turns a `QuestionSequence` into an ordered list of *semantic blocks*.
 *
 * A block is the atomic unit of pagination: the planner measures blocks, never
 * raw HTML, and a question that must be split carries several `fragments` so the
 * planner can move whole fragments to the next page instead of slicing text at
 * an arbitrary character.
 */

import type { Blueprint, QuestionPaperType } from '../types';
import {
  buildHeaderMeta,
  buildIdentity,
  buildQuestionFragments,
  renderDecorationBlock,
  renderHeaderBlock,
  renderNotesBlock,
  renderQuestionBlock,
  renderSectionBlock,
} from './questionRenderer';
import type { QuestionFragment, QuestionRenderOptions } from './questionRenderer';
import { getQuestionOverride, resolvePageGeometry } from './layoutTypes';
import type { QuestionPaperLayout } from './layoutTypes';
import type { QuestionSequence, SequenceItem } from './questionSequence';

export type BlockKind = 'header' | 'notes' | 'section' | 'question' | 'decoration';

export interface PaperBlock {
  id: string;
  kind: BlockKind;
  sectionId: string;
  itemId?: string;
  displayNumber?: number;
  /** Last displayed number of a multi-question item (equal to displayNumber for 1). */
  endNumber?: number;
  /** Number of displayed questions this block occupies (page rules use this). */
  questionSpans: number;
  breakBefore: boolean;
  keepTogether: boolean;
  allowSplit: boolean;
  /** mm */
  spacingBefore: number;
  /** mm */
  spacingAfter: number;
  /** Unitless question-specific line-height multiplier. */
  lineHeight?: number;
  preferredPage?: number;
  fragments: QuestionFragment[];
  html: string;
  text: string;
  splittable: boolean;
  continuationOf?: string;
  /** Present on question blocks; lets the planner build a continuation block. */
  sourceItem?: SequenceItem;
}

export interface BlockMeasurer {
  /** Height of one fragment in mm at the given content width. */
  measureFragment(fragment: QuestionFragment, context: { contentWidthMm: number; block: PaperBlock }): number;
  /** Width of a single-line text in mm (used to pick the MCQ option layout). */
  measureTextMm(text: string, fontSizePt: number): number;
}

export interface PaperBlockInput {
  blueprint: Partial<Blueprint>;
  paperType?: QuestionPaperType | null;
  layout: QuestionPaperLayout;
  sequence: QuestionSequence;
  notes?: string[];
  measurer?: BlockMeasurer;
}

const LONG_OPTION_CHARS = 58;

export function buildPaperBlocks(input: PaperBlockInput): PaperBlock[] {
  const { blueprint, layout, sequence, notes, measurer } = input;
  const geometry = resolvePageGeometry(layout);
  const identity = buildIdentity(blueprint);
  const headerMeta = buildHeaderMeta(blueprint, identity.paperCode);
  const blocks: PaperBlock[] = [];

  const renderOptions: QuestionRenderOptions = {
    bodyWidthMm: geometry.contentWidthMm,
    stackOptions: false,
  };

  if (layout.showHeader) {
    blocks.push({
      id: 'block-header',
      kind: 'header',
      sectionId: '',
      questionSpans: 0,
      breakBefore: true,
      keepTogether: true,
      allowSplit: false,
      spacingBefore: 0,
      spacingAfter: 6,
      fragments: [],
      html: renderHeaderBlock(headerMeta),
      text: `${identity.setLabel} ${identity.paperCode}`,
      splittable: false,
    });
  }

  if (layout.showNotes) {
    blocks.push({
      id: 'block-notes',
      kind: 'notes',
      sectionId: '',
      questionSpans: 0,
      breakBefore: false,
      keepTogether: true,
      allowSplit: false,
      spacingBefore: 0,
      spacingAfter: 6,
      fragments: [],
      html: renderNotesBlock(notes),
      text: 'குறிப்புகள்',
      splittable: false,
    });
  }

  sequence.sections.forEach(section => {
    if (section.items.length === 0) return;

    blocks.push({
      id: `block-section-${section.id}`,
      kind: 'section',
      sectionId: section.id,
      questionSpans: 0,
      breakBefore: false,
      keepTogether: true,
      allowSplit: false,
      spacingBefore: layout.sectionSpacing,
      spacingAfter: 2,
      fragments: [],
      html: renderSectionBlock(section),
      text: `${section.roman} ${section.rangeLabel} ${section.instruction}`,
      splittable: false,
    });

    section.items.forEach(item => {
      const override = getQuestionOverride(layout, item.itemId) || {};
      const fragments = buildQuestionFragments(item, {
        ...renderOptions,
        stackOptions: decideStackedOptions(item, renderOptions, layout, measurer),
      });

      blocks.push({
        id: `block-question-${item.itemId}`,
        kind: 'question',
        sectionId: section.id,
        itemId: item.itemId,
        displayNumber: item.displayNumber,
        endNumber: item.endNumber,
        questionSpans: item.questionCount,
        breakBefore: Boolean(override.breakBefore),
        keepTogether: override.keepTogether !== false && !override.allowSplit,
        allowSplit: override.allowSplit ?? layout.smart.allowLongQuestionSplit,
        spacingBefore: override.spacingBefore ?? 0,
        spacingAfter: override.spacingAfter ?? layout.questionSpacing,
        lineHeight: override.lineHeight ?? layout.typography.bodyLineHeight,
        preferredPage: override.preferredPage,
        fragments,
        html: renderQuestionBlock(item, fragments, false, override.lineHeight ?? layout.typography.bodyLineHeight),
        text: fragments.map(fragment => fragment.text).join(' '),
        splittable: override.allowSplit ?? layout.smart.allowLongQuestionSplit,
        sourceItem: item,
      });
    });
  });

  blocks.push({
    id: 'block-decoration',
    kind: 'decoration',
    sectionId: '',
    questionSpans: 0,
    breakBefore: false,
    keepTogether: true,
    allowSplit: false,
    spacingBefore: 6,
    spacingAfter: 0,
    fragments: [],
    html: renderDecorationBlock(),
    text: '',
    splittable: false,
  });

  return blocks;
}

function decideStackedOptions(
  item: SequenceItem,
  options: QuestionRenderOptions,
  layout: QuestionPaperLayout,
  measurer?: BlockMeasurer
): boolean {
  const bodyWidth = options.bodyWidthMm;
  if (!measurer) {
    const probe = buildQuestionFragments(item, { ...options, stackOptions: false });
    const optionText = probe.find(fragment => fragment.key === 'mcq')?.text || '';
    return optionText.length > LONG_OPTION_CHARS;
  }
  const probe = buildQuestionFragments(item, { ...options, stackOptions: false });
  const optionFragment = probe.find(fragment => fragment.key === 'mcq');
  if (!optionFragment) return false;
  const fontSizePt = layout.typography.bodyFontSize;
  const longest = optionFragment.text
    .split(/\s{2,}|\s\/\s|\|/)
    .reduce((max, chunk) => Math.max(max, measurer.measureTextMm(chunk, fontSizePt)), 0);
  return longest > bodyWidth / 2 - 6;
}
