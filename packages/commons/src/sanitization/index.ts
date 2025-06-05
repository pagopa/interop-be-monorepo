import * as express from "express";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
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
function sanitizeValue(value: any): any {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return escapeSpecialChars(trimmed);
  } else if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  } else if (value !== null && typeof value === "object") {
    const sanitized: Record<string, any> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitized[key] = sanitizeValue(value[key]);
      }
    }
    return sanitized;
  }
  return value;
}

export function sanitizeMiddleware(): express.RequestHandler {
  return (req, _res, next): void => {
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }
    if (req.query) {
      req.query = sanitizeValue(req.query);
    }
    next();
  };
}
