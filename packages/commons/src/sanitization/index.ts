import * as express from "express";
import { P, match } from "ts-pattern";

/**
 * Recursively trims leading and trailing whitespace from every string found in
 * the given value. Strings are trimmed; arrays and plain objects are traversed
 * recursively; any other value is returned unchanged.
 *
 * Note: this only normalizes whitespace. It does NOT escape special characters
 * (escaping must happen on output, not by mutating input data) and it does NOT
 * convert empty strings to `undefined`. Rejecting empty-after-trim values is
 * left to the Zodios/OpenAPI schema validation (e.g. `minLength`), which runs
 * downstream of this middleware on the already-trimmed values.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trimValue(value: any): any {
  return match(value)
    .with(P.string, (str) => str.trim())
    .with(P.array(P._), (arr) => arr.map(trimValue))
    .with(
      P.not(P.nullish)
        .and(P.not(P.array(P._)))
        .and(P.when((v) => typeof v === "object")),
      (obj) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const trimmed: Record<string, any> = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // eslint-disable-next-line functional/immutable-data
            trimmed[key] = trimValue(obj[key]);
          }
        }
        return trimmed;
      }
    )
    .otherwise(() => value);
}

/**
 * Express middleware that trims leading and trailing whitespace from all string
 * inputs found in the request body and query string (recursively, including
 * nested objects and arrays).
 *
 * It must be registered before the router so that the trimmed values reach the
 * schema validation: this makes whitespace-only inputs (e.g. an e-service name
 * of only spaces) fail the existing `minLength` checks instead of being
 * accepted. Path params are intentionally left untouched.
 */
export function trimMiddleware(): express.RequestHandler {
  return (req, _res, next): void => {
    if (req.body) {
      // eslint-disable-next-line functional/immutable-data
      req.body = trimValue(req.body);
    }
    if (req.query) {
      // eslint-disable-next-line functional/immutable-data
      req.query = trimValue(req.query);
    }
    next();
  };
}
