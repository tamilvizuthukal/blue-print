/**
 * questionPaper/questionPaperStyles.ts
 * ---------------------------------------------------------------------------
 * The only stylesheet for the question paper. It is generated from the layout
 * so the browser preview, the print view and the Puppeteer export cannot drift
 * apart, and it is fully scoped: every selector starts with `.qp-` and no bare
 * element selector is ever emitted (the old global `body { font-family }` and
 * `.pdf-page { overflow: hidden }` rules caused silent font/pagination bugs).
 */

import type { PageGeometry, QuestionPaperLayout } from './layoutTypes';
import { TIMES_NEW_ROMAN } from './typography';

export interface StyleOptions {
  /** Adds preview-only chrome (shadow, gaps, zoom). Never used when printing. */
  screenPreview?: boolean;
  /** Zoom factor for the screen preview. */
  previewZoom?: number;
}

export function buildQuestionPaperCss(
  layout: QuestionPaperLayout,
  geometry: PageGeometry,
  options: StyleOptions = {}
): string {
  const { screenPreview = false, previewZoom = 1 } = options;
  const t = layout.typography;
  const m = layout.margins;

  const pageBox = `
  width: ${geometry.pageWidthMm}mm;
  height: ${geometry.pageHeightMm}mm;
  padding: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
  box-sizing: border-box;
`;

  return `
.qp-root {
  --qp-tamil: '${t.bodyFontFamily}', 'Noto Serif Tamil', serif;
  --qp-heading: '${t.headingFontFamily}', '${TIMES_NEW_ROMAN}', serif;
  --qp-english: '${t.englishFontFamily}', serif;
  --qp-body-size: ${t.bodyFontSize}pt;
  --qp-heading-size: ${t.headingFontSize}pt;
  --qp-line-height: ${t.bodyLineHeight};
  font-family: var(--qp-tamil);
  font-size: var(--qp-body-size);
  line-height: var(--qp-line-height);
  color: #000;
  background: #fff;
  text-align: left;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.qp-root .qp-english { font-family: var(--qp-english); }
.qp-root .qp-tamil { font-family: var(--qp-tamil); }
.qp-root .qp-tamil-bold,
.qp-root .qp-heading { font-family: var(--qp-heading); font-weight: 700; }
/* The box-sizing reset used to require a nested .qp-root descendant, which never
   matched: bordered and padded blocks such as .qp-notes then overflowed the
   right margin by their padding plus border. */
.qp-root *, .qp-root *::before, .qp-root *::after { box-sizing: border-box; }
.qp-page {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
  break-after: page;
  page-break-after: always;
${pageBox}}
.qp-page:last-child { break-after: auto; page-break-after: auto; }
.qp-page__body { flex: 0 0 auto; width: 100%; }
.qp-page__footer { flex: 0 0 auto; width: 100%; height: ${geometry.footerHeightMm}mm; }

/* ---------------------------------------------------------------- blocks */
.qp-block { width: 100%; }
.qp-block[data-kind='question'] {
  display: grid;
  grid-template-columns: 6mm 1fr auto;
  column-gap: 0;
  align-items: start;
  text-align: justify;
}
.qp-block[data-kind='question'] > .qp-q__number { text-align: left; font-family: var(--qp-english); font-weight: 700; }
.qp-block[data-kind='question'] > .qp-q__marks { text-align: left; padding-left: 2mm; font-family: var(--qp-tamil); white-space: nowrap; }
.qp-q__body { text-align: justify; }
.qp-q__stem > p:first-child, .qp-q__body > p:first-child { margin-top: 0; }
.qp-q__stem p, .qp-q__body p { margin: 0 0 1mm 0; }
.qp-q__stem ul, .qp-q__stem ol { margin: 0 0 1mm 6mm; padding-left: 4mm; }
.qp-q__stem img, .qp-q__body img { max-width: 100%; height: auto; }
.qp-q__continued { font-style: italic; margin-bottom: 1mm; }
.qp-q__choice { display: grid; grid-template-columns: 6mm 1fr; align-items: start; text-align: justify; }
.qp-q__choice-or { text-align: center; font-weight: 700; margin: 1mm 0 1mm 6mm; }
.qp-q__time { text-align: right; font-size: 0.92em; }
.qp-q--continuation { grid-template-columns: 6mm 1fr auto; }

/* ------------------------------------------------------------------- MCQ */
.qp-mcq { list-style: none; margin: 1mm 0 0 0; padding: 0; display: grid; }
.qp-mcq--grid { grid-template-columns: 1fr 1fr; column-gap: 4mm; }
.qp-mcq--stacked { grid-template-columns: 1fr; }
.qp-mcq__option { display: grid; grid-template-columns: 6mm 1fr; align-items: start; text-align: justify; }
.qp-mcq__option .qp-option-label { text-align: left; font-weight: 700; }

/* --------------------------------------------------------------- section */
.qp-section__row { display: flex; justify-content: space-between; align-items: flex-end; gap: 3mm; }
.qp-section__roman { font-family: var(--qp-english); font-weight: 700; width: 6mm; flex: 0 0 auto; }
.qp-section__title { flex: 1 1 auto; font-weight: 700; text-align: justify; }
.qp-section__rate { font-weight: 400; white-space: nowrap; }
.qp-section__total { font-weight: 700; white-space: nowrap; }

/* ---------------------------------------------------------------- header */
.qp-header__codes { display: flex; justify-content: space-between; align-items: flex-start; }
.qp-code-box {
  background: #000;
  color: #fff;
  font-family: var(--qp-english);
  font-weight: 700;
  font-size: 1.05em;
  padding: 1mm 3.5mm;
  border-radius: 0;
  min-width: 8mm;
  text-align: center;
}
.qp-header__title {
  font-family: var(--qp-heading);
  font-weight: 700;
  font-size: 1.6em;
  text-align: center;
  margin: 2.5mm 0 0 0;
  letter-spacing: 0.2px;
  white-space: nowrap;
}
.qp-header__titles { text-align: center; margin-top: 2.5mm; }
.qp-header__term { font-size: 1.15em; font-weight: 700; margin: 0; }
.qp-header__subject { font-size: 1.15em; font-weight: 700; margin: 1.2mm 0 0 0; }
.qp-header__subject-en { font-family: var(--qp-english); font-size: 1.05em; font-weight: 700; margin: 0.8mm 0 0 0; }
.qp-header__meta { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1.5mm; font-weight: 700; }
.qp-header__meta-block { line-height: 1.5; }
.qp-header__meta-block--right { text-align: right; }

/* ----------------------------------------------------------------- notes */
.qp-notes { border: 0.25mm solid #000; border-radius: 0; padding: 2mm 3mm; font-size: 0.95em; }
.qp-notes__title { font-weight: 700; margin: 0 0 1mm 0; font-size: 1em; }
.qp-notes__list { list-style: none; margin: 0; padding: 0 0 0 2mm; }
.qp-notes__item { position: relative; padding-left: 5mm; margin-bottom: 0.8mm; text-align: justify; }
.qp-notes__item::before { content: '\\25C6'; position: absolute; left: 0; top: 0; }

/* ------------------------------------------------------------ decoration */
.qp-decoration { text-align: center; font-family: var(--qp-english); letter-spacing: 1px; }

/* ---------------------------------------------------------------- footer */
.qp-footer {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  border-top: 0.25mm solid #000;
  padding-top: 1.2mm;
  font-size: 0.9em;
}
.qp-footer__code { text-align: left; }
.qp-footer__page { text-align: center; font-family: var(--qp-english); }
.qp-footer__set { text-align: right; }

/* --------------------------------------------------------- running head */
.qp-running-header {
  display: flex;
  justify-content: space-between;
  border-bottom: 0.2mm solid #000;
  padding-bottom: 1mm;
  margin-bottom: 2mm;
  font-size: 0.9em;
}
.qp-running-header__page { font-family: var(--qp-english); }

/* ------------------------------------------------------------- overflow */
.qp-page--overflow { outline: 0.5mm solid #d92b2b; }
.qp-page[data-overflow='true'] .qp-page__body::after {
  content: 'overflow';
  color: #d92b2b;
  font-size: 8pt;
}

${screenPreview ? previewCss(previewZoom) : ''}
`;
}

function previewCss(zoom: number): string {
  return `
.qp-root--screen { background: #eef1f6; padding: 6mm 0; }
.qp-root--screen .qp-page {
  margin: 0 auto 6mm auto;
  box-shadow: 0 2mm 6mm rgba(15, 23, 42, 0.18);
  transform-origin: top center;
}
.qp-root--screen-zoom { zoom: ${zoom}; }
`;
}

export interface PrintCssOptions {
  /**
   * `isolate` hides the rest of the app when printing (browser print dialog).
   * The PDF export uses the standalone document, so it must stay false.
   */
  isolate?: boolean;
}

export function buildPrintPageRuleCss(options: PrintCssOptions = {}): string {
  const isolate = options.isolate === true;
  return `
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
${isolate ? '  body * { visibility: hidden; }\n  .qp-print-root, .qp-print-root * { visibility: visible; }\n  .qp-print-root { position: absolute; left: 0; top: 0; width: 100%; }\n' : ''}}
`;
}

export const FONT_CSS_HINT = `
/* The exact TAU faces are declared by questionPaper/typography.ts (buildFontFaceCss). */
`;
