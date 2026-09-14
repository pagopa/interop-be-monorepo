import { interpolateTemplateRestApiSpec } from "pagopa-interop-commons";
import {
  generateId,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

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

    const inputJson = JSON.parse(file);
    expect(parsedJson.components.schemas).toBeDefined();
    expect(Object.keys(parsedJson.components.schemas)).toEqual(
      Object.keys(inputJson.components.schemas)
    );
    expect(jsonString).toContain('"$ref"');

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

    expect(yamlString).not.toMatch(/&a\d+/);
    expect(yamlString).not.toMatch(/\*a\d+/);
    expect(yamlString).toContain("$ref");
  });

  it("should not mutate the spec beyond the interpolated custom fields", async () => {
    // The interpolation is only allowed to touch the custom fields
    // (info.contact, info.termsOfService and servers). Everything else
    // (paths, components, $ref, etc.) must stay byte-for-byte equivalent:
    // the validation step must not dereference $ref nor reorder the spec.
    const stripCustomFields = (spec: ReturnType<typeof JSON.parse>): void => {
      delete spec.servers;
      delete spec.info.contact;
      delete spec.info.termsOfService;
    };

    const jsonResult: File = await interpolateTemplateRestApiSpec(
      eservice,
      file,
      interfaceFileInfo,
      eserviceInstanceInterfaceData
    );
    const jsonOutput = JSON.parse(await jsonResult.text());
    const jsonInput = JSON.parse(file);
    stripCustomFields(jsonOutput);
    stripCustomFields(jsonInput);
    expect(jsonOutput).toStrictEqual(jsonInput);

    const yamlFileString: string = await readFileContent(
      "test.openapi.3.0.2.yaml"
    );
    const yamlInterfaceFileInfo = {
      id: generateId(),
      name: "yaml",
      contentType: "application/x-yaml",
      prettyName: "Test Interface YAML",
    };
    const yamlResult: File = await interpolateTemplateRestApiSpec(
      eservice,
      yamlFileString,
      yamlInterfaceFileInfo,
      eserviceInstanceInterfaceData
    );
    const { parse } = await import("yaml");
    const yamlOutput = parse(await yamlResult.text());
    const yamlInput = parse(yamlFileString);
    stripCustomFields(yamlOutput);
    stripCustomFields(yamlInput);
    expect(yamlOutput).toStrictEqual(yamlInput);
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
