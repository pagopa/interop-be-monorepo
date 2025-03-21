import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { interfaceExtractingInfoError } from "pagopa-interop-models";
import { z } from "zod";
import { match } from "ts-pattern";
import {
  eserviceInterfaceAllowedFileType,
  EserviceSoapInterfaceType,
} from "./eserviceDocumentUtils.js";

export const Wsdl = z.object({
  definitions: z.object({
    binding: z.array(
      z.object({
        operation: z.array(
          z.object({
            name: z.string(),
          })
        ),
      })
    ),
    service: z.object({
      port: z.array(
        z.object({
          address: z.object({ location: z.string() }),
        })
      ),
    }),
  }),
});
export type Wsdl = z.infer<typeof Wsdl>;

const soapParser = (file: string): Wsdl => {
  const xml = new XMLParser({
    ignoreDeclaration: true,
    removeNSPrefix: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name: string) =>
      ["operation", "port", "binding"].indexOf(name) !== -1,
  }).parse(file);

  const { data, success, error } = Wsdl.safeParse(xml);
  if (!success) {
    throw error;
  }
  return data;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const parseSoapApi = (
  fileType: EserviceSoapInterfaceType,
  file: string
): Wsdl =>
  match(fileType)
    .with(
      eserviceInterfaceAllowedFileType.wsdl,
      eserviceInterfaceAllowedFileType.xml,
      () => soapParser(file)
    )
    .exhaustive();

export const retrieveServerUrlsSoapAPI = (file: string): string[] => {
  const parsedXml = soapParser(file);

  const address = parsedXml.definitions.service.port.map(
    (p) => p.address.location
  );
  if (address.length === 0) {
    throw interfaceExtractingInfoError();
  }

  const endpoints = parsedXml.definitions.binding.flatMap((b) =>
    b.operation.map((o) => o.name)
  );
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
        const xmlDataStr: string = new XMLBuilder().build(file);
        return Buffer.from(xmlDataStr);
      }
    )
    .exhaustive();
