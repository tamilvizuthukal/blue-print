import { createRequire } from 'module';

// Set AWS_LAMBDA_JS_RUNTIME for Vercel AL2023 environment before loading index.js
process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs20.x';

const require = createRequire(import.meta.url);
const app = require('../server/index.js');

export default app;
