export interface AllocationToken { mark: number; sectionId: string; }
export interface AllocationUnit { id: string; target: number; }
export interface ExactAllocation { unitId: string; tokens: AllocationToken[]; }
export interface ChoiceCandidate { unitId: string; subUnitId: string; }

const usedSignatures = new Map<string, Set<string>>();
const shuffle = <T,>(values: T[]): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const keyFor = (tokens: AllocationToken[]) => tokens.map(t => `${t.sectionId}:${t.mark}`).sort().join(',');

/** Exact bounded subset search. Tokens are never split or duplicated. */
export function allocateExactWeightage(tokens: AllocationToken[], units: AllocationUnit[], cycleKey: string): ExactAllocation[] | null {
  if (units.some(u => !Number.isInteger(u.target) || u.target < 0) ||
      units.reduce((sum, u) => sum + u.target, 0) !== tokens.reduce((sum, t) => sum + t.mark, 0)) return null;
  const ordered = [...tokens].sort((a, b) => b.mark - a.mark);
  const buckets = units.map(() => [] as AllocationToken[]);
  const deficits = units.map(u => u.target);
  const seen = usedSignatures.get(cycleKey) || new Set<string>();
  let answer: ExactAllocation[] | null = null;
  const visit = (idx: number): boolean => {
    if (idx === ordered.length) {
      if (deficits.some(d => d !== 0)) return false;
      const signature = buckets.map(keyFor).join('|');
      if (seen.has(signature)) return false;
      answer = buckets.map((items, i) => ({ unitId: units[i].id, tokens: [...items] }));
      seen.add(signature); usedSignatures.set(cycleKey, seen);
      return true;
    }
    const token = ordered[idx];
    for (const i of shuffle(units.map((_, n) => n).filter(n => deficits[n] >= token.mark))) {
      deficits[i] -= token.mark; buckets[i].push(token);
      if (visit(idx + 1)) return true;
      buckets[i].pop(); deficits[i] += token.mark;
    }
    return false;
  };
  if (visit(0)) return answer;
  // Every exact partition was exhausted; start a fresh randomized cycle.
  seen.clear();
  return visit(0) ? answer : null;
}

export function resetAllocationHistory(): void { usedSignatures.clear(); }

export function selectInternalChoiceCandidates<T extends ChoiceCandidate>(items: T[], count: number, unitWeightages: Map<string, number>): T[] {
  const remaining = [...items];
  const selected: T[] = [];
  const usedSubUnits = new Set<string>();
  while (selected.length < count && remaining.length) {
    remaining.sort((a, b) => (unitWeightages.get(a.unitId) ?? 1) - (unitWeightages.get(b.unitId) ?? 1));
    const diverseIndex = remaining.findIndex(item => !usedSubUnits.has(item.subUnitId));
    const [choice] = remaining.splice(diverseIndex < 0 ? 0 : diverseIndex, 1);
    selected.push(choice);
    usedSubUnits.add(choice.subUnitId);
  }
  return selected;
}
