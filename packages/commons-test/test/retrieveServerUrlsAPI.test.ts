import { describe, expect, it, vi } from "vitest";
import { retrieveServerUrlsAPI } from "pagopa-interop-commons";
import {
  generateId,
  interfaceExtractingSoapFieldError,
  invalidInterfaceFileDetected,
  invalidServerUrl,
  openapiVersionNotRecognized,
  technology,
} from "pagopa-interop-models";
import { readFileContent } from "../src/index.js";

describe("retrieveServerUrlsAPI", () => {
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
    const urls = await retrieveServerUrlsAPI(
      mockFile,
      "INTERFACE",
      technology.rest,
      { id: generateId(), isEserviceTemplate: false }
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
          host: "http://api.example.com",
          paths: [{}],
        })
      ),
    } as unknown as File;

    const result = await retrieveServerUrlsAPI(
      swaggerDoc,
      "INTERFACE",
      "Rest",
      { id: generateId(), isEserviceTemplate: false }
    );
    expect(result).toEqual(["http://api.example.com"]);
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

    const urls = await retrieveServerUrlsAPI(
      yamlDoc,
      "INTERFACE",
      technology.rest,
      { id: generateId(), isEserviceTemplate: false }
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

    const urls = await retrieveServerUrlsAPI(
      soapDoc,
      "INTERFACE",
      technology.soap,
      { id: generateId(), isEserviceTemplate: false }
    );

    expect(urls).toBeInstanceOf(Array);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls).toEqual(
      expect.arrayContaining(["https://host.com/TestWS/v1"])
    );
  });
  it("should process SOAP 1.2 interface with WSDL", async () => {
    const soapfileContent = await readFileContent("interface-test-soap12.wsdl");
    const soapDoc = {
      name: "test.wsdl",
      text: vi.fn().mockResolvedValue(soapfileContent),
    } as unknown as File;

    const urls = await retrieveServerUrlsAPI(
      soapDoc,
      "INTERFACE",
      technology.soap,
      { id: generateId(), isEserviceTemplate: false }
    );

    expect(urls).toBeInstanceOf(Array);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://example.com/tst/service",
        "http://example.com/tst/service-2",
      ])
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

    const result = await retrieveServerUrlsAPI(soapDoc, "INTERFACE", "Soap", {
      id: generateId(),
      isEserviceTemplate: false,
    });
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
    const result = await retrieveServerUrlsAPI(soapDoc, "INTERFACE", "Soap", {
      id: generateId(),
      isEserviceTemplate: false,
    });
    expect(result).toEqual(["http://example1.com"]);
  });
  it("should process WSDL with multiple bindings", async () => {
    const soapfileContent = await readFileContent(
      "interface-test-multi-binding.wsdl"
    );
    const soapDoc = {
      name: "test.wsdl",
      text: vi.fn().mockResolvedValue(soapfileContent),
    } as unknown as File;
    const result = await retrieveServerUrlsAPI(soapDoc, "INTERFACE", "Soap", {
      id: generateId(),
      isEserviceTemplate: false,
    });
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
      retrieveServerUrlsAPI(soapDoc, "INTERFACE", "Soap", {
        id: generateId(),
        isEserviceTemplate: false,
      })
    ).rejects.toThrow(interfaceExtractingSoapFieldError("soap:address"));
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
      retrieveServerUrlsAPI(soapDoc, "INTERFACE", "Soap", {
        id: generateId(),
        isEserviceTemplate: false,
      })
    ).rejects.toThrow(interfaceExtractingSoapFieldError("soap:operation"));
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
      retrieveServerUrlsAPI(invalidDoc, "INTERFACE", "Rest", {
        id: generateId(),
        isEserviceTemplate: false,
      })
    ).rejects.toThrow(openapiVersionNotRecognized("1.0"));
  });

  it("should throw error for invalid JSON in REST interface", async () => {
    const resource = { id: generateId(), isEserviceTemplate: false };
    const invalidDoc = {
      name: "test.json",
      text: vi.fn().mockResolvedValue("invalid json"),
    } as unknown as File;

    await expect(
      retrieveServerUrlsAPI(invalidDoc, "INTERFACE", "Rest", resource)
    ).rejects.toThrow(invalidInterfaceFileDetected(resource));
  });
  it("should return an empty array for DOCUMENT kind", async () => {
    const documentDoc = {
      ...mockFile,
      kind: "DOCUMENT",
    } as unknown as File;

    const urls = await retrieveServerUrlsAPI(
      documentDoc,
      "DOCUMENT",
      technology.rest,
      { id: generateId(), isEserviceTemplate: false }
    );

    expect(urls).toEqual([]);
  });
  it("should throw invalidInterfaceFileDetected for unsupported file type", async () => {
    const resource = { id: generateId(), isEserviceTemplate: false };

    const unsupportedDoc = {
      ...mockFile,
      name: "unsupported.txt",
    } as unknown as File;

    await expect(
      retrieveServerUrlsAPI(unsupportedDoc, "INTERFACE", "Rest", resource)
    ).rejects.toThrow(invalidInterfaceFileDetected(resource));
  });
  it("should throw an error for invalid server URLs", async () => {
    const resource = { id: generateId(), isEserviceTemplate: false };

    const invalidDoc = {
      name: "test.json",
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          openapi: "3.0.0",
          servers: [{ url: "invalid-url" }],
        })
      ),
    } as unknown as File;

    await expect(
      retrieveServerUrlsAPI(invalidDoc, "INTERFACE", "Rest", resource)
    ).rejects.toThrow(invalidServerUrl(resource));
  });
});
