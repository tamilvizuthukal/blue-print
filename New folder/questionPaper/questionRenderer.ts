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
import { escapeHtml, formatMark, stripInlineFontFamily } from './htmlUtils';
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
  // Rich text (TipTap, the A4 editor) may carry inline font-family faces. They
  // are stripped here so the paper stylesheet stays the single source of truth,
  // otherwise the font audit would reject the encoded quotes it serializes.
  const tokens = stripInlineFontFamily(html).split(/(<[^>]+>)/g);
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
  'விடையளிக்கும்போது மதிப்பெண், நேரம் போன்றவற்றை கவனித்துச் செயல்படவும்.',
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
  let instruction = section.instruction
    .replace(/\(\s*\d+(\.5)?\s*மதிப்பெண்\s*வீதம்\s*\)/g, '')
    .replace(/\(\s*\d+\s*[xX*]\s*\d+(\.5)?\s*=\s*\d+(\.5)?\s*\)/g, '')
    .trim();
  const rangePart = section.isUnmatched ? 'மேலும் வினாக்கள்' : section.rangeLabel;
  // Some blueprint instructions already include the generated question range.
  // Remove that repeated prefix from the heading while preserving the prompt.
  if (rangePart) {
    const escapedRange = rangePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    instruction = instruction.replace(new RegExp(`^${escapedRange}[\\s:：,、.\\-]*`, 'i'), '').trim();
  }
  const title = [rangePart, instruction].filter(Boolean).join(' ');
  const marksRate = `<span class="qp-section__rate">(${formatMark(section.marks)} மதிப்பெண் வீதம்)</span>`;
  const marksTotalText = section.isUnmatched
    ? ''
    : `<span class="qp-section__total">(${section.declaredCount} × ${formatMark(section.marks)} = ${formatMark(marksTotal)})</span>`;

  return `
<section class="qp-block qp-section" data-kind="section">
  <div class="qp-section__row">
    <span class="qp-section__roman">${section.roman}.</span>
    <span class="qp-section__title">${applyMixedFonts(escapeHtml(stripInlineFontFamily(title)))} ${marksRate}</span>
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
  const html = (raw || '')
    .replace(/(?:&(?:amp;)?nbsp;|&#0*160;|&#x0*a0;|\u00a0){4,}/gi, ' ')
    .trim();
  return html || '<span class="qp-empty">(வினா உரை இல்லை)</span>';
};

/** Shared structured renderers used by the editor preview, print view and Puppeteer PDF. */
export function renderStructuredQuestion(content: any): string {
  if (!content || content.type === 'text') return '';
  if (content.type === 'multiple_choice') {
    const data = content.multipleChoice || {};
    const prompt = String(data.prompt || '').trim();
    const labels = ['அ','ஆ','இ','ஈ','உ','ஊ','எ','ஏ','ஐ','ஒ','ஓ','ஔ'];
    const options = (data.options || []).map((option: any, index: number) => `<div class="qp-structured-mcq__option"><b>${labels[index] || index + 1})</b><span>${escapeHtml(option.text || '')}</span></div>`).join('');
    return `${prompt ? `<div class="qp-structured-prompt"><span>${escapeHtml(prompt)}</span></div>` : ''}<div class="qp-structured-mcq">${options}</div>`;
  }
  if (content.type === 'match_pairs') {
    const data = content.matchPairs || {};
    const column = (rows: any[], right = false) => `<section class="qp-structured-match__column">${(rows || []).map((row, i) => `<div class="qp-structured-match__row"><b>${right ? `${['அ','ஆ','இ','ஈ','உ','ஊ','எ','ஏ','ஐ','ஒ','ஓ','ஔ'][i] || i+1})` : `${i+1}.`}</b><span>${escapeHtml(row.text || '')}</span></div>`).join('')}</section>`;
    const prompt = String(data.prompt || '').trim();
    return `${prompt ? `<div class="qp-structured-prompt"><span>${escapeHtml(prompt)}</span></div>` : ''}<div class="qp-structured-match">${column(data.leftItems)}${column(data.rightItems,true)}</div>`;
  }
  if (content.type === 'profile_table') {
    const rows = content.profileTable?.rows || [];
    const prompt = String(content.profileTable?.prompt || '').trim();
    return `${prompt ? `<div class="qp-structured-prompt"><span>${escapeHtml(prompt)}</span></div>` : ''}<table class="qp-structured-profile${content.profileTable?.bordered === false ? ' qp-structured-profile--plain' : ''}"><tbody>${rows.map((row: any) => `<tr><th>${escapeHtml(row.label || '')}</th><td>${escapeHtml(row.value || '').replace(/\n/g,'<br>')}</td></tr>`).join('')}</tbody></table>`;
  }
  if (content.type === 'word_sun') {
    const centerText = String(content.wordSun?.centerText || '');
    const prompt = String(content.wordSun?.prompt || '').trim();
    const nodes = [...(content.wordSun?.nodes || [])].sort((a:any,b:any) => (a.position || 0) - (b.position || 0));
    const graphemes = (text: string) => { const Segmenter=(Intl as any).Segmenter; return Segmenter ? [...new Segmenter('ta',{granularity:'grapheme'}).segment(text)].map((part:any)=>part.segment) : Array.from(text); };
    const lines = (text: string, limit: number) => {
      const result:string[]=[]; let current='';
      const pushLongWord=(word:string) => { const chars=graphemes(word); while(chars.length>limit) result.push(chars.splice(0,limit).join('')); return chars.join(''); };
      for(const word of String(text||'').trim().split(/\s+/).filter(Boolean)) {
        const remainder=pushLongWord(word);
        if(!remainder) continue;
        const next=current?`${current} ${remainder}`:remainder;
        if(current&&graphemes(next).length>limit){result.push(current);current=remainder;}else current=next;
      }
      if(current) result.push(current);
      return result.length?result:[''];
    };
    const box = (text: string) => { const wrapped=lines(text,11); return {wrapped,w:Math.min(200,Math.max(128,Math.max(...wrapped.map(v=>graphemes(v).length),0)*14+28)),h:Math.max(42,wrapped.length*20+14)}; };
    const center=box(centerText);
    center.w=Math.min(250,Math.max(220,center.w));
    const sizedNodes=nodes.map((node:any)=>({...node,...box(String(node.text||''))}));
    const maxNodeWidth=Math.max(114,...sizedNodes.map((node:any)=>node.w));
    const maxNodeHeight=Math.max(40,...sizedNodes.map((node:any)=>node.h));
    const radius=nodes.length?Math.max(115,nodes.length*32,(center.w+maxNodeWidth)/2+18,(center.h+maxNodeHeight)/2+18):0;
    const radiusX=nodes.length?Math.max(radius*1.28,(center.w+maxNodeWidth)/2+24):0;
    const radiusY=nodes.length?Math.max((center.h+maxNodeHeight)/2+16,radius*0.72):0;
    const width=nodes.length?Math.max(360,radiusX*2+maxNodeWidth+30):Math.max(300,center.w+40);
    const height=nodes.length?Math.max(220,radiusY*2+maxNodeHeight+24):Math.max(120,center.h+40);
    const cx=width/2,cy=height/2;
    const positioned=sizedNodes.map((node:any,i:number)=>{const angle=-Math.PI/2+2*Math.PI*i/Math.max(nodes.length,1);return {...node,x:cx+Math.cos(angle)*radiusX,y:cy+Math.sin(angle)*radiusY};});
    const edge=(x:number,y:number,w:number,h:number,dx:number,dy:number)=>{const scale=1/Math.max(Math.abs(dx)/(w/2),Math.abs(dy)/(h/2),0.001);return{x:x+dx*scale,y:y+dy*scale};};
    const connectors=positioned.map(node=>{const a=edge(cx,cy,center.w,center.h,node.x-cx,node.y-cy),b=edge(node.x,node.y,node.w,node.h,cx-node.x,cy-node.y);return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;}).join('');
    const nodeSvg=positioned.map(node=>`<g><rect x="${node.x-node.w/2}" y="${node.y-node.h/2}" width="${node.w}" height="${node.h}"/><text x="${node.x}" y="${node.y-(node.wrapped.length-1)*9}" text-anchor="middle" dominant-baseline="middle">${node.wrapped.map((line:string,i:number)=>`<tspan x="${node.x}" dy="${i?18:0}">${escapeHtml(line)}</tspan>`).join('')}</text></g>`).join('');
    const centerSvg=`<g class="qp-structured-sun__center"><rect x="${cx-center.w/2}" y="${cy-center.h/2}" width="${center.w}" height="${center.h}"/><text x="${cx}" y="${cy-(center.wrapped.length-1)*9}" text-anchor="middle" dominant-baseline="middle">${center.wrapped.map((line,i)=>`<tspan x="${cx}" dy="${i?18:0}">${escapeHtml(line)}</tspan>`).join('')}</text></g>`;
    return `${prompt ? `<div class="qp-structured-prompt"><span>${escapeHtml(prompt)}</span></div>` : ''}<svg class="qp-structured-sun" viewBox="0 0 ${width} ${height}" role="img" aria-label="சொற்சூரியனைப் பூர்த்தி செய்க."><g class="qp-structured-sun__lines">${connectors}</g>${nodeSvg}${centerSvg}</svg>`;
  }
  return '';
}

const mcqFragments = (
  parsed: ParsedMcq,
  options: QuestionRenderOptions,
  indentOptions = false
): QuestionFragment[] => {
  const markerClass = TYPOGRAPHY_CLASSES.optionLabel;
  const optionHtml = parsed.options.map((option, index) => {
    const marker = escapeHtml(parsed.markers[index]);
    // Old question text often stored the visual indent as four literal nbsp
    // entities. Replace that legacy padding with the renderer's tab-sized CSS
    // indent so the entity text can never leak into preview or PDF.
    const cleanOption = option.replace(/^(?:(?:&(?:amp;)?nbsp;|&#0*160;|&#x0*a0;|\u00a0|\s)+)/gi, '');
    return `<li class="qp-mcq__option"><span class="${markerClass}">${marker}</span><span class="qp-mcq__text">${applyMixedFonts(cleanOption)}</span></li>`;
  });
  const gridClass = [options.stackOptions ? 'qp-mcq--stacked' : 'qp-mcq--grid', indentOptions ? 'qp-mcq--indented' : ''].filter(Boolean).join(' ');
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
  const structuredA = renderStructuredQuestion(item.item.questionContent);
  const structuredB = renderStructuredQuestion(item.item.questionContentB);
  const parsed = parseMcqFromHtml(questionText);

  if (structuredA) {
    const aKey = item.item.questionContent?.type === 'word_sun'
      ? `word-sun:${item.item.questionContent.wordSun?.nodes?.length || 0}`
      : 'stem';
    fragments.push({ key: aKey, html: `<div class="qp-q__stem">${structuredA}</div>`, text: questionText.replace(/<[^>]+>/g, ' '), splittable: false });
    if (item.hasInternalChoice) {
      fragments.push({key:'choice-or',html:'<div class="qp-q__choice-or">(அல்லது)</div>',text:'(அல்லது)',splittable:false});
      if (structuredB) {
        const bKey = item.item.questionContentB?.type === 'word_sun'
          ? `choice-b-word-sun:${item.item.questionContentB.wordSun?.nodes?.length || 0}`
          : 'choice-b';
        fragments.push({key:bKey,html:`<div class="qp-q__choice"><span class="${TYPOGRAPHY_CLASSES.optionLabel}">ஆ)</span><span class="qp-q__choice-text">${structuredB}</span></div>`,text:(item.item.questionTextB||'').replace(/<[^>]+>/g,' '),splittable:true});
      }
    }
    return fragments;
  }

  // Only questions 1-8 use the compact MCQ option layout. Above question 8 the
  // அ)/ஆ)/இ)/ஈ) lines are usually full-sentence sub-questions, so they are
  // rendered exactly as authored instead of being forced into an option grid.
  if (parsed && item.displayNumber <= 8) {
    fragments.push({
      key: 'stem',
      html: `<div class="qp-q__stem">${applyMixedFonts(stemFragmentHtml(parsed.stem))}</div>`,
      text: parsed.stem,
      splittable: false,
    });
    fragments.push(...mcqFragments(parsed, { ...options, stackOptions: true }, true));
    return fragments;
  }

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

  if (!item.hasInternalChoice) {
    fragments.push({
      key: 'stem',
      html: `<div class="qp-q__stem">${applyMixedFonts(stemFragmentHtml(questionText))}</div>`,
      text: questionText.replace(/<[^>]+>/g, ' '),
      splittable: false,
    });
  }

  return fragments;
}

export function renderQuestionBlock(
  item: SequenceItem,
  fragments: QuestionFragment[],
  continuation = false,
  lineHeight = 1.6
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
<div class="qp-block qp-q${continuation ? ' qp-q--continuation' : ''}" data-kind="question" data-item-id="${escapeHtml(item.itemId)}" data-display-number="${item.displayNumber}" style="line-height:${lineHeight}">
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
