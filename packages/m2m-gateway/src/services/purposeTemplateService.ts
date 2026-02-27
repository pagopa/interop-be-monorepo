import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  FileManager,
  validateAndStorePDFDocument,
  WithLogger,
} from "pagopa-interop-commons";
import {
  generateId,
  EServiceId,
  PurposeTemplateId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { downloadDocument, DownloadedDocument } from "../utils/fileDownload.js";
import { config } from "../config/config.js";
import {
  isPolledVersionAtLeastMetadataTargetVersion,
  isPolledVersionAtLeastResponseVersion,
  pollResourceUntilDeletion,
  pollResourceWithMetadata,
} from "../utils/polling.js";

import {
  toGetPurposeTemplatesApiQueryParams,
  toM2MGatewayApiDocument,
  toM2MGatewayApiPurposeTemplate,
  toM2MGatewayApiRiskAnalysisTemplateAnnotationDocument,
  toPurposeTemplateApiRiskAnalysisFormTemplateSeed,
} from "../api/purposeTemplateApiConverter.js";
import { toM2MGatewayApiEService } from "../api/eserviceApiConverter.js";
import { toM2MGatewayApiRiskAnalysisFormTemplate } from "../api/riskAnalysisFormTemplateApiConverter.js";
import { purposeTemplateRiskAnalysisFormNotFound } from "../model/errors.js";

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  clients: PagoPAInteropBeClients,
  fileManager: FileManager
) {
  const retrievePurposeTemplateById = async (
    purposeTemplateId: PurposeTemplateId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<purposeTemplateApi.PurposeTemplate>> =>
    await clients.purposeTemplateProcessClient.getPurposeTemplate({
      params: {
        id: purposeTemplateId,
      },
      headers,
    });

  const retrieveEServiceDescriptorPurposeTemplate = async (
    purposeTemplateId: PurposeTemplateId,
    eserviceId: EServiceId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<
    WithMaybeMetadata<purposeTemplateApi.EServiceDescriptorPurposeTemplate>
  > =>
    await clients.purposeTemplateProcessClient.getPurposeTemplateEServiceDescriptor(
      {
        params: {
          id: purposeTemplateId,
          eserviceId,
        },
        headers,
      }
    );

  const pollPurposeTemplateUntilDeletion = (
    purposeTemplateId: PurposeTemplateId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<void> =>
    pollResourceUntilDeletion(() =>
      retrievePurposeTemplateById(unsafeBrandId(purposeTemplateId), headers)
    )({});

  const pollServiceDescriptorPurposeTemplateUntilDeletion = (
    purposeTemplateId: PurposeTemplateId,
    eserviceId: EServiceId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<void> =>
    pollResourceUntilDeletion(() =>
      retrieveEServiceDescriptorPurposeTemplate(
        purposeTemplateId,
        eserviceId,
        headers
      )
    )({});

  const pollPurposeTemplate = (
    response: WithMaybeMetadata<purposeTemplateApi.PurposeTemplate>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<purposeTemplateApi.PurposeTemplate>> =>
    pollResourceWithMetadata(() =>
      retrievePurposeTemplateById(unsafeBrandId(response.data.id), headers)
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  const pollPurposeTemplateById = (
    purposeTemplateId: PurposeTemplateId,
    metadata: { version: number } | undefined,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<m2mGatewayApi.PurposeTemplate>> =>
    pollResourceWithMetadata(() =>
      retrievePurposeTemplateById(purposeTemplateId, headers)
    )({
      condition: isPolledVersionAtLeastMetadataTargetVersion(metadata),
    });

  return {
    async getPurposeTemplates(
      queryParams: m2mGatewayApi.GetPurposeTemplatesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeTemplates> {
      const {
        purposeTitle,
        creatorIds,
        eserviceIds,
        states,
        targetTenantKind,
        handlesPersonalData,
        limit,
        offset,
      } = queryParams;

      logger.info(
        `Retrieving purpose templates with filters: purposeTitle ${purposeTitle}, creatorIds ${creatorIds.toString()}, eserviceIds ${eserviceIds.toString()}, states ${states.toString()}, targetTenantKind ${targetTenantKind}, handlesPersonalData ${handlesPersonalData}, limit ${limit}, offset ${offset}`
      );

      const {
        data: { results, totalCount },
      } = await clients.purposeTemplateProcessClient.getPurposeTemplates({
        queries: toGetPurposeTemplatesApiQueryParams(queryParams),
        headers,
      });

      return {
        results: results.map(toM2MGatewayApiPurposeTemplate),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async getPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeTemplate> {
      logger.info(`Retrieving purpose template with id ${purposeTemplateId}`);

      const { data } = await retrievePurposeTemplateById(
        purposeTemplateId,
        headers
      );

      return toM2MGatewayApiPurposeTemplate(data);
    },
    async getPurposeTemplateRiskAnalysis(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.RiskAnalysisFormTemplate> {
      logger.info(
        `Retrieving risk analysis of purpose template with id ${purposeTemplateId}`
      );

      const { data } = await retrievePurposeTemplateById(
        purposeTemplateId,
        headers
      );

      if (!data.purposeRiskAnalysisForm) {
        throw purposeTemplateRiskAnalysisFormNotFound(purposeTemplateId);
      }

      return toM2MGatewayApiRiskAnalysisFormTemplate(
        data.purposeRiskAnalysisForm
      );
    },
    async getRiskAnalysisTemplateAnnotationDocuments(
      purposeTemplateId: PurposeTemplateId,
      {
        offset,
        limit,
      }: m2mGatewayApi.GetEServiceDescriptorDocumentsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.RiskAnalysisTemplateAnnotationDocuments> {
      logger.info(
        `Retrieving annotation documents for purpose template ${purposeTemplateId}`
      );

      const {
        data: { results, totalCount },
      } =
        await clients.purposeTemplateProcessClient.getRiskAnalysisTemplateAnnotationDocuments(
          {
            params: {
              purposeTemplateId,
            },
            queries: {
              offset,
              limit,
            },
            headers,
          }
        );

      return {
        results: results.map(
          toM2MGatewayApiRiskAnalysisTemplateAnnotationDocument
        ),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async uploadRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: PurposeTemplateId,
      fileUpload: m2mGatewayApi.RiskAnalysisTemplateAnnotationDocumentUploadMultipart,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Document> {
      logger.info(
        `Adding document ${fileUpload.file.name} to annotation documents for purpose template ${purposeTemplateId} for answer ${fileUpload.answerId}`
      );

      const documentId = generateId();

      const { data: document, metadata } = await validateAndStorePDFDocument(
        fileManager,
        purposeTemplateId,
        fileUpload.file,
        documentId,
        config.purposeTemplateDocumentsContainer,
        config.purposeTemplateDocumentsPath,
        fileUpload.prettyName,
        async (
          documentId: string,
          fileName: string,
          filePath: string,
          prettyName: string,
          contentType: string,
          checksum: string
        ): Promise<
          WithMaybeMetadata<purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument>
          // eslint-disable-next-line max-params
        > =>
          await clients.purposeTemplateProcessClient.addRiskAnalysisTemplateAnswerAnnotationDocument(
            {
              documentId,
              prettyName,
              name: fileName,
              path: filePath,
              contentType,
              checksum,
            },
            {
              headers,
              params: {
                id: purposeTemplateId,
                answerId: fileUpload.answerId,
              },
            }
          ),
        logger
      );

      await pollPurposeTemplateById(purposeTemplateId, metadata, headers);

      return toM2MGatewayApiDocument(document);
    },
    async getPurposeTemplateEServices(
      purposeTemplateId: PurposeTemplateId,
      queryParams: m2mGatewayApi.GetPurposeTemplateEServicesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServices> {
      const { producerIds, eserviceName, limit, offset } = queryParams;

      logger.info(
        `Retrieving e-service descriptors linked to purpose template ${purposeTemplateId} with filters: producerIds ${producerIds.toString()}, eserviceName ${eserviceName}, limit ${limit}, offset ${offset}`
      );

      const {
        data: { results: processResults, totalCount },
      } =
        await clients.purposeTemplateProcessClient.getPurposeTemplateEServices({
          params: { id: purposeTemplateId },
          queries: {
            producerIds,
            eserviceName,
            limit,
            offset,
          },
          headers,
        });

      const eserviceIds = processResults.map(({ eserviceId }) => eserviceId);
      const eservices = await clients.catalogProcessClient
        .getEServices({
          queries: { eservicesIds: eserviceIds, offset: 0, limit },
          headers,
        })
        .then(({ data: eService }) => eService.results);

      return {
        results: eservices.map(toM2MGatewayApiEService),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async downloadRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: PurposeTemplateId,
      documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<DownloadedDocument> {
      logger.info(
        `Retrieving risk analysis template answer annotation document ${documentId} for purpose template ${purposeTemplateId}`
      );

      const { data: document } =
        await clients.purposeTemplateProcessClient.getRiskAnalysisTemplateAnnotationDocument(
          {
            params: {
              purposeTemplateId,
              documentId,
            },
            headers,
          }
        );

      return downloadDocument(
        document,
        fileManager,
        config.purposeTemplateDocumentsContainer,
        logger
      );
    },
    async publishPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeTemplate> {
      logger.info(`Publishing purpose template ${purposeTemplateId}`);

      const { metadata } =
        await clients.purposeTemplateProcessClient.publishPurposeTemplate(
          undefined,
          {
            params: { id: purposeTemplateId },
            headers,
          }
        );

      const { data } = await pollPurposeTemplateById(
        purposeTemplateId,
        metadata,
        headers
      );

      return toM2MGatewayApiPurposeTemplate(data);
    },
    async archivePurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeTemplate> {
      logger.info(`Archiving purpose template ${purposeTemplateId}`);

      const { metadata } =
        await clients.purposeTemplateProcessClient.archivePurposeTemplate(
          undefined,
          {
            params: { id: purposeTemplateId },
            headers,
          }
        );

      const { data } = await pollPurposeTemplateById(
        purposeTemplateId,
        metadata,
        headers
      );

      return toM2MGatewayApiPurposeTemplate(data);
    },
    async unsuspendPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeTemplate> {
      logger.info(`Unsuspending purpose template ${purposeTemplateId}`);

      const { metadata } =
        await clients.purposeTemplateProcessClient.unsuspendPurposeTemplate(
          undefined,
          {
            params: { id: purposeTemplateId },
            headers,
          }
        );

      const { data } = await pollPurposeTemplateById(
        purposeTemplateId,
        metadata,
        headers
      );

      return toM2MGatewayApiPurposeTemplate(data);
    },
    async suspendPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeTemplate> {
      logger.info(`Suspending purpose template ${purposeTemplateId}`);

      const { metadata } =
        await clients.purposeTemplateProcessClient.suspendPurposeTemplate(
          undefined,
          {
            params: { id: purposeTemplateId },
            headers,
          }
        );

      const { data } = await pollPurposeTemplateById(
        purposeTemplateId,
        metadata,
        headers
      );

      return toM2MGatewayApiPurposeTemplate(data);
    },
    async createPurposeTemplate(
      purposeTemplateSeed: m2mGatewayApi.PurposeTemplateSeed,
      { logger, headers, authData }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeTemplate> {
      logger.info(
        `Creating purpose template for creator ${authData.organizationId}`
      );

      const purposeResponse =
        await clients.purposeTemplateProcessClient.createPurposeTemplate(
          {
            targetDescription: purposeTemplateSeed.targetDescription,
            targetTenantKind: purposeTemplateSeed.targetTenantKind,
            purposeTitle: purposeTemplateSeed.purposeTitle,
            purposeDescription: purposeTemplateSeed.purposeDescription,
            purposeIsFreeOfCharge: purposeTemplateSeed.purposeIsFreeOfCharge,
            purposeFreeOfChargeReason:
              purposeTemplateSeed.purposeFreeOfChargeReason,
            purposeDailyCalls: purposeTemplateSeed.purposeDailyCalls,
            handlesPersonalData: purposeTemplateSeed.handlesPersonalData,
          },
          { headers }
        );

      const polledResource = await pollPurposeTemplate(
        purposeResponse,
        headers
      );

      return toM2MGatewayApiPurposeTemplate(polledResource.data);
    },
    async updateDraftPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      seed: m2mGatewayApi.PurposeTemplateDraftUpdateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeTemplate> {
      logger.info(
        `Updating draft Purpose Template with id ${purposeTemplateId}`
      );

      const response =
        await clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById(
          seed,
          {
            params: { id: purposeTemplateId },
            headers,
          }
        );
      const polledResource = await pollPurposeTemplate(response, headers);
      return toM2MGatewayApiPurposeTemplate(polledResource.data);
    },
    async deletePurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(`Deleting purpose template with id ${purposeTemplateId}`);

      await clients.purposeTemplateProcessClient.deletePurposeTemplate(
        undefined,
        {
          params: { id: purposeTemplateId },
          headers,
        }
      );

      await pollPurposeTemplateUntilDeletion(purposeTemplateId, headers);
    },
    async deleteRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: PurposeTemplateId,
      documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(`Deleting purpose template with id ${purposeTemplateId}`);

      const { metadata } =
        await clients.purposeTemplateProcessClient.deleteRiskAnalysisTemplateAnnotationDocument(
          undefined,
          {
            params: { purposeTemplateId, documentId },
            headers,
          }
        );

      await pollPurposeTemplateById(purposeTemplateId, metadata, headers);
    },
    async replacePurposeTemplateRiskAnalysis(
      purposeTemplateId: PurposeTemplateId,
      riskAnalysisFormSeed: m2mGatewayApi.RiskAnalysisFormTemplateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.RiskAnalysisFormTemplate> {
      logger.info(
        `Replacing risk analysis form template for purpose template ${purposeTemplateId}`
      );

      const { data: riskAnalysisForm, metadata } =
        await clients.purposeTemplateProcessClient.updatePurposeTemplateRiskAnalysis(
          toPurposeTemplateApiRiskAnalysisFormTemplateSeed(
            riskAnalysisFormSeed
          ),
          {
            params: {
              purposeTemplateId,
            },
            headers,
          }
        );

      await pollPurposeTemplateById(purposeTemplateId, metadata, headers);

      return toM2MGatewayApiRiskAnalysisFormTemplate(riskAnalysisForm);
    },
    async addPurposeTemplateEService(
      purposeTemplateId: PurposeTemplateId,
      { eserviceId }: m2mGatewayApi.PurposeTemplateLinkEService,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Linking e-service ${eserviceId} to purpose template ${purposeTemplateId}`
      );

      const { metadata } =
        await clients.purposeTemplateProcessClient.linkEServicesToPurposeTemplate(
          {
            eserviceIds: [eserviceId],
          },
          {
            headers,
            params: {
              id: purposeTemplateId,
            },
          }
        );

      await pollPurposeTemplateById(purposeTemplateId, metadata, headers);
    },
    async removePurposeTemplateEService(
      purposeTemplateId: PurposeTemplateId,
      eserviceId: EServiceId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Unlinking e-service ${eserviceId} from purpose template ${purposeTemplateId}`
      );

      await clients.purposeTemplateProcessClient.unlinkEServicesFromPurposeTemplate(
        {
          eserviceIds: [eserviceId],
        },
        {
          headers,
          params: {
            id: purposeTemplateId,
          },
        }
      );

      await pollServiceDescriptorPurposeTemplateUntilDeletion(
        purposeTemplateId,
        eserviceId,
        headers
      );
    },
  };
}
