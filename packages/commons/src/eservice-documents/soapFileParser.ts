/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { XMLParser } from "fast-xml-parser";
import {
  interfaceExtractingInfoError,
  interfaceExtractingSoapFiledError,
  parsingSoapFileError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";

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
        throw interfaceExtractingSoapFiledError("soap:address");
      });
  } catch (e) {
    throw interfaceExtractingSoapFiledError("soap:address");
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

const soapAddressLocationRegexp =
  /(<(?:soap|soap12):address\b[^>]*\blocation\s*=\s*)(["'])([^"']*)(\2[^>]*\/?>)/g;

export const updateSoapApiFileServerUrls = (
  file: string,
  serverUrls: string[]
): Buffer => {
  retrieveServerUrlsSoapAPI(file);

  const soapAddressLocationMatches = Array.from(
    file.matchAll(soapAddressLocationRegexp)
  );

  if (soapAddressLocationMatches.length !== serverUrls.length) {
    throw interfaceExtractingInfoError();
  }

  const updatedFile = soapAddressLocationMatches.reduceRight(
    (currentFile, match, index) => {
      const [soapAddress, prefix, quote, , suffix] = match;
      const matchIndex = match.index;

      return `${currentFile.slice(0, matchIndex)}${prefix}${quote}${
        serverUrls[index]
      }${suffix}${currentFile.slice(matchIndex + soapAddress.length)}`;
    },
    file
  );

  return Buffer.from(updatedFile);
};
