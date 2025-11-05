import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeTemplateId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetPurposeTemplatesApiQueryParams,
  toM2MGatewayApiPurposeTemplate,
} from "../api/purposeTemplateApiConverter.js";

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(clients: PagoPAInteropBeClients) {
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
    async getPurposeTemplateEServiceDescriptors(
      purposeTemplateId: PurposeTemplateId,
      queryParams: m2mGatewayApi.GetPurposeTemplateEServiceDescriptorsQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptorsPurposeTemplate> {
      const { producerIds, eserviceName, limit, offset } = queryParams;

      logger.info(
        `Retrieving e-service descriptors linked to purpose template ${purposeTemplateId} with filters: producerIds ${producerIds.toString()}, eserviceName ${eserviceName}, limit ${limit}, offset ${offset}`
      );

      const {
        data: { results, totalCount },
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

      return {
        results,
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
  };
}
