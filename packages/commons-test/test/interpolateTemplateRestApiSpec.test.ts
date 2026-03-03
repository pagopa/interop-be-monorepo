import { describe, expect, it } from "vitest";
import {
  generateId,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import { interpolateTemplateRestApiSpec } from "pagopa-interop-commons";
import { getMockEService, readFileContent } from "../src/index.js";

describe("interpolateTemplateRestApiSpec", async () => {
  const eservice = getMockEService();
  const file: string = await readFileContent("test.openapi.3.0.2.json");
  const interfaceFileInfo = {
    id: generateId(),
    name: "json",
    contentType: "application/json",
    prettyName: "Test Interface",
  };

  const eserviceInstanceInterfaceData = {
    contactName: "Test User",
    contactEmail: "Test email",
    contactUrl: "http://example.com",
    termsAndConditionsUrl: "http://example.com",
    serverUrls: [],
  };

  it("should interpolate OpenAPI spec", async () => {
    const result: File = await interpolateTemplateRestApiSpec(
      eservice,
      file,
      interfaceFileInfo,
      eserviceInstanceInterfaceData
    );

    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe(interfaceFileInfo.name);
    expect(result.type).toBe(interfaceFileInfo.contentType);

    const fileBuffer = await result.arrayBuffer();
    const jsonString = new TextDecoder().decode(fileBuffer);
    const parsedJson = JSON.parse(jsonString);

    expect(parsedJson.info.contact).toMatchObject({
      name: eserviceInstanceInterfaceData.contactName,
      email: eserviceInstanceInterfaceData.contactEmail,
      url: eserviceInstanceInterfaceData.contactUrl,
    });

    expect(parsedJson.servers).toHaveLength(
      eserviceInstanceInterfaceData.serverUrls.length
    );

    const yamlFileString: string = await readFileContent(
      "test.openapi.3.0.2.yaml"
    );
    const yamlInterfaceFileInfo = {
      id: generateId(),
      name: "yaml",
      contentType: "application/x-yaml",
      prettyName: "Test Interface YAML",
    };

    const yamlFile: File = await interpolateTemplateRestApiSpec(
      eservice,
      yamlFileString,
      yamlInterfaceFileInfo,
      eserviceInstanceInterfaceData
    );
    expect(result.name).toEqual(interfaceFileInfo.name);

    expect(yamlFile.type).toEqual(yamlInterfaceFileInfo.contentType);

    const yamlFileBuffer = await yamlFile.arrayBuffer();
    const yamlString = new TextDecoder().decode(yamlFileBuffer);

    const { parse } = await import("yaml");
    const parsedYaml = parse(yamlString);

    expect(parsedYaml.info).toMatchObject({
      termsOfService: eserviceInstanceInterfaceData.termsAndConditionsUrl,
      contact: {
        name: eserviceInstanceInterfaceData.contactName,
        email: eserviceInstanceInterfaceData.contactEmail,
        url: eserviceInstanceInterfaceData.contactUrl,
      },
    });

    expect(parsedYaml.servers).toHaveLength(
      eserviceInstanceInterfaceData.serverUrls.length
    );
  });

  it("should throw invalidInterfaceFileDetected error for unsupported file type", async () => {
    const interfaceFileInfo = {
      id: generateId(),
      name: "txt",
      contentType: "application/json",
      prettyName: "Test Interface",
    };
    await expect(
      interpolateTemplateRestApiSpec(
        eservice,
        file,
        interfaceFileInfo,
        eserviceInstanceInterfaceData
      )
    ).rejects.toThrow(
      invalidInterfaceFileDetected({
        id: eservice.id,
        isEserviceTemplate: true,
      })
    );
  });
});
