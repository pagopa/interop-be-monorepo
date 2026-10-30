import { stringify } from "csv-stringify/sync";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readCsvErrorFile } from "../src/utils/csvReader.js";
import { generateErrorMessages } from "../src/utils/generateErrorMessages.js";

describe("error message generation", () => {
  let directory: string;
  let input: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "error-message-parser-"));
    input = join(directory, "messages.csv");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true });
  });

  const headers = ["Process", "Error", "BFF endpoint", "copy it", "copy en"];
  const row = [
    "Tenant Process",
    "certifiedAttributeAlreadyAssigned",
    "GET /tenant/:tenantId",
    "Messaggio italiano",
    "English message",
  ];

  it("selects named columns in any order and ignores additional columns", () => {
    writeFileSync(
      input,
      stringify([
        ["note", " COPY EN ", "ERROR", "Process", "copy it", "BFF endpoint"],
        ["ignored", row[4], row[1], row[0], row[3], row[2]],
      ])
    );

    expect(readCsvErrorFile(input)).toEqual([
      {
        process: row[0],
        error: row[1],
        bffEndpoint: row[2],
        copy: { it: row[3], en: row[4] },
      },
    ]);
  });

  it("handles a BOM, metadata before the header and empty rows", () => {
    writeFileSync(
      input,
      `\uFEFF${stringify([
        [""],
        ["Updated on: 29/10"],
        headers,
        row,
        ["", "", "", "", ""],
      ])}`
    );

    expect(readCsvErrorFile(input)).toHaveLength(1);
    expect(readCsvErrorFile(input)[0].process).toBe(row[0]);
  });

  it("preserves values, incomplete rows, unknown codes and duplicates", () => {
    const incomplete = [" unknown process ", "unknownError", "PATCH /", "", ""];
    writeFileSync(
      input,
      stringify([headers, incomplete, incomplete, ["only a process"]])
    );

    expect(readCsvErrorFile(input)).toEqual([
      {
        process: " unknown process ",
        error: "unknownError",
        bffEndpoint: "PATCH /",
        copy: { it: "", en: "" },
      },
      {
        process: " unknown process ",
        error: "unknownError",
        bffEndpoint: "PATCH /",
        copy: { it: "", en: "" },
      },
      {
        process: "only a process",
        error: "",
        bffEndpoint: "",
        copy: { it: "", en: "" },
      },
    ]);
  });

  it("generates deterministic TypeScript with literal types and safe escaping", () => {
    const italian = '  Test "quotes", \\path\n${notAnExpression} `backticks`  ';
    writeFileSync(
      input,
      stringify([headers, [...row.slice(0, 3), italian, ""]])
    );

    const source = generateErrorMessages(input);
    expect(generateErrorMessages(input)).toBe(source);
    expect(source).toContain("as const satisfies readonly ErrorMessage[]");
    expect(source).toContain(
      "export type GeneratedErrorMessage = (typeof errorMessages)[number]"
    );

    const result = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
      reportDiagnostics: true,
    });
    expect(result.diagnostics).toEqual([]);
    const exports: { errorMessages?: unknown } = {};
    runInNewContext(result.outputText, { exports });
    expect(exports.errorMessages).toEqual([
      {
        process: row[0],
        error: row[1],
        errorCode: "005-0014",
        bffEndpoint: row[2],
        copy: { it: italian, en: "" },
      },
    ]);
  });

  it("generates null codes without discarding unknown or incomplete rows", () => {
    writeFileSync(
      input,
      stringify([
        headers,
        ["Unknown Process", row[1], row[2], "", ""],
        [row[0], "unknownError", row[2], "", ""],
        [row[0]],
      ])
    );
    const source = generateErrorMessages(input);
    const result = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    });
    const exports: { errorMessages?: Array<{ errorCode: string | null }> } = {};
    runInNewContext(result.outputText, { exports });
    expect(exports.errorMessages?.map(({ errorCode }) => errorCode)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("generates an empty array for a header-only CSV", () => {
    writeFileSync(input, stringify([headers]));
    expect(generateErrorMessages(input)).toContain(
      "export const errorMessages = [] as const satisfies readonly ErrorMessage[]"
    );
  });

  it.each(["", "Process,Error,BFF endpoint,copy it\n"])(
    "reports missing required headers for %j",
    (csv) => {
      writeFileSync(input, csv);
      expect(() => generateErrorMessages(input)).toThrow(
        "Missing CSV header row"
      );
    }
  );

  it("reports malformed CSV quoting", () => {
    writeFileSync(input, `${headers.join(",")}\n"unterminated`);
    expect(() => generateErrorMessages(input)).toThrow();
  });

  it("reports missing input files", () => {
    expect(() => generateErrorMessages(input)).toThrow("ENOENT");
  });
});
