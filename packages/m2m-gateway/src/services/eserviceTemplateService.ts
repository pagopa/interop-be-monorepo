import { eserviceTemplateApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  RiskAnalysisId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MGatewayApiEServiceTemplateRiskAnalysis,
  toM2MGatewayEServiceTemplate,
  toM2MGatewayEServiceTemplateVersion,
  toGetEServiceTemplatesQueryParams,
} from "../api/eserviceTemplateApiConverter.js";
import {
  eserviceTemplateRiskAnalysisNotFound,
  eserviceTemplateVersionNotFound,
} from "../model/errors.js";
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
  const retrieveEServiceTemplateRiskAnalysisById = (
    eserviceTemplate: WithMaybeMetadata<eserviceTemplateApi.EServiceTemplate>,
    riskAnalysisId: RiskAnalysisId
  ): eserviceTemplateApi.EServiceTemplateRiskAnalysis => {
    const riskAnalysis = eserviceTemplate.data.riskAnalysis.find(
      (r) => r.id === riskAnalysisId
    );

    if (!riskAnalysis) {
      throw eserviceTemplateRiskAnalysisNotFound(
        eserviceTemplate.data.id,
        riskAnalysisId
      );
    }

    return riskAnalysis;
  };

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
  const retrieveEServiceTemplateVersionById = (
    eserviceTemplate: WithMaybeMetadata<eserviceTemplateApi.EServiceTemplate>,
    versionId: EServiceTemplateVersionId
  ): eserviceTemplateApi.EServiceTemplateVersion => {
    const version = eserviceTemplate.data.versions.find(
      (v) => v.id === versionId
    );

    if (!version) {
      throw eserviceTemplateVersionNotFound(
        unsafeBrandId(eserviceTemplate.data.id),
        versionId
      );
    }

    return version;
  };

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

      const { data } =
        await clients.eserviceTemplateProcessClient.getEServiceTemplateById({
          headers,
          params: { templateId },
        });

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

      const { data } =
        await clients.eserviceTemplateProcessClient.getEServiceTemplateById({
          headers,
          params: { templateId },
        });

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

      const eserviceTemplate = await retrieveEServiceTemplateById(
        headers,
        templateId
      );

      const version = retrieveEServiceTemplateVersionById(
        eserviceTemplate,
        versionId
      );

      return toM2MGatewayEServiceTemplateVersion(version);
    },

    async createEServiceTemplateRiskAnalysis(
      templateId: EServiceTemplateId,
      body: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateRiskAnalysis> {
      logger.info(
        `Creating Risk Analysis for E-Service Template ${templateId}`
      );

      const {
        data: { eserviceTemplate, createdRiskAnalysisId },
        metadata,
      } =
        await clients.eserviceTemplateProcessClient.createEServiceTemplateRiskAnalysis(
          body,
          {
            params: { templateId },
            headers,
          }
        );

      await pollEServiceTemplate(
        {
          data: eserviceTemplate,
          metadata,
        },
        headers
      );

      const createdRiskAnalysis = retrieveEServiceTemplateRiskAnalysisById(
        { data: eserviceTemplate, metadata },
        unsafeBrandId(createdRiskAnalysisId)
      );

      return toM2MGatewayApiEServiceTemplateRiskAnalysis(createdRiskAnalysis);
    },

    async getEServiceTemplateRiskAnalyses(
      templateId: EServiceTemplateId,
      {
        limit,
        offset,
      }: m2mGatewayApi.GetEServiceTemplateRiskAnalysesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateRiskAnalyses> {
      logger.info(
        `Retrieving Risk Analyses for E-Service Template ${templateId}`
      );

      const { data: eserviceTemplate } = await retrieveEServiceTemplateById(
        headers,
        templateId
      );

      const paginated = eserviceTemplate.riskAnalysis.slice(
        offset,
        offset + limit
      );

      return {
        results: paginated.map(toM2MGatewayApiEServiceTemplateRiskAnalysis),
        pagination: {
          limit,
          offset,
          totalCount: eserviceTemplate.riskAnalysis.length,
        },
      };
    },
    async getEServiceTemplates(
      params: m2mGatewayApi.GetEServiceTemplatesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplates> {
      logger.info(
        `Retrieving eservice templates with creatorsIds ${params.creatorIds} templatesIds ${params.eserviceTemplateIds} offset ${params.offset} limit ${params.limit}`
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
    async updateDraftEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      seed: eserviceTemplateApi.PatchUpdateDraftEServiceTemplateVersionSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersion> {
      logger.info(
        `Updating draft version ${versionId} of eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.patchUpdateDraftTemplateVersion(
          {
            ...seed,
            attributes: undefined,
          },
          {
            params: { templateId, templateVersionId: versionId },
            headers,
          }
        );
      const polledResource = await pollEServiceTemplate(response, headers);

      return toM2MGatewayEServiceTemplateVersion(
        retrieveEServiceTemplateVersionById(
          polledResource,
          unsafeBrandId(versionId)
        )
      );
    },
    async updatePublishedEServiceTemplateVersionQuotas(
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      seed: m2mGatewayApi.EServiceTemplateVersionQuotasUpdateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersion> {
      logger.info(
        `Updating Version Quotas for published E-Service Template with id ${templateId}`
      );

      const version = retrieveEServiceTemplateVersionById(
        await retrieveEServiceTemplateById(headers, templateId),
        templateVersionId
      );

      const response =
        await clients.eserviceTemplateProcessClient.updateTemplateVersionQuotas(
          {
            voucherLifespan: seed.voucherLifespan ?? version.voucherLifespan,
            dailyCallsPerConsumer:
              seed.dailyCallsPerConsumer ?? version.dailyCallsPerConsumer,
            dailyCallsTotal: seed.dailyCallsTotal ?? version.dailyCallsTotal,
          },
          {
            params: { templateId, templateVersionId },
            headers,
          }
        );
      const polledResource = await pollEServiceTemplate(response, headers);

      return toM2MGatewayEServiceTemplateVersion(
        retrieveEServiceTemplateVersionById(
          polledResource,
          unsafeBrandId(templateVersionId)
        )
      );
    },
    async updateDraftEServiceTemplate(
      templateId: EServiceTemplateId,
      seed: m2mGatewayApi.EServiceTemplateDraftUpdateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(`Updating draft EService Template with id ${templateId}`);

      const response =
        await clients.eserviceTemplateProcessClient.patchUpdateDraftEServiceTemplate(
          seed,
          {
            params: { templateId },
            headers,
          }
        );
      const polledResource = await pollEServiceTemplate(response, headers);
      return toM2MGatewayEServiceTemplate(polledResource.data);
    },
  };
}
