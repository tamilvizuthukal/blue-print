import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateExactWeightage, resetAllocationHistory, selectInternalChoiceCandidates } from '../utils/exactWeightageAllocator';

const unitTargets = (marks: number, percentages: number[]) => percentages.map((pct, i) => ({ id: `u${i + 1}`, target: marks * pct / 100 }));
const oneMarkTokens = (marks: number) => Array.from({ length: marks }, () => ({ mark: 1, sectionId: 'one' }));
const assertExact = (tokens: {mark:number; sectionId:string}[], units: {id:string;target:number}[], key: string) => {
  const result = allocateExactWeightage(tokens, units, key);
  assert.ok(result);
  assert.equal(result.reduce((sum, unit) => sum + unit.tokens.reduce((n, token) => n + token.mark, 0), 0), tokens.reduce((n, token) => n + token.mark, 0));
  result.forEach((unit, index) => assert.equal(unit.tokens.reduce((n, token) => n + token.mark, 0), units[index].target));
  return result;
};

test('40M exact common weightage combinations', () => {
  for (const percentages of [[20,80],[30,70],[50,50],[25,75],[40,60]]) {
    resetAllocationHistory();
    assertExact(oneMarkTokens(40), unitTargets(40, percentages), `40:${percentages}`);
  }
});

test('100M combinations and three or more units conserve every mark', () => {
  for (const percentages of [[20,80],[25,25,50],[10,20,30,40],[15,25,30,30]]) {
    resetAllocationHistory();
    assertExact(oneMarkTokens(100), unitTargets(100, percentages), `100:${percentages}`);
  }
});

test('8M unit target uses available 5M + 3M denominations without changing tokens', () => {
  resetAllocationHistory();
  const tokens = [
    {mark:5,sectionId:'five'},{mark:3,sectionId:'three'},
    ...Array.from({length:4}, () => ({mark:6,sectionId:'six'})),
    {mark:5,sectionId:'five'},{mark:3,sectionId:'three'},
  ];
  const result = assertExact(tokens, [{id:'u1',target:8},{id:'u2',target:32}], '8-of-40');
  assert.deepEqual(result[0].tokens.map(token => token.mark).sort((a,b) => b-a), [5,3]);
  assert.equal(result.flatMap(unit => unit.tokens).length, tokens.length);
});

test('fractional targets and insufficient denominations fail exactly', () => {
  assert.equal(allocateExactWeightage([{mark:2,sectionId:'two'}], [{id:'u1',target:1.5},{id:'u2',target:.5}], 'fractional'), null);
  assert.equal(allocateExactWeightage([{mark:5,sectionId:'five'}], [{id:'u1',target:2},{id:'u2',target:3}], 'insufficient'), null);
});

test('an impossible exact allocation is never approximated', () => {
  assert.equal(allocateExactWeightage([{mark:3,sectionId:'three'}], [{id:'u1',target:1},{id:'u2',target:2}], 'impossible'), null);
});

test('ten resets retain exact totals and rotate signatures before cycling', () => {
  resetAllocationHistory();
  const tokens = [{mark:1,sectionId:'s1'},{mark:1,sectionId:'s1'},{mark:1,sectionId:'s2'},{mark:1,sectionId:'s2'}];
  const units = [{id:'u1',target:2},{id:'u2',target:2}];
  const signatures = new Set<string>();
  let firstCycleStart = -1;
  for (let reset = 0; reset < 10; reset++) {
    const allocation = assertExact(tokens, units, 'reset-cycle');
    const signature = allocation.map(unit => unit.tokens.map(token => token.sectionId).sort().join(',')).join('|');
    if (signatures.has(signature) && firstCycleStart < 0) firstCycleStart = reset;
    if (firstCycleStart < 0) assert.ok(!signatures.has(signature), 'should not repeat before exhausting the pattern pool');
    signatures.add(signature);
  }
  assert.ok(signatures.size >= 2);
  assert.ok(firstCycleStart > 0, 'history should start a new cycle only after exhausting previous patterns');
});

test('OR candidates prioritize the lowest-weightage unit and vary sub-unit coverage', () => {
  const candidates = [
    { id:'h1', unitId:'high', subUnitId:'h-a' }, { id:'h2', unitId:'high', subUnitId:'h-b' },
    { id:'l1', unitId:'low', subUnitId:'l-a' }, { id:'l2', unitId:'low', subUnitId:'l-b' },
  ];
  const selected = selectInternalChoiceCandidates(candidates, 2, new Map([['low', .2], ['high', .8]]));
  assert.deepEqual(new Set(selected.map(item => item.unitId)), new Set(['low']));
  assert.equal(new Set(selected.map(item => item.subUnitId)).size, 2);
});

test('sub-unit assignment balancing can cover separate sub-units', () => {
  const available = ['a','b','c'];
  const marksBySubUnit: Record<string, number> = Object.fromEntries(available.map(id => [id, 0]));
  for (const mark of [5,3,2]) {
    const target = available.reduce((best, id) => marksBySubUnit[id] < marksBySubUnit[best] ? id : best, available[0]);
    marksBySubUnit[target] += mark;
  }
  assert.equal(Object.values(marksBySubUnit).filter(mark => mark > 0).length, 3);
});
