import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const netlify = readFileSync(resolve(root, 'netlify.toml'), 'utf8');
const checks = [];
const add = (label, pass, detail) => checks.push({ label, pass: Boolean(pass), detail });

add('Node.js runtime requirement is declared', Number(String(pkg.engines?.node || '').match(/\d+/)?.[0] || 0) >= 20, `engines.node=${pkg.engines?.node || '(missing)'}`);
add('Netlify build command runs checks and Next.js build', /command\s*=\s*"[^"]*npm run build[^"]*"/.test(netlify) && /npm run check:all/.test(netlify) && typeof pkg.scripts?.build === 'string', 'Netlify gates the build on syntax/import/security/unit checks');
add('Netlify pins a compatible Node major', /NODE_VERSION\s*=\s*"20"/.test(netlify), 'NODE_VERSION=20');
add('Lockfile exists for reproducible install', existsSync(resolve(root, 'package-lock.json')), 'package-lock.json is required before release');
add('Firestore rules are included', existsSync(resolve(root, 'firestore.rules')), 'firestore.rules');
add('Netlify scheduled backup function is included', existsSync(resolve(root, 'netlify/functions/backup.mjs')), 'netlify/functions/backup.mjs');
add('Firebase Admin fails closed without explicit configuration', /if \(!projectId \|\| !clientEmail \|\| !privateKey\)/.test(readFileSync(resolve(root, 'lib/admin.js'), 'utf8')), 'No implicit Firebase project fallback');
add('Environment template contains placeholders only', existsSync(resolve(root, '.env.example')) && /your-firebase-staging-project-id/.test(readFileSync(resolve(root, '.env.example'), 'utf8')), '.env.example is a template, not a credential file');
add('All local check scripts are available', ['check:syntax', 'check:imports', 'check:security', 'test:unit', 'check:all'].every((s) => typeof pkg.scripts?.[s] === 'string'), 'Syntax, imports, static security checks, unit tests');

for (const c of checks) console.log(`${c.pass ? 'PASS' : 'BLOCK'} ${c.label} — ${c.detail}`);
const failures = checks.filter((c) => !c.pass);
console.log(`\nRelease preflight: ${checks.length - failures.length}/${checks.length} passed; ${failures.length} blocker(s).`);
if (failures.length) process.exitCode = 1;
