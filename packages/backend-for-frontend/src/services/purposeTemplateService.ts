import {
  bffApi,
  purposeTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { assertFeatureFlagEnabled, WithLogger } from "pagopa-interop-commons";
import { PurposeTemplateId, TenantKind } from "pagopa-interop-models";
import {
  CatalogProcessClient,
  PurposeTemplateProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";
import {
  toBffCatalogPurposeTemplate,
  toBffCreatorPurposeTemplate,
  toBffEServiceDescriptorsPurposeTemplate,
} from "../api/purposeTemplateApiConverter.js";
import {
  eserviceDescriptorNotFound,
  eServiceNotFound,
  tenantNotFound,
} from "../model/errors.js";
import {
  toCompactDescriptor,
  toCompactEservice,
} from "../api/catalogApiConverter.js";
import { toBffCompactOrganization } from "../api/agreementApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  purposeTemplateClient: PurposeTemplateProcessClient,
  tenantProcessClient: TenantProcessClient,
  catalogProcessClient: CatalogProcessClient
) {
  async function getTenantsFromPurposeTemplates(
    tenantClient: TenantProcessClient,
    purposeTemplates: purposeTemplateApi.PurposeTemplate[],
    headers: BffAppContext["headers"]
  ): Promise<Map<string, tenantApi.Tenant>> {
    const creatorIds = Array.from(
      new Set(purposeTemplates.map((t) => t.creatorId))
    );

    const tenants = await Promise.all(
      creatorIds.map(async (id) =>
        tenantClient.tenant.getTenant({ headers, params: { id } })
      )
    );

    return new Map(tenants.map((t) => [t.id, t]));
  }

  async function getEServicesDescriptorsFromPurposeTemplateEServiceDescriptors(
    catalogClient: CatalogProcessClient,
    tenantClient: TenantProcessClient,
    purposeTemplateEServiceDescriptor: purposeTemplateApi.EServiceDescriptorPurposeTemplate[],
    headers: BffAppContext["headers"]
  ): Promise<{
    compactEServicesMap: Map<string, bffApi.CompactEService | undefined>;
    compactDescriptorsMap: Map<string, bffApi.CompactDescriptor | undefined>;
  }> {
    const eserviceDescriptorIds = new Map<string, string>();
    for (const eserviceDescriptor of purposeTemplateEServiceDescriptor) {
      eserviceDescriptorIds.set(
        eserviceDescriptor.eserviceId,
        eserviceDescriptor.descriptorId
      );
    }

    const eservices = await Promise.all(
      Array.from(eserviceDescriptorIds.entries()).map(
        async ([eserviceId, descriptorId]) => {
          const eservice = await catalogClient.getEServiceById({
            headers,
            params: { eServiceId: eserviceId },
          });

          return { eservice, descriptorId };
        }
      )
    );

    const compactDescriptorsMap = new Map<string, bffApi.CompactDescriptor>();
    const compactEServicesMap = new Map<string, bffApi.CompactEService>();
    const producersMap = new Map<string, tenantApi.Tenant>();
    for (const { eservice, descriptorId } of eservices) {
      if (!producersMap.has(eservice.producerId)) {
        const producer = await tenantClient.tenant.getTenant({
          headers,
          params: { id: eservice.producerId },
        });

        producersMap.set(eservice.producerId, producer);
      }

      const producer = producersMap.get(eservice.producerId);
      if (!producer) {
        throw tenantNotFound(eservice.producerId);
      }

      compactEServicesMap.set(
        eservice.id,
        toCompactEservice(eservice, producer)
      );

      if (!compactDescriptorsMap.has(descriptorId)) {
        const descriptor = eservice.descriptors.find(
          (d) => d.id === descriptorId
        );
        if (!descriptor) {
          throw eserviceDescriptorNotFound(eservice.id, descriptorId);
        }

        compactDescriptorsMap.set(
          descriptorId,
          toCompactDescriptor(descriptor)
        );
      }
    }

    return { compactEServicesMap, compactDescriptorsMap };
  }

  return {
    async createPurposeTemplate(
      seed: bffApi.PurposeTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");
      logger.info(`Creating purpose template`);
      const result = await purposeTemplateClient.createPurposeTemplate(seed, {
        headers,
      });

      return { id: result.id };
    },
    async linkEServiceToPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      eserviceId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceDescriptorPurposeTemplate> {
      logger.info(
        `Linking e-service ${eserviceId} to purpose template ${purposeTemplateId}`
      );

      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const result = await purposeTemplateClient.linkEServicesToPurposeTemplate(
        {
          eserviceIds: [eserviceId],
        },
        {
          params: {
            id: purposeTemplateId,
          },
          headers,
        }
      );

      return result[0];
    },
    async unlinkEServicesFromPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      eserviceId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Unlinking e-service ${eserviceId} from purpose template ${purposeTemplateId}`
      );

      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      await purposeTemplateClient.unlinkEServicesFromPurposeTemplate(
        {
          eserviceIds: [eserviceId],
        },
        {
          params: {
            id: purposeTemplateId,
          },
          headers,
        }
      );
    },
    async getCreatorPurposeTemplates({
      purposeTitle,
      states,
      eserviceIds,
      offset,
      limit,
      ctx,
    }: {
      purposeTitle: string | undefined;
      states: bffApi.PurposeTemplateState[];
      eserviceIds: string[];
      offset: number;
      limit: number;
      ctx: WithLogger<BffAppContext>;
    }): Promise<bffApi.CreatorPurposeTemplates> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const { headers, authData, logger } = ctx;

      logger.info(
        `Retrieving creator's purpose templates with title ${purposeTitle}, offset ${offset}, limit ${limit}`
      );

      const creatorPurposeTemplatesResponse =
        await purposeTemplateClient.getPurposeTemplates({
          headers,
          queries: {
            purposeTitle,
            creatorIds: [authData.organizationId],
            states,
            eserviceIds,
            limit,
            offset,
          },
        });

      return {
        results: creatorPurposeTemplatesResponse.results.map(
          toBffCreatorPurposeTemplate
        ),
        pagination: {
          offset,
          limit,
          totalCount: creatorPurposeTemplatesResponse.totalCount,
        },
      };
    },
    async getCatalogPurposeTemplates({
      purposeTitle,
      targetTenantKind,
      creatorIds,
      eserviceIds,
      excludeExpiredRiskAnalysis,
      offset,
      limit,
      ctx,
    }: {
      purposeTitle: string | undefined;
      targetTenantKind: TenantKind | undefined;
      creatorIds: string[];
      eserviceIds: string[];
      excludeExpiredRiskAnalysis: boolean;
      offset: number;
      limit: number;
      ctx: WithLogger<BffAppContext>;
    }): Promise<bffApi.CatalogPurposeTemplates> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");
      const { headers, logger } = ctx;

      logger.info(
        `Retrieving catalog purpose templates with title ${purposeTitle}, eserviceIds ${eserviceIds.toString()} offset ${offset}, limit ${limit}`
      );

      const catalogPurposeTemplatesResponse =
        await purposeTemplateClient.getPurposeTemplates({
          headers,
          queries: {
            purposeTitle,
            targetTenantKind,
            creatorIds,
            eserviceIds,
            states: [purposeTemplateApi.PurposeTemplateState.Enum.ACTIVE],
            excludeExpiredRiskAnalysis,
            limit,
            offset,
          },
        });

      const creatorTenantsMap = await getTenantsFromPurposeTemplates(
        tenantProcessClient,
        catalogPurposeTemplatesResponse.results,
        headers
      );

      const results = catalogPurposeTemplatesResponse.results.map(
        (purposeTemplate) => {
          const creator = creatorTenantsMap.get(purposeTemplate.creatorId);

          if (!creator) {
            throw tenantNotFound(purposeTemplate.creatorId);
          }

          return toBffCatalogPurposeTemplate(purposeTemplate, creator);
        }
      );

      return {
        results,
        pagination: {
          offset,
          limit,
          totalCount: catalogPurposeTemplatesResponse.totalCount,
        },
      };
    },
    async getPurposeTemplateEServiceDescriptors({
      purposeTemplateId,
      producerIds,
      eserviceIds,
      offset,
      limit,
      ctx,
    }: {
      purposeTemplateId: string;
      producerIds: string[];
      eserviceIds: string[];
      offset: number;
      limit: number;
      ctx: WithLogger<BffAppContext>;
    }): Promise<bffApi.EServiceDescriptorsPurposeTemplate> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const { headers, logger } = ctx;

      logger.info(
        `Retrieving e-service descriptors linked to purpose template ${purposeTemplateId} with eserviceIds ${eserviceIds.toString()}, producerIds ${producerIds.toString()}, offset ${offset}, limit ${limit}`
      );

      const purposeTemplateEServiceDescriptorsResponse =
        await purposeTemplateClient.getPurposeTemplateEServices({
          headers,
          params: {
            id: purposeTemplateId,
          },
          queries: {
            producerIds,
            eserviceIds,
            limit,
            offset,
          },
        });

      const { compactEServicesMap, compactDescriptorsMap } =
        await getEServicesDescriptorsFromPurposeTemplateEServiceDescriptors(
          catalogProcessClient,
          tenantProcessClient,
          purposeTemplateEServiceDescriptorsResponse.results,
          headers
        );

      const results = purposeTemplateEServiceDescriptorsResponse.results.map(
        (eserviceDescriptor) => {
          const { eserviceId, descriptorId } = eserviceDescriptor;

          const compactEService = compactEServicesMap.get(eserviceId);
          if (!compactEService) {
            throw eServiceNotFound(eserviceId);
          }

          const compactDescriptor = compactDescriptorsMap.get(descriptorId);
          if (!compactDescriptor) {
            throw eserviceDescriptorNotFound(eserviceId, descriptorId);
          }

          return toBffEServiceDescriptorsPurposeTemplate(
            eserviceDescriptor,
            compactEService,
            compactDescriptor
          );
        }
      );

      return {
        results,
        pagination: {
          offset,
          limit,
          totalCount: purposeTemplateEServiceDescriptorsResponse.totalCount,
        },
      };
    },
    async getPurposeTemplate(
      id: PurposeTemplateId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplateWithCompactCreator> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      logger.info(`Retrieving Purpose Template ${id}`);

      const result = await purposeTemplateClient.getPurposeTemplate({
        params: {
          id,
        },
        headers,
      });

      const creator = await tenantProcessClient.tenant.getTenant({
        params: {
          id: result.creatorId,
        },
        headers,
      });
      if (!creator) {
        throw tenantNotFound(result.creatorId);
      }

      const riskAnalysisFormTemplateAnswers =
        result.purposeRiskAnalysisForm?.answers;
      const annotationDocuments = riskAnalysisFormTemplateAnswers
        ? Object.values(riskAnalysisFormTemplateAnswers).flatMap(
            (answer) => answer.annotation?.docs ?? []
          )
        : [];

      return bffApi.PurposeTemplateWithCompactCreator.parse({
        ...result,
        creator: toBffCompactOrganization(creator),
        annotationDocuments,
      });
    },
    async publishPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      logger.info(`Publishing purpose template ${purposeTemplateId}`);
      const result = await purposeTemplateClient.publishPurposeTemplate(
        undefined,
        {
          params: {
            id: purposeTemplateId,
          },
          headers,
        }
      );

      return bffApi.PurposeTemplate.parse(result);
    },
    async updatePurposeTemplate(
      id: PurposeTemplateId,
      seed: bffApi.PurposeTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplateSeed> {
      logger.info(`Updating purpose template ${id}`);
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");
      return await purposeTemplateClient.updatePurposeTemplate(seed, {
        headers,
        params: { id },
      });
    },
  };
}
export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
