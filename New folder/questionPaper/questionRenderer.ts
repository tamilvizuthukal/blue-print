/**
 * questionPaper/questionRenderer.ts
 * ---------------------------------------------------------------------------
 * Pure, DOM-free HTML builders for the question paper.
 *
 * Everything here is a pure string function so the exact same output can be
 * produced in three places without divergence:
 *   1. Mass View preview (browser)
 *   2. the A4 editor / print view (browser)
 *   3. the server-side Puppeteer export (Node)
 *
 * No inline font-family declarations, no regex HTML rewriting, no
 * `document.createElement` (which is what made the old pipeline behave
 * differently in Node than in the browser).
 */

import type { Blueprint } from '../types';
import { escapeHtml, formatMark } from './htmlUtils';
import type { SequenceItem, SequenceSection } from './questionSequence';
import { TYPOGRAPHY_CLASSES } from './typography';
import type { QuestionPaperLayout } from './layoutTypes';
import { resolvePaperCode, resolveSetLabel } from './layoutTypes';

const MM_PER_INCH = 25.4;
const PX_PER_MM = 96 / MM_PER_INCH;

export const mmToPx = (mm: number): number => mm * PX_PER_MM;
export const pxToMm = (px: number): number => px / PX_PER_MM;
export const ptToMm = (pt: number): number => (pt * 25.4) / 72;

/* -------------------------------------------------------------------------- */
/* Latin font runs (replaces the old nested-span regex)                        */
/* -------------------------------------------------------------------------- */

const LATIN_RUN = /[A-Za-z0-9][A-Za-z0-9\-:()[\],.'&/+=]*/g;

/**
 * Wraps Latin/digit runs in `.qp-english` so Latin text renders in Times New
 * Roman while Tamil stays in TAU-Paalai. Idempotent: a second call is a no-op.
 */
export function applyMixedFonts(html: string): string {
  if (!html) return '';
  const tokens = html.split(/(<[^>]+>)/g);
  let englishDepth = 0;
  return tokens
    .map(token => {
      if (!token) return token;
      if (token.startsWith('<')) {
        const lower = token.toLowerCase();
        if (lower.startsWith('<span') && /qp-english/.test(lower) && !lower.startsWith('</')) englishDepth += 1;
        else if (lower.startsWith('</span') && englishDepth > 0) englishDepth -= 1;
        return token;
      }
      if (englishDepth > 0) return token;
      return token.replace(LATIN_RUN, match => `<span class="${TYPOGRAPHY_CLASSES.english}">${match}</span>`);
    })
    .join('');
}

/* -------------------------------------------------------------------------- */
/* Tag-aware helpers (no DOM)                                                  */
/* -------------------------------------------------------------------------- */

const OPENING_TAG = /^<([a-zA-Z][\w:-]*)/;
const CLOSING_TAG = /^<\/([a-zA-Z][\w:-]*)/;
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'col']);
const BLOCK_TAGS = new Set(['p', 'div', 'li', 'tr', 'td', 'th', 'table', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'blockquote']);

/**
 * Slices a tokenized HTML string and returns a balanced fragment: unmatched
 * closing tags are dropped and unclosed openers are closed.
 */
export function sliceBalancedTokens(tokens: string[], start: number, end: number): string {
  const slice = tokens.slice(start, end + 1);
  const cleaned: string[] = [];
  let droppedLeading = false;
  for (let i = 0; i < slice.length; i += 1) {
    const token = slice[i];
    if (!token) continue;
    if (!token.startsWith('<')) {
      cleaned.push(token);
      droppedLeading = false;
      continue;
    }
    const closing = token.match(CLOSING_TAG);
    if (closing) {
      if (droppedLeading) continue; // closing tag of a block we removed
      if (token === '</span>' && cleaned.length === 0) continue;
    }
    const opening = token.match(OPENING_TAG);
    if (opening && BLOCK_TAGS.has(opening[1].toLowerCase()) && cleaned.length === 0 && !droppedLeading) {
      droppedLeading = true;
      if (VOID_TAGS.has(opening[1].toLowerCase())) continue;
      continue;
    }
    if (/^<br\s*\/?>$/i.test(token) && cleaned.length === 0) continue;
    droppedLeading = false;
    cleaned.push(token);
  }

  const stack: string[] = [];
  const out: string[] = [];
  cleaned.forEach(token => {
    if (!token.startsWith('<')) {
      out.push(token);
      return;
    }
    const closing = token.match(CLOSING_TAG);
    if (closing) {
      const name = closing[1].toLowerCase();
      if (VOID_TAGS.has(name)) {
        if (stack.length === 0) return;
        out.push(token);
        return;
      }
      const index = stack.lastIndexOf(name);
      if (index === -1) return; // orphan closing tag
      while (stack.length > index) out.push(`</${stack.pop()}>`);
      return;
    }
    const opening = token.match(OPENING_TAG);
    if (opening) {
      const name = opening[1].toLowerCase();
      if (!token.endsWith('/>') && !VOID_TAGS.has(name)) stack.push(name);
    }
    out.push(token);
  });
  while (stack.length > 0) {
    const name = stack.pop() as string;
    // An unclosed block wrapper is empty, so drop it instead of emitting <p></p>.
    if (BLOCK_TAGS.has(name)) continue;
    out.push(`</${name}>`);
  }
  return out.join('').trim();
}

