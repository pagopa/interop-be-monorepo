/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  catalogApi,
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  FileManager,
  Logger,
  verifyAndCreateDocument,
} from "pagopa-interop-commons";
import { generateId, technology } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { config } from "../config/config.js";
import {
  CatalogProcessClientWithMetadata,
  EServiceTemplateProcessClient,
} from "../clients/clientsProvider.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { Headers } from "./context.js";

export async function uploadEServiceDocument({
  eservice,
  descriptorId,
  documentKind,
  fileUpload,
  catalogProcessClient,
  fileManager,
  logger,
  headers,
}: {
  eservice: catalogApi.EService;
  descriptorId: string;
  documentKind: catalogApi.EServiceDocumentKind;
  fileUpload: m2mGatewayApiV3.FileUploadMultipart;
  catalogProcessClient: CatalogProcessClientWithMetadata;
  fileManager: FileManager;
  logger: Logger;
  headers: Headers;
}): Promise<WithMaybeMetadata<catalogApi.EServiceDoc>> {
  return await verifyAndCreateDocument(
    fileManager,
    { id: eservice.id, isEserviceTemplate: false },
    match(eservice.technology)
      .with("REST", () => technology.rest)
      .with("SOAP", () => technology.soap)
      .exhaustive(),
    documentKind,
    fileUpload.file,
    generateId(),
    config.eserviceDocumentsContainer,
    config.eserviceDocumentsPath,
    fileUpload.prettyName,
    async (
      documentId,
      fileName,
      filePath,
      prettyName,
      kind,
      serverUrls,
      contentType,
      checksum
      // eslint-disable-next-line max-params
    ) =>
      await catalogProcessClient.createEServiceDocument(
        {
          documentId,
          prettyName,
          fileName,
          filePath,
          kind,
          contentType,
          checksum,
          serverUrls,
        },
        {
          headers,
          params: {
            eServiceId: eservice.id,
            descriptorId,
          },
        }
      ),
    logger
  );
}

export async function uploadEServiceTemplateDocument({
  eserviceTemplate,
  versionId,
  documentKind,
  fileUpload,
  eserviceTemplateProcessClient,
  fileManager,
  logger,
  headers,
}: {
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate;
  versionId: string;
  documentKind: eserviceTemplateApi.EServiceDocumentKind;
  fileUpload: m2mGatewayApiV3.FileUploadMultipart;
  eserviceTemplateProcessClient: EServiceTemplateProcessClient;
  fileManager: FileManager;
  logger: Logger;
  headers: Headers;
}): Promise<WithMaybeMetadata<eserviceTemplateApi.EServiceDoc>> {
  return await verifyAndCreateDocument(
    fileManager,
    { id: eserviceTemplate.id, isEserviceTemplate: true },
    match(eserviceTemplate.technology)
      .with("REST", () => technology.rest)
      .with("SOAP", () => technology.soap)
      .exhaustive(),
    documentKind,
    fileUpload.file,
    generateId(),
    config.eserviceTemplateDocumentsContainer,
    config.eserviceTemplateDocumentsPath,
    fileUpload.prettyName,
    async (
      documentId,
      fileName,
      filePath,
      prettyName,
      kind,
      serverUrls,
      contentType,
      checksum
      // eslint-disable-next-line max-params
    ) =>
      await eserviceTemplateProcessClient.createEServiceTemplateDocument(
        {
          documentId,
          prettyName,
          fileName,
          filePath,
          kind,
          contentType,
          checksum,
          serverUrls,
        },
        {
          headers,
          params: {
            templateId: eserviceTemplate.id,
            templateVersionId: versionId,
          },
        }
      ),
    logger
  );
}
