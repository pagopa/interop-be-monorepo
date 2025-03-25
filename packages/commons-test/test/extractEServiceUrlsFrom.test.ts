import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { describe, expect, it } from "vitest";
import { extractEServiceUrlsFrom } from "pagopa-interop-commons";
import {
  invalidInterfaceFileDetected,
  technology,
} from "pagopa-interop-models";

const readFileToFile = async (fileName: string): Promise<File> => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templatePath = `./resources/${fileName}`;

  const fileBuffer = await fs.readFile(`${dirname}/${templatePath}`);
  return new File([fileBuffer], fileName, { type: "application/json" });
};

describe("extractEServiceUrlsFrom", () => {
  it("should extract URLs from OpenAPI JSON", async () => {
    const file = await readFileToFile("test.openapi.3.0.2.json");

    const urls = await extractEServiceUrlsFrom(
      file,
      "INTERFACE",
      technology.rest,
      "test-resource-id"
    );

    expect(urls).toBeInstanceOf(Array);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://petstore.swagger.io/api/v1",
        "http://petstore.swagger.io/api/v2",
      ])
    );
  });

  it("should extract URLs from OpenAPI YAML", async () => {
    const file = await readFileToFile("test.openapi.3.0.2.yaml");

    const urls = await extractEServiceUrlsFrom(
      file,
      "INTERFACE",
      technology.rest,
      "test-resource-id"
    );

    expect(urls).toBeInstanceOf(Array);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://petstore.swagger.io/api/v1",
        "http://petstore.swagger.io/api/v2",
      ])
    );
  });
  it("should extract URLs from WSDL", async () => {
    const file = await readFileToFile("interface-test.wsdl");

    const urls = await extractEServiceUrlsFrom(
      file,
      "INTERFACE",
      technology.soap,
      "test-resource-id"
    );

    expect(urls).toBeInstanceOf(Array);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls).toEqual(
      expect.arrayContaining(["https://host.com/TestWS/v1"])
    );
  });
  it("should return empty array for documents", async () => {
    const file = await readFileToFile("interface-test.wsdl");

    const urls = await extractEServiceUrlsFrom(
      file,
      "DOCUMENT",
      technology.rest,
      "test-resource-id"
    );

    expect(urls).toEqual([]);
  });
  it("should throw invalidInterfaceFileDetected for unsupported file type", async () => {
    const file = new File(["unsupported content"], "unsupported.txt", {
      type: "text/plain",
    });
    await expect(
      extractEServiceUrlsFrom(
        file,
        "INTERFACE",
        technology.rest,
        "test-resource-id"
      )
    ).rejects.toThrow(invalidInterfaceFileDetected("test-resource-id"));
  });
});
