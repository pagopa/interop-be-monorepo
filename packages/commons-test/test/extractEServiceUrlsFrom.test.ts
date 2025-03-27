import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { describe, expect, it, vi } from "vitest";
import { extractEServiceUrlsFrom } from "pagopa-interop-commons";
import {
  generateId,
  interfaceExtractingSoapFiledError,
  invalidInterfaceFileDetected,
  openapiVersionNotRecognized,
  technology,
} from "pagopa-interop-models";

const readFileContent = async (fileName: string): Promise<string> => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templatePath = `./resources/${fileName}`;

  const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
  return htmlTemplateBuffer.toString();
};

describe("extractEServiceUrlsFrom", () => {
  const eserviceId = generateId();

  const mockFile = {
    name: "test.json",
    text: vi.fn().mockResolvedValue(
      JSON.stringify({
        openapi: "3.0.0",
        servers: [
          { url: "http://petstore.swagger.io/api/v1" },
          { url: "http://petstore.swagger.io/api/v2" },
        ],
      })
    ),
  } as unknown as File;

  it("should process REST interface with OpenAPI 3.0", async () => {
    const urls = await extractEServiceUrlsFrom(
      mockFile,
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
  it("should process REST interface with OpenAPI 2.0", async () => {
    const swaggerDoc = {
      name: "test.json",
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          openapi: "2.0",
          host: "api.example.com",
          paths: [{}],
        })
      ),
    } as unknown as File;

    const result = await extractEServiceUrlsFrom(
      swaggerDoc,
      "INTERFACE",
      "Rest",
      eserviceId
    );
    expect(result).toEqual(["api.example.com"]);
  });
  it("should process REST interface with YAML format", async () => {
    const yamlDoc = {
      name: "test.yaml",
      text: vi
        .fn()
        .mockResolvedValue(
          "openapi: 3.0.0\nservers:\n  - url: http://example.com"
        ),
    } as unknown as File;

    const urls = await extractEServiceUrlsFrom(
      yamlDoc,
      "INTERFACE",
      technology.rest,
      "test-resource-id"
    );

    expect(urls).toBeInstanceOf(Array);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls).toEqual(["http://example.com"]);
  });
  it("should process SOAP interface with WSDL", async () => {
    const soapfileContent = await readFileContent("interface-test.wsdl");
    const soapDoc = {
      name: "test.wsdl",
      text: vi.fn().mockResolvedValue(soapfileContent),
    } as unknown as File;

    const urls = await extractEServiceUrlsFrom(
      soapDoc,
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
  it("should process WSDL with multiple addresses", async () => {
    const soapfileContent = await readFileContent(
      "interface-test-multi-server-urls.wsdl"
    );
    const soapDoc = {
      name: "test.wsdl",
      text: vi.fn().mockResolvedValue(soapfileContent),
    } as unknown as File;

    const result = await extractEServiceUrlsFrom(
      soapDoc,
      "INTERFACE",
      "Soap",
      eserviceId
    );
    expect(result).toEqual(["http://example1.com", "http://example2.com"]);
  });
  it("should process WSDL with multiple operations", async () => {
    const soapfileContent = await readFileContent(
      "interface-test-multi-operation.wsdl"
    );
    const soapDoc = {
      name: "test.wsdl",
      text: vi.fn().mockResolvedValue(soapfileContent),
    } as unknown as File;
    const result = await extractEServiceUrlsFrom(
      soapDoc,
      "INTERFACE",
      "Soap",
      eserviceId
    );
    expect(result).toEqual(["http://example1.com"]);
  });
  it("should throw an error if there are no addresses in WSDL", async () => {
    const soapDoc = {
      name: "test.wsdl",
      text: vi.fn().mockResolvedValue(`
          <definitions>
            <service>
              <port>
              </port>
            </service>
            <binding>
              <operation name="testOperation"/>
            </binding>
          </definitions>
        `),
    } as unknown as File;

    await expect(
      extractEServiceUrlsFrom(soapDoc, "INTERFACE", "Soap", eserviceId)
    ).rejects.toThrow(interfaceExtractingSoapFiledError("soap:address"));
  });
  it("should throw an error if there are no operations in WSDL", async () => {
    const soapDoc = {
      name: "test.wsdl",
      text: vi.fn().mockResolvedValue(`
          <wsdl:definitions>
            <wsdl:service name="TestWS">
                <wsdl:port name="TestWS" binding="tns:TestWS">
                        <soap:address location="https://host.com/TestWS/v1"/>
                </wsdl:port>
            </wsdl:service>
            <wsdl:binding></wsdl:binding>
          </wsdl:definitions>
        `),
    } as unknown as File;

    await expect(
      extractEServiceUrlsFrom(soapDoc, "INTERFACE", "Soap", eserviceId)
    ).rejects.toThrow(interfaceExtractingSoapFiledError("soap:operation"));
  });
  it("should throw error for unsupported OpenAPI version", async () => {
    const invalidDoc = {
      name: "test.json",
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          openapi: "1.0",
          servers: [{ url: "http://example.com" }],
        })
      ),
    } as unknown as File;

    await expect(
      extractEServiceUrlsFrom(invalidDoc, "INTERFACE", "Rest", eserviceId)
    ).rejects.toThrow(openapiVersionNotRecognized("1.0"));
  });

  it("should throw error for invalid JSON in REST interface", async () => {
    const invalidDoc = {
      name: "test.json",
      text: vi.fn().mockResolvedValue("invalid json"),
    } as unknown as File;

    await expect(
      extractEServiceUrlsFrom(invalidDoc, "INTERFACE", "Rest", eserviceId)
    ).rejects.toThrow(invalidInterfaceFileDetected(eserviceId));
  });
  it("should return an empty array for DOCUMENT kind", async () => {
    const documentDoc = {
      ...mockFile,
      kind: "DOCUMENT",
    } as unknown as File;

    const urls = await extractEServiceUrlsFrom(
      documentDoc,
      "DOCUMENT",
      technology.rest,
      "test-resource-id"
    );

    expect(urls).toEqual([]);
  });
  it("should throw invalidInterfaceFileDetected for unsupported file type", async () => {
    const unsupportedDoc = {
      ...mockFile,
      name: "unsupported.txt",
    } as unknown as File;

    await expect(
      extractEServiceUrlsFrom(unsupportedDoc, "INTERFACE", "Rest", eserviceId)
    ).rejects.toThrow(invalidInterfaceFileDetected(eserviceId));
  });
});
