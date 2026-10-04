/**
 * questionPaper/typography.ts
 * ---------------------------------------------------------------------------
 * Single source of truth for question paper typography.
 *
 * Rules enforced here:
 *  - Family names are NEVER suffixed with a weight ("TAU-Paalai Bold",
 *    "TAU-Urai Bold", "Times New Roman Bold" are rejected as families).
 *  - Bold is expressed with `font-weight: 700` on the base family.
 *  - Font files are declared once, with explicit 400/700 faces.
 *  - Every measurement/export waits for `document.fonts.ready` and verifies the
 *    faces that the paper actually uses.
 *  - A development font audit fails loudly on unsupported families so a silent
 *    browser fallback can never reach the printed paper.
 */

import type { QuestionPaperTypography } from './layoutTypes';

export const TAU_PAALAI = 'TAU-Paalai';
export const TAU_URAI = 'TAU-Urai';
export const TIMES_NEW_ROMAN = 'Times New Roman';

export const FONT_FACE_SOURCES: Array<{ family: string; weight: 400 | 700; file: string }> = [
  { family: TAU_PAALAI, weight: 400, file: 'TAU-Paalai.ttf' },
  { family: TAU_PAALAI, weight: 700, file: 'TAU-Paalai%20Bold.ttf' },
  { family: TAU_URAI, weight: 400, file: 'TAU-Urai.ttf' },
  { family: TAU_URAI, weight: 700, file: 'TAU-Urai%20Bold.ttf' },
];

/** Families that may legally appear in a font-family declaration. */
export const ALLOWED_FONT_FAMILIES: string[] = [
  TAU_PAALAI,
  TAU_URAI,
  TIMES_NEW_ROMAN,
  'Georgia',
  'Arial',
  'serif',
  'sans-serif',
  'monospace',
];

/** Historical mistakes that must never reappear. */
export const FORBIDDEN_FONT_FAMILIES: string[] = [
  'TAU-Paalai Bold',
  'TAU-Urai Bold',
  'Times New Roman Bold',
  'TAU-Paalai-Bold',
  'TAU-Urai-Bold',
];

/** Semantic classes used by the renderer. No global element selectors anywhere. */
export const TYPOGRAPHY_CLASSES = {
  tamil: 'qp-tamil',
  tamilBold: 'qp-tamil-bold',
  english: 'qp-english',
  number: 'qp-number',
  heading: 'qp-heading',
  section: 'qp-section',
  optionLabel: 'qp-option-label',
} as const;

export interface FontCssOptions {
  /** Absolute origin (e.g. "https://app.example.com") for URL-based @font-face. */
  origin?: string;
  /** Optional inline data URIs keyed by file name; wins over `origin`. */
  dataUris?: Record<string, string>;
}

/**
 * Builds the @font-face block. `dataUris` is used by the PDF pipeline so the
 * headless browser never depends on network access to the font files.
 */
export function buildFontFaceCss(options: FontCssOptions = {}): string {
  const { origin = '', dataUris } = options;
  const rules = FONT_FACE_SOURCES.map(source => {
    const encodedFile = decodeURIComponent(source.file);
    const inline = dataUris ? (dataUris[encodedFile] || dataUris[source.file]) : undefined;
    const url = inline
      ? `url(data:font/ttf;base64,${inline})`
      : `url('${origin ? `${origin}/` : '/'}${source.file}')`;
    return `@font-face {
    font-family: '${source.family}';
    src: ${url} format('truetype');
    font-weight: ${source.weight};
    font-style: normal;
    font-display: block;
  }`;
  });
  return rules.join('\n');
}

export function resolveFamilyStack(
  typography: Pick<QuestionPaperTypography, 'bodyFontFamily' | 'englishFontFamily' | 'headingFontFamily'>
): { tamil: string; english: string; heading: string } {
  return {
    tamil: `'${typography.bodyFontFamily}', 'Noto Serif', serif`,
    english: `'${typography.englishFontFamily}', serif`,
    heading: `'${typography.headingFontFamily}', 'Times New Roman', serif`,
  };
}

/* -------------------------------------------------------------------------- */
/* Font audit (development guard)                                             */
/* -------------------------------------------------------------------------- */

export interface FontAuditIssue {
  family: string;
  reason: 'forbidden-alias' | 'not-allowed' | 'empty';
  where: string;
}

export interface FontAuditResult {
  valid: boolean;
  issues: FontAuditIssue[];
  familiesFound: string[];
}

const FONT_DECLARATION = /font-family\s*:\s*([^;{}]+)/gi;

