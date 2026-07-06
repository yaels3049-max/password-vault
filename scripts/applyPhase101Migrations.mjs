/**
 * Prints Phase 101 migration apply instructions and file paths.
 * Apply via Supabase Dashboard SQL Editor or `npx supabase db push` after linking.
 *
 * Usage: node scripts/applyPhase101Migrations.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');

const files = [
  '20260702121500_phase101_schema.sql',
  '20260702121600_phase101_rls.sql',
];

console.log('Phase 101 migrations (apply in order):\n');
for (const file of files) {
  const path = join(migrationsDir, file);
  const sql = readFileSync(path, 'utf8');
  console.log(`--- ${file} (${sql.length} bytes) ---`);
  console.log(`Path: ${path}\n`);
}

console.log('Apply options:');
console.log('  1. npx supabase link --project-ref wbehjoraatkrpsbgyunx');
console.log('  2. npx supabase db push');
console.log('  OR paste each file into Supabase Dashboard → SQL Editor → Run');
console.log('\nThen verify:');
console.log('  set NODE_EXTRA_CA_CERTS=<netspark-ca-bundle.pem>');
console.log('  node scripts/verifyPhase101Supabase.mjs');
