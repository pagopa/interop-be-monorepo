import { hyperlinkDetectionError } from "pagopa-interop-models";

export function escapeRegExp(str: string): string {
  return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Regular expression that matches an explicit hyperlink in free text:
 * - `https?:\/\/...`   — matches `http://...` or `https://...`
 * - `(?<![a-zA-Z0-9])www\.` — matches `www.` only when not preceded by an
 *   alphanumeric character (so e.g. `test-www.com` is NOT considered a link)
 *
 * The trailing token is bounded with `{1,N}` (instead of `+`) and the `g` flag
 * is omitted so that the pattern is ReDoS-safe and stateless on long inputs.
 *
 * The intent is to prevent the insertion of clickable links that lead out of
 * context (UI/email vectors); we deliberately do NOT try to match every URL
 * shape — bare domains like `example.com` are allowed.
 */
const HYPERLINK_MAX_TOKEN_LENGTH = 2048;
const HYPERLINK_PATTERN = new RegExp(
  `(https?:\\/\\/|(?<![a-zA-Z0-9])www\\.)[^\\s]{1,${HYPERLINK_MAX_TOKEN_LENGTH}}`,
  "i"
);

/**
 * Returns true if `text` contains a hyperlink as defined by
 * {@link HYPERLINK_PATTERN}. Safe to call on optional fields.
 */
export function containsHyperlink(text: string | undefined): boolean {
  if (!text) {
    return false;
  }
  return HYPERLINK_PATTERN.test(text);
}

/**
 * Throws when `text` contains a hyperlink. No-op when `text` is undefined or
 * empty, so callers don't need to guard optional inputs.
 *
 * @param text - The text to validate (no-op when undefined or empty)
 * @param customError - Optional error to throw instead of the default
 *                      {@link hyperlinkDetectionError}
 */
export function validateNoHyperlinksSafe(
  text: string | undefined,
  customError?: Error
): void {
  if (containsHyperlink(text) && text) {
    throw customError || hyperlinkDetectionError(text);
  }
}
