import { hyperlinkDetectionError } from "pagopa-interop-models";

export function escapeRegExp(str: string): string {
  return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Validates that a text does not contain hyperlinks or URLs
 * The intent is only to prevent the insertion of clickable hyperlinks that lead out of context,
 * so it is sufficient to focus on http(s) and www.
 * Keep in mind that the text should be limited to 250 characters.
 * Regular expression to match explicit hyperlinks (http/https or www.).
 * - https?:\/\/[^\s]+ -> Matches 'http://...' or 'https://...'
 * - (?<![a-zA-Z0-9])www\. -> Matches 'www.' only if not preceded by an alphanumeric character (e.g., 'test-www.com' is not matched)
 *
 * @param text - The text to validate
 * @param customError - Optional custom error to throw if hyperlinks are found
 * @throws Error or custom error if hyperlinks are detected
 */
export function validateNoHyperlinks(text: string, customError?: Error): void {
  const urlPattern = /(https?:\/\/|(?<![a-zA-Z0-9])www\.)[^\s]+/gi;

  if (urlPattern.test(text)) {
    throw customError || hyperlinkDetectionError(text);
  }
}