/**
 * Scans generated HTML for font-family declarations. Pure string analysis so it
 * runs identically in the browser, in Node tests and inside the PDF pipeline.
 */
export function auditFontsInHtml(html: string): FontAuditResult {
  const issues: FontAuditIssue[] = [];
  const families = new Set<string>();
  if (!html) return { valid: true, issues, familiesFound: [] };

  let match: RegExpExecArray | null;
  FONT_DECLARATION.lastIndex = 0;
  while ((match = FONT_DECLARATION.exec(html)) !== null) {
    const rawValue = match[1] || '';
    const where = `char ${match.index}`;
    if (/\bvar\(--/.test(rawValue)) {
      // Resolved through a scoped custom property; checked at the source instead.
      continue;
    }
    const stack = rawValue
      .split(',')
      .map(part => part.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    if (stack.length === 0) {
      issues.push({ family: rawValue, reason: 'empty', where });
      continue;
    }
    stack.forEach(family => {
      families.add(family);
      const normalized = family.toLowerCase();
      if (FORBIDDEN_FONT_FAMILIES.some(forbidden => forbidden.toLowerCase() === normalized)) {
        issues.push({ family, reason: 'forbidden-alias', where });
        return;
      }
      if (!ALLOWED_FONT_FAMILIES.some(allowed => allowed.toLowerCase() === normalized)) {
        issues.push({ family, reason: 'not-allowed', where });
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    familiesFound: Array.from(families),
  };
}

/** Throws in development when the audit finds an unsupported family. */
export function assertFontsAuditable(html: string, context: string): FontAuditResult {
  const result = auditFontsInHtml(html);
  if (!result.valid) {
    const detail = result.issues
      .map(issue => `${issue.family} (${issue.reason})`)
      .join(', ');
    throw new Error(`[questionPaper] Unsupported font family in ${context}: ${detail}`);
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Font readiness                                                             */
/* -------------------------------------------------------------------------- */

export interface FontReadinessReport {
  ready: boolean;
  checks: Array<{ expression: string; ok: boolean }>;
  missing: string[];
}

export const READINESS_CHECKS = [
  '14pt "TAU-Paalai"',
  'bold 14pt "TAU-Paalai"',
  'bold 14pt "TAU-Urai"',
  '14pt "TAU-Urai"',
  '14pt "Times New Roman"',
];

/**
 * MUST be awaited before any measurement. Prevents the classic bug where block
 * heights are measured with a fallback font and the exported PDF reflows.
 */
export async function awaitFontsReady(doc?: Document): Promise<void> {
  const target = doc || (typeof document !== 'undefined' ? document : undefined);
  if (!target) return;
  const fonts = (target as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts || typeof fonts.ready?.then !== 'function') return;
  await fonts.ready;
}

/**
 * Forces every required face to load.
 *
 * `document.fonts.check()` only reports faces the document has actually used, so
 * a declared-but-unused face (e.g. `TAU-Urai` 400 when every heading is bold)
 * reports `false` and would be misread as a missing font. Loading them
 * explicitly first is what makes the readiness report meaningful.
 */
export async function loadRequiredFonts(doc?: Document, checks: string[] = READINESS_CHECKS): Promise<void> {
  const target = doc || (typeof document !== 'undefined' ? document : undefined);
  const fonts = target ? (target as Document & { fonts?: FontFaceSet }).fonts : undefined;
  if (!fonts || typeof fonts.load !== 'function') return;
  await Promise.all(
    checks.map(expression =>
      Promise.resolve(fonts.load(expression)).catch(() => undefined)
    )
  );
  await awaitFontsReady(target as Document);
}

export function verifyFontsLoaded(doc?: Document, checks: string[] = READINESS_CHECKS): FontReadinessReport {
  const target = doc || (typeof document !== 'undefined' ? document : undefined);
  const fonts = target ? (target as Document & { fonts?: FontFaceSet }).fonts : undefined;
  if (!fonts || typeof fonts.check !== 'function') {
    return { ready: false, checks: checks.map(expression => ({ expression, ok: false })), missing: [...checks] };
  }
  const results = checks.map(expression => ({ expression, ok: fonts.check(expression) }));
  return {
    ready: results.every(result => result.ok),
    checks: results,
    missing: results.filter(result => !result.ok).map(result => result.expression),
  };
}

export async function ensureFontsReady(doc?: Document): Promise<FontReadinessReport> {
  await awaitFontsReady(doc);
  return verifyFontsLoaded(doc);
}
