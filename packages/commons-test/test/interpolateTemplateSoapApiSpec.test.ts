import { describe, expect, it } from "vitest";
import {
  generateId,
  interfaceExtractingInfoError,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import { interpolateTemplateSoapApiSpec } from "pagopa-interop-commons";
import { getMockEService, readFileContent } from "../src/index.js";

describe("interpolateTemplateSoapApiSpec", async () => {
  const eservice = getMockEService();
  const file: string = await readFileContent("interface-test.wsdl");

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
    serverUrls: ["http://server1.example.com"],
  };

  it("should interpolate SOAP API spec preserving the original document", async () => {
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
    const expectedFileContent = file.replace(
      'location="https://host.com/TestWS/v1"',
      'location="http://server1.example.com"'
    );

    expect(fileContent).toBe(expectedFileContent);
  });

  it("should interpolate SOAP 1.2 address preserving the original document", async () => {
    const soap12File: string = await readFileContent(
      "interface-test-soap12-address.wsdl"
    );
    const result: File = await interpolateTemplateSoapApiSpec(
      eservice,
      soap12File,
      interfaceFileInfo,
      {
        serverUrls: ["http://server.example.com"],
      }
    );

    const expectedFileContent = soap12File.replace(
      'location="http://example.com/tst/service"',
      'location="http://server.example.com"'
    );

    expect(await result.text()).toBe(expectedFileContent);
  });

  it("should interpolate multiple SOAP 1.1 addresses preserving the original document", async () => {
    const multiAddressFile: string = await readFileContent(
      "interface-test-multi-server-urls.wsdl"
    );
    const result: File = await interpolateTemplateSoapApiSpec(
      eservice,
      multiAddressFile,
      interfaceFileInfo,
      {
        serverUrls: [
          "http://server1.example.com",
          "http://server2.example.com",
        ],
      }
    );

    const expectedFileContent = multiAddressFile
      .replace(
        'location="http://example1.com"',
        'location="http://server1.example.com"'
      )
      .replace(
        'location="http://example2.com"',
        'location="http://server2.example.com"'
      );

    expect(await result.text()).toBe(expectedFileContent);
  });

  it("should preserve SOAP address attributes and self-closing tags", async () => {
    const wsdlWithSelfClosingAddress: string = await readFileContent(
      "interface-test-self-closing-address.wsdl"
    );

    const result: File = await interpolateTemplateSoapApiSpec(
      eservice,
      wsdlWithSelfClosingAddress,
      interfaceFileInfo,
      {
        serverUrls: ["http://server.example.com"],
      }
    );

    const expectedFileContent = wsdlWithSelfClosingAddress.replace(
      'location="http://example.com/old"',
      'location="http://server.example.com"'
    );

    expect(await result.text()).toBe(expectedFileContent);
    expect(expectedFileContent).toContain(
      '<soap:address data-custom="keep-me" location="http://server.example.com" another-attribute="still-here"/>'
    );
  });

  it("should ignore SOAP address examples inside XML comments", async () => {
    const wsdlWithCommentedAddress = file.replace(
      '<wsdl:port name="TestWS" binding="tns:TestWS">',
      `<wsdl:port name="TestWS" binding="tns:TestWS">
                        <!-- <soap:address location="http://commented.example.com"/> -->`
    );

    const result: File = await interpolateTemplateSoapApiSpec(
      eservice,
      wsdlWithCommentedAddress,
      interfaceFileInfo,
      eserviceInstanceInterfaceData
    );

    const expectedFileContent = wsdlWithCommentedAddress.replace(
      'location="https://host.com/TestWS/v1"',
      'location="http://server1.example.com"'
    );

    expect(await result.text()).toBe(expectedFileContent);
    expect(expectedFileContent).toContain(
      '<!-- <soap:address location="http://commented.example.com"/> -->'
    );
  });

  it("should throw invalidInterfaceFileDetected if server urls do not match SOAP addresses", async () => {
    await expect(
      interpolateTemplateSoapApiSpec(eservice, file, interfaceFileInfo, {
        ...eserviceInstanceInterfaceData,
        serverUrls: [
          "http://server1.example.com",
          "http://server2.example.com",
        ],
      })
    ).rejects.toThrowError(
      invalidInterfaceFileDetected({
        id: eservice.id,
        isEserviceTemplate: true,
      })
    );
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
