import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

const root = process.cwd();
const roots = ['app/api', 'lib', 'netlify/functions', 'public/admin', 'public/assets/js'];
const candidates = [];

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && /\.(?:mjs|js)$/.test(entry.name)) candidates.push(path);
  }
}

for (const dir of roots) await walk(join(root, dir));
let failures = 0;
for (const path of candidates.sort()) {
  const source = await readFile(path, 'utf8');
  const args = path.endsWith('.mjs') ? ['--check', path] : ['--input-type=module', '--check'];
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    input: path.endsWith('.mjs') ? undefined : source,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(`\nFAIL ${relative(root, path)}\n${result.stderr || result.stdout}`);
  }
}

// Staff panels must call the server-mediated data API instead of querying private collections directly.
const panelRoot = join(root, 'public/admin/panels');
for (const path of candidates.filter((x) => x.startsWith(panelRoot))) {
  const source = await readFile(path, 'utf8');
  if (/\b(?:getDoc|getDocs|onSnapshot|collection|doc)\s*\(/.test(source) || /firebase-firestore\.js/.test(source)) {
    failures += 1;
    process.stderr.write(`\nFAIL ${relative(root, path)} uses direct Firestore access; use readData() or server operations.\n`);
  }
}

if (failures) {
  process.stderr.write(`\nSyntax/security smoke check failed: ${failures} issue(s) across ${candidates.length} checked JavaScript files.\n`);
  process.exit(1);
}
process.stdout.write(`Syntax/security smoke check passed for ${candidates.length} JavaScript files.\n`);
