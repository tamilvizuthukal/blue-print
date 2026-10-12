import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_QUESTION_PAPER_LAYOUT,
  LAYOUT_SCHEMA_VERSION,
  defaultPageRulesForQuestionCount,
  migrateBlueprintLayout,
  normalizeQuestionPaperLayout,
  resolvePaperCode,
  resolvePageGeometry,
} from '../layoutTypes';
import { buildQuestionPaperDocument } from '../questionPaperDocument';
import { auditFontsInHtml } from '../typography';
import { FIXTURE_BLUEPRINT, FIXTURE_PAPER_TYPE } from './fixtures';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

test('an unknown or empty payload produces the full default v2 layout', () => {
  [undefined, null, {}, 'nonsense', 42].forEach(payload => {
    const layout = normalizeQuestionPaperLayout(payload, { totalQuestions: 15 });
    assert.equal(layout.version, LAYOUT_SCHEMA_VERSION);
    assert.equal(layout.pageSize, 'A4');
    assert.equal(layout.orientation, 'portrait');
    assert.equal(layout.mode, 'smart', 'pages must fill continuously by default');
    assert.deepEqual(layout.pageRules, defaultPageRulesForQuestionCount(15));
    assert.equal(layout.footer.showPageNumber, true);
    assert.equal(layout.runningHeader, false);
  });
});

test('per-question gaps and line spacing are normalized and bounded', () => {
  const layout = normalizeQuestionPaperLayout({ questionOverrides: {
    q1: { spacingBefore: 2.5, spacingAfter: 7, lineHeight: 1.9 },
    q2: { spacingBefore: -5, spacingAfter: 100, lineHeight: 4 },
  } });
  assert.deepEqual(layout.questionOverrides.q1, { spacingBefore: 2.5, spacingAfter: 7, lineHeight: 1.9 });
  assert.deepEqual(layout.questionOverrides.q2, { spacingBefore: 0, spacingAfter: 40, lineHeight: 2.5 });
});

test('the canonical 15-question paper maps to 5/6/3/1', () => {
  assert.deepEqual(defaultPageRulesForQuestionCount(15), [
    { page: 1, maxQuestions: 5 },
    { page: 2, maxQuestions: 6 },
    { page: 3, maxQuestions: 3 },
    { page: 4, maxQuestions: 1 },
  ]);
});

test('legacy report settings are migrated instead of being dropped', () => {
  const layout = normalizeQuestionPaperLayout(
    { reportSettings: { fontSizeTamil: 13, lineHeight: 1.9, orientation: 'l' } },
    { totalQuestions: 15 }
  );
  assert.equal(layout.typography.bodyFontSize, 13);
  assert.equal(layout.typography.bodyLineHeight, 1.9);
  assert.equal(layout.version, LAYOUT_SCHEMA_VERSION);
});

test('legacy blueprints migrate without touching their items', () => {
  const blueprint = clone(FIXTURE_BLUEPRINT) as any;
  blueprint.massViewHeader = '<div>legacy html</div>';
  blueprint.reportSettings = { fontSizeTamil: 12, lineHeight: 1.6 };
  const before = JSON.stringify(blueprint.items);

  const result = migrateBlueprintLayout(blueprint);

  assert.equal(JSON.stringify(blueprint.items), before, 'items must not be modified');
  assert.equal(result.legacyMassViewContent, '<div>legacy html</div>');
  assert.equal(result.migrated, true);
  assert.equal(result.layout.version, LAYOUT_SCHEMA_VERSION);
  assert.ok(result.warnings.some(warning => /massViewHeader/.test(warning)));
});

test('a stored v2 layout is reused verbatim', () => {
  const layout = { ...DEFAULT_QUESTION_PAPER_LAYOUT, questionSpacing: 9 };
  const result = migrateBlueprintLayout({ ...clone(FIXTURE_BLUEPRINT), questionPaperLayout: layout } as any);
  assert.equal(result.layout.questionSpacing, 9);
  assert.equal(result.migrated, false);
});

test('page geometry subtracts the footer band from the printable height', () => {
  const geometry = resolvePageGeometry(DEFAULT_QUESTION_PAPER_LAYOUT);
  assert.equal(geometry.pageWidthMm, 210);
  assert.equal(geometry.pageHeightMm, 297);
  assert.equal(geometry.contentWidthMm, 210 - 25 - 25);
  assert.equal(
    geometry.contentHeightMm,
    Math.round((297 - 20 - 18 - geometry.footerHeightMm) * 10) / 10
  );
});

