/**
 * Server entry point for the question paper pipeline.
 *
 * `server/index.js` is plain Node ESM, so it cannot import the TypeScript
 * modules directly. `scripts/build-question-paper-server-bundle.mjs` bundles
 * this file into `server/generated/question-paper.mjs`, which the `/question-paper/pdf`
 * route imports. Only the canonical, DOM-free surface is re-exported here.
 */

export { buildQuestionPaperDocument, renderDocumentHtml, createEstimatedMeasurer } from './questionPaperDocument';
export { buildQuestionSequence } from './questionSequence';
export {
  DEFAULT_QUESTION_PAPER_LAYOUT,
  LAYOUT_SCHEMA_VERSION,
  migrateBlueprintLayout,
  normalizeQuestionPaperLayout,
  resolvePageGeometry,
  resolvePaperCode,
} from './layoutTypes';
export { buildQuestionPaperCss, buildPrintPageRuleCss } from './questionPaperStyles';
export { auditFontsInHtml, assertFontsAuditable, buildFontFaceCss, loadRequiredFonts, READINESS_CHECKS } from './typography';
export { formatDiagnosticsForUser } from './diagnostics';
