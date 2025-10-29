import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import {
  PurposeTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(clients: PagoPAInteropBeClients) {
  const retrievePurposeTemplateById = async (
    purposeTemplateId: PurposeTemplateId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<m2mGatewayApi.PurposeTemplate>> =>
    await clients.purposeTemplateProcessClient.getPurposeTemplate({
      params: {
        id: purposeTemplateId,
      },
      headers,
    });

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

      return data;
    },
    async getPurposeTemplates(
      queryParams: m2mGatewayApi.GetPurposeTemplatesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeTemplates> {
      const { limit, offset } = queryParams;

      logger.info(
        `Getting purpose templates with filters: ${JSON.stringify(queryParams)}`
      );

      const {
        data: { results, totalCount },
      } = await clients.purposeTemplateProcessClient.getPurposeTemplates({
        queries: queryParams,
        headers,
      });

      return {
        results,
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async getRiskAnalysisTemplateAnswerAnnotationDocument({
      purposeTemplateId,
      answerId,
      documentId,
      ctx,
    }: {
      purposeTemplateId: PurposeTemplateId;
      answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
      documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId;
      ctx: WithLogger<M2MGatewayAppContext>;
    }): Promise<m2mGatewayApi.RiskAnalysisTemplateAnswerAnnotationDocument> {
      const { headers, logger } = ctx;
      logger.info(
        `Retrieving risk analysis template answer annotation document ${documentId} for purpose template ${purposeTemplateId} and answer ${answerId}`
      );

      const { data } =
        await clients.purposeTemplateProcessClient.getRiskAnalysisTemplateAnswerAnnotationDocument(
          {
            params: {
              purposeTemplateId,
              answerId,
              documentId,
            },
            headers,
          }
        );

      return data;
    },
    async createPurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async updatePurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async deletePurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async suspendPurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async archivePurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async unsuspendPurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async publishPurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
  };
}
