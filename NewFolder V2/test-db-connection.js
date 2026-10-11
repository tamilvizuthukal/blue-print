import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

console.log('Testing connection to MongoDB...');
console.log('URI:', MONGO_URI ? MONGO_URI.replace(/:([^@]+)@/, ':****@') : 'undefined');

if (!MONGO_URI) {
  console.error('No MONGODB_URI found in environment!');
  process.exit(1);
}

try {
  const conn = await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000
  });
  console.log('SUCCESS: Connected to MongoDB successfully!');
  await mongoose.disconnect();
} catch (err) {
  console.error('FAILURE: Connection failed!');
  console.error(err);
}
