import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  generateId,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import { validateRestInterfaceRoundTrip } from "pagopa-interop-commons";
import { readFileContent } from "../src/index.js";

const bffApiPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../api-clients/open-api/bffApi.yml"
);

describe("validateRestInterfaceRoundTrip", () => {
  const resource = {
    id: generateId(),
    isEserviceTemplate: true,
  };

  it("should pass for a small OpenAPI YAML file", async () => {
    const content = await readFileContent("test.openapi.3.0.2.yaml");
    const file = new File([content], "test.openapi.3.0.2.yaml", {
      type: "application/x-yaml",
    });

    await expect(
      validateRestInterfaceRoundTrip(file, resource)
    ).resolves.toBeUndefined();
  });

  it("should pass for a small OpenAPI JSON file", async () => {
    const content = await readFileContent("test.openapi.3.0.2.json");
    const file = new File([content], "test.openapi.3.0.2.json", {
      type: "application/json",
    });

    await expect(
      validateRestInterfaceRoundTrip(file, resource)
    ).resolves.toBeUndefined();
  });

  it("should throw invalidInterfaceFileDetected for a YAML file with too many $ref that cause excessive aliases after round-trip", async () => {
    const content = await fs.readFile(bffApiPath, "utf-8");
    const file = new File([content], "bffApi.yml", {
      type: "application/x-yaml",
    });

    await expect(
      validateRestInterfaceRoundTrip(file, resource)
    ).rejects.toThrow(invalidInterfaceFileDetected(resource));
  });

  it("should skip validation for non-REST files (wsdl)", async () => {
    const file = new File(["<xml></xml>"], "interface.wsdl", {
      type: "application/wsdl+xml",
    });

    await expect(
      validateRestInterfaceRoundTrip(file, resource)
    ).resolves.toBeUndefined();
  });
});