test('the paper code follows the class/subject table', () => {
  assert.equal(resolvePaperCode({ classLevel: 10, subject: 'Tamil AT' } as any), 'T-1002');
  assert.equal(resolvePaperCode({ classLevel: 9, subject: 'Tamil BT' } as any), 'T-912');
});

test('the whole fixture paper builds into 4 pages with a clean font audit', () => {
  const document = buildQuestionPaperDocument({
    blueprint: clone(FIXTURE_BLUEPRINT),
    paperType: clone(FIXTURE_PAPER_TYPE),
    layout: { mode: 'hybrid' },
  });

  assert.equal(document.estimated, true, 'no DOM measurer was supplied in this test');
  assert.equal(document.totalPages, 4);
  assert.deepEqual(document.pages.map(page => page.questionCount), [5, 6, 3, 1]);
  assert.equal(document.paperCode, 'T-1002');
  assert.equal(document.setLabel, '10-AT SET C');

  const audit = auditFontsInHtml(document.html);
  assert.equal(audit.valid, true, JSON.stringify(audit.issues));

  // Page 1 carries the header and the plain notes; later pages must not.
  const pageHtml = document.html.split('<section class="qp-page');
  assert.match(pageHtml[1], /qp-header/);
  assert.match(pageHtml[1], /qp-notes/);
  assert.doesNotMatch(pageHtml[2], /qp-header/);
  assert.doesNotMatch(pageHtml[2], /qp-notes/);

  // Every page carries the centred footer and no preview placeholder.
  pageHtml.slice(1).forEach(page => {
    assert.match(page, /qp-footer__page/);
    assert.doesNotMatch(page, /Preview/);
  });

  // The closing decoration sits on the final page.
  assert.match(pageHtml[pageHtml.length - 1], /qp-decoration/);
});

test('numbering, section ranges and page distribution agree with each other', () => {
  const document = buildQuestionPaperDocument({
    blueprint: clone(FIXTURE_BLUEPRINT),
    paperType: clone(FIXTURE_PAPER_TYPE),
    layout: { mode: 'hybrid' },
  });
  const rangesPerPage = document.pages.map(page => {
    const questionBlocks = page.blocks.filter(block => block.kind === 'question' && !block.continuationOf);
    const first = questionBlocks[0];
    const last = questionBlocks[questionBlocks.length - 1];
    return [first?.displayNumber, last?.endNumber];
  });
  assert.deepEqual(rangesPerPage, [[1, 5], [6, 11], [12, 14], [15, 15]]);
  assert.equal(document.sequence.sectionRanges['sec-1'].label, '1 முதல் 5 வரையுள்ள');
  assert.equal(document.sequence.sectionRanges['sec-2'].end, 11);
  assert.equal(document.diagnostics.fonts?.valid, true);
});

/* ------------------------------------------------------------------ */
/* Regressions for bugs found by the end-to-end PDF verification run.   */
/* ------------------------------------------------------------------ */