const tokenizeHtml = (html: string): string[] => html.split(/(<[^>]+>)/g).filter(token => token !== '');

export interface ParsedMcq {
  stem: string;
  options: string[];
  markers: string[];
}

const MCQ_MARKER_SETS: string[][] = [
  ['அ)', 'ஆ)', 'இ)', 'ஈ)'],
  ['அ.', 'ஆ.', 'இ.', 'ஈ.'],
  ['A)', 'B)', 'C)', 'D)'],
  ['(A)', '(B)', '(C)', '(D)'],
];

/**
 * Extracts a 4-option MCQ from rich text. Works on the tokenized HTML instead of
 * the DOM, so the browser and Node produce identical results.
 */
export function parseMcqFromHtml(html: string): ParsedMcq | null {
  if (!html) return null;
  const tokens = tokenizeHtml(html);
  const textIndexes: number[] = [];
  tokens.forEach((token, index) => {
    if (!token.startsWith('<')) textIndexes.push(index);
  });
  if (textIndexes.length === 0) return null;

  for (const markers of MCQ_MARKER_SETS) {
    const found: Array<{ marker: string; tokenIndex: number; charIndex: number }> = [];
    let cursor = 0;
    for (const marker of markers) {
      let hit: { tokenIndex: number; charIndex: number } | null = null;
      for (let i = cursor; i < textIndexes.length; i += 1) {
        const tokenIndex = textIndexes[i];
        const charIndex = (tokens[tokenIndex] || '').indexOf(marker);
        if (charIndex >= 0) {
          hit = { tokenIndex, charIndex };
          break;
        }
      }
      if (!hit) {
        found.length = 0;
        break;
      }
      found.push({ marker, ...hit });
      cursor = textIndexes.indexOf(hit.tokenIndex) + 1;
    }
    if (found.length !== markers.length) continue;

    const stem = sliceBalancedTokens(tokens, 0, found[0].tokenIndex - 1);
    const options: string[] = [];
    for (let i = 0; i < found.length; i += 1) {
      const startToken = found[i].tokenIndex;
      const startChar = found[i].charIndex + found[i].marker.length;
      const startSlice = tokens[startToken].slice(startChar);
      let combined: string[];
      if (i === found.length - 1) {
        const endToken = textIndexes[textIndexes.length - 1];
        combined = [startSlice, ...tokens.slice(startToken + 1, endToken + 1)];
      } else {
        const endToken = found[i + 1].tokenIndex;
        const endChar = found[i + 1].charIndex;
        const tail = tokens[endToken].slice(0, endChar);
        combined = [startSlice, ...tokens.slice(startToken + 1, endToken), tail];
      }
      options.push(sliceBalancedTokens(combined, 0, combined.length - 1));
    }

    if (options.every(option => option.length > 0)) {
      return { stem, options, markers };
    }
  }
  return null;
}

/** Decides between the compact 2-column table and the stacked option list. */
export function shouldStackMcqOptions(optionTexts: string[], longestOptionMm: number, columnWidthMm: number): boolean {
  if (optionTexts.length === 0) return false;
  const half = columnWidthMm / 2;
  return longestOptionMm > half - 6;
}

/* -------------------------------------------------------------------------- */
/* Page furniture                                                             */
/* -------------------------------------------------------------------------- */

