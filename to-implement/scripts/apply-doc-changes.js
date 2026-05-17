#!/usr/bin/env node
/**
 * apply-doc-changes.js
 * Reads LLM JSON output and writes doc files to disk.
 * Rejects any path outside docs/ to prevent path traversal.
 *
 * Usage: node apply-doc-changes.js /path/to/doc_changes.json
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve, relative } from 'path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node apply-doc-changes.js /path/to/doc_changes.json');
  process.exit(1);
}

const DOCS_ROOT = resolve(process.cwd(), 'docs');

let changes, summary;
try {
  const raw = readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw);
  changes = parsed.changes;
  summary = parsed.summary;
  if (!Array.isArray(changes)) throw new Error('"changes" must be an array');
  console.log(`Summary: ${summary}`);
} catch (err) {
  console.error('Failed to parse doc_changes.json:', err.message);
  process.exit(1);
}

let created = 0, updated = 0, deleted = 0, errors = 0;

for (const change of changes) {
  const { action, path: filePath, content } = change;

  if (!filePath) {
    console.warn('Skipping change with no path');
    errors++;
    continue;
  }

  const absolutePath = resolve(process.cwd(), filePath);

  // Security: reject any path outside docs/
  const rel = relative(DOCS_ROOT, absolutePath);
  if (rel.startsWith('..') || !absolutePath.startsWith(DOCS_ROOT)) {
    console.error(`❌ Rejected path outside docs/: ${filePath}`);
    errors++;
    continue;
  }

  try {
    if (action === 'create' || action === 'update') {
      if (!content) {
        console.warn(`Skipping ${action} for ${filePath} — no content`);
        errors++;
        continue;
      }
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, content, 'utf8');
      action === 'create' ? (console.log(`✅ Created: ${filePath}`), created++) : (console.log(`🔄 Updated: ${filePath}`), updated++);

    } else if (action === 'delete') {
      if (existsSync(absolutePath)) {
        unlinkSync(absolutePath);
        console.log(`🗑️  Deleted: ${filePath}`);
        deleted++;
      } else {
        console.warn(`⚠️  Delete skipped (not found): ${filePath}`);
      }

    } else {
      console.warn(`⚠️  Unknown action "${action}" for ${filePath}`);
      errors++;
    }
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err.message);
    errors++;
  }
}

console.log('');
console.log('─'.repeat(40));
console.log(`Done. Created: ${created} | Updated: ${updated} | Deleted: ${deleted} | Errors: ${errors}`);
if (errors > 0) process.exit(1);
