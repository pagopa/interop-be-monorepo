/* eslint-disable max-params */
import { randomUUID } from "crypto";
import { Readable } from "stream";
import SwaggerParser from "@apidevtools/swagger-parser";
import AdmZip from "adm-zip";
import mime from "mime";
import {
  ApiError,
  CommonErrorCodes,
  EService,
  EServiceId,
  genericError,
  interfaceExtractingInfoError,
  invalidContentTypeDetected,
  invalidInterfaceData,
  invalidInterfaceFileDetected,
  invalidServerUrl,
  openapiVersionNotRecognized,
  technology,
  Technology,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { z, ZodError } from "zod";
import { calculateChecksum } from "../utils/fileUtils.js";
import { FileManager } from "../file-manager/fileManager.js";
import { Logger } from "../logging/index.js";
import {
  parseOpenApi,
  restApiFileToBuffer,
  retriesceServerUrlsOpenApiV3,
  retrieveServerUrlsOpenApiV2,
} from "./restFileParser.js";
import {
  retrieveServerUrlsSoapAPI,
  soapApiFileToBuffer,
  soapParse,
} from "./soapFileParser.js";

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

const retrieveServerUrlsRestAPI = (
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

export const interpolateTemplateApiSpec = async (
  eservice: EService,
  file: string,
  interfaceFileInfo: {
    id: string;
    name: string;
    contentType: string;
    prettyName: string;
  },
  serverUrls: string[],
  eserviceInstanceInterfaceRestData:
    | {
        contactEmail: string;
        contactName: string;
        contactUrl?: string;
        termsAndConditionsUrl?: string;
      }
    | undefined
): Promise<File> => {
  const fileType = getInterfaceFileType(interfaceFileInfo.name);
  return match([fileType, eserviceInstanceInterfaceRestData])
    .with(
      [eserviceInterfaceAllowedFileType.json, P.not(P.nullish)],
      [eserviceInterfaceAllowedFileType.yaml, P.not(P.nullish)],
      ([_, contactData]) =>
        interpolateTemplateRestApiSpec(eservice, file, interfaceFileInfo, {
          serverUrls,
          ...contactData,
        })
    )
    .with(
      [eserviceInterfaceAllowedFileType.wsdl, P.nullish],
      [eserviceInterfaceAllowedFileType.xml, P.nullish],
      () =>
        interpolateTemplateSoapApiSpec(eservice, file, interfaceFileInfo, {
          serverUrls,
        })
    )
    .otherwise(() => {
      throw invalidInterfaceData({ id: eservice.id, isEserviceTemplate: true });
    });
};

export const interpolateTemplateRestApiSpec = async (
  eservice: EService,
  file: string,
  interfaceFileInfo: {
    id: string;
    name: string;
    contentType: string;
    prettyName: string;
  },
  eserviceInstanceInterfaceData: {
    contactName?: string;
    contactEmail?: string;
    contactUrl?: string;
    termsAndConditionsUrl?: string;
    serverUrls: string[];
  }
): Promise<File> => {
  const fileType = getInterfaceFileType(interfaceFileInfo.name);
  const { concreteFileType, jsonApi } = match(fileType)
    .with(
      eserviceInterfaceAllowedFileType.json,
      eserviceInterfaceAllowedFileType.yaml,
      (fileType) => ({
        concreteFileType: fileType,
        jsonApi: parseOpenApi(fileType, file),
      })
    )
    .otherwise(() => {
      throw invalidInterfaceFileDetected({
        id: eservice.id,
        isEserviceTemplate: true,
      });
    });

  /* eslint-disable functional/immutable-data */
  jsonApi.info.termsOfService =
    eserviceInstanceInterfaceData.termsAndConditionsUrl;
  jsonApi.info.contact = {
    name: eserviceInstanceInterfaceData.contactName,
    email: eserviceInstanceInterfaceData.contactEmail,
    url: eserviceInstanceInterfaceData.contactUrl,
  };
  jsonApi.servers = eserviceInstanceInterfaceData.serverUrls.map((url) => ({
    url,
  }));
  /* eslint-enable */

  try {
    await SwaggerParser.validate(jsonApi);
    const updatedInterfaceBuffer = restApiFileToBuffer(
      concreteFileType,
      jsonApi
    );

    return new File([updatedInterfaceBuffer], interfaceFileInfo.name, {
      type: interfaceFileInfo.contentType,
    });
  } catch (errors) {
    throw invalidInterfaceFileDetected({
      id: eservice.id,
      isEserviceTemplate: true,
    });
  }
};

export const interpolateTemplateSoapApiSpec = async (
  eservice: EService,
  file: string,
  interfaceFileInfo: {
    id: string;
    name: string;
    contentType: string;
    prettyName: string;
  },
  eserviceInstanceInterfaceData: {
    serverUrls: string[];
  }
): Promise<File> => {
  const fileType = getInterfaceFileType(interfaceFileInfo.name);
  const { concreteFileType, jsonApi } = match(fileType)
    .with(
      eserviceInterfaceAllowedFileType.wsdl,
      eserviceInterfaceAllowedFileType.xml,
      (fileType) => ({
        concreteFileType: fileType,
        jsonApi: soapParse(file),
      })
    )
    .otherwise(() => {
      throw interfaceExtractingInfoError();
    });

  /* ======================================================
    NOTE : SOAP protocol does not have specific fields for
    - termsOfService
    - name
    - email
    - contactUrl
    this data is not present in the final WSDL file
  ========================================================= */

  const urlsPorts = eserviceInstanceInterfaceData.serverUrls.map((url) => ({
    "soap:address": {
      location: url,
    },
  }));

  // eslint-disable-next-line functional/immutable-data
  const interpolatedJsonApi = {
    ...jsonApi,
    "wsdl:definitions": {
      ...jsonApi["wsdl:definitions"],
      "wsdl:service": {
        "wsdl:port": [...urlsPorts],
      },
    },
  };

  try {
    const updatedInterfaceBuffer = match(concreteFileType)
      .with(
        eserviceInterfaceAllowedFileType.wsdl,
        eserviceInterfaceAllowedFileType.xml,
        (fileType) => soapApiFileToBuffer(fileType, interpolatedJsonApi)
      )
      .otherwise(() => {
        throw interfaceExtractingInfoError();
      });

    return new File([updatedInterfaceBuffer], interfaceFileInfo.name, {
      type: interfaceFileInfo.contentType,
    });
  } catch (errors) {
    throw invalidInterfaceFileDetected({
      id: eservice.id,
      isEserviceTemplate: true,
    });
  }
};

export const retrieveServerUrlsAPI = async (
  file: File,
  kind: "INTERFACE" | "DOCUMENT",
  tech: Technology,
  resource: {
    id: string;
    isEserviceTemplate: boolean;
  }
): Promise<string[]> => {
  const fileContent = await file.text();
  try {
    const serverUrls = match({
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
        (f) => retrieveServerUrlsRestAPI(f.fileType, fileContent)
      )
      .with(
        {
          kind: "INTERFACE",
          technology: technology.soap,
          fileType: P.union("xml", "wsdl"),
        },
        () => retrieveServerUrlsSoapAPI(fileContent)
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

    // Validate that all returned strings are valid URLs
    for (const url of serverUrls) {
      const { success } = z.string().url().safeParse(url);
      if (!success) {
        throw invalidServerUrl(resource);
      }
    }

    return serverUrls;
  } catch (error) {
    throw match(error)
      .with(
        P.instanceOf(ApiError<CommonErrorCodes>),
        P.instanceOf(ZodError),
        () => error
      )
      .otherwise(() => invalidInterfaceFileDetected(resource));
  }
};

// eslint-disable-next-line max-params
export async function verifyAndCreateDocument<T>(
  fileManager: FileManager,
  resource: {
    // logging purposes
    id: string;
    isEserviceTemplate: boolean;
  },
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
    throw invalidContentTypeDetected(resource, "invalid", technology);
  }

  const serverUrls = await retrieveServerUrlsAPI(
    doc,
    kind,
    technology,
    resource
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

export const verifyAndCreateImportedDocument = async <T>(
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
    { id: eserviceId, isEserviceTemplate: false },
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
