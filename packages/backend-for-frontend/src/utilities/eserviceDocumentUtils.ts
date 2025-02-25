/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Readable } from "node:stream";
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import mime from "mime";
import { bffApi, catalogApi } from "pagopa-interop-api-clients";
import { FileManager, Logger, WithLogger } from "pagopa-interop-commons";
import {
  ApiError,
  Technology,
  genericError,
  technology,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import YAML from "yaml";
import { ZodError, z } from "zod";
import { config } from "../config/config.js";
import {
  ErrorCodes,
  interfaceExtractingInfoError,
  invalidInterfaceContentTypeDetected,
  invalidInterfaceFileDetected,
  openapiVersionNotRecognized,
} from "../model/errors.js";
import { CatalogProcessClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { ConfigurationDoc } from "../model/types.js";
import { apiTechnologyToTechnology } from "../api/catalogApiConverter.js";
import { calculateChecksum } from "./fileUtils.js";

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

// eslint-disable-next-line max-params
export async function verifyAndCreateDocument(
  fileManager: FileManager,
  id: string,
  technology: Technology,
  prettyName: string,
  kind: "INTERFACE" | "DOCUMENT",
  doc: File,
  documentId: string,
  createDocumentHandler: (
    path: string,
    serverUrls: string[],
    checksum: string
  ) => Promise<void>,
  logger: Logger
): Promise<void> {
  const contentType = doc.type;
  if (!contentType) {
    throw invalidInterfaceContentTypeDetected(id, "invalid", technology);
  }

  const serverUrls = await handleEServiceDocumentProcessing(
    {
      prettyName,
      kind,
      doc,
    },
    technology,
    id
  );
  const filePath = await fileManager.storeBytes(
    {
      bucket: config.eserviceDocumentsContainer,
      path: config.eserviceDocumentsPath,
      resourceId: documentId,
      name: doc.name,
      content: Buffer.from(await doc.arrayBuffer()),
    },
    logger
  );

  const checksum = await calculateChecksum(Readable.from(doc.stream()));
  try {
    await createDocumentHandler(filePath, serverUrls, checksum);
  } catch (error) {
    await fileManager.delete(
      config.eserviceDocumentsContainer,
      filePath,
      logger
    );
    throw error;
  }
}

const getFileType = (
  name: string
): "json" | "yaml" | "wsdl" | "xml" | undefined =>
  match(name.toLowerCase())
    .with(P.string.endsWith("json"), () => "json" as const)
    .with(
      P.string.endsWith("yaml"),
      P.string.endsWith("yml"),
      () => "yaml" as const
    )
    .with(P.string.endsWith("wsdl"), () => "wsdl" as const)
    .with(P.string.endsWith("xml"), () => "xml" as const)
    .otherwise(() => undefined);

function parseOpenApi(
  fileType: "json" | "yaml",
  file: string,
  eServiceId: string
) {
  try {
    return match(fileType)
      .with("json", () => JSON.parse(file))
      .with("yaml", () => YAML.parse(file))
      .exhaustive();
  } catch (error) {
    throw invalidInterfaceFileDetected(eServiceId);
  }
}

export const verifyAndCreateImportedDoc = async (
  catalogProcessClient: CatalogProcessClient,
  fileManager: FileManager,
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor,
  entriesMap: Map<string, AdmZip.IZipEntry>,
  doc: ConfigurationDoc,
  docType: "INTERFACE" | "DOCUMENT",
  context: WithLogger<BffAppContext>
  // eslint-disable-next-line max-params
): Promise<void> => {
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
    eservice.id,
    apiTechnologyToTechnology(eservice.technology),
    doc.prettyName,
    docType,
    file,
    documentId,
    async (filePath, serverUrls, checksum) => {
      await catalogProcessClient.createEServiceDocument(
        {
          documentId,
          prettyName: doc.prettyName,
          fileName: file.name,
          filePath,
          kind: docType,
          contentType: file.type,
          checksum,
          serverUrls,
        },
        {
          headers: context.headers,
          params: {
            eServiceId: eservice.id,
            descriptorId: descriptor.id,
          },
        }
      );
    },
    context.logger
  );
};

function handleOpenApiV2(openApi: Record<string, unknown>) {
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
}

function handleOpenApiV3(openApi: Record<string, unknown>) {
  const { data: servers, error } = z
    .array(z.object({ url: z.string() }))
    .safeParse(openApi.servers);
  if (error) {
    throw error;
  }

  return servers.flatMap((s) => s.url);
}

function processRestInterface(
  fileType: "json" | "yaml",
  file: string,
  eServiceId: string
) {
  const openApi = parseOpenApi(fileType, file, eServiceId);
  const { data: version, error } = z.string().safeParse(openApi.openapi);

  if (error) {
    throw openapiVersionNotRecognized("nd");
  }
  return match(version)
    .with("2.0", () => handleOpenApiV2(openApi))
    .with(P.string.startsWith("3."), () => handleOpenApiV3(openApi))
    .otherwise(() => {
      throw openapiVersionNotRecognized(version);
    });
}

function processSoapInterface(file: string) {
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
}

export async function handleEServiceDocumentProcessing(
  doc: bffApi.createEServiceDocument_Body,
  tech: Technology,
  eServiceId: string
) {
  const file = await doc.doc.text();
  try {
    return match({
      fileType: getFileType(doc.doc.name),
      technology: tech,
      kind: doc.kind,
    })
      .with(
        {
          kind: "INTERFACE",
          technology: technology.rest,
          fileType: P.union("json", "yaml"),
        },
        (f) => processRestInterface(f.fileType, file, eServiceId)
      )
      .with(
        {
          kind: "INTERFACE",
          technology: technology.soap,
          fileType: P.union("xml", "wsdl"),
        },
        () => processSoapInterface(file)
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
        P.instanceOf(ApiError<ErrorCodes>),
        P.instanceOf(ZodError),
        () => error
      )
      .otherwise(() => invalidInterfaceFileDetected(eServiceId));
  }
}
