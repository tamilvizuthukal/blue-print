/**
 * Bundles the canonical question paper pipeline for the Node server.
 *
 * `server/index.js` is CommonJS (`server/package.json` sets type: commonjs) and
 * cannot import `.ts` files, but the PDF route must rebuild the paper from
 * structured blueprint data instead of trusting browser HTML. This script
 * produces the single artifact the server requires, so the browser preview and
 * the exported PDF run the exact same numbering, block and pagination code.
 *
 *   npm run build:question-paper-server
 */

import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = join(root, 'server', 'generated');

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [join(root, 'questionPaper', 'serverEntry.ts')],
  outfile: join(outDir, 'question-paper.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'warning',
  banner: {
    js: '// GENERATED FILE - do not edit. Run: npm run build:question-paper-server',
  },
});

console.log('Built server/generated/question-paper.cjs');

/**
 * esbuild silently drops a re-export whose name does not exist in the target
 * module, so a typo in `serverEntry.ts` would produce a bundle that loads fine
 * and then throws `undefined is not a function` on the first request. Verify
 * the contract instead of trusting the build.
 */
const REQUIRED_EXPORTS = [
  'buildQuestionPaperDocument',
  'renderDocumentHtml',
  'createEstimatedMeasurer',
  'buildQuestionSequence',
  'migrateBlueprintLayout',
  'normalizeQuestionPaperLayout',
  'resolvePageGeometry',
  'resolvePaperCode',
  'buildQuestionPaperCss',
  'buildPrintPageRuleCss',
  'buildFontFaceCss',
  'auditFontsInHtml',
  'assertFontsAuditable',
  'loadRequiredFonts',
  'READINESS_CHECKS',
  'formatDiagnosticsForUser',
];

const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const bundle = require(join(outDir, 'question-paper.cjs'));

const missing = REQUIRED_EXPORTS.filter(name => bundle[name] === undefined);
if (missing.length > 0) {
  console.error(`Generated bundle is missing exports: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`Verified ${REQUIRED_EXPORTS.length} exports on the generated bundle.`);
