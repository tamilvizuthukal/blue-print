import { createRequire } from 'module';

// Set runtime environment variables dynamically based on actual Node.js version running on Vercel
const nodeVersion = process.version.match(/^v(\d+)\./)?.[1];
if (nodeVersion) {
  process.env.AWS_LAMBDA_JS_RUNTIME = `nodejs${nodeVersion}.x`;
  process.env.AWS_EXECUTION_ENV = `AWS_Lambda_nodejs${nodeVersion}.x`;
} else {
  process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs20.x';
  process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x';
}

const require = createRequire(import.meta.url);
const app = require('../server/index.js');

export default app;
