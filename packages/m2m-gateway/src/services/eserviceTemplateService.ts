import { eserviceTemplateApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetEServiceTemplatesQueryParams,
  toM2MGatewayEServiceTemplate,
  toM2MGatewayEServiceTemplateVersion,
} from "../api/eserviceTemplateApiConverter.js";
import { eserviceTemplateVersionNotFound } from "../model/errors.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  pollResourceWithMetadata,
  isPolledVersionAtLeastResponseVersion,
} from "../utils/polling.js";

export type EserviceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder(
  clients: PagoPAInteropBeClients
) {
  const retrieveEServiceTemplateById = async (
    headers: M2MGatewayAppContext["headers"],
    templateId: EServiceTemplateId
  ): Promise<WithMaybeMetadata<eserviceTemplateApi.EServiceTemplate>> =>
    await clients.eserviceTemplateProcessClient.getEServiceTemplateById({
      params: {
        templateId,
      },
      headers,
    });

  const pollEServiceTemplate = (
    response: WithMaybeMetadata<eserviceTemplateApi.EServiceTemplate>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<eserviceTemplateApi.EServiceTemplate>> =>
    pollResourceWithMetadata(() =>
      retrieveEServiceTemplateById(headers, unsafeBrandId(response.data.id))
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    async getEServiceTemplateById(
      templateId: EServiceTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(`Retrieving eservice template with id ${templateId}`);

      const { data } = await retrieveEServiceTemplateById(headers, templateId);

      return toM2MGatewayEServiceTemplate(data);
    },
    async getEServiceTemplateVersions(
      templateId: EServiceTemplateId,
      queryParams: m2mGatewayApi.GetEServiceTemplateVersionsQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersions> {
      const { state, limit, offset } = queryParams;

      logger.info(
        `Retrieving versions of eservice template with id ${templateId}, offset ${offset}, limit ${limit}, state ${state}`
      );

      const { data } = await retrieveEServiceTemplateById(headers, templateId);

      const filteredVersions = state
        ? data.versions.filter((version) => version.state === state)
        : data.versions;

      const paginatedVersions = filteredVersions.slice(offset, offset + limit);

      return {
        results: paginatedVersions.map(toM2MGatewayEServiceTemplateVersion),
        pagination: {
          limit,
          offset,
          totalCount: filteredVersions.length,
        },
      };
    },
    async getEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersion> {
      logger.info(
        `Retrieving version ${versionId} of eservice template with id ${templateId}`
      );

      const { data } =
        await clients.eserviceTemplateProcessClient.getEServiceTemplateById({
          headers,
          params: { templateId },
        });

      const version = data.versions.find((v) => v.id === versionId);

      if (!version) {
        throw eserviceTemplateVersionNotFound(templateId, versionId);
      }

      return toM2MGatewayEServiceTemplateVersion(version);
    },
    async getEServiceTemplates(
      params: m2mGatewayApi.GetEServiceTemplatesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplates> {
      logger.info(
        `Retrieving eserviceTemplates with creatorsIds ${params.creatorIds} templatesIds ${params.eserviceTemplateIds} offset ${params.offset} limit ${params.limit}`
      );

      const {
        data: { results, totalCount },
      } = await clients.eserviceTemplateProcessClient.getEServiceTemplates({
        queries: toGetEServiceTemplatesQueryParams(params),
        headers,
      });

      return {
        results: results.map(toM2MGatewayEServiceTemplate),
        pagination: {
          limit: params.limit,
          offset: params.offset,
          totalCount,
        },
      };
    },
    async createEServiceTemplate(
      seed: m2mGatewayApi.EServiceTemplateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(`Creating eservice template with name ${seed.name}`);

      const response =
        await clients.eserviceTemplateProcessClient.createEServiceTemplate(
          seed,
          {
            headers,
          }
        );
      const polledResource = await pollEServiceTemplate(response, headers);
      return toM2MGatewayEServiceTemplate(polledResource.data);
    },
    async updateEServiceTemplateDescription(
      templateId: EServiceTemplateId,
      seed: m2mGatewayApi.EServiceTemplateDescriptionUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(
        `Updating description for published eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.updateEServiceTemplateDescription(
          seed,
          {
            params: { templateId },
            headers,
          }
        );
      const polledResource = await pollEServiceTemplate(response, headers);
      return toM2MGatewayEServiceTemplate(polledResource.data);
    },
    async updateEServiceTemplateIntendedTarget(
      templateId: EServiceTemplateId,
      seed: m2mGatewayApi.EServiceTemplateIntendedTargetUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(
        `Updating intended target for published eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.updateEServiceTemplateIntendedTarget(
          seed,
          {
            params: { templateId },
            headers,
          }
        );
      const polledResource = await pollEServiceTemplate(response, headers);
      return toM2MGatewayEServiceTemplate(polledResource.data);
    },
    async updateEServiceTemplateName(
      templateId: EServiceTemplateId,
      seed: m2mGatewayApi.EServiceTemplateNameUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(
        `Updating name for published eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.updateEServiceTemplateName(
          seed,
          {
            params: { templateId },
            headers,
          }
        );
      const polledResource = await pollEServiceTemplate(response, headers);
      return toM2MGatewayEServiceTemplate(polledResource.data);
    },
    async createEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersion> {
      logger.info(
        `Creating new version for eservice template with id ${templateId}`
      );

      const createdVersion =
        await clients.eserviceTemplateProcessClient.createEServiceTemplateVersion(
          undefined,
          {
            params: { templateId },
            headers,
          }
        );

      // Poll the template to ensure the version was created
      const polledTemplate = await pollEServiceTemplate(
        {
          ...(await retrieveEServiceTemplateById(headers, templateId)),
          metadata: createdVersion.metadata,
        },
        headers
      );

      const version = polledTemplate.data.versions.find(
        (v) => v.id === createdVersion.data.id
      );
      if (!version) {
        throw eserviceTemplateVersionNotFound(
          templateId,
          unsafeBrandId(createdVersion.data.id)
        );
      }
      return toM2MGatewayEServiceTemplateVersion(version);
    },
    async updateEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      seed: {
        description?: string;
        voucherLifespan?: number;
        dailyCallsPerConsumer?: number;
        dailyCallsTotal?: number;
        agreementApprovalPolicy?: "AUTOMATIC" | "MANUAL";
      },
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersion> {
      logger.info(
        `Updating version ${versionId} of eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.patchUpdateDraftTemplateVersion(
          seed,
          {
            params: { templateId, templateVersionId: versionId },
            headers,
          }
        );
      const polledResource = await pollEServiceTemplate(response, headers);

      const version = polledResource.data.versions.find(
        (v) => v.id === versionId
      );
      if (!version) {
        throw eserviceTemplateVersionNotFound(templateId, versionId);
      }
      return toM2MGatewayEServiceTemplateVersion(version);
    },
    async deleteEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting version ${versionId} for eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.deleteDraftTemplateVersion(
          undefined,
          {
            params: { templateId, templateVersionId: versionId },
            headers,
          }
        );
      await pollEServiceTemplate(
        {
          ...(await retrieveEServiceTemplateById(headers, templateId)),
          metadata: response.metadata,
        },
        headers
      );
    },
    async suspendEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersion> {
      logger.info(
        `Suspending version ${versionId} for eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.suspendTemplateVersion(
          undefined,
          {
            params: { templateId, templateVersionId: versionId },
            headers,
          }
        );

      // Poll the template to ensure the version was suspended
      const polledTemplate = await pollEServiceTemplate(
        {
          ...(await retrieveEServiceTemplateById(headers, templateId)),
          metadata: response.metadata,
        },
        headers
      );
      const version = polledTemplate.data.versions.find(
        (v) => v.id === versionId
      );
      if (!version) {
        throw eserviceTemplateVersionNotFound(templateId, versionId);
      }
      return toM2MGatewayEServiceTemplateVersion(version);
    },
    async unsuspendEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersion> {
      logger.info(
        `Unsuspending version ${versionId} for eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.activateTemplateVersion(
          undefined,
          {
            params: { templateId, templateVersionId: versionId },
            headers,
          }
        );

      // Poll the template to ensure the version was unsuspended
      const polledTemplate = await pollEServiceTemplate(
        {
          ...(await retrieveEServiceTemplateById(headers, templateId)),
          metadata: response.metadata,
        },
        headers
      );
      const version = polledTemplate.data.versions.find(
        (v) => v.id === versionId
      );
      if (!version) {
        throw eserviceTemplateVersionNotFound(templateId, versionId);
      }
      return toM2MGatewayEServiceTemplateVersion(version);
    },
    async publishEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersion> {
      logger.info(
        `Publishing version ${versionId} for eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.publishTemplateVersion(
          undefined,
          {
            params: { templateId, templateVersionId: versionId },
            headers,
          }
        );

      // Poll the template to ensure the version was published
      const polledTemplate = await pollEServiceTemplate(
        {
          ...(await retrieveEServiceTemplateById(headers, templateId)),
          metadata: response.metadata,
        },
        headers
      );
      const version = polledTemplate.data.versions.find(
        (v) => v.id === versionId
      );
      if (!version) {
        throw eserviceTemplateVersionNotFound(templateId, versionId);
      }
      return toM2MGatewayEServiceTemplateVersion(version);
    },
  };
}
