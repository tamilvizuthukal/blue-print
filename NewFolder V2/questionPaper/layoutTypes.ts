/**
 * questionPaper/layoutTypes.ts
 * ---------------------------------------------------------------------------
 * Canonical layout configuration for the question paper compositor.
 *
 * One schema, one place. Browser Mass View, the pagination engine and the
 * server-side PDF exporter all read and write THIS shape, which is persisted
 * per blueprint (per question paper) as `blueprint.questionPaperLayout`.
 *
 * Units: millimetres (mm) for geometry/spacing, points (pt) for typography.
 */

import type { Blueprint, BlueprintItem, QuestionPaperType } from '../types';

export const LAYOUT_SCHEMA_VERSION = 2;

export type QuestionPaperLayoutMode = 'smart' | 'hybrid' | 'manual';
export type QuestionPaperOrientation = 'portrait' | 'landscape';

/** A4 in millimetres (ISO 216). */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export interface QuestionPaperMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface QuestionPaperTypography {
  /** Tamil body face. Only semantic family names are allowed. */
  bodyFontFamily: string;
  /** pt */
  bodyFontSize: number;
  /** unitless multiplier */
  bodyLineHeight: number;
  /** Section / title heading face. */
  headingFontFamily: string;
  /** pt */
  headingFontSize: number;
  /** Latin / English face. */
  englishFontFamily: string;
}

export interface QuestionPaperPageRule {
  page: number;
  /** Maximum number of numbered questions on this page. */
  maxQuestions?: number;
  /** Spacing after each question on this page (mm). */
  spacing?: number;
}

export interface QuestionPaperQuestionOverride {
  breakBefore?: boolean;
  keepTogether?: boolean;
  allowSplit?: boolean;
  /** mm */
  spacingBefore?: number;
  /** mm */
  spacingAfter?: number;
  /** Unitless line-height multiplier. */
  lineHeight?: number;
  /** 1-based page number, or undefined for "Auto". */
  preferredPage?: number;
}

export interface QuestionPaperSmartOptions {
  avoidOrphans: boolean;
  optimizePageFill: boolean;
  allowLongQuestionSplit: boolean;
}

export interface QuestionPaperFooterSettings {
  showPaperCode: boolean;
  showPageNumber: boolean;
  /** 'bottom' keeps the rule above the row, matching the official paper. */
  style: 'rule-and-row';
}

export interface QuestionPaperLayout {
  version: number;
  mode: QuestionPaperLayoutMode;
  pageSize: 'A4';
  orientation: QuestionPaperOrientation;
  margins: QuestionPaperMargins;
  typography: QuestionPaperTypography;
  /** mm between questions */
  questionSpacing: number;
  /** mm above a section header */
  sectionSpacing: number;
  pageRules: QuestionPaperPageRule[];
  questionOverrides: Record<string, QuestionPaperQuestionOverride>;
  smart: QuestionPaperSmartOptions;
  footer: QuestionPaperFooterSettings;
  /** First-page-only official header. */
  showHeader: boolean;
  /** Plain notes block on page 1. */
  showNotes: boolean;
  /** Optional running header on pages 2+. Off by default (reference style). */
  runningHeader: boolean;
  /** Manual mode: keep the configured question caps even if it means splitting. */
  allowManualOverflow: boolean;
}

export interface PageGeometry {
  pageWidthMm: number;
  pageHeightMm: number;
  contentWidthMm: number;
  /** Height available for blocks, excluding the footer band. */
  contentHeightMm: number;
  footerHeightMm: number;
  margins: QuestionPaperMargins;
}

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

const clampBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const MODES: QuestionPaperLayoutMode[] = ['smart', 'hybrid', 'manual'];

/**
 * Geometry and typography are calibrated against the official 4-page A4
 * reference paper (public/10-AT_SET-A_Type-1.pdf): 25 mm side margins, ~12 pt
 * Tamil body, plain notes block, no running header, footer rule + paper code +
 * page number.
 *
 * Pagination defaults to `smart`: questions flow into the available space so a
 * page is never closed while it still has room. The 5/6/3/1 per-page caps remain
 * available as a preset via the `hybrid` mode (see `defaultPageRulesForQuestionCount`).
 */
export const DEFAULT_QUESTION_PAPER_LAYOUT: QuestionPaperLayout = {
  version: LAYOUT_SCHEMA_VERSION,
  mode: 'smart',
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 20, right: 25, bottom: 18, left: 25 },
  typography: {
    bodyFontFamily: 'TAU-Paalai',
    bodyFontSize: 12,
    bodyLineHeight: 1.6,
    headingFontFamily: 'TAU-Urai',
    headingFontSize: 13,
    englishFontFamily: 'Times New Roman',
  },
  questionSpacing: 4,
  sectionSpacing: 5,
  pageRules: [],
  questionOverrides: {},
  smart: {
    avoidOrphans: true,
    optimizePageFill: true,
    allowLongQuestionSplit: true,
  },
  footer: { showPaperCode: true, showPageNumber: true, style: 'rule-and-row' },
  showHeader: true,
  showNotes: true,
  runningHeader: false,
  allowManualOverflow: true,
};

