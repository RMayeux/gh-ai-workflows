import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Logger } from '@core';

/**
 * Recursively finds all files in a directory, skipping common ignore-dirs.
 */
export function getAllFilesRecursive(dir: string): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (existsSync(fullPath) && !path.extname(fullPath)) {
      const baseName = path.basename(fullPath);
      if (baseName === '.git' || baseName === 'node_modules' || baseName === 'dist') continue;
      try {
        results = results.concat(getAllFilesRecursive(fullPath));
      } catch (e) {}
    } else if (existsSync(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Collects content of documentation files that match a given regex.
 * Logs every matching file found.
 */
export function collectDocs(docPattern: string): string {
  let docContent = '';
  const regex = new RegExp(docPattern);
  const allFiles = getAllFilesRecursive(process.cwd());
  
  Logger.debug(`Scanning ${allFiles.length} files for pattern: ${docPattern}`);

  for (const file of allFiles) {
    const relativePath = path.relative(process.cwd(), file);
    if (regex.test(relativePath)) {
      Logger.log(`Found matching doc: ${relativePath}`);
      try {
        const content = readFileSync(file, 'utf8');
        docContent += `\n\n--- FILE: ${relativePath} ---\n${content}`;
      } catch (err) {
        Logger.error(`Failed to read doc file ${relativePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return docContent;
}
