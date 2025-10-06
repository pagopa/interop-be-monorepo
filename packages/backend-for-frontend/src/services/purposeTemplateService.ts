import {
  bffApi,
  purposeTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { assertFeatureFlagEnabled, WithLogger } from "pagopa-interop-commons";
import { PurposeTemplateId, TenantKind } from "pagopa-interop-models";
import {
  PurposeTemplateProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";
import {
  toBffCatalogPurposeTemplate,
  toBffCreatorPurposeTemplate,
} from "../api/purposeTemplateApiConverter.js";
import { tenantNotFound } from "../model/errors.js";
import { toBffCompactOrganization } from "../api/agreementApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  purposeTemplateClient: PurposeTemplateProcessClient,
  tenantProcessClient: TenantProcessClient
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
        (template) => {
          const creator = creatorTenantsMap.get(template.creatorId);

          if (!creator) {
            throw tenantNotFound(template.creatorId);
          }

          return toBffCatalogPurposeTemplate(template, creator);
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
    async unsuspendPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      logger.info(`Unsuspending purpose template ${purposeTemplateId}`);
      const result = await purposeTemplateClient.unsuspendPurposeTemplate(
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
    async suspendPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      logger.info(`Suspending purpose template ${purposeTemplateId}`);
      const result = await purposeTemplateClient.suspendPurposeTemplate(
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