/** Paper code table used by the footer and header code box. */
const PAPER_CODE_MAP: Record<string, string> = {
  '8-AT': '802',
  '8-BT': '812',
  '9-AT': '902',
  '9-BT': '912',
  '10-AT': '1002',
  '10-BT': '1012',
  'SSLC-AT': '1102',
  'SSLC-BT': '1112',
};

export function resolvePaperCode(blueprint: Partial<Blueprint> | null | undefined): string {
  if (!blueprint) return '';
  const subjectText = typeof blueprint.subject === 'string' ? blueprint.subject : '';
  const subject = subjectText.toUpperCase().includes('BT') ? 'BT' : 'AT';
  const classLevel = blueprint.classLevel as unknown as string;
  const key = `${classLevel}-${subject}`;
  const base = PAPER_CODE_MAP[key] || `${classLevel}${subject === 'AT' ? '02' : '12'}`;
  return `T-${base}`;
}

export function resolveSetLabel(blueprint: Partial<Blueprint> | null | undefined): string {
  if (!blueprint) return '';
  const subjectText = typeof blueprint.subject === 'string' ? blueprint.subject : '';
  const subject = subjectText.toUpperCase().includes('BT') ? 'BT' : 'AT';
  const setId = (blueprint.setId || 'A').replace(/^SET\s+/i, '').trim();
  if (/^GENERAL$/i.test(setId)) return 'GENERAL SET';
  const letter = setId.charAt(0).toUpperCase() || 'A';
  const classLevel = blueprint.classLevel as unknown as string;
  return `${classLevel === 'SSLC' ? 'SSLC' : classLevel}-${subject} SET ${letter}`;
}

/**
 * Default page rules reproduce the reference rhythm for a 15-question paper:
 * 5 / 6 / 3 / 1 questions per page.
 */
export function defaultPageRulesForQuestionCount(totalQuestions: number): QuestionPaperPageRule[] {
  const canonical = [5, 6, 3, 1];
  if (totalQuestions <= 0) return [];
  if (totalQuestions === 15) {
    return canonical.map((count, index) => ({ page: index + 1, maxQuestions: count }));
  }
  // Generic fallback: distribute as evenly as possible over four pages.
  const perPage = Math.max(1, Math.ceil(totalQuestions / 4));
  const rules: QuestionPaperPageRule[] = [];
  let remaining = totalQuestions;
  let page = 1;
  while (remaining > 0) {
    const take = Math.min(perPage, remaining);
    rules.push({ page, maxQuestions: take });
    remaining -= take;
    page += 1;
  }
  return rules;
}

export function resolvePageGeometry(layout: QuestionPaperLayout): PageGeometry {
  const isLandscape = layout.orientation === 'landscape';
  const pageWidthMm = isLandscape ? A4_HEIGHT_MM : A4_WIDTH_MM;
  const pageHeightMm = isLandscape ? A4_WIDTH_MM : A4_HEIGHT_MM;
  const margins = layout.margins;
  const contentWidthMm = Math.max(10, pageWidthMm - margins.left - margins.right);
  const rawContentHeightMm = Math.max(10, pageHeightMm - margins.top - margins.bottom);
  const footerHeightMm = layout.footer.showPaperCode || layout.footer.showPageNumber ? 8 : 0;
  const contentHeightMm = Math.max(10, rawContentHeightMm - footerHeightMm);
  return {
    pageWidthMm,
    pageHeightMm,
    contentWidthMm,
    contentHeightMm,
    footerHeightMm,
    margins,
  };
}

const normalizePageRules = (raw: unknown, fallback: QuestionPaperPageRule[]): QuestionPaperPageRule[] => {
  if (!Array.isArray(raw)) return fallback;
  const rules: QuestionPaperPageRule[] = [];
  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    const page = Number(record.page ?? index + 1);
    if (!Number.isFinite(page) || page < 1) return;
    const rule: QuestionPaperPageRule = { page: Math.round(page) };
    if (record.maxQuestions !== undefined && record.maxQuestions !== null && record.maxQuestions !== '') {
      rule.maxQuestions = Math.max(1, Math.round(clampNumber(record.maxQuestions, 1, 100, 1)));
    }
    if (record.spacing !== undefined && record.spacing !== null && record.spacing !== '') {
      rule.spacing = clampNumber(record.spacing, 0, 30, DEFAULT_QUESTION_PAPER_LAYOUT.questionSpacing);
    }
    rules.push(rule);
  });
  rules.sort((a, b) => a.page - b.page);
  return rules;
};

