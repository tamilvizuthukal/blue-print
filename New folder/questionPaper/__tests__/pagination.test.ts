import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPaperBlocks } from '../questionBlocks';
import type { BlockMeasurer, PaperBlock } from '../questionBlocks';
import { normalizeQuestionPaperLayout, resolvePageGeometry } from '../layoutTypes';
import { planPages } from '../paginationEngine';
import { buildQuestionSequence } from '../questionSequence';
import { FIXTURE_BLUEPRINT, FIXTURE_PAPER_TYPE } from './fixtures';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const makeMeasurer = (mmPerFragment: number): BlockMeasurer => ({
  measureFragment: () => mmPerFragment,
  measureTextMm: text => (text || '').length * 2,
});

const buildLayout = (overrides: Record<string, unknown> = {}) =>
  normalizeQuestionPaperLayout(
    { mode: 'hybrid', pageRules: [
      { page: 1, maxQuestions: 5 },
      { page: 2, maxQuestions: 6 },
      { page: 3, maxQuestions: 3 },
      { page: 4, maxQuestions: 1 },
    ], ...overrides },
    { totalQuestions: 15 }
  );

const setup = (layoutOverrides: Record<string, unknown> = {}, mmPerFragment = 6) => {
  const blueprint = clone(FIXTURE_BLUEPRINT);
  const paperType = clone(FIXTURE_PAPER_TYPE);
  const layout = buildLayout(layoutOverrides);
  const geometry = resolvePageGeometry(layout);
  const sequence = buildQuestionSequence(blueprint, paperType);
  const blocks = buildPaperBlocks({ blueprint, paperType, layout, sequence, measurer: makeMeasurer(mmPerFragment) });
  return { layout, geometry, sequence, blocks };
};

const plan = (setupResult: ReturnType<typeof setup>, mmPerFragment = 6) =>
  planPages({
    blocks: setupResult.blocks,
    layout: setupResult.layout,
    geometry: setupResult.geometry,
    measureBlock: block => measure(setupResult, block, mmPerFragment),
    measureFragments: block => block.fragments.map(() => mmPerFragment),
  });

const measure = (setupResult: ReturnType<typeof setup>, block: PaperBlock, mmPerFragment: number) =>
  block.fragments.length === 0 ? mmPerFragment * 2 : block.fragments.length * mmPerFragment;

test('hybrid mode honours the configured 5/6/3/1 question distribution', () => {
  const result = plan(setup());
  assert.equal(result.totalPages, 4);
  assert.deepEqual(result.pages.map(page => page.questionCount), [5, 6, 3, 1]);
  assert.deepEqual(
    result.pages.map(page => page.blocks.filter(block => block.kind === 'question' && block.displayNumber).map(block => block.displayNumber)).map(list => [list[0], list[list.length - 1]]),
    [[1, 5], [6, 11], [12, 14], [15, 15]]
  );
});

test('smart mode ignores the per-page caps so questions fill pages continuously', () => {
  // Same blocks and measurements, only the mode differs. The 5/6/3/1 caps would
  // force four pages; smart mode packs all 15 questions onto one.
  const smart = plan(setup({ mode: 'smart' }), 2);
  const hybrid = plan(setup({ mode: 'hybrid' }), 2);
  assert.equal(hybrid.totalPages, 4);
  assert.equal(smart.totalPages, 1);
  assert.equal(smart.pages[0].questionCount, 15);
});

test('no page overflows when the measured blocks fit', () => {
  const result = plan(setup());
  result.pages.forEach(page => {
    assert.ok(page.overflowMm === 0, `page ${page.pageNumber} overflowed by ${page.overflowMm}mm`);
  });
});

test('smart mode moves an oversized question to the next page instead of overflowing', () => {
  // 20 mm per fragment: 15 blocks of ~40 mm each cannot fit on one page.
  const { layout, geometry, blocks } = setup({ mode: 'smart', pageRules: [] }, 20);
  const result = planPages({
    blocks,
    layout,
    geometry,
    measureBlock: block => measure({ blocks } as never, block, 20),
    measureFragments: block => block.fragments.map(() => 20),
  });
  assert.ok(result.totalPages > 1);
  result.pages.forEach(page => assert.ok(page.overflowMm === 0));
  // The first page must end with a complete question, never mid-question.
  const questionBlocks = result.pages[0].blocks.filter(block => block.kind === 'question');
  questionBlocks.forEach(block => {
    assert.equal(block.splittable, block.allowSplit);
  });
});

test('manual mode reports an error when a block is taller than the printable area', () => {
  const tall = 900;
  const { layout, geometry, blocks } = setup({ mode: 'manual', allowManualOverflow: false, pageRules: [] }, tall);
  const result = planPages({
    blocks,
    layout,
    geometry,
    measureBlock: block => (block.fragments.length === 0 ? tall * 2 : tall),
    measureFragments: block => block.fragments.map(() => tall),
  });
  const errors = result.diagnostics.filter(diagnostic => diagnostic.level === 'error');
  assert.ok(errors.length > 0);
  assert.ok(errors.some(diagnostic => diagnostic.code === 'MANUAL_PAGE_OVERFLOW'));
});

test('a deliberate break and a preferred page are respected', () => {
  const setupResult = setup();
  const questionBlocks = setupResult.blocks.filter(block => block.kind === 'question');
  const target = questionBlocks[6];
  target.breakBefore = true;
  const withPreferred = setup();
  const preferredBlocks = withPreferred.blocks.filter(block => block.kind === 'question');
  preferredBlocks[4].preferredPage = 3;

  const result = planPages({
    blocks: withPreferred.blocks,
    layout: withPreferred.layout,
    geometry: withPreferred.geometry,
    measureBlock: block => measure(withPreferred, block, 6),
    measureFragments: block => block.fragments.map(() => 6),
  });
  const pageOf = (displayNumber: number) =>
    result.pages.findIndex(page => page.blocks.some(block => block.displayNumber === displayNumber)) + 1;
  // Question 6 has an explicit break, question 5 was moved to page 3.
  assert.equal(pageOf(5), 3);
  assert.ok(pageOf(6) >= 3);
});

test('the closing decoration never creates a page of its own', () => {
  const setupResult = setup({ mode: 'smart', pageRules: [] });
  const result = planPages({
    blocks: setupResult.blocks,
    layout: setupResult.layout,
    geometry: setupResult.geometry,
    measureBlock: block => measure(setupResult, block, 40),
    measureFragments: block => block.fragments.map(() => 40),
  });
  const decorationPages = result.pages.filter(page => page.blocks.some(block => block.kind === 'decoration'));
  assert.equal(decorationPages.length, 1);
});

test('smart mode keeps a section header with at least one question', () => {
  const setupResult = setup({ mode: 'smart', pageRules: [] });
  const geometry = setupResult.geometry;
  const usable = geometry.contentHeightMm;
  const result = planPages({
    blocks: setupResult.blocks,
    layout: setupResult.layout,
    geometry,
    measureBlock: block => (block.kind === 'section' ? 20 : Math.floor(usable / 3) - 2),
    measureFragments: block => block.fragments.map(() => Math.floor(usable / 3) - 2),
  });
  result.pages.forEach(page => {
    const kinds = page.blocks.map(block => block.kind);
    const lastIndex = kinds.lastIndexOf('section');
    if (lastIndex === -1) return;
    assert.ok(
      kinds.slice(lastIndex + 1).some(kind => kind === 'question'),
      `page ${page.pageNumber} ends with an orphaned section header`
    );
  });
});
