/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import {
  interfaceExtractingInfoError,
  buildingSoapFileError,
  parsingSoapFileError,
  interfaceExtractingSoapFiledError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  eserviceInterfaceAllowedFileType,
  EserviceSoapInterfaceType,
} from "./eserviceDocumentUtils.js";

// Improvement: use a more specific type for parsed SOAP xml than any
const extractAddress = (parsedXml: any): string[] => {
  try {
    return parsedXml["wsdl:definitions"]["wsdl:service"]["wsdl:port"].map(
      (b: { "soap:address": { "@_location": string } }) =>
        b["soap:address"]["@_location"]
    );
  } catch (e) {
    throw interfaceExtractingSoapFiledError("soap:address");
  }
};

// Improvement: use a more specific type for parsed SOAP xml than any
const extractEndpoints = (parsedXml: any): string[] => {
  try {
    return parsedXml["wsdl:definitions"]["wsdl:binding"]["wsdl:operation"].map(
      (b: { "soap:operation": { "@_soapAction": string } }) =>
        b["soap:operation"]["@_soapAction"]
    );
  } catch (e) {
    throw interfaceExtractingSoapFiledError("soap:operation");
  }
};

export const soapParse = (file: string) => {
  try {
    return new XMLParser({
      ignoreDeclaration: false,
      removeNSPrefix: false,
      ignoreAttributes: false,
      isArray: (name: string) =>
        ["operation", "port", "binding"].indexOf(name) !== -1,
    }).parse(file);
  } catch (e) {
    throw parsingSoapFileError();
  }
};

export const retrieveServerUrlsSoapAPI = (file: string): string[] => {
  const parsedXml = soapParse(file);
  const address = extractAddress(parsedXml);
  if (address.length === 0) {
    throw interfaceExtractingInfoError();
  }
  const endpoints = extractEndpoints(parsedXml);
  if (endpoints.length === 0) {
    throw interfaceExtractingInfoError();
  }

  return address;
};

export const soapApiFileToBuffer: (
  fileType: EserviceSoapInterfaceType,
  jsonApi: object
) => Buffer = (fileType, file) =>
  match(fileType)
    .with(
      eserviceInterfaceAllowedFileType.xml,
      eserviceInterfaceAllowedFileType.wsdl,
      () => {
        try {
          const xmlDataStr: string = new XMLBuilder({
            ignoreAttributes: false,
          }).build(file);
          return Buffer.from(xmlDataStr);
        } catch (e) {
          throw buildingSoapFileError();
        }
      }
    )
    .exhaustive();
