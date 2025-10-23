import {
  attributeRegistryApi,
  eserviceTemplateApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
  AttributeId,
  EServiceDocumentId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  ListResult,
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
  toM2MGatewayApiDocument,
  toEServiceTemplateApiEServiceTemplateVersionSeed,
} from "../api/eserviceTemplateApiConverter.js";
import {
  cannotDeleteLastEServiceTemplateVersion,
  eserviceTemplateRiskAnalysisNotFound,
  eserviceTemplateVersionAttributeNotFound,
  eserviceTemplateVersionNotFound,
  eserviceTemplateVersionAttributeGroupNotFound,
} from "../model/errors.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  pollResourceWithMetadata,
  isPolledVersionAtLeastResponseVersion,
  isPolledVersionAtLeastMetadataTargetVersion,
  pollResourceUntilDeletion,
} from "../utils/polling.js";
import { uploadEServiceTemplateDocument } from "../utils/fileUpload.js";
import { downloadDocument, DownloadedDocument } from "../utils/fileDownload.js";
import { config } from "../config/config.js";
import {
  toM2MGatewayApiCertifiedAttribute,
  toM2MGatewayApiDeclaredAttribute,
  toM2MGatewayApiVerifiedAttribute,
} from "../api/attributeApiConverter.js";

export type EserviceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder(
  clients: PagoPAInteropBeClients,
  fileManager: FileManager
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

  // eslint-disable-next-line max-params
  async function retrieveEServiceTemplateVersionAttributes(
    eserviceTemplate: WithMaybeMetadata<eserviceTemplateApi.EServiceTemplate>,
    versionId: EServiceTemplateVersionId,
    attributeKind: keyof eserviceTemplateApi.Attributes,
    { offset, limit }: { offset: number; limit: number },
    headers: M2MGatewayAppContext["headers"]
  ): Promise<
    ListResult<{
      attribute: attributeRegistryApi.Attribute;
      groupIndex: number;
    }>
  > {
    const version = retrieveEServiceTemplateVersionById(
      eserviceTemplate,
      versionId
    );
    const kindAttributeGroups = version.attributes[attributeKind];
    const allFlatKindAttributes: Array<{
      attributeId: string;
      groupIndex: number;
    }> = kindAttributeGroups.flatMap((group, groupIndex) =>
      group.map((attribute) => ({
        attributeId: attribute.id,
        groupIndex,
      }))
    );

    const paginatedFlatKindAttributes = allFlatKindAttributes.slice(
      offset,
      offset + limit
    );

    const attributeIdsToResolve: Array<attributeRegistryApi.Attribute["id"]> =
      paginatedFlatKindAttributes.map((item) => item.attributeId);

    if (attributeIdsToResolve.length === 0) {
      return {
        results: [],
        totalCount: attributeIdsToResolve.length,
      };
    }

    // Resolve the complete details only for the attributes needed on the page.
    const bulkResult = await clients.attributeProcessClient.getBulkedAttributes(
      attributeIdsToResolve,
      {
        headers,
        queries: {
          offset,
          limit,
        },
      }
    );

    // Convert the result array into a Map for efficient lookup
    const attributeMap: Map<string, attributeRegistryApi.Attribute> = new Map(
      bulkResult.data.results.map((attr) => [attr.id, attr])
    );

    // Recombination: Map the paginated flat list with the resolved complete details
    const attributesToReturn = paginatedFlatKindAttributes.map((item) => {
      const attributeDetailed = attributeMap.get(item.attributeId);

      if (!attributeDetailed) {
        throw eserviceTemplateVersionAttributeNotFound(versionId);
      }

      return {
        attribute: attributeDetailed,
        groupIndex: item.groupIndex,
      };
    });

    return {
      results: attributesToReturn,
      totalCount: allFlatKindAttributes.length,
    };
  }

  const pollEServiceTemplate = (
    response: WithMaybeMetadata<eserviceTemplateApi.EServiceTemplate>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<eserviceTemplateApi.EServiceTemplate>> =>
    pollResourceWithMetadata(() =>
      retrieveEServiceTemplateById(headers, unsafeBrandId(response.data.id))
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  const pollEServiceTemplateById = (
    templateId: EServiceTemplateId,
    metadata: { version: number } | undefined,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<eserviceTemplateApi.EServiceTemplate>> =>
    pollResourceWithMetadata(() =>
      retrieveEServiceTemplateById(headers, templateId)
    )({
      condition: isPolledVersionAtLeastMetadataTargetVersion(metadata),
    });

  const pollEserviceTemplateUntilDeletion = (
    templateId: string,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<void> =>
    pollResourceUntilDeletion(() =>
      retrieveEServiceTemplateById(headers, unsafeBrandId(templateId))
    )({});

  // eslint-disable-next-line max-params
  async function deleteEServiceTemplateVersionAttributeFromGroup(
    templateId: EServiceTemplateId,
    versionId: EServiceTemplateVersionId,
    groupIndex: number,
    attributeId: AttributeId,
    attributeKind: keyof eserviceTemplateApi.Attributes,
    { headers }: WithLogger<M2MGatewayAppContext>
  ): Promise<void> {
    const eserviceTemplate = await retrieveEServiceTemplateById(
      headers,
      templateId
    );
    const eserviceTemplateVersion = retrieveEServiceTemplateVersionById(
      eserviceTemplate,
      versionId
    );

    const kindAttributeGroups =
      eserviceTemplateVersion.attributes[attributeKind];

    const attributeGroup = kindAttributeGroups.at(groupIndex);

    if (!attributeGroup) {
      throw eserviceTemplateVersionAttributeGroupNotFound(
        attributeKind,
        templateId,
        versionId,
        groupIndex
      );
    }

    if (!attributeGroup.find((a) => a.id === attributeId)) {
      throw eserviceTemplateVersionAttributeNotFound(versionId);
    }

    const attributeGroupWithoutAttribute = attributeGroup.filter(
      (a) => a.id !== attributeId
    );

    const updatedGroups =
      attributeGroupWithoutAttribute.length === 0
        ? [
            ...kindAttributeGroups.slice(0, groupIndex),
            ...kindAttributeGroups.slice(groupIndex + 1),
          ]
        : [
            ...kindAttributeGroups.slice(0, groupIndex),
            attributeGroupWithoutAttribute,
            ...kindAttributeGroups.slice(groupIndex + 1),
          ];

    const response =
      await clients.eserviceTemplateProcessClient.patchUpdateDraftTemplateVersion(
        {
          attributes: {
            ...eserviceTemplateVersion.attributes,
            [attributeKind]: updatedGroups,
          },
        },
        {
          params: { templateId, templateVersionId: versionId },
          headers,
        }
      );

    await pollEServiceTemplate(response, headers);
  }

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
    async createEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      seed: m2mGatewayApi.EServiceTemplateVersionSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersion> {
      logger.info(`Creating Version for E-Service Template ${templateId}`);

      const {
        data: { eserviceTemplate, createdEServiceTemplateVersionId },
        metadata,
      } =
        await clients.eserviceTemplateProcessClient.createEServiceTemplateVersion(
          toEServiceTemplateApiEServiceTemplateVersionSeed(seed),
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
      const createdVersion = retrieveEServiceTemplateVersionById(
        { data: eserviceTemplate, metadata },
        unsafeBrandId(createdEServiceTemplateVersionId)
      );
      return toM2MGatewayEServiceTemplateVersion(createdVersion);
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
      seed: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed,
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
    async getEServiceTemplateRiskAnalysis(
      templateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateRiskAnalysis> {
      logger.info(
        `Retrieving Risk Analysis ${riskAnalysisId} for E-Service Template ${templateId}`
      );

      const riskAnalysis = retrieveEServiceTemplateRiskAnalysisById(
        await retrieveEServiceTemplateById(headers, templateId),
        unsafeBrandId(riskAnalysisId)
      );

      return toM2MGatewayApiEServiceTemplateRiskAnalysis(riskAnalysis);
    },

    async deleteDraftEServiceTemplateVersion(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting version ${versionId} for eservice template with id ${templateId}`
      );
      const { data: eserviceTemplate } = await retrieveEServiceTemplateById(
        headers,
        templateId
      );

      if (
        eserviceTemplate.versions.length === 1 &&
        eserviceTemplate.versions[0].id === versionId
      ) {
        throw cannotDeleteLastEServiceTemplateVersion(templateId, versionId);
      }

      const response =
        await clients.eserviceTemplateProcessClient.deleteDraftTemplateVersion(
          undefined,
          {
            params: { templateId, templateVersionId: versionId },
            headers,
          }
        );
      await pollEServiceTemplateById(templateId, response.metadata, headers);
    },
    async deleteEServiceTemplateRiskAnalysis(
      templateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting Risk Analysis ${riskAnalysisId} for E-Service Template ${templateId}`
      );

      const { metadata } =
        await clients.eserviceTemplateProcessClient.deleteEServiceTemplateRiskAnalysis(
          undefined,
          {
            params: { templateId, riskAnalysisId },
            headers,
          }
        );

      await pollEServiceTemplateById(templateId, metadata, headers);
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

    async getEServiceTemplateVersionDocuments(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      {
        offset,
        limit,
      }: m2mGatewayApi.GetEServiceTemplateVersionDocumentsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Documents> {
      logger.info(
        `Retrieving documents for eservice template version with id ${versionId} for eservice with id ${templateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplateById(
        headers,
        templateId
      );

      const documents = retrieveEServiceTemplateVersionById(
        eserviceTemplate,
        versionId
      ).docs;

      const paginatedDocs = documents.slice(offset, offset + limit);

      return {
        results: paginatedDocs.map(toM2MGatewayApiDocument),
        pagination: {
          limit,
          offset,
          totalCount: documents.length,
        },
      };
    },

    async uploadEServiceTemplateVersionDocument(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      fileUpload: m2mGatewayApi.FileUploadMultipart,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Document> {
      logger.info(
        `Adding document ${fileUpload.file.name} to version with id ${versionId} for eservice template with id ${templateId}`
      );

      const { data: eserviceTemplate } = await retrieveEServiceTemplateById(
        headers,
        templateId
      );

      const { data: document, metadata } = await uploadEServiceTemplateDocument(
        {
          eserviceTemplate,
          versionId,
          documentKind:
            eserviceTemplateApi.EServiceDocumentKind.Values.DOCUMENT,
          fileUpload,
          fileManager,
          eserviceTemplateProcessClient: clients.eserviceTemplateProcessClient,
          headers,
          logger,
        }
      );

      await pollEServiceTemplateById(templateId, metadata, headers);

      return toM2MGatewayApiDocument(document);
    },

    async downloadEServiceTemplateVersionDocument(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<DownloadedDocument> {
      logger.info(
        `Retrieving document with id ${documentId} for eservice template version with id ${versionId} for eservice template with id ${templateId}`
      );

      const { data: document } =
        await clients.eserviceTemplateProcessClient.getEServiceTemplateDocumentById(
          {
            params: {
              templateId,
              templateVersionId: versionId,
              documentId,
            },
            headers,
          }
        );

      return downloadDocument(
        document,
        fileManager,
        config.eserviceTemplateDocumentsContainer,
        logger
      );
    },

    async deleteEServiceTemplateVersionDocument(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting document with id ${documentId} from eservice template version with id ${versionId} for eservice template with id ${templateId}`
      );

      const response =
        await clients.eserviceTemplateProcessClient.deleteEServiceTemplateDocumentById(
          undefined,
          {
            params: {
              templateId,
              templateVersionId: versionId,
              documentId,
            },
            headers,
          }
        );

      await pollEServiceTemplate(response, headers);
    },
    async updatePublishedEServiceTemplateDescription(
      templateId: EServiceTemplateId,
      seed: m2mGatewayApi.EServiceTemplateDescriptionUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(
        `Updating description for published E-Service Template with id ${templateId}`
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
    async updatePublishedEServiceTemplateIntendedTarget(
      templateId: EServiceTemplateId,
      seed: m2mGatewayApi.EServiceTemplateIntendedTargetUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(
        `Updating intended target for published E-Service Template with id ${templateId}`
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
    async updatePublishedEServiceTemplateName(
      templateId: EServiceTemplateId,
      seed: m2mGatewayApi.EServiceTemplateNameUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(
        `Updating name for published E-Service Template with id ${templateId}`
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

      const polledTemplate = await pollEServiceTemplateById(
        templateId,
        response.metadata,
        headers
      );
      const version = retrieveEServiceTemplateVersionById(
        polledTemplate,
        versionId
      );
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

      const polledTemplate = await pollEServiceTemplateById(
        templateId,
        response.metadata,
        headers
      );
      const version = retrieveEServiceTemplateVersionById(
        polledTemplate,
        versionId
      );
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

      const polledTemplate = await pollEServiceTemplateById(
        templateId,
        response.metadata,
        headers
      );
      const version = retrieveEServiceTemplateVersionById(
        polledTemplate,
        versionId
      );
      return toM2MGatewayEServiceTemplateVersion(version);
    },
    async deleteEServiceTemplate(
      templateId: EServiceTemplateId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(`Deleting eservice template with id ${templateId}`);

      await clients.eserviceTemplateProcessClient.deleteEServiceTemplate(
        undefined,
        {
          params: { templateId },
          headers,
        }
      );
      await pollEserviceTemplateUntilDeletion(templateId, headers);
    },
    async getEserviceTemplateVersionCertifiedAttributes(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      {
        limit,
        offset,
      }: m2mGatewayApi.GetEServiceTemplateVersionCertifiedAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersionCertifiedAttributes> {
      logger.info(
        `Retrieving Certified Attributes for E-Service Template ${templateId} Version ${versionId}`
      );

      const eserviceTemplateVersionAttributes =
        await retrieveEServiceTemplateVersionAttributes(
          await retrieveEServiceTemplateById(headers, templateId),
          versionId,
          "certified",
          { offset, limit },
          headers
        );

      return {
        results: eserviceTemplateVersionAttributes.results.map((item) => ({
          groupIndex: item.groupIndex,
          attribute: toM2MGatewayApiCertifiedAttribute({
            attribute: item.attribute,
            logger,
          }),
        })),
        pagination: {
          limit,
          offset,
          totalCount: eserviceTemplateVersionAttributes.totalCount,
        },
      };
    },

    async getEserviceTemplateVersionDeclaredAttributes(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      {
        limit,
        offset,
      }: m2mGatewayApi.GetEServiceTemplateVersionDeclaredAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersionDeclaredAttributes> {
      logger.info(
        `Retrieving Declared Attributes for E-Service Template ${templateId} Version ${versionId}`
      );

      const eserviceTemplateVersionAttributes =
        await retrieveEServiceTemplateVersionAttributes(
          await retrieveEServiceTemplateById(headers, templateId),
          versionId,
          "declared",
          { offset, limit },
          headers
        );

      return {
        results: eserviceTemplateVersionAttributes.results.map((item) => ({
          groupIndex: item.groupIndex,
          attribute: toM2MGatewayApiDeclaredAttribute({
            attribute: item.attribute,
            logger,
          }),
        })),
        pagination: {
          limit,
          offset,
          totalCount: eserviceTemplateVersionAttributes.totalCount,
        },
      };
    },

    async getEserviceTemplateVersionVerifiedAttributes(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      {
        limit,
        offset,
      }: m2mGatewayApi.GetEServiceTemplateVersionVerifiedAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateVersionVerifiedAttributes> {
      logger.info(
        `Retrieving Verified Attributes for E-Service Template ${templateId} Version ${versionId}`
      );

      const eserviceTemplateVersionAttributes =
        await retrieveEServiceTemplateVersionAttributes(
          await retrieveEServiceTemplateById(headers, templateId),
          versionId,
          "verified",
          { offset, limit },
          headers
        );

      return {
        results: eserviceTemplateVersionAttributes.results.map((item) => ({
          groupIndex: item.groupIndex,
          attribute: toM2MGatewayApiVerifiedAttribute({
            attribute: item.attribute,
            logger,
          }),
        })),
        pagination: {
          limit,
          offset,
          totalCount: eserviceTemplateVersionAttributes.totalCount,
        },
      };
    },
    async deleteEServiceTemplateVersionCertifiedAttributeFromGroup(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      groupIndex: number,
      attributeId: AttributeId,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      ctx.logger.info(
        `Deleting certified attribute ${attributeId} from group ${groupIndex} for version ${versionId} of eservice template ${templateId}`
      );
      await deleteEServiceTemplateVersionAttributeFromGroup(
        templateId,
        versionId,
        groupIndex,
        attributeId,
        "certified",
        ctx
      );
    },
    async deleteEServiceTemplateVersionVerifiedAttributeFromGroup(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      groupIndex: number,
      attributeId: AttributeId,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      ctx.logger.info(
        `Deleting verified attribute ${attributeId} from group ${groupIndex} for version ${versionId} of eservice template ${templateId}`
      );
      await deleteEServiceTemplateVersionAttributeFromGroup(
        templateId,
        versionId,
        groupIndex,
        attributeId,
        "verified",
        ctx
      );
    },
    async deleteEServiceTemplateVersionDeclaredAttributeFromGroup(
      templateId: EServiceTemplateId,
      versionId: EServiceTemplateVersionId,
      groupIndex: number,
      attributeId: AttributeId,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      ctx.logger.info(
        `Deleting declared attribute ${attributeId} from group ${groupIndex} for version ${versionId} of eservice template ${templateId}`
      );
      await deleteEServiceTemplateVersionAttributeFromGroup(
        templateId,
        versionId,
        groupIndex,
        attributeId,
        "declared",
        ctx
      );
    },
  };
}
