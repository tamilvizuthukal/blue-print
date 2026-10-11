import { ExamTerm } from '../types';

export interface DefaultExamSelection {
    examTerm: ExamTerm;
    academicYear: string;
}

/** School academic year runs from June through May. */
export const getDefaultExamSelection = (date = new Date()): DefaultExamSelection => {
    const month = date.getMonth();
    const year = date.getFullYear();

    if (month >= 5 && month <= 8) {
        return { examTerm: ExamTerm.FIRST, academicYear: `${year}-${String(year + 1).slice(-2)}` };
    }

    if (month >= 9) {
        return { examTerm: ExamTerm.SECOND, academicYear: `${year}-${String(year + 1).slice(-2)}` };
    }

    return { examTerm: ExamTerm.THIRD, academicYear: `${year - 1}-${String(year).slice(-2)}` };
};

export const normalizeAcademicYear = (academicYear: string) =>
    academicYear.replace(/^(\d{4})-(\d{2}|\d{4})$/, (_match, start: string, end: string) => `${start}-${end.slice(-2)}`);

export const getExamSelectionKey = (examTerm: string, academicYear: string) =>
    `${examTerm}|${normalizeAcademicYear(academicYear)}`;
