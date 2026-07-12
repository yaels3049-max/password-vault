export type ExtensionMessage = Record<string, unknown>;

export interface BrowserHostAdapter {
  probeExtensionAvailable(): boolean;
  getExtensionId(): string;
  sendExtensionMessage(
    message: ExtensionMessage,
    onResponse?: (response: unknown, lastError: string | null) => void,
  ): boolean;
  sendExtensionMessageAsync<T = unknown>(message: ExtensionMessage): Promise<T | null>;
  openUrlInNewTab(url: string): void;
}
