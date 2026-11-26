import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string): string =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const adapterReference =
  /piiDescriptionValidator|assertDescriptionHasNoPii|createDetectionApiClient|detectPii/;

describe("PII detector remains outside the production catalog composition", () => {
  it("keeps the catalog app, service, router and bootstrap disconnected", () => {
    const productionEntrypoints = [
      "../../src/index.ts",
      "../../src/app.ts",
      "../../src/services/catalogService.ts",
      "../../src/routers/EServiceRouter.ts",
    ];
    for (const path of productionEntrypoints) {
      expect(source(path), path).not.toMatch(adapterReference);
    }
  });

  it("rejects an attempted catalog-service detector import", () => {
    const attemptedWiring = `${source("../../src/services/catalogService.ts")}\nimport { assertDescriptionHasNoPii } from "./piiDescriptionValidator.js";`;
    expect(attemptedWiring).toMatch(adapterReference);
  });
});
