import type { DiscoveryResult } from '../discovery';

export interface DiscoveryHarnessRunMeta {
  htmlSource: 'none' | 'dev-proxy' | 'manual-paste';
  htmlFetchNote?: string;
  durationMs: number;
}

export function formatDiscoveryResultSummary(result: DiscoveryResult): string {
  const lines = [
    `Primary URL:\n${result.primaryUrl}`,
    '',
    'Discovery:',
    '',
    `Success: ${result.success ? 'yes' : 'no'}`,
  ];

  if (result.loginUrl) {
    lines.push(`Found login URL:\n${result.loginUrl}`);
  }

  if (result.method) {
    lines.push(`Method:\n${result.method}`);
  }

  if (result.confidence) {
    lines.push(`Confidence:\n${result.confidence}`);
  }

  if (result.finalUrlAfterRedirects) {
    lines.push(`Final URL after redirects:\n${result.finalUrlAfterRedirects}`);
  }

  if (result.redirectChain && result.redirectChain.length > 0) {
    lines.push('Redirect chain:');
    for (const url of result.redirectChain) {
      lines.push(`- ${url}`);
    }
  }

  if (result.reason) {
    lines.push(`Failure reason:\n${result.reason}`);
  }

  if (result.modalTrigger) {
    lines.push(
      `Modal trigger:\n${result.modalTrigger.label} (${result.modalTrigger.tagName})`,
    );
  }

  if (result.candidates && result.candidates.length > 0) {
    lines.push('', 'Candidates:');
    for (const candidate of [...result.candidates].sort((a, b) => b.score - a.score)) {
      lines.push(
        `- [${candidate.method}] score=${candidate.score} confidence=${candidate.confidence} url=${candidate.url}${candidate.label ? ` label="${candidate.label}"` : ''}`,
      );
    }
  }

  return lines.join('\n');
}
