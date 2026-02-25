/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import {
  buildingSoapFileError,
  interfaceExtractingInfoError,
  interfaceExtractingSoapFieldError,
  parsingSoapFileError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  eserviceInterfaceAllowedFileType,
  EserviceSoapInterfaceType,
} from "./eserviceDocumentUtils.js";

const extractAddress = (parsedXml: any): string[] => {
  try {
    const port = parsedXml["wsdl:definitions"]["wsdl:service"]["wsdl:port"];
    return match(port)
      .with(P.shape({ "soap:address": { location: P.string } }), (port) => [
        port["soap:address"].location,
      ])
      .with(P.shape({ "soap12:address": { location: P.string } }), (port) => [
        port["soap12:address"].location,
      ])
      .with(
        P.array(
          P.union(
            P.shape({ "soap:address": { location: P.string } }),
            P.shape({ "soap12:address": { location: P.string } })
          )
        ),
        (port) =>
          port.map((add) =>
            "soap12:address" in add
              ? add["soap12:address"].location
              : add["soap:address"].location
          )
      )
      .otherwise(() => {
        throw interfaceExtractingSoapFieldError("soap:address");
      });
  } catch (e) {
    throw interfaceExtractingSoapFieldError("soap:address");
  }
};

const extractEndpoints = (parsedXml: any): string[] => {
  try {
    const binding = parsedXml["wsdl:definitions"]["wsdl:binding"];
    const operation = Array.isArray(binding)
      ? binding.flatMap((b) => b["wsdl:operation"])
      : binding["wsdl:operation"];

    return match(operation)
      .with(
        P.shape({ "soap:operation": { soapAction: P.string } }),
        (operation) => [operation["soap:operation"].soapAction]
      )
      .with(
        P.shape({ "soap12:operation": { soapAction: P.string } }),
        (operation) => [operation["soap12:operation"].soapAction]
      )
      .with(
        P.array(
          P.union(
            P.shape({ "soap:operation": { soapAction: P.string } }),
            P.shape({ "soap12:operation": { soapAction: P.string } })
          )
        ),
        (operations) =>
          operations.map((o) =>
            "soap12:operation" in o
              ? o["soap12:operation"].soapAction
              : o["soap:operation"].soapAction
          )
      )
      .otherwise(() => {
        throw interfaceExtractingSoapFieldError("soap:operation");
      });
  } catch (e) {
    throw interfaceExtractingSoapFieldError("soap:operation");
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