const normalizeOverrides = (raw: unknown): Record<string, QuestionPaperQuestionOverride> => {
  const result: Record<string, QuestionPaperQuestionOverride> = {};
  if (!raw || typeof raw !== 'object') return result;
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const override: QuestionPaperQuestionOverride = {};
    if (typeof record.breakBefore === 'boolean') override.breakBefore = record.breakBefore;
    if (typeof record.keepTogether === 'boolean') override.keepTogether = record.keepTogether;
    if (typeof record.allowSplit === 'boolean') override.allowSplit = record.allowSplit;
    if (record.spacingBefore !== undefined && record.spacingBefore !== null && record.spacingBefore !== '') {
      override.spacingBefore = clampNumber(record.spacingBefore, 0, 40, 0);
    }
    if (record.spacingAfter !== undefined && record.spacingAfter !== null && record.spacingAfter !== '') {
      override.spacingAfter = clampNumber(record.spacingAfter, 0, 40, DEFAULT_QUESTION_PAPER_LAYOUT.questionSpacing);
    }
    if (record.lineHeight !== undefined && record.lineHeight !== null && record.lineHeight !== '') {
      override.lineHeight = clampNumber(record.lineHeight, 1, 2.5, DEFAULT_QUESTION_PAPER_LAYOUT.typography.bodyLineHeight);
    }
    if (record.preferredPage !== undefined && record.preferredPage !== null && record.preferredPage !== '') {
      const page = Number(record.preferredPage);
      if (Number.isFinite(page) && page >= 1) override.preferredPage = Math.round(page);
    }
    if (Object.keys(override).length > 0) result[key] = override;
  });
  return result;
};

/**
 * Legacy migration. Accepts anything the app may have persisted before v2:
 *  - `reportSettings` / `perReportSettings.questionPaper` (old shared report config)
 *  - flat page-count settings written by earlier Mass View builds
 * and always returns a complete, valid v2 layout.
 */
export function normalizeQuestionPaperLayout(
  raw: unknown,
  hints: { totalQuestions?: number; defaultMode?: QuestionPaperLayoutMode } = {}
): QuestionPaperLayout {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const defaults = DEFAULT_QUESTION_PAPER_LAYOUT;
  const legacySettings = source.reportSettings && typeof source.reportSettings === 'object'
    ? source.reportSettings
    : (source.perReportSettings && typeof source.perReportSettings === 'object'
      ? (source.perReportSettings.questionPaper || source.perReportSettings.report1 || {})
      : {});

  const mode = MODES.includes(source.mode) ? source.mode : (hints.defaultMode || defaults.mode);

  const marginsSource = source.margins && typeof source.margins === 'object' ? source.margins : {};
  const margins: QuestionPaperMargins = {
    top: clampNumber(marginsSource.top, 5, 40, defaults.margins.top),
    right: clampNumber(marginsSource.right, 5, 40, defaults.margins.right),
    bottom: clampNumber(marginsSource.bottom, 5, 40, defaults.margins.bottom),
    left: clampNumber(marginsSource.left, 5, 40, defaults.margins.left),
  };

  const typographySource = source.typography && typeof source.typography === 'object' ? source.typography : {};
  const legacyFontSize = Number(legacySettings.fontSizeTamil ?? legacySettings.fontSizeBody ?? 0);
  const legacyLineHeight = Number(legacySettings.lineHeight ?? 0);
  const typography: QuestionPaperTypography = {
    bodyFontFamily: defaults.typography.bodyFontFamily,
    bodyFontSize: clampNumber(
      typographySource.bodyFontSize,
      8,
      24,
      legacyFontSize > 0 ? legacyFontSize : defaults.typography.bodyFontSize
    ),
    bodyLineHeight: clampNumber(
      typographySource.bodyLineHeight,
      1,
      2.6,
      legacyLineHeight > 0 ? legacyLineHeight : defaults.typography.bodyLineHeight
    ),
    headingFontFamily: defaults.typography.headingFontFamily,
    headingFontSize: clampNumber(typographySource.headingFontSize, 8, 30, defaults.typography.headingFontSize),
    englishFontFamily: defaults.typography.englishFontFamily,
  };

  const smartSource = source.smart && typeof source.smart === 'object' ? source.smart : {};
  const footerSource = source.footer && typeof source.footer === 'object' ? source.footer : {};

  const layout: QuestionPaperLayout = {
    version: LAYOUT_SCHEMA_VERSION,
    mode,
    pageSize: 'A4',
    orientation: source.orientation === 'landscape' ? 'landscape' : 'portrait',
    margins,
    typography,
    questionSpacing: clampNumber(source.questionSpacing, 0, 30, defaults.questionSpacing),
    sectionSpacing: clampNumber(source.sectionSpacing, 0, 30, defaults.sectionSpacing),
    pageRules: normalizePageRules(
      source.pageRules,
      hints.totalQuestions
        ? defaultPageRulesForQuestionCount(hints.totalQuestions)
        : defaults.pageRules
    ),
    questionOverrides: normalizeOverrides(source.questionOverrides),
    smart: {
      avoidOrphans: clampBoolean(smartSource.avoidOrphans, defaults.smart.avoidOrphans),
      optimizePageFill: clampBoolean(smartSource.optimizePageFill, defaults.smart.optimizePageFill),
      allowLongQuestionSplit: clampBoolean(smartSource.allowLongQuestionSplit, defaults.smart.allowLongQuestionSplit),
    },
    footer: {
      showPaperCode: clampBoolean(footerSource.showPaperCode, defaults.footer.showPaperCode),
      showPageNumber: clampBoolean(footerSource.showPageNumber, defaults.footer.showPageNumber),
      style: 'rule-and-row',
    },
    showHeader: clampBoolean(source.showHeader, defaults.showHeader),
    showNotes: clampBoolean(source.showNotes, defaults.showNotes),
    runningHeader: clampBoolean(source.runningHeader, defaults.runningHeader),
    allowManualOverflow: clampBoolean(source.allowManualOverflow, defaults.allowManualOverflow),
  };

  return layout;
}

