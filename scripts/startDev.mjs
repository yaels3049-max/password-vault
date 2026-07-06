/**
 * Start Vite dev server with corporate TLS CA for the Supabase dev proxy.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function resolveCaPath() {
  const extra = process.env.NODE_EXTRA_CA_CERTS;
  if (extra && extra !== 'null' && existsSync(extra)) {
    return extra;
  }

  try {
    const cafile = execSync('npm config get cafile', { encoding: 'utf8', cwd: root }).trim();
    if (cafile && cafile !== 'null' && existsSync(cafile)) {
      return cafile;
    }
  } catch {
    // ignore
  }

  return null;
}

const caPath = resolveCaPath();
if (caPath) {
  process.env.NODE_EXTRA_CA_CERTS = caPath;
  console.log(`[dev] TLS: using CA bundle ${caPath}`);
} else {
  console.warn(
    '[dev] TLS: no CA bundle found — Supabase dev proxy may fail on corporate networks.',
  );
}

const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [viteBin], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
