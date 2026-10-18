import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const checks = [];
async function read(path) { return readFile(join(root, path), 'utf8'); }
function assert(name, condition, detail) {
  checks.push(name);
  if (!condition) failures.push(`${name}: ${detail}`);
}

const rules = await read('firestore.rules');
const session = await read('app/api/session/route.js');
const adminConfig = await read('lib/admin.js');
const adminGate = await read('app/api/admin/gate/route.js');
const adminOp = await read('app/api/admin/op/route.js');
const adminData = await read('app/api/admin/data/route.js');
const orders = await read('app/api/orders/route.js');
const proof = await read('app/api/orders/proof/route.js');
const quote = await read('app/api/orders/accept-quote/route.js');
const chat = await read('app/api/chat/route.js');
const account = await read('app/api/account/complete/route.js');
const catalog = await read('app/api/catalog/route.js');
const scheduledBackup = await read('netlify/functions/backup.mjs');
const backupPanel = await read('public/admin/panels/sistem.js');
const adminDataSource = adminData;
const originProtectedRoutes = ['app/api/session/route.js', 'app/api/admin/gate/route.js', 'app/api/admin/data/route.js', 'app/api/admin/op/route.js', 'app/api/orders/route.js', 'app/api/orders/proof/route.js', 'app/api/orders/accept-quote/route.js', 'app/api/chat/route.js', 'app/api/account/complete/route.js'];

