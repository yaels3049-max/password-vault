export const DISCOVERY_HARNESS_HASH = '#/dev/discovery';

export const DISCOVERY_HARNESS_QA_URLS = [
  'https://www.shufersal.co.il',
  'https://www.clalit.co.il',
  'https://www.ksp.co.il',
] as const;

export function isDiscoveryHarnessRoute(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.location.hash === DISCOVERY_HARNESS_HASH
  );
}

export { fetchPageHtmlForDiscovery as fetchDiscoveryPageHtml } from '../discovery/fetchPageHtml';
