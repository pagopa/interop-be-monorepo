/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from "crypto";
import { Readable } from "node:stream";
import SwaggerParser from "@apidevtools/swagger-parser";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import mime from "mime";
import {
  bffApi,
  catalogApi,
  eserviceTemplateApi,
} from "pagopa-interop-api-clients";
import { FileManager, Logger, WithLogger } from "pagopa-interop-commons";
import {
  ApiError,
  EServiceDocumentId,
  Technology,
  descriptorState,
  genericError,
  technology,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import YAML from "yaml";
import { ZodError, z } from "zod";
import {
  apiDescriptorStateToDescriptorState,
  apiTechnologyToTechnology,
} from "../api/catalogApiConverter.js";
import { CatalogProcessClient } from "../clients/clientsProvider.js";
import { config } from "../config/config.js";
import {
  ErrorCodes,
  eserviceDescriptorDraftNotFound,
  eserviceInterfaceDataNotValid,
  interfaceExtractingInfoError,
  invalidInterfaceContentTypeDetected,
  invalidInterfaceFileDetected,
  openapiVersionNotRecognized,
  tooManyDescriptorForInterfaceWithTemplate,
} from "../model/errors.js";
import { ConfigurationDoc } from "../model/types.js";
import { BffAppContext } from "../utilities/context.js";
import { calculateChecksum } from "./fileUtils.js";

export const allowedFileType = {
  json: "json",
  yaml: "yaml",
  wsdl: "wsdl",
  xml: "xml",
} as const;
export const AllowedFileType = z.enum([
  Object.values(allowedFileType)[0],
  ...Object.values(allowedFileType).slice(1),
]);
export type AllowedFileType = z.infer<typeof AllowedFileType>;

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
export async function verifyAndCreateDocument<T>(
  fileManager: FileManager,
  id: string,
  technology: Technology,
  prettyName: string,
  kind: "INTERFACE" | "DOCUMENT",
  doc: File,
  documentId: string,
  documentContainer: string,
  documentPath: string,
  createDocumentHandler: (
    path: string,
    serverUrls: string[],
    checksum: string
  ) => Promise<T>,
  logger: Logger
): Promise<T> {
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
    return await createDocumentHandler(filePath, serverUrls, checksum);
  } catch (error) {
    await fileManager.delete(documentContainer, filePath, logger);
    throw error;
  }
}

const getFileType = (name: string): AllowedFileType | undefined =>
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
  fileType: Omit<AllowedFileType, "wsdl" | "xml">,
  file: string,
  eServiceId: string
) {
  return match(fileType)
    .with("json", () => JSON.parse(file))
    .with("yaml", () => YAML.parse(file))
    .otherwise(() => {
      throw invalidInterfaceFileDetected(eServiceId);
    });
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
    config.eserviceDocumentsContainer,
    config.eserviceDocumentsPath,
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

// eslint-disable-next-line max-params
export async function createOpenApiInterfaceByTemplate(
  eservice: catalogApi.EService,
  eserviceTemplateInterface: eserviceTemplateApi.EServiceDoc,
  eserviceInstanceInterfaceData: bffApi.EserviceInterfaceTemplatePayload,
  bucket: string,
  fileManager: FileManager,
  catalogProcessClient: CatalogProcessClient,
  { logger, headers }: WithLogger<BffAppContext>
): Promise<catalogApi.EServiceDoc["id"]> {
  const interfaceTemplate = await fileManager.get(
    bucket,
    eserviceTemplateInterface.path,
    logger
  );

  if (eserviceInstanceInterfaceData.serverUrls.length < 1) {
    throw eserviceInterfaceDataNotValid();
  }

  const documentId = unsafeBrandId<EServiceDocumentId>(randomUUID());
  const updatedInterfaceFile = await interpolateOpenApiSpec(
    eservice,
    Buffer.from(interfaceTemplate).toString(),
    eserviceTemplateInterface,
    eserviceInstanceInterfaceData
  );

  const descriptor = retrieveDraftDescriptor(eservice);

  return await verifyAndCreateDocument<catalogApi.EServiceDoc["id"]>(
    fileManager,
    eservice.id,
    apiTechnologyToTechnology(eservice.technology),
    eserviceTemplateInterface.name,
    "INTERFACE",
    updatedInterfaceFile,
    documentId,
    async (
      filePath,
      serverUrls,
      checksum
    ): Promise<catalogApi.EServiceDoc["id"]> => {
      const documentPath = await fileManager.storeBytes(
        {
          bucket,
          path: filePath,
          resourceId: documentId,
          name: eserviceTemplateInterface.name,
          content: await fileToBuffer(updatedInterfaceFile),
        },
        logger
      );

      const { id } = await catalogProcessClient.createEServiceDocument(
        {
          documentId,
          prettyName: eserviceTemplateInterface.prettyName,
          fileName: eserviceTemplateInterface.name,
          filePath: documentPath,
          kind: "INTERFACE",
          contentType: eserviceTemplateInterface.contentType,
          checksum,
          serverUrls,
        },
        {
          headers,
          params: {
            eServiceId: eservice.id,
            descriptorId: descriptor.id,
          },
        }
      );

      return id;
    },
    logger
  );
}

async function interpolateOpenApiSpec(
  eservice: catalogApi.EService,
  file: string,
  eserviceTemplateInterface: eserviceTemplateApi.EServiceDoc,
  eserviceInstanceInterfaceData: bffApi.EserviceInterfaceTemplatePayload
): Promise<File> {
  const fileType = getFileType(eserviceTemplateInterface.name);
  if (!fileType) {
    throw invalidInterfaceContentTypeDetected(
      eservice.id,
      eserviceTemplateInterface.contentType,
      eservice.technology
    );
  }

  const openApiObject = match(fileType)
    .with("json", "yaml", () => parseOpenApi(fileType, file, eservice.id))
    .otherwise(() => {
      throw invalidInterfaceFileDetected(eservice.id);
    });

  openApiObject.info.contact = {
    name: eserviceInstanceInterfaceData.contactName,
    email: eserviceInstanceInterfaceData.email,
    url: eserviceInstanceInterfaceData.contactUrl,
  };

  openApiObject.info.termsOfService =
    eserviceInstanceInterfaceData.termsAndConditionsUrl;

  openApiObject.servers = eserviceInstanceInterfaceData.serverUrls.map(
    (url) => ({
      url,
    })
  );

  try {
    await SwaggerParser.validate(openApiObject);
    const updatedInterface = Buffer.from(JSON.stringify(openApiObject));

    return new File([updatedInterface], eserviceTemplateInterface.name, {
      type: eserviceTemplateInterface.contentType,
    });
  } catch (errors) {
    throw invalidInterfaceFileDetected(eservice.id);
  }
}

function retrieveDraftDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor {
  if (eservice.descriptors.length !== 1) {
    throw tooManyDescriptorForInterfaceWithTemplate(eservice.id);
  }

  const draftDescriptor = eservice.descriptors.find(
    (descriptor) =>
      apiDescriptorStateToDescriptorState(descriptor.state) ===
      descriptorState.draft
  );

  if (!draftDescriptor) {
    throw eserviceDescriptorDraftNotFound(eservice.id);
  }

  return draftDescriptor;
}

async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
