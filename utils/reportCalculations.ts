
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

    // 2. Sort by Unit number/order
    const unitA = unitOrderMap.get(a.unitId) ?? 999;
    const unitB = unitOrderMap.get(b.unitId) ?? 999;
    if (unitA !== unitB) return unitA - unitB;

    // 3. Sort by Sub-unit index
    const subUnitA = subUnitOrderMap.get(a.subUnitId) ?? 999;
    const subUnitB = subUnitOrderMap.get(b.subUnitId) ?? 999;
    if (subUnitA !== subUnitB) return subUnitA - subUnitB;

    // 4. Stable fallback using item ID
    return a.id.localeCompare(b.id);
  });
}

