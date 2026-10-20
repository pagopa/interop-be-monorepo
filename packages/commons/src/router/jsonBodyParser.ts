import express, { RequestHandler } from "express";

type JsonBodyParserOptions = NonNullable<Parameters<typeof express.json>[0]>;

const skipWhitespaces = (json: string, index: number): number => {
  let currentIndex = index;
  while (/\s/.test(json[currentIndex] ?? "")) {
    currentIndex += 1;
  }
  return currentIndex;
};

const parseString = (
  json: string,
  startIndex: number
): { value: string; endIndex: number } => {
  let currentIndex = startIndex + 1;
  let isEscaped = false;

  while (currentIndex < json.length) {
    const character = json[currentIndex];

    if (isEscaped) {
      isEscaped = false;
    } else if (character === "\\") {
      isEscaped = true;
    } else if (character === '"') {
      const rawString = json.slice(startIndex, currentIndex + 1);
      const parsedValue: unknown = JSON.parse(rawString);

      if (typeof parsedValue !== "string") {
        throw new SyntaxError("Invalid JSON string");
      }

      return { value: parsedValue, endIndex: currentIndex + 1 };
    }

    currentIndex += 1;
  }

  throw new SyntaxError("Unterminated JSON string");
};

const parseLiteral = (
  json: string,
  startIndex: number,
  literal: string
): number => {
  if (!json.startsWith(literal, startIndex)) {
    throw new SyntaxError("Invalid JSON body");
  }

  return startIndex + literal.length;
};

const parseNumber = (json: string, startIndex: number): number => {
  const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
    json.slice(startIndex)
  );

  if (!match) {
    throw new SyntaxError("Invalid JSON number");
  }

  return startIndex + match[0].length;
};

const parseValue = (json: string, startIndex: number): number => {
  const currentIndex = skipWhitespaces(json, startIndex);
  const character = json[currentIndex];

  if (character === "{") {
    return parseObject(json, currentIndex);
  }

  if (character === "[") {
    return parseArray(json, currentIndex);
  }

  if (character === '"') {
    return parseString(json, currentIndex).endIndex;
  }

  if (character === "t") {
    return parseLiteral(json, currentIndex, "true");
  }

  if (character === "f") {
    return parseLiteral(json, currentIndex, "false");
  }

  if (character === "n") {
    return parseLiteral(json, currentIndex, "null");
  }

  return parseNumber(json, currentIndex);
};

function parseObject(json: string, startIndex: number): number {
  const keys = new Set<string>();
  let currentIndex = skipWhitespaces(json, startIndex + 1);

  if (json[currentIndex] === "}") {
    return currentIndex + 1;
  }

  while (currentIndex < json.length) {
    if (json[currentIndex] !== '"') {
      throw new SyntaxError("Invalid JSON object key");
    }

    const parsedKey = parseString(json, currentIndex);
    if (keys.has(parsedKey.value)) {
      throw new SyntaxError("Duplicate JSON field");
    }
    keys.add(parsedKey.value);

    currentIndex = skipWhitespaces(json, parsedKey.endIndex);
    if (json[currentIndex] !== ":") {
      throw new SyntaxError("Invalid JSON object");
    }

    currentIndex = skipWhitespaces(json, parseValue(json, currentIndex + 1));
    if (json[currentIndex] === "}") {
      return currentIndex + 1;
    }

    if (json[currentIndex] !== ",") {
      throw new SyntaxError("Invalid JSON object");
    }

    currentIndex = skipWhitespaces(json, currentIndex + 1);
  }

  throw new SyntaxError("Unterminated JSON object");
}

function parseArray(json: string, startIndex: number): number {
  let currentIndex = skipWhitespaces(json, startIndex + 1);

  if (json[currentIndex] === "]") {
    return currentIndex + 1;
  }

  while (currentIndex < json.length) {
    currentIndex = skipWhitespaces(json, parseValue(json, currentIndex));
    if (json[currentIndex] === "]") {
      return currentIndex + 1;
    }

    if (json[currentIndex] !== ",") {
      throw new SyntaxError("Invalid JSON array");
    }

    currentIndex = skipWhitespaces(json, currentIndex + 1);
  }

  throw new SyntaxError("Unterminated JSON array");
}

export function assertNoDuplicateJsonFields(json: string): void {
  const endIndex = skipWhitespaces(json, parseValue(json, 0));

  if (endIndex !== json.length) {
    throw new SyntaxError("Invalid JSON body");
  }
}

export function strictJsonBodyParser(
  options: JsonBodyParserOptions = {}
): RequestHandler {
  return express.json({
    ...options,
    verify: (req, res, buffer, encoding) => {
      options.verify?.(req, res, buffer, encoding);

      if (buffer.length > 0) {
        const bufferEncoding = Buffer.isEncoding(encoding)
          ? encoding
          : undefined;
        assertNoDuplicateJsonFields(buffer.toString(bufferEncoding));
      }
    },
  });
}
