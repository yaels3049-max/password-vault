import { discoverLoginEntry, type DiscoverLoginEntryOptions } from './discoverLoginEntry';
import type { DiscoveryResult } from './discoveryResult';
import { fetchPageHtmlForDiscovery, type FetchPageHtmlResult } from './fetchPageHtml';

export interface LoginDiscoverySessionInput {
  primaryUrl: string;
  fetchHtml?: boolean;
  followRedirects?: boolean;
  tryCommonPaths?: boolean;
}

export interface LoginDiscoverySessionResult {
  primaryUrl: string;
  fetchResult: FetchPageHtmlResult | null;
  discovery: DiscoveryResult;
}

/**
 * Shared login discovery session used by the Discovery Harness (dev only).
 * Production custom-service and admin flows use discoverLogin → extension executor
 * via discoverLoginForRegistryService / discoverAndPersistLoginUrl.
 * Matches harness behavior: dev proxy fetch when enabled, same discoverLoginEntry options.
 */
export async function runLoginDiscoverySession(
  input: LoginDiscoverySessionInput,
): Promise<LoginDiscoverySessionResult> {
  const primaryUrl = input.primaryUrl.trim();
  const fetchHtml = input.fetchHtml ?? true;

  let fetchResult: FetchPageHtmlResult | null = null;
  let html: string | undefined;
  let pageUrl: string | undefined;

  if (fetchHtml) {
    fetchResult = await fetchPageHtmlForDiscovery(primaryUrl);
    if (fetchResult.ok) {
      html = fetchResult.html;
      pageUrl = fetchResult.finalUrl;
    }
  }

  const options: DiscoverLoginEntryOptions = {
    html,
    pageUrl,
    followRedirects: input.followRedirects ?? true,
    tryCommonPaths: input.tryCommonPaths ?? true,
  };

  const discovery = await discoverLoginEntry(primaryUrl, options);

  return {
    primaryUrl,
    fetchResult,
    discovery,
  };
}
