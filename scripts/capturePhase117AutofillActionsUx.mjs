/**
 * Capture Phase 117 Managed Autofill action-row UX states (A/B/C).
 * Usage: node scripts/capturePhase117AutofillActionsUx.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'scripts/fixtures/phase117-autofill-actions-ux.html');
const outDir = join(root, 'team-Yuri/evidence/phase117-autofill-actions-ux');

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
await page.goto(pathToFileURL(fixture).href);

const states = [
  { id: 'state-a', file: 'A-mapping-not-yet-saved.png' },
  { id: 'state-b', file: 'B-saved-structurally-valid.png' },
  { id: 'state-c', file: 'C-validated-mapping.png' },
];

for (const state of states) {
  const el = page.locator(`#${state.id}`);
  await el.screenshot({ path: join(outDir, state.file) });
  const buttons = await el.locator('button[data-action]').evaluateAll((nodes) =>
    nodes.map((node) => ({
      action: node.getAttribute('data-action'),
      label: (node.textContent || '').trim(),
      enabledAttr: node.getAttribute('data-enabled'),
      disabledProp: node.disabled,
      ariaDisabled: node.getAttribute('aria-disabled'),
    })),
  );
  console.log(JSON.stringify({ state: state.id, file: state.file, buttons }, null, 2));
}

await browser.close();
console.log(`screenshots: ${outDir}`);
