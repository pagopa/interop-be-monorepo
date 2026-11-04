import * as publicExports from "error-messages";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FullErrors } from "../src/models/index.js";
import { loadErrorMessages } from "../src/utils/dynamicLoader.js";
import { generateErrorMessages } from "../src/utils/generateErrorMessages.js";
import { getRootPath } from "../src/utils/paths.js";
import { validate } from "../src/validate/index.js";

const csvPath = "packages/error-messages/error-messages.csv";
const generatedPath = "packages/error-messages/src/generated/errorMessages.ts";
const csvUrl = new URL("../error-messages.csv", import.meta.url);
const generatedUrl = new URL(
  "../src/generated/errorMessages.ts",
  import.meta.url
);

describe("error-messages package", () => {
  it("only exports the generated error messages at runtime", () => {
    expect(Object.keys(publicExports)).toEqual(["errorMessages"]);
    expect(publicExports.errorMessages.length).toBeGreaterThan(0);
  });

  it("does not expose internal generation or validation modules", () => {
    const require = createRequire(import.meta.url);
    for (const module of [
      "error-messages/dist/utils/generateErrorMessages.js",
      "error-messages/dist/validate/index.js",
      "error-messages/error-messages.csv",
    ]) {
      expect(() => require.resolve(module)).toThrow(
        expect.objectContaining({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" })
      );
    }
  });

  it("keeps the generated source in sync with the package-local CSV", () => {
    expect(readFileSync(generatedUrl, "utf8")).toBe(
      generateErrorMessages(fileURLToPath(csvUrl))
    );
  });

  it("loads the package-local generated module for validation", async () => {
    expect(await loadErrorMessages(fileURLToPath(generatedUrl))).toEqual(
      FullErrors.parse(publicExports.errorMessages)
    );
  });

  it("resolves the repository root from the new package", () => {
    expect(getRootPath()).toBe(
      resolve(fileURLToPath(new URL("../../..", import.meta.url)))
    );
  });

  it("validates the relocated CSV, generated messages and BFF endpoints", async () => {
    await expect(validate({ csvPath, generatedPath })).resolves.toBeUndefined();
  });

  it("reports a missing CSV", async () => {
    await expect(
      validate({ csvPath: `${csvPath}.missing`, generatedPath })
    ).rejects.toThrow(`${csvPath}.missing not found`);
  });

  it("reports a missing generated module", async () => {
    await expect(
      validate({ csvPath, generatedPath: `${generatedPath}.missing` })
    ).rejects.toThrow(`${generatedPath}.missing not found`);
  });
});
