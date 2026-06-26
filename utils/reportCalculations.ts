
import { BlueprintItem, Curriculum, QuestionPaperType } from '../types';

export function getTermTamilMap(): Record<string, string> {
  return {
    'First Term Summative':   'முதல் பருவ தொகுத்தறி மதிப்பீடு',
    'Second Term Summative':  'இரண்டாம் பருவ தொகுத்தறி மதிப்பீடு',
    'Third Term Summative':   'மூன்றாம் பருவ தொகுத்தறி மதிப்பீடு',
    'First Term Formative':   'முதல் பருவ உருவாக்க மதிப்பீடு',
    'Second Term Formative':  'இரண்டாம் பருவ உருவாக்க மதிப்பீடு',
    'Annual Examination':     'ஆண்டு இறுதித் தேர்வு',
  };
}

export function sortBlueprintItems(
  items: BlueprintItem[],
  curriculum: Curriculum | null,
  paperType?: QuestionPaperType
): BlueprintItem[] {
  // 1. Build unit index map
  const unitOrderMap = new Map<string, number>();
  const subUnitOrderMap = new Map<string, number>();
  if (curriculum) {
    curriculum.units.forEach((u, uIdx) => {
      unitOrderMap.set(u.id, u.unitNumber ?? uIdx);
      u.subUnits.forEach((su, suIdx) => {
        subUnitOrderMap.set(su.id, suIdx);
      });
    });
  }

  // 2. Build section index map
  const sectionIndexMap = new Map<string, number>();
  if (paperType) {
    paperType.sections.forEach((s, idx) => {
      sectionIndexMap.set(s.id, idx);
    });
  }

  return [...items].sort((a, b) => {
    // 1. Sort by Section (using paperType sections order if available, else marksPerQuestion)
    const idxA = a.sectionId && sectionIndexMap.has(a.sectionId) ? sectionIndexMap.get(a.sectionId)! : 999;
    const idxB = b.sectionId && sectionIndexMap.has(b.sectionId) ? sectionIndexMap.get(b.sectionId)! : 999;
    if (idxA === 999 || idxB === 999) {
      if (a.marksPerQuestion !== b.marksPerQuestion) {
        return a.marksPerQuestion - b.marksPerQuestion;
      }
    } else if (idxA !== idxB) {
      return idxA - idxB;
    }

    // 2. Sort by static qNo if available
    const qA = a.qNo ? String(a.qNo).trim() : '';
    const qB = b.qNo ? String(b.qNo).trim() : '';
    if (qA || qB) {
      if (qA && !qB) return -1;
      if (!qA && qB) return 1;
      const cmp = qA.localeCompare(qB, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }

    // 3. Sort by Unit number/order
    const unitA = unitOrderMap.get(a.unitId) ?? 999;
    const unitB = unitOrderMap.get(b.unitId) ?? 999;
    if (unitA !== unitB) return unitA - unitB;

    // 4. Sort by Sub-unit index
    const subUnitA = subUnitOrderMap.get(a.subUnitId) ?? 999;
    const subUnitB = subUnitOrderMap.get(b.subUnitId) ?? 999;
    if (subUnitA !== subUnitB) return subUnitA - subUnitB;

    // 5. Stable fallback using original array order
    return items.indexOf(a) - items.indexOf(b);
  });
}

/**
 * Ensures all items in a blueprint have a stable `qNo` assigned.
 * If any item is missing `qNo`, we strip all qNo and generate them
 * sequentially in unit/subunit order.
 */
export function ensureBlueprintItemsHaveQNo(
  items: BlueprintItem[],
  curriculum: Curriculum | null,
  paperType?: QuestionPaperType
): BlueprintItem[] {
  // If all items have qNo, just return
  const needsQNo = items.some(item => !item.qNo);
  if (!needsQNo) return items;

  // We should assign a sequential number only to items that don't have one
  // But wait, the computed map logic handles this already!
  // Let's just do a clean sort and assign numbers sequentially to empty ones.
  const sorted = sortBlueprintItems(items, curriculum, paperType);
  let currentStartNumber = 1;

  return sorted.map((item) => {
    if (item.qNo) {
      return item; // Keep the manual one
    } else {
      const qNo = String(currentStartNumber);
      currentStartNumber += item.questionCount || 1;
      return {
        ...item,
        qNo
      };
    }
  });
}