export interface HeaderMeta {
  setLetter: string;
  paperCode: string;
  termHeading: string;
  subjectTamil: string;
  subjectEnglish: string;
  durationText: string;
  thinkingText: string;
  classText: string;
  marksText: string;
}

export function buildHeaderMeta(blueprint: Partial<Blueprint>, paperCode: string): HeaderMeta {
  const year = (blueprint.academicYear || '').trim();
  const yearStr = year ? `<span class="${TYPOGRAPHY_CLASSES.english}">${escapeHtml(year)}</span>` : '';
  const term = blueprint.examTerm || '';
  let termHeading = `முதல்பருவத் தொகுத்தறி மதிப்பீடு ${yearStr}`;
  if (term === 'Second Term Summative') termHeading = `இரண்டாம் பருவத் தொகுத்தறி மதிப்பீடு ${yearStr}`;
  if (term === 'Third Term Summative') termHeading = `இறுதிப் பருவத் தொகுத்தறி மதிப்பீடு ${yearStr}`;

  const isBT = String(blueprint.subject || '').toUpperCase().includes('BT');
  const subjectTitle = isBT
    ? { tamil: 'தமிழ் இரண்டாம் தாள்', eng: 'Tamil Language Paper II (BT)' }
    : { tamil: 'தமிழ் முதல் தாள்', eng: 'Tamil Language Paper I (AT)' };

  const setLetter = (blueprint.setId || 'A')
    .replace(/^SET\s+/i, '')
    .trim()
    .charAt(0)
    .toUpperCase() || 'A';

  return {
    setLetter,
    paperCode,
    termHeading,
    subjectTamil: subjectTitle.tamil,
    subjectEnglish: subjectTitle.eng,
    durationText: '90 நிமிடம்',
    thinkingText: '15 நிமிடம்',
    classText: String(blueprint.classLevel ?? ''),
    marksText: formatMark(Number(blueprint.totalMarks) || 0),
  };
}

/** First-page-only official header. Square corners, no rounded decorative UI. */
export function renderHeaderBlock(meta: HeaderMeta): string {
  return `
<section class="qp-block qp-header" data-kind="header">
  <div class="qp-header__codes">
    <div class="qp-code-box">${escapeHtml(meta.setLetter)}</div>
    <div class="qp-code-box">${escapeHtml(meta.paperCode)}</div>
  </div>
  <h1 class="qp-header__title">சமக்ர சிக்ஷா கேரளம்</h1>
  <div class="qp-header__titles">
    <p class="qp-header__term">${meta.termHeading}</p>
    <p class="qp-header__subject">${escapeHtml(meta.subjectTamil)}</p>
    <p class="qp-header__subject-en">${escapeHtml(meta.subjectEnglish)}</p>
  </div>
  <div class="qp-header__meta">
    <div class="qp-header__meta-block">
      <div>நேரம்: <span class="${TYPOGRAPHY_CLASSES.english}">90</span> நிமிடம்</div>
      <div>சிந்தனை நேரம்: <span class="${TYPOGRAPHY_CLASSES.english}">15</span> நிமிடம்</div>
    </div>
    <div class="qp-header__meta-block qp-header__meta-block--right">
      <div>வகுப்பு: <span class="${TYPOGRAPHY_CLASSES.english}">${escapeHtml(meta.classText)}</span></div>
      <div>மதிப்பெண்: <span class="${TYPOGRAPHY_CLASSES.english}">${escapeHtml(meta.marksText)}</span></div>
    </div>
  </div>
</section>`.trim();
}

const DEFAULT_NOTES: string[] = [
  'முதல் 15 நிமிடம் சிந்தனை நேரமாகும்.',
  'வினாக்களை வாசித்து விடைகளை வரிசைப்படுத்த இந்த நேரத்தைப் பயன்படுத்தலாம்.',
  'வினாக்களையும் குறிப்புகளையும் நன்கு வாசித்துப் புரிந்து விடையளிக்கவும்.',
  'விடையளிக்கும்போது மதிப்பெண், நேரம் போன்றவற்றை கவனித்து செயல்படவும்.',
];

