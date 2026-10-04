/**
 * Shared fixtures for the question paper tests.
 * Mirrors a real 10th-standard Tamil paper: 15 questions, 3 sections,
 * duplicated/missing stored qNos, one internal choice, one MCQ.
 */

import type { Blueprint, BlueprintItem, QuestionPaperType } from '../../types';

export const makeItem = (overrides: Partial<BlueprintItem> & { id: string }): BlueprintItem =>
  ({
    unitId: 'u1',
    subUnitId: 's1',
    knowledgeLevel: 'Basic' as BlueprintItem['knowledgeLevel'],
    cognitiveProcess: 'CP1' as BlueprintItem['cognitiveProcess'],
    itemFormat: 'SR1 (MCI)' as BlueprintItem['itemFormat'],
    questionCount: 1,
    marksPerQuestion: 1,
    totalMarks: 1,
    questionText: '<p>கேள்வி</p>',
    ...overrides,
  }) as BlueprintItem;

export const FIXTURE_PAPER_TYPE: QuestionPaperType = {
  id: 'pt-10-at',
  name: '10th Tamil AT',
  totalMarks: 100,
  description: 'fixture',
  sections: [
    {
      id: 'sec-1',
      marks: 1,
      count: 5,
      optionCount: 5,
      instruction: 'அகக்கும் சரியாக விடையளிக்கும்.',
    },
    {
      id: 'sec-2',
      marks: 2,
      count: 6,
      optionCount: 1,
      instruction: 'கீழ்க்கண்ட வினாக்களுக்கு விடையளி.',
    },
    {
      id: 'sec-3',
      marks: 5,
      count: 4,
      optionCount: 0,
      instruction: 'விரிவாக விடையளி.',
    },  ],
};

export const FIXTURE_BLUEPRINT: Blueprint = {
  id: 'bp-10-at-set-c',
  examTerm: 'First Term Summative' as Blueprint['examTerm'],
  classLevel: 10 as Blueprint['classLevel'],
  subject: 'Tamil AT' as Blueprint['subject'],
  questionPaperTypeId: FIXTURE_PAPER_TYPE.id,
  questionPaperTypeName: FIXTURE_PAPER_TYPE.name,
  totalMarks: 50,
  createdAt: '2026-06-01T00:00:00.000Z',
  setId: 'SET C',
  academicYear: '2026-27',
  items: [
    // Section I: 5 MCQs. Stored qNo values are duplicated on purpose (1, 1, 1, 2, 2).
    makeItem({
      id: 'i1',
      sectionId: 'sec-1',
      qNo: '1',
      questionText:
        '<p>இலங்கை தமிழ் பாடத்தின் முதல் பாடம் எது?</p><p>அ) கலைமாமுரை</p><p>ஆ) கம்பளி</p><p>இ) சுவையொன்று</p><p>ஈ) பார்த்திப்பூ</p>',
      itemFormat: 'SR1 (MCI)' as BlueprintItem['itemFormat'],
    }),
    makeItem({ id: 'i2', sectionId: 'sec-1', qNo: '1', questionText: '<p>இரண்டாவது வினா</p>' }),
    makeItem({ id: 'i3', sectionId: 'sec-1', questionText: '<p>மூன்றாவது வினா</p>' }), // missing qNo
    makeItem({ id: 'i4', sectionId: 'sec-1', qNo: '2', questionText: '<p>நான்காம் வினா</p>' }),
    makeItem({ id: 'i5', sectionId: 'sec-1', qNo: 'Q# 2', questionText: '<p>ஐந்தாவது வினா</p>' }),

    // Section II: 6 questions; i7 is an internal choice, i9 spans 3 questions.
    makeItem({
      id: 'i6',
      sectionId: 'sec-2',
      qNo: '3',
      marksPerQuestion: 2,
      totalMarks: 2,
      itemFormat: 'CRS1 (VSA)' as BlueprintItem['itemFormat'],
      questionText: '<p>ஆறாம் வினா</p>',
    }),
    makeItem({
      id: 'i7',
      sectionId: 'sec-2',
      qNo: '4',
      marksPerQuestion: 2,
      totalMarks: 2,
      hasInternalChoice: true,
      questionText: '<p>எழாம் வினா - தெரிவு அ</p>',
      questionTextB: '<p>எழாம் வினா - தெரிவு ஆ</p>',
    }),
    makeItem({
      id: 'i8',
      sectionId: 'sec-2',
      qNo: '5',
      marksPerQuestion: 2,
      totalMarks: 2,
      questionText: '<p>எட்டாம் வினா</p>',
    }),
    makeItem({
      id: 'i9',
      sectionId: 'sec-2',
      qNo: '6',
      marksPerQuestion: 2,
      totalMarks: 2,
      questionText: '<p>ஒன்பதாம் வினா</p>',
    }),
    makeItem({
      id: 'i10',
      sectionId: 'sec-2',
      qNo: '7',
      marksPerQuestion: 2,
      totalMarks: 2,
      questionText: '<p>பதாம் வினா</p>',
    }),
    makeItem({
      id: 'i11',
      sectionId: 'sec-2',
      qNo: 'abc',
      marksPerQuestion: 2,
      totalMarks: 2,
      questionText: '<p>பதினொன்றாம் வினா</p>',
    }),

    // Section III: 3 long answers worth 4 questions in total (i12 spans two).
    makeItem({
      id: 'i12',
      sectionId: 'sec-3',
      qNo: '9',
      questionCount: 2,
      marksPerQuestion: 5,
      totalMarks: 5,
      itemFormat: 'CRS2 (SA)' as BlueprintItem['itemFormat'],
      questionText: '<p>பன்னிரண்டாவது வினா</p>',
      time: 12,
    }),
    makeItem({
      id: 'i13',
      sectionId: 'sec-3',
      qNo: '10',
      marksPerQuestion: 5,
      totalMarks: 5,
      questionText: '<p>பதின்மூன்றாவது வினா</p>',
    }),
    makeItem({
      id: 'i14',
      sectionId: 'sec-3',
      qNo: '11',
      marksPerQuestion: 5,
      totalMarks: 5,
      questionText: '<p>பதினாவது வினா</p>',
    }),
  ],
} as Blueprint;

export const fixtureBlueprints = () =>
  JSON.parse(JSON.stringify({ blueprint: FIXTURE_BLUEPRINT, paperType: FIXTURE_PAPER_TYPE }));
