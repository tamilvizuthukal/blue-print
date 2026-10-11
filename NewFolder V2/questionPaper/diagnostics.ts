/**
 * questionPaper/diagnostics.ts
 * ---------------------------------------------------------------------------
 * Every problem found while building a paper is reported here instead of being
 * swallowed. The Mass View shows the list; the export endpoint returns it; the
 * regression tests assert on it.
 */

import type { FontAuditResult } from './typography';
import { auditFontsInHtml } from './typography';
import type { SequenceWarning } from './questionSequence';
import type { PlannedPage } from './paginationEngine';

export type DiagnosticLevel = 'info' | 'warning' | 'error';

export interface PaginationDiagnostic {
  level: DiagnosticLevel;
  code: string;
  message: string;
  page?: number;
  blockId?: string;
  questionNumber?: number;
  overflowMm?: number;
}

export interface QuestionPaperDiagnostics {
  level: DiagnosticLevel;
  sequence: SequenceWarning[];
  pagination: PaginationDiagnostic[];
  fonts: FontAuditResult | null;
  fontReadiness: { ready: boolean; missing: string[] } | null;
  pages: Array<{
    pageNumber: number;
    questionCount: number;
    usedHeightMm: number;
    freeHeightMm: number;
    overflowMm: number;
  }>;
  summary: string;
}

const LEVEL_ORDER: Record<DiagnosticLevel, number> = { info: 0, warning: 1, error: 2 };

export function worstLevel(levels: DiagnosticLevel[]): DiagnosticLevel {
  return levels.reduce<DiagnosticLevel>(
    (worst, level) => (LEVEL_ORDER[level] > LEVEL_ORDER[worst] ? level : worst),
    'info'
  );
}

export function buildQuestionPaperDiagnostics(input: {
  sequenceWarnings: SequenceWarning[];
  paginationDiagnostics: PaginationDiagnostic[];
  pages: PlannedPage[];
  html?: string;
  fontReadiness?: { ready: boolean; missing: string[] } | null;
}): QuestionPaperDiagnostics {
  const { sequenceWarnings, paginationDiagnostics, pages, html, fontReadiness } = input;
  const fonts = html ? auditFontsInHtml(html) : null;

  const level = worstLevel([
    ...sequenceWarnings.map(warning => (SEQUENCE_LEVEL[warning.type] || 'warning') as DiagnosticLevel),
    ...paginationDiagnostics.map(diagnostic => diagnostic.level),
    ...(fonts && !fonts.valid ? (['error'] as DiagnosticLevel[]) : []),
    ...(fontReadiness && !fontReadiness.ready ? (['error'] as DiagnosticLevel[]) : []),
  ]);

  const errorCount =
    sequenceWarnings.filter(warning => (SEQUENCE_LEVEL[warning.type] || 'warning') === 'error').length +
    paginationDiagnostics.filter(diagnostic => diagnostic.level === 'error').length +
    (fonts && !fonts.valid ? fonts.issues.length : 0) +
    (fontReadiness && !fontReadiness.ready ? 1 : 0);
  const warningCount =
    sequenceWarnings.filter(warning => (SEQUENCE_LEVEL[warning.type] || 'warning') === 'warning').length +
    paginationDiagnostics.filter(diagnostic => diagnostic.level === 'warning').length;

  return {
    level,
    sequence: sequenceWarnings,
    pagination: paginationDiagnostics,
    fonts,
    fontReadiness: fontReadiness ?? null,
    pages: pages.map(page => ({
      pageNumber: page.pageNumber,
      questionCount: page.questionCount,
      usedHeightMm: page.usedHeightMm,
      freeHeightMm: page.freeHeightMm,
      overflowMm: page.overflowMm,
    })),
    summary: `${pages.length} page(s), ${errorCount} error(s), ${warningCount} warning(s)`,
  };
}

const SEQUENCE_LEVEL: Record<string, DiagnosticLevel> = {
  DUPLICATE_QNO: 'warning',
  MISSING_QNO: 'info',
  INVALID_QNO: 'warning',
  UNMATCHED_SECTION_ITEM: 'warning',
  PAPER_TYPE_MISSING: 'warning',
  EMPTY_SECTION: 'info',
  SECTION_COUNT_MISMATCH: 'warning',
  QUESTION_COUNT_INVALID: 'warning',
  MISSING_QUESTION_TEXT: 'warning',
  MISSING_CHOICE_TEXT_B: 'warning',
};

export function formatDiagnosticsForUser(diagnostics: QuestionPaperDiagnostics): string {
  const lines: string[] = [diagnostics.summary];
  diagnostics.sequence.forEach(warning => lines.push(`• [${warning.type}] ${warning.message}`));
  diagnostics.pagination.forEach(diagnostic => {
    const where = diagnostic.page ? ` (page ${diagnostic.page})` : '';
    lines.push(`• [${diagnostic.code}]${where} ${diagnostic.message}`);
  });
  if (diagnostics.fonts && !diagnostics.fonts.valid) {
    diagnostics.fonts.issues.forEach(issue =>
      lines.push(`• [FONT] ${issue.family} (${issue.reason}) at ${issue.where}`)
    );
  }
  if (diagnostics.fontReadiness && !diagnostics.fontReadiness.ready) {
    lines.push(`• [FONT] Not loaded in this environment: ${diagnostics.fontReadiness.missing.join(', ')}`);
  }
  return lines.join('\n');
}
