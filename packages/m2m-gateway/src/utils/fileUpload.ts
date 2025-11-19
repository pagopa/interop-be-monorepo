/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Readable } from "stream";
import {
  catalogApi,
  eserviceTemplateApi,
  m2mGatewayApi,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import {
  calculateChecksum,
  FileManager,
  Logger,
  verifyAndCreateDocument,
} from "pagopa-interop-commons";
import {
  generateId,
  PurposeTemplateId,
  technology,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  CatalogProcessClient,
  EServiceTemplateProcessClient,
  PurposeTemplateProcessClient,
} from "../clients/clientsProvider.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { config } from "../config/config.js";
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
  fileUpload: m2mGatewayApi.FileUploadMultipart;
  catalogProcessClient: CatalogProcessClient;
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
  fileUpload: m2mGatewayApi.FileUploadMultipart;
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

export async function uploadAnswerAnnotationDocument({
  purposeTemplateId,
  fileUpload,
  purposeTemplateProcessClient,
  fileManager,
  logger,
  headers,
}: {
  purposeTemplateId: PurposeTemplateId;
  fileUpload: m2mGatewayApi.AnnotationDocumentUploadMultipart;
  purposeTemplateProcessClient: PurposeTemplateProcessClient;
  fileManager: FileManager;
  logger: Logger;
  headers: Headers;
}): Promise<
  WithMaybeMetadata<purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument>
> {
  const documentId = generateId();

  const path = await fileManager.storeBytes(
    {
      bucket: config.purposeTemplateDocumentsContainer,
      path: config.purposeTemplateDocumentsPath,
      resourceId: documentId,
      name: fileUpload.file.name,
      content: Buffer.from(await fileUpload.file.arrayBuffer()),
    },
    logger
  );

  const checksum = await calculateChecksum(
    Readable.from(fileUpload.file.stream())
  );

  try {
    return await purposeTemplateProcessClient.addRiskAnalysisTemplateAnswerAnnotationDocument(
      {
        documentId,
        prettyName: fileUpload.prettyName,
        name: fileUpload.file.name,
        path,
        contentType: fileUpload.file.type,
        checksum,
      },
      {
        headers,
        params: {
          id: purposeTemplateId,
          answerId: fileUpload.answerId,
        },
      }
    );
  } catch (error) {
    await fileManager.delete(
      config.purposeTemplateDocumentsContainer,
      path,
      logger
    );
    throw error;
  }
}