export interface LegacyMigrationResult {
  layout: QuestionPaperLayout;
  /** Legacy Mass View document captured verbatim; kept for manual migration only. */
  legacyMassViewContent: string | null;
  warnings: string[];
  migrated: boolean;
}

/**
 * Read a blueprint that may pre-date v2 layout storage. Never mutates and never
 * throws: legacy `massViewHeader`, `reportSettings` and `perReportSettings` are
 * understood but are no longer authoritative for rendering.
 */
export function migrateBlueprintLayout(blueprint: Blueprint | null | undefined): LegacyMigrationResult {
  const warnings: string[] = [];
  const bp = (blueprint || {}) as Blueprint & Record<string, any>;
  const items: BlueprintItem[] = Array.isArray(bp.items) ? bp.items : [];
  const stored = bp.questionPaperLayout;

  let layout: QuestionPaperLayout;
  let migrated = false;

  if (stored && typeof stored === 'object') {
    const totalQuestions = items.reduce((sum, item) => sum + Math.max(1, Number(item?.questionCount) || 1), 0);
    layout = normalizeQuestionPaperLayout(stored, { totalQuestions });
    if ((stored as any).version !== LAYOUT_SCHEMA_VERSION) {
      migrated = true;
      warnings.push(`questionPaperLayout upgraded from version ${(stored as any).version ?? 'legacy'} to ${LAYOUT_SCHEMA_VERSION}`);
    }
  } else {
    const totalQuestions = items.reduce((sum, item) => sum + Math.max(1, Number(item?.questionCount) || 1), 0);
    layout = normalizeQuestionPaperLayout(undefined, { totalQuestions });
    migrated = true;
    warnings.push('No questionPaperLayout found; default v2 layout generated (blueprint data untouched)');
  }

  const legacyMassViewContent = typeof bp.massViewHeader === 'string' && bp.massViewHeader.trim()
    ? bp.massViewHeader
    : null;
  if (legacyMassViewContent) {
    warnings.push('Legacy massViewHeader content preserved for reference only; the paper is now rebuilt from blueprint data');
  }

  return { layout, legacyMassViewContent, warnings, migrated };
}

export function getPageRule(layout: QuestionPaperLayout, page: number): QuestionPaperPageRule | undefined {
  return layout.pageRules.find(rule => rule.page === page);
}

export function getQuestionOverride(
  layout: QuestionPaperLayout,
  questionId: string
): QuestionPaperQuestionOverride | undefined {
  return layout.questionOverrides[questionId];
}

export function setQuestionOverride(
  layout: QuestionPaperLayout,
  questionId: string,
  patch: QuestionPaperQuestionOverride
): QuestionPaperLayout {
  const current = layout.questionOverrides[questionId] || {};
  const next: QuestionPaperQuestionOverride = { ...current };
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      delete (next as Record<string, unknown>)[key];
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
  });
  return {
    ...layout,
    questionOverrides: { ...layout.questionOverrides, [questionId]: next },
  };
}

export type { Blueprint, BlueprintItem, QuestionPaperType };
