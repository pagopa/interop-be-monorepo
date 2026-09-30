import { interpolateTemplateSoapApiSpec } from "pagopa-interop-commons";
import {
  generateId,
  interfaceExtractingInfoError,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { getMockEService, readFileContent } from "../src/index.js";

describe("interpolateTemplateSoapApiSpec", async () => {
  const eservice = getMockEService();
  const file: string = await readFileContent("interface-test.wsdl");
  const expectedFileContent: string = await readFileContent(
    "interface-test-expected.wsdl"
  );

  const interfaceFileInfo = {
    id: generateId(),
    name: "wsdl",
    contentType: "application/wsdl",
    prettyName: "Test Interface",
  };

  const eserviceInstanceInterfaceData = {
    contactName: "Test User",
    contactEmail: "Test email",
    contactUrl: "http://example.com",
    termsAndConditionsUrl: "http://example.com",
    serverUrls: [
      { url: "http://server1.example.com" },
      { url: "http://server2.example.com" },
    ],
  };

  it("should interpolate SOAP API spec", async () => {
    const result: File = await interpolateTemplateSoapApiSpec(
      eservice,
      file,
      interfaceFileInfo,
      eserviceInstanceInterfaceData
    );

    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe(interfaceFileInfo.name);
    expect(result.type).toBe(interfaceFileInfo.contentType);

    const fileContent = await result.text();

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
  it("should interpolate the SOAP API spec adding wsdl:documentation for each server description", async () => {
    const dataWithDescriptions = {
      ...eserviceInstanceInterfaceData,
      serverUrls: [
        {
          url: "http://server1.example.com",
          description: "Primary production server",
        },
        {
          url: "http://server2.example.com",
          description: "Secondary production server",
        },
      ],
    };

    const result: File = await interpolateTemplateSoapApiSpec(
      eservice,
      file,
      interfaceFileInfo,
      dataWithDescriptions
    );

    const fileContent = await result.text();

    expect(fileContent).toContain("wsdl:documentation");
    expect(fileContent).toContain("Primary production server");
    expect(fileContent).toContain("Secondary production server");
  });
  it("should throw interfaceExtractingInfoError if fileType is not supported", async () => {
    const interfaceFileInfo = {
      id: generateId(),
      name: "pdf",
      contentType: "application/pdf",
      prettyName: "Test Interface",
    };

    await expect(
      interpolateTemplateSoapApiSpec(
        eservice,
        file,
        interfaceFileInfo,
        eserviceInstanceInterfaceData
      )
    ).rejects.toThrowError(interfaceExtractingInfoError());
  });
});
