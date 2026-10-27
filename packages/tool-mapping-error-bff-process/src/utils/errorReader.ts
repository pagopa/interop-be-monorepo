import { readFileSync } from "node:fs";

import { ErrorWithCode } from "../models/index.js";

const HTTP_STATUS_CODES: Record<string, number> = {
  HTTP_STATUS_BAD_REQUEST: 400,
  HTTP_STATUS_CONFLICT: 409,
  HTTP_STATUS_FORBIDDEN: 403,
  HTTP_STATUS_INTERNAL_SERVER_ERROR: 500,
  HTTP_STATUS_NOT_FOUND: 404,
  HTTP_STATUS_NOT_IMPLEMENTED: 501,
};

function findHttpStatusCode(statusConstant: string): number {
  const code = HTTP_STATUS_CODES[statusConstant];

  if (code === undefined) {
    throw new Error(`Unknown HTTP status constant: ${statusConstant}`);
  }

  return code;
}

export function findErrorMappings(
  fileName: string,
  mapperName?: string
): ErrorWithCode[] {
  if (
    mapperName === undefined ||
    mapperName === "NOT FOUND" ||
    mapperName === "emptyErrorMapper"
  ) {
    return [];
  }
  const file = readFileSync(fileName, "utf8");

  /*
   * Find the mapper:
   *
   * export const createEServiceInstanceFromTemplateErrorMapper = (
   *   error: ApiError<ErrorCodes>
   * ): number =>
   *   match(error.code)
   *     ...
   *     .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
   */
  const mapperRegex = new RegExp(
    `export\\s+const\\s+${mapperName}\\s*=\\s*[\\s\\S]*?match\\(error\\.code\\)([\\s\\S]*?)\\.otherwise\\(`
  );

  const mapperMatch = file.match(mapperRegex);

  if (!mapperMatch) {
    throw new Error(
      `Could not find error mapper "${mapperName}" in "${fileName}"`
    );
  }

  const mapperBody = mapperMatch[1];

  const mappings: ErrorWithCode[] = [];

  /*
   * Match:
   *
   * .with("foo", () => HTTP_STATUS_BAD_REQUEST)
   *
   * and:
   *
   * .with(
   *   "foo",
   *   "bar",
   *   () => HTTP_STATUS_CONFLICT
   * )
   */
  const withRegex =
    /\.with\(\s*([\s\S]*?),\s*\(\)\s*=>\s*(HTTP_STATUS_\w+)\s*\)/g;

  for (const match of mapperBody.matchAll(withRegex)) {
    const [, argumentsPart, statusConstant] = match;

    const messages = [...argumentsPart.matchAll(/"([^"]+)"/g)].map(
      (match) => match[1]
    );

    const code = findHttpStatusCode(statusConstant);

    for (const message of messages) {
      mappings.push({
        code,
        message,
      });
    }
  }

  return mappings;
}
