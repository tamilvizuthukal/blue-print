import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = await mkdtemp(join(tmpdir(), 'bp-exact-weightage-'));
try {
  await build({ entryPoints: [join(root, 'tests/exactWeightageAllocator.test.ts')], outdir: outDir, bundle: true, platform: 'node', target: 'node20', format: 'esm', external: ['node:*'] });
  const child = spawn(process.execPath, ['--test', join(outDir, 'exactWeightageAllocator.test.js')], { stdio: 'inherit' });
  const code = await new Promise(resolveExit => child.on('exit', code => resolveExit(code ?? 1)));
  process.exitCode = code;
} finally {
  await rm(outDir, { recursive: true, force: true });
}
