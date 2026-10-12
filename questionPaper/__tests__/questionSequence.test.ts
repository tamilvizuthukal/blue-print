import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQuestionSequence } from '../questionSequence';
import { FIXTURE_BLUEPRINT, FIXTURE_PAPER_TYPE, makeItem } from './fixtures';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const sequence = () => buildQuestionSequence(clone(FIXTURE_BLUEPRINT), clone(FIXTURE_PAPER_TYPE));

test('section order follows paperType.sections order even when marks are descending', () => {
  const blueprint = clone(FIXTURE_BLUEPRINT);
  const paperType = {
    ...clone(FIXTURE_PAPER_TYPE),
    sections: [...clone(FIXTURE_PAPER_TYPE.sections)].reverse(),
  };
  const result = buildQuestionSequence(blueprint, paperType);
  assert.deepEqual(
    result.sections.map(section => section.id),
    ['sec-3', 'sec-2', 'sec-1']
  );
  assert.deepEqual(
    result.sections.map(section => section.roman),
    ['I', 'II', 'III']
  );
});

test('display numbering is continuous and independent of the stored qNo', () => {
  const result = sequence();
  const printed: number[] = [];
  result.items.forEach(item => {
    for (let n = item.displayNumber; n <= item.endNumber; n += 1) printed.push(n);
  });
  assert.deepEqual(printed, Array.from({ length: result.totalQuestions }, (_, index) => index + 1));
  assert.equal(result.totalQuestions, 15);
  assert.equal(new Set(printed).size, printed.length, 'no duplicated printed numbers');
  // 14 stored items cover 15 printed questions because i12 spans two numbers.
  assert.equal(result.totalNumberedItems, 14);
});

test('questionCount consumes several numbers; internal choice consumes exactly one', () => {
  const result = sequence();
  const multi = result.items.find(item => item.itemId === 'i12');
  const choice = result.items.find(item => item.itemId === 'i7');
  assert.ok(multi);
  assert.ok(choice);
  assert.equal(multi.questionCount, 2);
  assert.equal(multi.endNumber, multi.displayNumber + 1);
  assert.equal(choice.questionCount, 1);
  assert.equal(choice.endNumber, choice.displayNumber);
  assert.equal(choice.hasInternalChoice, true);
});

test('duplicate, missing and invalid stored qNo values produce warnings, never gaps', () => {
  const result = sequence();
  const types = result.warnings.map(warning => warning.type);
  assert.ok(types.includes('DUPLICATE_QNO'));
  assert.ok(types.includes('MISSING_QNO'));
  assert.ok(types.includes('INVALID_QNO'));
  const last = result.items[result.items.length - 1];
  assert.equal(last.endNumber, 15);
});

test('section range labels are derived from the display numbers', () => {
  const result = sequence();
  const section1 = result.sections[0];
  const section2 = result.sections[1];
  assert.equal(section1.rangeStart, 1);
  assert.equal(section1.rangeLabel, '1 முதல் 5 வரையுள்ள');
  assert.equal(section2.rangeStart, 6);
  assert.equal(section2.rangeLabel, '6 முதல் 11 வரையுள்ள');
  assert.equal(result.sections[2].rangeStart, 12);
  assert.equal(result.sections[2].rangeEnd, 15);
  assert.equal(result.sections[2].rangeLabel, '12 முதல் 15 வரையுள்ள');
});

test('items that belong to no section are appended and reported', () => {
  const blueprint = clone(FIXTURE_BLUEPRINT);
  blueprint.items.push(makeItem({ id: 'x1', sectionId: 'sec-missing', qNo: '99' }));
  const result = buildQuestionSequence(blueprint, clone(FIXTURE_PAPER_TYPE));
  const unmatched = result.sections[result.sections.length - 1];
  assert.equal(unmatched.isUnmatched, true);
  assert.equal(unmatched.items.length, 1);
  assert.ok(result.warnings.some(warning => warning.type === 'UNMATCHED_SECTION_ITEM'));
});

test('a section count mismatch is reported but does not renumber anything', () => {
  const paperType = clone(FIXTURE_PAPER_TYPE);
  paperType.sections[0].count = 4;
  const result = buildQuestionSequence(clone(FIXTURE_BLUEPRINT), paperType);
  assert.ok(result.warnings.some(warning => warning.type === 'SECTION_COUNT_MISMATCH'));
  assert.equal(result.items[0].displayNumber, 1);
  assert.equal(result.items[result.items.length - 1].endNumber, 15);
});

test('items with no stored qNo are ordered after numbered items, keeping array order', () => {
  const blueprint = clone(FIXTURE_BLUEPRINT);
  const section1 = blueprint.items.filter(item => item.sectionId === 'sec-1');
  section1.forEach(item => {
    delete item.qNo;
  });
  const result = buildQuestionSequence(blueprint, clone(FIXTURE_PAPER_TYPE));
  const firstSectionItems = result.sections[0].items;
  assert.deepEqual(
    firstSectionItems.map(item => item.itemId),
    ['i1', 'i2', 'i3', 'i4', 'i5']
  );
});
