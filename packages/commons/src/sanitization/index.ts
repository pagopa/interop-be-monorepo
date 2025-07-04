import * as express from "express";
import { P, match } from "ts-pattern";

const replacements: { [key: string]: string } = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
  "\\": "&#x5C;",
};

function escapeSpecialChars(input: string): string {
  return input.replace(/[&<>"'/\\]/g, (char) => replacements[char] || char);
}

/**
 * Recursive function to sanitize the value.
 * If the value is a string, it trims and escapes special characters.
 * If it is an array, sanitizes each element.
 * If it is an object, sanitizes each property.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeValue(value: any): any {
  return match(value)
    .with(P.string, (str) => {
      const trimmed = str.trim();
      return escapeSpecialChars(trimmed);
    })
    .with(P.array(P._), (arr) => arr.map(sanitizeValue))
    .with(
      P.not(P.nullish)
        .and(P.not(P.array(P._)))
        .and(P.when((v) => typeof v === "object")),
      (obj) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sanitized: Record<string, any> = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // eslint-disable-next-line functional/immutable-data
            sanitized[key] = sanitizeValue(obj[key]);
          }
        }
        return sanitized;
      }
    )
    .otherwise(() => value);
}

export function sanitizeMiddleware(): express.RequestHandler {
  return (req, _res, next): void => {
    if (req.body) {
      // eslint-disable-next-line functional/immutable-data
      req.body = sanitizeValue(req.body);
    }
    if (req.query) {
      // eslint-disable-next-line functional/immutable-data
      req.query = sanitizeValue(req.query);
    }
    next();
  };
}
