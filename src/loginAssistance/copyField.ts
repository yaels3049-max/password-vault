/**
 * Phase 113 — per-field clipboard copy (AC-113-10 / AC-113-11).
 * Never put password values into confirmation text (caller responsibility).
 */

export type CopyFieldResult = 'ok' | 'failed';

async function copyViaClipboardApi(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function copyViaExecCommand(value: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

/** Copy a credential field value. Requires explicit user gesture (caller). */
export async function copyCredentialField(value: string): Promise<CopyFieldResult> {
  if (await copyViaClipboardApi(value)) {
    return 'ok';
  }
  if (copyViaExecCommand(value)) {
    return 'ok';
  }
  return 'failed';
}
