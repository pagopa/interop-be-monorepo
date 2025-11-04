import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeTemplateId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  isPolledVersionAtLeastMetadataTargetVersion,
  pollResourceWithMetadata,
} from "../utils/polling.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { toM2MGatewayApiPurposeTemplate } from "../api/purposeTemplateApiConverter.js";

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
        queries: queryParams,
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

      return data;
    },
  };
}
