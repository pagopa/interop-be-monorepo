import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeTemplateId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  toGetPurposeTemplatesApiQueryParams,
  toM2MGatewayApiPurposeTemplate,
  toM2MGatewayApiRiskAnalysisTemplateAnnotationDocument,
} from "../api/purposeTemplateApiConverter.js";

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(clients: PagoPAInteropBeClients) {
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
  };
}
