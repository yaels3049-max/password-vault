import { discoverLoginEntry } from '../discovery/discoverLoginEntry';
import type { DiscoveryResult } from '../discovery/discoveryResult';

/**
 * Run login entry discovery against the live page DOM (extension content context).
 * Bundled into extension/discovery/login-entry-discovery.js for scripting injection.
 */
export async function runLoginEntryDiscoveryInPage(
  primaryUrl: string,
): Promise<DiscoveryResult> {
  return discoverLoginEntry(primaryUrl, {
    document: window.document,
    pageUrl: window.location.href,
    followRedirects: false,
    tryCommonPaths: true,
  });
}

declare global {
  interface Window {
    runLoginEntryDiscoveryInPage: typeof runLoginEntryDiscoveryInPage;
  }
}

window.runLoginEntryDiscoveryInPage = runLoginEntryDiscoveryInPage;
