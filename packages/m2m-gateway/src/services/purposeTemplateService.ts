import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
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
  pollResourceUntilDeletion,
  pollResourceWithMetadata,
} from "../utils/polling.js";
import {
  isPolledVersionAtLeastMetadataTargetVersion,
  pollResourceWithMetadata,
} from "../utils/polling.js";

import {
  toGetPurposeTemplatesApiQueryParams,
  toM2MGatewayApiPurposeTemplate,
  toM2MGatewayApiRiskAnalysisTemplateAnnotationDocument,
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

  const pollPurposeTemplateUntilDeletion = (
    purposeTemplateId: PurposeTemplateId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<void> =>
    pollResourceUntilDeletion(() =>
      retrievePurposeTemplateById(unsafeBrandId(purposeTemplateId), headers)
    )({});

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
  };
}
