import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
  PurposeTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { downloadDocument, DownloadedDocument } from "../utils/fileDownload.js";
import { config } from "../config/config.js";
import { pollResourceUntilDeletion } from "../utils/polling.js";
import {
  toGetPurposeTemplatesApiQueryParams,
  toM2MGatewayApiPurposeTemplate,
} from "../api/purposeTemplateApiConverter.js";

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

  const pollPurposeTemplateUntilDeletion = (
    purposeTemplateId: PurposeTemplateId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<void> =>
    pollResourceUntilDeletion(() =>
      retrievePurposeTemplateById(unsafeBrandId(purposeTemplateId), headers)
    )({});

  return {
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
      answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
      documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(`Deleting purpose template with id ${purposeTemplateId}`);

      await clients.purposeTemplateProcessClient.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        undefined,
        {
          params: { purposeTemplateId, answerId, documentId },
          headers,
        }
      );

      await pollPurposeTemplateUntilDeletion(purposeTemplateId, headers);
    },
  };
}
