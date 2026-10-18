import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

const root = process.cwd();
const ignored = new Set(['node_modules', '.next', '.git']);
const sourceExts = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx']);
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) await walk(join(dir, entry.name));
    } else if (entry.isFile() && sourceExts.has(extname(entry.name))) {
      files.push(join(dir, entry.name));
    }
  }
}

async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

async function resolves(path) {
  if (await exists(path)) return true;
  if (!extname(path)) {
    for (const ext of sourceExts) if (await exists(path + ext)) return true;
    for (const ext of sourceExts) if (await exists(join(path, 'index' + ext))) return true;
  }
  return false;
}

await walk(root);
const failures = [];
const importPattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"](\.[^'"]+)['"]/g;
for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!await resolves(resolve(dirname(file), specifier))) {
      const line = source.slice(0, match.index).split('\n').length;
      failures.push(`${file.slice(root.length + 1)}:${line} -> ${specifier}`);
    }
  }
}

if (failures.length) {
  process.stderr.write(`Relative import check failed (${failures.length} missing):\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write(`Relative import check passed (${files.length} source files; no missing relative imports).\n`);
