/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import {
  buildingSoapFileError,
  interfaceExtractingInfoError,
  interfaceExtractingSoapFiledError,
  parsingSoapFileError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  eserviceInterfaceAllowedFileType,
  EserviceSoapInterfaceType,
} from "./eserviceDocumentUtils.js";

// Improvement: use a more specific type for parsed SOAP xml than any
type SoapFieldPort = { "soap:address": { location: string } };
type SoapFieldOperation = { "soap:operation": { soapAction: string } };

const extractAddress = (parsedXml: any): string[] => {
  try {
    const port = parsedXml["wsdl:definitions"]["wsdl:service"]["wsdl:port"];
    return match(port)
      .with(
        P.shape({ "soap:address": { location: P.string } }),
        (port: SoapFieldPort) => [port["soap:address"].location]
      )
      .with(
        P.array(P.shape({ "soap:address": { location: P.string } })),
        (port: SoapFieldPort[]) =>
          port.map((add) => add["soap:address"].location)
      )
      .otherwise(() => {
        throw interfaceExtractingSoapFiledError("soap:address");
      });
  } catch (e) {
    throw interfaceExtractingSoapFiledError("soap:address");
  }
};

// Improvement: use a more specific type for parsed SOAP xml than any
const extractEndpoints = (parsedXml: any): string[] => {
  try {
    const operation =
      parsedXml["wsdl:definitions"]["wsdl:binding"]["wsdl:operation"];
    return match(operation)
      .with(
        P.shape({ "soap:operation": { soapAction: P.string } }),
        (operation: SoapFieldOperation) => [
          operation["soap:operation"].soapAction,
        ]
      )
      .with(
        P.array(P.shape({ "soap:operation": { soapAction: P.string } })),
        (operations: SoapFieldOperation[]) =>
          operations.map((o) => o["soap:operation"].soapAction)
      )
      .otherwise(() => {
        throw interfaceExtractingSoapFiledError("soap:operation");
      });
  } catch (e) {
    throw interfaceExtractingSoapFiledError("soap:operation");
  }
};

export const soapParse = (file: string) => {
  try {
    return new XMLParser({
      ignoreDeclaration: false,
      removeNSPrefix: false,
      attributeNamePrefix: "",
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
            attributeNamePrefix: "",
            format: true,
          }).build(file);
          return Buffer.from(xmlDataStr);
        } catch (e) {
          throw buildingSoapFileError();
        }
      }
    )
    .exhaustive();
