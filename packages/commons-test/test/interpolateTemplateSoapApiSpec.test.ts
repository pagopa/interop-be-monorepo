import {
  interpolateTemplateSoapApiSpec,
  retrieveServerUrlsAPI,
} from "pagopa-interop-commons";
import {
  generateId,
  interfaceExtractingInfoError,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

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
    serverUrls: [{ url: "http://server1.example.com" }],
  };

  it.each(["wsdl", "xml"])(
    "should preserve the original %s spec except for location",
    async (name) => {
      const fileInfo = { ...interfaceFileInfo, name };
      const result: File = await interpolateTemplateSoapApiSpec(
        eservice,
        file,
        fileInfo,
        eserviceInstanceInterfaceData
      );

      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe(fileInfo.name);
      expect(result.type).toBe(interfaceFileInfo.contentType);

      expect(Buffer.from(await result.arrayBuffer())).toEqual(
        Buffer.from(
          file.replace(
            "https://host.com/TestWS/v1",
            "http://server1.example.com"
          )
        )
      );
    }
  );
  it("should preserve original documentation when server descriptions are provided", async () => {
    const documentedFile = file.replace(
      '<wsdl:port name="TestWS" binding="tns:TestWS">',
      '<wsdl:port name="TestWS" binding="tns:TestWS"><wsdl:documentation>Original documentation</wsdl:documentation>'
    );
    const dataWithDescriptions = {
      ...eserviceInstanceInterfaceData,
      serverUrls: [
        {
          url: "http://server1.example.com",
          description: "Primary production server",
        },
      ],
    };

    const result: File = await interpolateTemplateSoapApiSpec(
      eservice,
      documentedFile,
      interfaceFileInfo,
      dataWithDescriptions
    );

    expect(await result.text()).toBe(
      documentedFile.replace(
        "https://host.com/TestWS/v1",
        "http://server1.example.com"
      )
    );
  });
  it("should reject a URL count that differs from the original SOAP addresses", async () => {
    await expect(
      interpolateTemplateSoapApiSpec(eservice, file, interfaceFileInfo, {
        serverUrls: [],
      })
    ).rejects.toThrowError(
      invalidInterfaceFileDetected({
        id: eservice.id,
        isEserviceTemplate: true,
      })
    );
  });
  it("should validate the interpolated URLs with namespace aliases", async () => {
    const aliasedFile = file
      .replaceAll("wsdl:", "w:")
      .replace("xmlns:wsdl=", "xmlns:w=")
      .replaceAll("soap:", "s:")
      .replace("xmlns:soap=", "xmlns:s=");
    const result = await interpolateTemplateSoapApiSpec(
      eservice,
      aliasedFile,
      interfaceFileInfo,
      eserviceInstanceInterfaceData
    );

    expect(await result.text()).toBe(
      aliasedFile.replace(
        "https://host.com/TestWS/v1",
        "http://server1.example.com"
      )
    );
    await expect(
      retrieveServerUrlsAPI(result, "INTERFACE", "Soap", {
        id: eservice.id,
        isEserviceTemplate: true,
      })
    ).resolves.toEqual(["http://server1.example.com"]);
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
