/**
 * Question paper regression tests.
 *
 * The project has no test framework and Node cannot import .ts files with
 * extensionless specifiers, so the suite is bundled with the esbuild that is
 * already a dependency and executed with `node --test`.
 *
 *   npm run test:question-paper
 */

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const testsDir = join(root, 'questionPaper', '__tests__');
const outDir = join(root, '.test-build', 'question-paper');

const entries = (await readdir(testsDir))
  .filter(name => name.endsWith('.test.ts'))
  .map(name => join(testsDir, name));

if (entries.length === 0) {
  console.error('No question paper tests found.');
  process.exit(1);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: entries,
  outdir: outDir,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  sourcemap: 'inline',
  logLevel: 'warning',
  external: ['node:*'],
});

const built = (await readdir(outDir))
  .filter(name => name.endsWith('.mjs'))
  .map(name => join(outDir, name));

const child = spawn(process.execPath, ['--test', ...built], { stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 1));