test('the font CSS is wrapped in a <style> element, never emitted as body text', () => {
  const document = buildQuestionPaperDocument({
    blueprint: clone(FIXTURE_BLUEPRINT),
    paperType: clone(FIXTURE_PAPER_TYPE),
    standalone: true,
  });

  assert.match(document.html, /^<!DOCTYPE html>/);
  // The raw @font-face text used to be placed directly in <body>, where the
  // browser rendered it as ~92px of visible text and pushed the paper onto a
  // 5th printed page.
  assert.doesNotMatch(document.html, /<body[^>]*>\s*@font-face/);
  const headEnd = document.html.indexOf('</head>');
  const firstStyle = document.html.indexOf('<style>', document.html.indexOf('<head>'));
  const bodyStart = document.html.indexOf('<body');
  const rootDiv = document.html.indexOf('<div class="qp-root', bodyStart);
  assert.ok(firstStyle > 0 && firstStyle < headEnd, 'print and font styles must be in the document head');
  assert.ok(rootDiv > bodyStart, 'paper pages must be inside the document body');
  assert.doesNotMatch(document.html.slice(bodyStart, rootDiv), /@font-face/);
  assert.match(document.html.slice(0, headEnd), /@page\s*\{\s*size:\s*A4 portrait;/);
});

test('four nonbreaking spaces used as tab indentation are removed from question text', () => {
  const blueprint = clone(FIXTURE_BLUEPRINT) as any;
  blueprint.items = [{ ...blueprint.items[0], questionText: '<p>&nbsp;&nbsp;&nbsp;&nbsp;வினா உரை</p>' }];
  const document = buildQuestionPaperDocument({ blueprint, paperType: clone(FIXTURE_PAPER_TYPE), standalone: true });
  assert.doesNotMatch(document.html, /(?:&(?:amp;)?nbsp;){4,}/i);
  assert.match(document.html, /வினா உரை/);
});

test('box-sizing is scoped to the paper so padded blocks stay inside the margins', () => {
  const document = buildQuestionPaperDocument({
    blueprint: clone(FIXTURE_BLUEPRINT),
    paperType: clone(FIXTURE_PAPER_TYPE),
  });

  // A nested .qp-root descendant requirement never matches, so .qp-notes
  // (border + 3mm padding) rendered 6.42mm wider than the content box.
  assert.match(document.css, /\.qp-root \*(?:[^{]*)\{[^}]*box-sizing:\s*border-box/);
  assert.doesNotMatch(document.css, /\.qp-root \.qp-root/);
  assert.match(document.css, /\.qp-page__footer\s*\{[^}]*margin-top:\s*auto/);
});

test('a section header is never left alone at the bottom of a page', () => {
  const document = buildQuestionPaperDocument({
    blueprint: clone(FIXTURE_BLUEPRINT),
    paperType: clone(FIXTURE_PAPER_TYPE),
    layout: { mode: 'hybrid' },
  });

  document.pages.forEach((page, index) => {
    const blocks = page.blocks;
    const last = blocks[blocks.length - 1];
    if (!last || last.kind !== 'section') return;
    const questionsAfter = blocks.filter(block => block.kind === 'question').length;
    assert.ok(
      questionsAfter > 0,
      `page ${index + 1} ends with a section header and no question (${last.id})`,
    );
  });

  // Every page that starts with a section must also carry one of its questions.
  document.pages.forEach((page, index) => {
    if (page.blocks[0]?.kind !== 'section') return;
    assert.ok(
      page.blocks.some(block => block.kind === 'question'),
      `page ${index + 1} opens with a section header but has no questions`,
    );
  });
});

test('a word-sun SVG is paginated using its diagram height instead of being clipped', () => {
  const blueprint = clone(FIXTURE_BLUEPRINT);
  blueprint.items = [
    {
      ...blueprint.items[0],
      id: 'word-sun',
      sectionId: 'sun-section',
      qNo: '1',
      marksPerQuestion: 5,
      totalMarks: 5,
      questionText: 'மைய எழுத்துடன் தொடர்புடைய சொற்களை எழுதுக.',
      questionContent: {
        type: 'word_sun',
        wordSun: {
          prompt: 'மைய எழுத்துடன் தொடர்புடைய சொற்களை எழுதுக.',
          centerText: 'அ',
          nodes: [
            { id: 'n1', text: 'அன்னை', position: 0 },
            { id: 'n2', text: 'அன்பு', position: 1 },
            { id: 'n3', text: 'அறம்', position: 2 },
            { id: 'n4', text: 'அழகு', position: 3 },
          ],
        },
      },
    },
  ];
  const paperType = {
    ...clone(FIXTURE_PAPER_TYPE),
    sections: [{ id: 'sun-section', marks: 5, count: 1, instruction: 'வினாவிற்கு விடையளி.' }],
  };
  const document = buildQuestionPaperDocument({ blueprint, paperType });

  assert.match(document.html, /சொற்சூரியனைப் பூர்த்தி செய்க./);
  assert.match(document.html, /<svg class="qp-structured-sun"/);
  assert.ok(document.pages.some(page => page.blocks.some(block => block.id.includes('word-sun'))));
  assert.ok(document.diagnostics.pages.every(page => page.overflowMm === 0));
});

test('page diagnostics report a real used height, not zero', () => {
  const document = buildQuestionPaperDocument({
    blueprint: clone(FIXTURE_BLUEPRINT),
    paperType: clone(FIXTURE_PAPER_TYPE),
    layout: { mode: 'hybrid' },
  });

  document.diagnostics.pages.forEach(entry => {
    assert.ok(entry.usedHeightMm > 0, `page ${entry.pageNumber} reported 0mm used`);
    assert.ok(entry.freeHeightMm > 0, `page ${entry.pageNumber} reported no free space`);
    assert.equal(entry.overflowMm, 0);
  });

  // The pages must not all claim to be empty.
  const distinct = new Set(document.diagnostics.pages.map(entry => entry.usedHeightMm));
  assert.ok(distinct.size > 1, 'every page reported an identical used height');
});
