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
  toGetPurposeTemplatesApiQueryParams,
  toM2MGatewayApiPurposeTemplate,
  toM2MGatewayApiRiskAnalysisTemplateAnnotationDocument,
} from "../api/purposeTemplateApiConverter.js";
import { toM2MGatewayApiEService } from "../api/eserviceApiConverter.js";
import { toM2MGatewayApiRiskAnalysisFormTemplate } from "../api/riskAnalysisFormTemplateApiConverter.js";
import { purposeTemplateRiskAnalysisFormNotFound } from "../model/errors.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResourceWithMetadata,
} from "../utils/polling.js";

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

  const pollPurposeTemplate = (
    response: WithMaybeMetadata<purposeTemplateApi.PurposeTemplate>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<purposeTemplateApi.PurposeTemplate>> =>
    pollResourceWithMetadata(() =>
      retrievePurposeTemplateById(unsafeBrandId(response.data.id), headers)
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
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
  };
}
