// import { File } from "node:buffer";
import { describe, expect, it } from "vitest";
import { generateId, invalidInterfaceData } from "pagopa-interop-models";
import { interpolateTemplateApiSpec } from "pagopa-interop-commons";
import { getMockEService, readFileContent } from "../src/index.js";

describe("interpolateTemplateApiSpec", async () => {
  const eservice = getMockEService();
  const file: string = await readFileContent("test.openapi.3.0.2.json");

  const interfaceFileInfo = {
    id: generateId(),
    name: "json",
    contentType: "application/json",
    prettyName: "Test Interface",
  };

  const serverUrls = [
    "http://server1.example.com",
    "http://server2.example.com",
  ];

  const eserviceInstanceInterfaceRestData = {
    contactName: "Test User",
    contactEmail: "Test email",
    contactUrl: "http://example.com",
    termsAndConditionsUrl: "http://example.com",
  };

  it("should interpolate API spec to json file", async () => {
    const result: File = await interpolateTemplateApiSpec(
      eservice,
      file,
      interfaceFileInfo,
      serverUrls,
      eserviceInstanceInterfaceRestData
    );

    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe(interfaceFileInfo.name);
    expect(result.type).toBe(interfaceFileInfo.contentType);

    const fileBuffer = await result.arrayBuffer();
    const jsonString = new TextDecoder().decode(fileBuffer);
    const parsedJson = JSON.parse(jsonString);

    expect(parsedJson.info.contact).toMatchObject({
      name: eserviceInstanceInterfaceRestData.contactName,
      email: eserviceInstanceInterfaceRestData.contactEmail,
      url: eserviceInstanceInterfaceRestData.contactUrl,
    });

    const wsdlFile: string = await readFileContent("interface-test.wsdl");
    const expectedFileContent: string = await readFileContent(
      "interface-test-expected.wsdl"
    );

    const interfaceFileInfoWsdl = {
      id: generateId(),
      name: "wsdl",
      contentType: "application/wsdl",
      prettyName: "Test Interface",
    };

    const interpolatedFile: File = await interpolateTemplateApiSpec(
      eservice,
      wsdlFile,
      interfaceFileInfoWsdl,
      serverUrls,
      undefined
    );

    expect(interpolatedFile).toBeInstanceOf(File);
    expect(interpolatedFile.name).toBe(interfaceFileInfoWsdl.name);
    expect(interpolatedFile.type).toBe(interfaceFileInfoWsdl.contentType);

    const fileContent = await interpolatedFile.text();

    const normalizedFileContent = fileContent
      .replace(/\t/g, "") // Remove tabs
      .replace(/\n/g, "") // Remove newlines
      .replace(/\s+/g, " ") // Replace multiple spaces with a single space
      .trim(); // Remove leading and trailing spaces

    const normalizedExpectedContent = expectedFileContent
      .toString()
      .replace(/\t/g, "")
      .replace(/\n/g, "")
      .replace(/\s+/g, " ")
      .trim();

    expect(normalizedFileContent).toBe(normalizedExpectedContent);
  });
  it("should throw invalidInterfaceData error for unsupported file type", async () => {
    const interfaceFileInfo = {
      id: generateId(),
      name: "txt",
      contentType: "application/json",
      prettyName: "Test Interface",
    };
    await expect(
      interpolateTemplateApiSpec(
        eservice,
        file,
        interfaceFileInfo,
        serverUrls,
        eserviceInstanceInterfaceRestData
      )
    ).rejects.toThrow(
      invalidInterfaceData({ id: eservice.id, isEserviceTemplate: true })
    );
  });
});
