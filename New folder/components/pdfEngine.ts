/**
 * components/pdfEngine.ts  (compatibility layer)
 * ---------------------------------------------------------------------------
 * The question paper is rendered by `questionPaper/`. This file keeps the
 * historical exports so existing screens keep compiling, but every one of them
 * is now a thin adapter - there is no second numbering or rendering path.
 *
 * Root causes removed here (see the audit):
 *  - `buildFullQuestionPaperHTML` used `computeQuestionNumbersMap`, which
 *    re-sorted sections by marks and never advanced its counter for items that
 *    already had a `qNo` (duplicate numbers such as 1, 1, 1).
 *  - `applyMixedFonts` / `formatQuestionFonts` rewrote HTML with regexes and
 *    produced nested `<span style="font-family:'Times New Roman'">` wrappers.
 *  - The MCQ parser required a DOM, so the server could not reproduce it.
 *  - Everything was inline-styled, so the preview and the exported PDF could
 *    never be guaranteed to match.
 */
import { Blueprint, QuestionPaperType, BlueprintItem } from '../types';
import { buildQuestionPaperDocument } from '../questionPaper/questionPaperDocument';
import {
  applyMixedFonts,
  buildHeaderMeta,
  parseMcqFromHtml,
  renderHeaderBlock,
  renderNotesBlock,
} from '../questionPaper/questionRenderer';
import { buildQuestionSequence } from '../questionPaper/questionSequence';
import { migrateBlueprintLayout } from '../questionPaper/layoutTypes';
import type { PaperBlock } from '../questionPaper/questionBlocks';
import { formatMark, toRoman } from '../questionPaper/htmlUtils';

export { applyMixedFonts, formatMark, toRoman };

export function getCurrentAcademicYear() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  if (month >= 5) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

export const measureTextWidth = (text: string, fontFamily: string, fontSize: string): number => {
  if (typeof document === 'undefined') return 0;
  const span = document.createElement('span');
  span.style.fontFamily = fontFamily || 'TAU-Paalai, serif';
  span.style.fontSize = fontSize || '14pt';
  span.style.visibility = 'hidden';
  span.style.position = 'absolute';
  span.style.whiteSpace = 'nowrap';
  span.innerText = text;
  document.body.appendChild(span);
  const width = span.getBoundingClientRect().width;
  document.body.removeChild(span);
  return width;
};

/** DOM-free MCQ extraction (delegates to the canonical parser). */
export const parseMCQFromDOM = (html: string, _markers?: string[]) => parseMcqFromHtml(html);

export const renderMCQ = (questionHtml: string, itemFormat?: string): string => {
  void itemFormat;
  return applyMixedFonts(questionHtml || '');
};

export const processQuestionText = (text: string, format?: string) => renderMCQ(text, format);

export const formatQuestionFonts = (html: string) => applyMixedFonts(html);

export const generateCoverHeader = (bp: Blueprint, paperCode?: string) =>
  renderHeaderBlock(buildHeaderMeta(bp, paperCode || ''));

export const generateNotesBox = () => renderNotesBlock();

/** Legacy signature: explicit marks strings instead of a paper type section. */
export const generateSectionHeader = (
  roman: string,
  titlePart: string,
  marksRateStr: string,
  marksTotalStr: string
) =>
  [
    '<div class="qp-block qp-section" data-kind="section"><div class="qp-section__row">',
    `<span class="qp-section__roman">${roman}.</span>`,
    `<span class="qp-section__title">${applyMixedFonts(titlePart)} <span class="qp-section__rate">${marksRateStr}</span></span>`,
    `<span class="qp-section__total">${marksTotalStr}</span>`,
    '</div></div>',
  ].join('');

const renderSingleQuestion = (item: BlueprintItem): string => {
  const document = buildQuestionPaperDocument({
    blueprint: { items: [item] } as Blueprint,
    layout: { showHeader: false, showNotes: false, mode: 'manual', pageRules: [{ page: 1, maxQuestions: 1 }] },
  });
  const block = document.blocks.find(candidate => candidate.kind === 'question') as PaperBlock | undefined;
  return block ? block.html : '';
};

export const renderQuestion = (item: BlueprintItem, _qNoDisp?: string) => renderSingleQuestion(item);

export const renderInternalChoice = renderQuestion;

/**
 * LEGACY adapter: the paper as one continuous HTML string.
 * Prefer `buildQuestionPaperDocument(...).html` (paginated) for anything the
 * user actually sees or prints.
 */
export const buildFullQuestionPaperHTML = (
  bp: Blueprint,
  pt?: QuestionPaperType,
  paperCode?: string
): string => buildQuestionPaperBodyHtml(bp, pt, paperCode);

/** Concatenated page bodies of the canonical document (no page wrappers). */
export const buildQuestionPaperBodyHtml = (
  bp: Blueprint,
  pt?: QuestionPaperType,
  paperCode?: string
): string => {
  const document = buildQuestionPaperDocument({
    blueprint: bp,
    paperType: pt,
    layout: migrateBlueprintLayout(bp).layout,
  });
  void paperCode;
  return document.pages
    .map(page => page.blocks.map(block => block.html).join('\n'))
    .join('\n');
};

export { buildQuestionSequence, buildQuestionPaperDocument, migrateBlueprintLayout };