/** Plain notes block: square corners, no rounded cards, no shadows. */
export function renderNotesBlock(notes: string[] = DEFAULT_NOTES): string {
  const rows = notes
    .map(note => `<li class="qp-notes__item">${escapeHtml(note)}</li>`)
    .join('');
  return `
<section class="qp-block qp-notes" data-kind="notes">
  <h2 class="qp-notes__title">குறிப்புகள்:</h2>
  <ul class="qp-notes__list">${rows}</ul>
</section>`.trim();
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

export function renderSectionBlock(section: SequenceSection): string {
  const marksTotal = section.declaredMarksTotal;
  const instruction = section.instruction
    .replace(/\(\s*\d+(\.5)?\s*மதிப்பெண்\s*வீதம்\s*\)/g, '')
    .replace(/\(\s*\d+\s*[xX*]\s*\d+(\.5)?\s*=\s*\d+(\.5)?\s*\)/g, '')
    .trim();
  const rangePart = section.isUnmatched ? 'மேலும் வினாக்கள்' : section.rangeLabel;
  const title = [rangePart, instruction].filter(Boolean).join(' ');
  const marksRate = `<span class="qp-section__rate">(${formatMark(section.marks)} மதிப்பெண் வீதம்)</span>`;
  const marksTotalText = section.isUnmatched
    ? ''
    : `<span class="qp-section__total">(${section.declaredCount} × ${formatMark(section.marks)} = ${formatMark(marksTotal)})</span>`;

  return `
<section class="qp-block qp-section" data-kind="section">
  <div class="qp-section__row">
    <span class="qp-section__roman">${section.roman}.</span>
    <span class="qp-section__title">${applyMixedFonts(escapeHtml(title))} ${marksRate}</span>
    ${marksTotalText}
  </div>
</section>`.trim();
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                  */
/* -------------------------------------------------------------------------- */

export interface QuestionRenderOptions {
  /** mm available for the question body (content width - number column). */
  bodyWidthMm: number;
  /** Forces the stacked MCQ layout. */
  stackOptions?: boolean;
}

export interface QuestionFragment {
  key: string;
  html: string;
  text: string;
  /** Fragments that may be dropped onto the next page. */
  splittable: boolean;
}

const numberLabel = (item: SequenceItem): string =>
  item.questionCount > 1 ? `${item.displayNumber}-${item.endNumber}` : String(item.displayNumber);

const stemFragmentHtml = (raw: string): string => {
  const html = (raw || '').trim();
  return html || '<span class="qp-empty">(வினா உரை இல்லை)</span>';
};

const mcqFragments = (
  parsed: ParsedMcq,
  options: QuestionRenderOptions
): QuestionFragment[] => {
  const markerClass = TYPOGRAPHY_CLASSES.optionLabel;
  const optionHtml = parsed.options.map((option, index) => {
    const marker = escapeHtml(parsed.markers[index]);
    return `<li class="qp-mcq__option"><span class="${markerClass}">${marker}</span><span class="qp-mcq__text">${applyMixedFonts(option)}</span></li>`;
  });
  const gridClass = options.stackOptions ? 'qp-mcq--stacked' : 'qp-mcq--grid';
  return [
    {
      key: 'mcq',
      html: `<ul class="qp-mcq ${gridClass}">${optionHtml.join('')}</ul>`,
      text: parsed.options.join(' '),
      splittable: false,
    },
  ];
};

export function buildQuestionFragments(
  item: SequenceItem,
  options: QuestionRenderOptions
): QuestionFragment[] {
  const fragments: QuestionFragment[] = [];
  const questionText = item.item.questionText || '';
  const parsed = parseMcqFromHtml(questionText);

  if (parsed) {
    fragments.push({
      key: 'stem',
      html: `<div class="qp-q__stem">${applyMixedFonts(stemFragmentHtml(parsed.stem))}</div>`,
      text: parsed.stem,
      splittable: false,
    });
    fragments.push(...mcqFragments(parsed, options));
    return fragments;
  }

  fragments.push({
    key: 'stem',
    html: `<div class="qp-q__stem">${applyMixedFonts(stemFragmentHtml(questionText))}</div>`,
    text: questionText.replace(/<[^>]+>/g, ' '),
    splittable: false,
  });

  if (item.hasInternalChoice) {
    const aHtml = item.item.questionText || '';
    const bHtml = item.item.questionTextB || '';
    if (aHtml.trim()) {
      fragments.push({
        key: 'choice-a',
        html: `<div class="qp-q__choice"><span class="${TYPOGRAPHY_CLASSES.optionLabel}">அ)</span><span class="qp-q__choice-text">${applyMixedFonts(aHtml)}</span></div>`,
        text: aHtml.replace(/<[^>]+>/g, ' '),
        splittable: true,
      });
    }
    fragments.push({
      key: 'choice-or',
      html: '<div class="qp-q__choice-or">(அல்லது)</div>',
      text: '(அல்லது)',
      splittable: false,
    });
    if (bHtml.trim()) {
      fragments.push({
        key: 'choice-b',
        html: `<div class="qp-q__choice"><span class="${TYPOGRAPHY_CLASSES.optionLabel}">ஆ)</span><span class="qp-q__choice-text">${applyMixedFonts(bHtml)}</span></div>`,
        text: bHtml.replace(/<[^>]+>/g, ' '),
        splittable: true,
      });
    }
  }

  const time = Number(item.item.time);
  if (Number.isFinite(time) && time > 0) {
    fragments.push({
      key: 'time',
      html: `<div class="qp-q__time">(நேரம்: <span class="${TYPOGRAPHY_CLASSES.english}">${time}</span> நிமிடம்)</div>`,
      text: `நேரம் ${time} நிமிடம்`,
      splittable: false,
    });
  }

  return fragments;
}

export function renderQuestionBlock(
  item: SequenceItem,
  fragments: QuestionFragment[],
  continuation = false
): string {
  const number = numberLabel(item);
  const numberHtml = continuation
    ? ''
    : `<div class="qp-q__number">${number}.</div>`;
  const body = fragments.map(fragment => fragment.html).join('');
  const marks = Number(item.item.marksPerQuestion ?? item.item.marksPerItem ?? 0);
  const marksHtml = continuation
    ? ''
    : `<div class="qp-q__marks">(${formatMark(marks)})</div>`;

  return `
<div class="qp-block qp-q${continuation ? ' qp-q--continuation' : ''}" data-kind="question" data-item-id="${escapeHtml(item.itemId)}" data-display-number="${item.displayNumber}">
  ${numberHtml}
  <div class="qp-q__body">
    ${continuation ? '<div class="qp-q__continued">(தொடர்ச்சி)</div>' : ''}
    ${body}
  </div>
  ${marksHtml}
</div>`.trim();
}

export function renderDecorationBlock(): string {
  return `
<div class="qp-block qp-decoration" data-kind="decoration"><span>──── ✦ ✦ ✦ ────</span></div>`.trim();
}

/* -------------------------------------------------------------------------- */
/* Footers                                                                    */
/* -------------------------------------------------------------------------- */

/** Printed on every page: rule + paper code on the left, "Page N / Total" centred. */
export interface FooterMeta {
  pageNumber: number;
  totalPages: number;
  paperCode: string;
  setLabel: string;
  layout: QuestionPaperLayout;
}

export function renderFooter(meta: FooterMeta): string {
  const { layout } = meta;
  const left = layout.footer.showPaperCode
    ? `<div class="qp-footer__code">${escapeHtml(meta.paperCode)}</div>`
    : '<div class="qp-footer__code"></div>';
  const center = layout.footer.showPageNumber
    ? `<div class="qp-footer__page">${escapeHtml(`Page ${meta.pageNumber} / ${meta.totalPages}`)}</div>`
    : '<div class="qp-footer__page"></div>';
  const right = `<div class="qp-footer__set">${escapeHtml(meta.setLabel)}</div>`;
  return `
<div class="qp-footer">
  ${left}
  ${center}
  ${right}
</div>`.trim();
}

/** Running header for pages 2+; disabled by default to match the reference paper. */
export function renderRunningHeader(pageNumber: number, totalPages: number, paperCode: string, title: string): string {
  return `
<div class="qp-running-header">
  <span>${escapeHtml(title)}</span>
  <span class="qp-running-header__page">${escapeHtml(`Page ${pageNumber} / ${totalPages}`)}</span>
</div>`.trim();
}

export interface QuestionPaperIdentity {
  paperCode: string;
  title: string;
  setLabel: string;
}

export function buildIdentity(blueprint: Partial<Blueprint>): QuestionPaperIdentity {
  const paperCode = resolvePaperCode(blueprint as Blueprint);
  return {
    paperCode,
    title: String(blueprint.subject || '').toUpperCase().includes('BT') ? 'தமிழ் இரண்டாம் தாள்' : 'தமிழ் முதல் தாள்',
    setLabel: resolveSetLabel(blueprint as Blueprint),
  };
}