assert('Firestore blocks browser writes to orders', /match \/orders\/\{id\}[\s\S]*?allow create, delete: if false/.test(rules), 'expected create/delete denial in orders rules');
assert('Firestore blocks browser writes to proofs', /match \/payment_proofs\/\{id\}[\s\S]*?allow create, update, delete: if false/.test(rules), 'expected all client writes to payment_proofs denied');
assert('Firestore blocks direct writes to admin gate', /match \/admin_gate\/\{uid\}[\s\S]*?allow list, create, update, delete: if false/.test(rules), 'expected admin_gate writes denied');
assert('Session endpoint verifies revoked tokens', /verifyIdToken\([^,]+,\s*true\)/.test(session), 'verifyIdToken must check revocation');
assert('Admin gate binds session to auth_time', /authTime/.test(adminGate) && /verifyIdToken\([^,]+,\s*true\)/.test(adminGate), 'expected auth_time and revoked-token verification');
assert('Admin operations re-check active session in transactions', /assertGateTx/.test(adminOp) && /sessionId !== body\.sid/.test(adminOp), 'expected transactional session ID check');
assert('Sensitive staff reads are mediated server-side', /sessionId !== body\.sid/.test(adminData) && /verifyIdToken\([^,]+,\s*true\)/.test(adminData), 'expected token and session validation');
assert('Order price is derived from trusted catalog', /catalogRef/.test(orders) && /basePrice: pkg\.price/.test(orders) && !/price:\s*body\.price/.test(orders), 'order creation must not trust a client-supplied price');
assert('Proof submission checks order ownership and state', /orderSnap\.data\(\)\.uid !== token\.uid/.test(proof) && /menunggu_verifikasi/.test(proof), 'expected owner and state checks');
assert('Quote acceptance requires a pending valid quote', /priceStatus !== 'quoted'/.test(quote) && /menunggu_persetujuan_harga/.test(quote), 'expected pending quote validation');
assert('Chat writes have rate limiting', /rate_limits\/chat_uid_/.test(chat) && /count >= 10/.test(chat), 'expected per-user chat rate limit');
assert('Account completion reserves username transactionally', /tx\.create\(usernameRef/.test(account) && /runTransaction/.test(account), 'expected transactional username reservation');
assert('Public catalog filters inactive packages', /item\.active == null \|\| item\.active === true/.test(catalog), 'inactive packages must not be exposed');
assert('Session cookie is HttpOnly, Secure, and SameSite=Lax', /httpOnly:\s*true/.test(session) && /secure:\s*true/.test(session) && /sameSite:\s*'lax'/.test(session), 'session cookie must use secure browser flags');
assert('Firebase Admin requires explicit server credentials and project ID', /if \(!projectId \|\| !clientEmail \|\| !privateKey\)/.test(adminConfig) && !/FIREBASE_PROJECT_ID \|\| 'tama-studio-store'/.test(adminConfig), 'server must not silently fall back to a specific Firebase project');
assert('Admin gate requires GitHub then Google', /provider !== 'github\.com'/.test(adminGate) && /provider !== 'google\.com'/.test(adminGate), 'both linked providers must be enforced server-side');
assert('Order creation has per-user rate limit', /rate_limits\/order_/.test(orders) && /count >= 5/.test(orders), 'order creation must be throttled per account');
assert('Chat validates request origin and attachment type', /allowedOrigin\(req\)/.test(chat) && /JPEG_DATA_URL/.test(chat) && /count >= 10/.test(chat), 'chat must validate origin, image type, and rate');
assert('Proof upload validates JPEG and transactionally binds order', /validJpegDataUrl/.test(proof) && /orderSnap\.data\(\)\.uid !== token\.uid/.test(proof) && /runTransaction/.test(proof), 'proof must be valid image data owned by the order customer');
assert('Support cannot price, verify, reject, or finish projects', /if \(!isAdmin\) return fail\('Hanya admin atau owner yang boleh menetapkan harga\.'/.test(adminOp) && /if \(!isAdmin\) return fail\('Hanya admin atau owner yang boleh memverifikasi pembayaran\.'/.test(adminOp) && /if \(!isAdmin\) return fail\('Hanya admin atau owner yang boleh menyelesaikan proyek\.'/.test(adminOp), 'privileged order operations must require admin/owner');
assert('Manual backup includes the ID index', /\['users', 'orders', 'testimonials', 'cms', 'ids'\]/.test(adminData), 'manual backup must include IDs promised by the UI');
assert('Manual backup detects truncation instead of silently exporting partial data', /EXPORT_LIMIT \+ 1/.test(adminData) && /snap\.size > EXPORT_LIMIT/.test(adminData) && /status: 413/.test(adminData), 'manual export must detect collections beyond the cap');
assert('Scheduled backup paginates Firestore collections', /PAGE_SIZE = 500/.test(scheduledBackup) && /startAfter\(cursor\)/.test(scheduledBackup) && /FieldPath\.documentId\(\)/.test(scheduledBackup), 'scheduled backup must page through collections in stable document order');
assert('Scheduled backup retention only deletes dated backup blobs', /filter\(\(blobKey\) => \/\^backup-/.test(scheduledBackup) && /keys\.length - 14/.test(scheduledBackup), 'retention must not delete unrelated blobs and should keep 14 backups');
assert('Backup UI discloses that transfer proofs are excluded', /Bukti transfer tidak disertakan dalam backup otomatis/.test(backupPanel), 'admin must be told that scheduled backup excludes transfer proofs');
assert('Admin data responses are not cached', /Cache-Control.*no-store/.test(adminData), 'sensitive staff data must disable caching');
assert('Admin data uses the tested Firestore serializer for all responses', /serializeFirestoreValue/.test(adminData) && /const one = \(snap\) => snap\.exists \? serializeFirestoreValue\(/.test(adminData) && /return ok\(serializeFirestoreValue\(result\)\)/.test(adminData), 'Firestore timestamps and nested values must use the shared JSON-safe serializer');
for (const route of originProtectedRoutes) {
  const source = await read(route);
  assert(`Mutation endpoint rejects missing Origin (${route})`, /if \(!origin\) return false;/.test(source), 'state-changing endpoint must reject requests without an explicit Origin header');
}

async function walk(dir) {
  let entries;
  try { entries = await readdir(join(root, dir), { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) await walk(rel);
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      const source = await read(rel);
      if (rel.startsWith('public/admin/panels/')) {
        assert(`Admin panel server-mediated access (${rel})`, !/\b(?:getDoc|getDocs|onSnapshot|collection|doc)\s*\(/.test(source) && !/firebase-firestore\.js/.test(source), 'panel contains direct Firestore access');
      }
    }
  }
}
await walk('public/admin/panels');

if (failures.length) {
  process.stderr.write(`Security static checks failed (${failures.length}/${checks.length}):\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write(`Security static checks passed (${checks.length} assertions).\n`);
