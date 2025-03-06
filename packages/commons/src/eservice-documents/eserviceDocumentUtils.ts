import { randomUUID } from "crypto";
import { Readable } from "stream";
import SwaggerParser from "@apidevtools/swagger-parser";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import mime from "mime";
import {
  ApiError,
  CommonErrorCodes,
  EService,
  EServiceId,
  genericError,
  interfaceExtractingInfoError,
  invalidInterfaceContentTypeDetected,
  invalidInterfaceFileDetected,
  openapiVersionNotRecognized,
  technology,
  Technology,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import YAML from "yaml";
import { z, ZodError } from "zod";
import { calculateChecksum, FileManager, Logger } from "../index.js";

export const eserviceInterfaceAllowedFileType = {
  json: "json",
  yaml: "yaml",
  wsdl: "wsdl",
  xml: "xml",
} as const;
export const EserviceInterfaceAllowedFileType = z.enum([
  Object.values(eserviceInterfaceAllowedFileType)[0],
  ...Object.values(eserviceInterfaceAllowedFileType).slice(1),
]);
export type EserviceInterfaceAllowedFileType = z.infer<
  typeof EserviceInterfaceAllowedFileType
>;

export type EserviceRestInterfaceType = Extract<
  EserviceInterfaceAllowedFileType,
  "json" | "yaml"
>;

export type EserviceSoapInterfaceType = Extract<
  EserviceInterfaceAllowedFileType,
  "wsdl" | "xml"
>;

const Wsdl = z.object({
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

const getInterfaceFileType = (
  name: string
): EserviceInterfaceAllowedFileType | undefined =>
  match(name.toLowerCase())
    .with(
      P.string.endsWith("json"),
      () => eserviceInterfaceAllowedFileType.json
    )
    .with(
      P.string.endsWith("yaml"),
      P.string.endsWith("yml"),
      () => eserviceInterfaceAllowedFileType.yaml
    )
    .with(
      P.string.endsWith("wsdl"),
      () => eserviceInterfaceAllowedFileType.wsdl
    )
    .with(P.string.endsWith("xml"), () => eserviceInterfaceAllowedFileType.xml)
    .otherwise(() => undefined);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const parseOpenApi = (
  // Temporary type workaround to avoid Wsdl and Xml
  fileType: EserviceRestInterfaceType,
  file: string
) =>
  match(fileType)
    .with("json", () => JSON.parse(file))
    .with("yaml", () => YAML.parse(file))
    .exhaustive();

const retrieveServerUrlsOpenApiV2 = (
  openApi: Record<string, unknown>
): string[] => {
  const { data, error } = z
    .object({
      host: z.string(),
      paths: z.array(z.object({})),
    })
    .safeParse(openApi);

  if (error) {
    throw error;
  }

  return [data.host];
};

const retriesceServerUrlsOpenApiV3 = (
  openApi: Record<string, unknown>
): string[] => {
  const { data: servers, error } = z
    .array(z.object({ url: z.string() }))
    .safeParse(openApi.servers);
  if (error) {
    throw error;
  }

  return servers.flatMap((s) => s.url);
};

const processRestInterface = (
  fileType: EserviceRestInterfaceType,
  file: string
): string[] => {
  const openApi = parseOpenApi(fileType, file);
  const { data: version, error } = z.string().safeParse(openApi.openapi);

  if (error) {
    throw openapiVersionNotRecognized("nd");
  }
  return match(version)
    .with("2.0", () => retrieveServerUrlsOpenApiV2(openApi))
    .with(P.string.startsWith("3."), () =>
      retriesceServerUrlsOpenApiV3(openApi)
    )
    .otherwise(() => {
      throw openapiVersionNotRecognized(version);
    });
};

const processSoapInterface = (file: string): string[] => {
  const xml = new XMLParser({
    ignoreDeclaration: true,
    removeNSPrefix: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name: string) =>
      ["operation", "port", "binding"].indexOf(name) !== -1,
  }).parse(file);

  const { data: parsedXml, success, error } = Wsdl.safeParse(xml);

  if (!success) {
    throw error;
  }

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

export const interpolateOpenApiSpec = async (
  eservice: EService,
  file: string,
  interfaceFileInfo: {
    id: string;
    name: string;
    contentType: string;
    prettyName: string;
  },
  eserviceInstanceInterfaceData: {
    contactName: string;
    email: string;
    contactUrl: string;
    termsAndConditionsUrl: string;
    serverUrls: string[];
  }
): Promise<File> => {
  const fileType = getInterfaceFileType(interfaceFileInfo.name);
  const openApiObject = match(fileType)
    .with(
      eserviceInterfaceAllowedFileType.json,
      eserviceInterfaceAllowedFileType.yaml,
      (fileType) => parseOpenApi(fileType, file)
    )
    .otherwise(() => {
      throw invalidInterfaceFileDetected(eservice.id);
    });

  /* eslint-disable functional/immutable-data */
  openApiObject.info.termsOfService =
    eserviceInstanceInterfaceData.termsAndConditionsUrl;
  openApiObject.info.contact = {
    name: eserviceInstanceInterfaceData.contactName,
    email: eserviceInstanceInterfaceData.email,
    url: eserviceInstanceInterfaceData.contactUrl,
  };
  openApiObject.servers = eserviceInstanceInterfaceData.serverUrls.map(
    (url) => ({
      url,
    })
  );
  /* eslint-enable */

  try {
    await SwaggerParser.validate(openApiObject);
    const updatedInterface = Buffer.from(JSON.stringify(openApiObject));

    return new File([updatedInterface], interfaceFileInfo.name, {
      type: interfaceFileInfo.contentType,
    });
  } catch (errors) {
    throw invalidInterfaceFileDetected(eservice.id);
  }
};

export const extractEServiceUrlsFrom = async (
  file: File,
  kind: "INTERFACE" | "DOCUMENT",
  tech: Technology,
  resourceId: string // logging purpose
): Promise<string[]> => {
  const fileContent = await file.text();
  try {
    return match({
      fileType: getInterfaceFileType(file.name),
      technology: tech,
      kind,
    })
      .with(
        {
          kind: "INTERFACE",
          technology: technology.rest,
          fileType: P.union("json", "yaml"),
        },
        (f) => processRestInterface(f.fileType, fileContent)
      )
      .with(
        {
          kind: "INTERFACE",
          technology: technology.soap,
          fileType: P.union("xml", "wsdl"),
        },
        () => processSoapInterface(fileContent)
      )
      .with(
        {
          kind: "DOCUMENT",
        },
        () => []
      )
      .otherwise(() => {
        throw new Error();
      });
  } catch (error) {
    throw match(error)
      .with(
        P.instanceOf(ApiError<CommonErrorCodes>),
        P.instanceOf(ZodError),
        () => error
      )
      .otherwise(() => invalidInterfaceFileDetected(resourceId));
  }
};

// eslint-disable-next-line max-params
export async function verifyAndCreateDocument<T>(
  fileManager: FileManager,
  resourceId: string, // logging purpose
  technology: Technology,
  kind: "INTERFACE" | "DOCUMENT",
  doc: File,
  documentId: string,
  documentContainer: string,
  documentPath: string,
  prettyName: string,
  createDocumentHandler: (
    documentId: string,
    fileName: string,
    filePath: string,
    prettyName: string,
    kind: "INTERFACE" | "DOCUMENT",
    serverUrls: string[],
    contentType: string,
    checksum: string
  ) => Promise<T>,
  logger: Logger
): Promise<T> {
  const contentType = doc.type;
  if (!contentType) {
    throw invalidInterfaceContentTypeDetected(
      resourceId,
      "invalid",
      technology
    );
  }

  const serverUrls = await extractEServiceUrlsFrom(
    doc,
    kind,
    technology,
    resourceId
  );

  const filePath = await fileManager.storeBytes(
    {
      bucket: documentContainer,
      path: documentPath,
      resourceId: documentId,
      name: doc.name,
      content: Buffer.from(await doc.arrayBuffer()),
    },
    logger
  );
  const checksum = await calculateChecksum(Readable.from(doc.stream()));

  try {
    return await createDocumentHandler(
      documentId,
      doc.name,
      filePath,
      prettyName,
      kind,
      serverUrls,
      contentType,
      checksum
    );
  } catch (error) {
    await fileManager.delete(documentContainer, filePath, logger);
    throw error;
  }
}

export const verifyAndCreateImportedDoc = async <T>(
  fileManager: FileManager,
  eserviceId: EServiceId,
  technology: Technology,
  entriesMap: Map<string, AdmZip.IZipEntry>,
  doc: {
    prettyName: string;
    path: string;
  },
  kind: "INTERFACE" | "DOCUMENT",
  createDocumentHandler: (
    documentId: string,
    fileName: string,
    filePath: string,
    prettyName: string,
    kind: "INTERFACE" | "DOCUMENT",
    serverUrls: string[],
    contentType: string,
    checksum: string
  ) => Promise<T>,
  eserviceDocumentsContainer: string,
  eserviceDocumentsPath: string,
  logger: Logger
): // eslint-disable-next-line max-params
Promise<void> => {
  const entry = entriesMap.get(doc.path);
  if (!entry) {
    throw genericError("Invalid file");
  }

  const mimeType = mime.getType(doc.path) || "application/octet-stream";

  const file = new File([entry.getData()], doc.path, {
    type: mimeType,
  });

  const documentId = randomUUID();

  await verifyAndCreateDocument(
    fileManager,
    eserviceId,
    technology,
    kind,
    file,
    documentId,
    eserviceDocumentsContainer,
    eserviceDocumentsPath,
    doc.prettyName,
    createDocumentHandler,
    logger
  );
};
