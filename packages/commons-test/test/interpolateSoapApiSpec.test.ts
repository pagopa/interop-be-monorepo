import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { describe, expect, it } from "vitest";
import {
  generateId,
  interfaceExtractingInfoError,
} from "pagopa-interop-models";
import { interpolateSoapApiSpec } from "pagopa-interop-commons";
import { getMockEService } from "../src/index.js";

const readFileContent = async (fileName: string): Promise<string> => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templatePath = `./resources/${fileName}`;

  const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
  return htmlTemplateBuffer.toString();
};

describe("interpolateSoapApiSpec", async () => {
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
    serverUrls: ["http://server1.example.com", "http://server2.example.com"],
  };

  it("should interpolate SOAP API spec", async () => {
    const result: File = await interpolateSoapApiSpec(
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
      .replace(/\t/g, "") // Rimuovi tabulazioni
      .replace(/\n/g, "") // Rimuovi a capo
      .replace(/\s+/g, " ") // Sostituisci spazi multipli con uno spazio
      .trim(); // Rimuovi spazi iniziali e finali

    const normalizedExpectedContent = expectedFileContent
      .toString()
      .replace(/\t/g, "")
      .replace(/\n/g, "")
      .replace(/\s+/g, " ")
      .trim();

    expect(normalizedFileContent).toBe(normalizedExpectedContent);
  });
  it("should throw interfaceExtractingInfoError if fileType is not supported", async () => {
    const interfaceFileInfo = {
      id: generateId(),
      name: "pdf",
      contentType: "application/pdf",
      prettyName: "Test Interface",
    };

    await expect(
      interpolateSoapApiSpec(
        eservice,
        file,
        interfaceFileInfo,
        eserviceInstanceInterfaceData
      )
    ).rejects.toThrowError(interfaceExtractingInfoError());
  });
});
