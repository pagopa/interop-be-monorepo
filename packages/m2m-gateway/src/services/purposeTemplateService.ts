import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeTemplateId, unsafeBrandId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { pollResourceUntilDeletion } from "../utils/polling.js";

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

      return data;
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
        excludeExpiredRiskAnalysis,
        handlesPersonalData,
        limit,
        offset,
      } = queryParams;

      logger.info(
        `Retrieving purpose templates with filters: purposeTitle ${purposeTitle}, creatorIds ${creatorIds.toString()}, eserviceIds ${eserviceIds.toString()}, states ${states.toString()}, targetTenantKind ${targetTenantKind}, excludeExpiredRiskAnalysis ${excludeExpiredRiskAnalysis}, handlesPersonalData ${handlesPersonalData}, limit ${limit}, offset ${offset}`
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
  };
}
