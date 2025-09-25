import { hyperlinkDetectionError } from "pagopa-interop-models";

export function escapeRegExp(str: string): string {
  return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Validates that a text does not contain hyperlinks or URLs
 * URL pattern that matches:
 * - https:// or http:// URLs
 * - www. URLs
 * - domain.com patterns
 *
 * @param text - The text to validate
 * @param customError - Optional custom error to throw if hyperlinks are found
 * @throws Error or custom error if hyperlinks are detected
 */
export function validateNoHyperlinks(text: string, customError?: Error): void {
  const urlPattern =
    /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;

  if (urlPattern.test(text)) {
    throw customError || hyperlinkDetectionError(text);
  }
}
