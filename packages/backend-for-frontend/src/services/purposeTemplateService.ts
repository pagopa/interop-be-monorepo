/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-params */
import { randomUUID } from "crypto";
import {
  bffApi,
  purposeTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  assertFeatureFlagEnabled,
  FileManager,
  validateAndStorePDFDocument,
  WithLogger,
} from "pagopa-interop-commons";
import {
  PurposeTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  TenantKind,
} from "pagopa-interop-models";
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
  toBffEServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor,
  toBffPurposeTemplateWithCompactCreator,
  toCompactPurposeTemplateEService,
} from "../api/purposeTemplateApiConverter.js";
import { eserviceDescriptorNotFound, tenantNotFound } from "../model/errors.js";
import { toCompactDescriptor } from "../api/catalogApiConverter.js";

export function purposeTemplateServiceBuilder(
  purposeTemplateClient: PurposeTemplateProcessClient,
  tenantProcessClient: TenantProcessClient,
  catalogProcessClient: CatalogProcessClient,
  fileManager: FileManager
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
      handlesPersonalData,
      offset,
      limit,
      ctx,
    }: {
      purposeTitle: string | undefined;
      targetTenantKind: TenantKind | undefined;
      creatorIds: string[];
      eserviceIds: string[];
      excludeExpiredRiskAnalysis: boolean;
      handlesPersonalData: boolean | undefined;
      offset: number;
      limit: number;
      ctx: WithLogger<BffAppContext>;
    }): Promise<bffApi.CatalogPurposeTemplates> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");
      const { headers, logger } = ctx;

      logger.info(
        `Retrieving catalog purpose templates with purposeTitle ${purposeTitle}, targetTenantKind ${targetTenantKind}, creatorIds ${creatorIds.toString()}, eserviceIds ${eserviceIds.toString()}, excludeExpiredRiskAnalysis ${excludeExpiredRiskAnalysis}, handlesPersonalData ${handlesPersonalData}, offset ${offset}, limit ${limit}`
      );

      const catalogPurposeTemplatesResponse =
        await purposeTemplateClient.getPurposeTemplates({
          headers,
          queries: {
            purposeTitle,
            targetTenantKind,
            creatorIds,
            eserviceIds,
            states: [purposeTemplateApi.PurposeTemplateState.Enum.PUBLISHED],
            excludeExpiredRiskAnalysis,
            handlesPersonalData,
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
      eserviceName,
      offset,
      limit,
      ctx,
    }: {
      purposeTemplateId: string;
      producerIds: string[];
      eserviceName?: string;
      offset: number;
      limit: number;
      ctx: WithLogger<BffAppContext>;
    }): Promise<bffApi.EServiceDescriptorsPurposeTemplate> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const { headers, logger } = ctx;

      logger.info(
        `Retrieving e-service descriptors linked to purpose template ${purposeTemplateId} with eserviceName ${eserviceName}, producerIds ${producerIds.toString()}, offset ${offset}, limit ${limit}`
      );

      const purposeTemplateEServiceDescriptorsResponse =
        await purposeTemplateClient.getPurposeTemplateEServices({
          headers,
          params: {
            id: purposeTemplateId,
          },
          queries: {
            producerIds,
            eserviceName,
            limit,
            offset,
          },
        });

      const producersById = new Map<string, tenantApi.Tenant>();
      const results = await Promise.all(
        purposeTemplateEServiceDescriptorsResponse.results.map(
          async (eserviceDescriptor) => {
            const { eserviceId, descriptorId } = eserviceDescriptor;

            const eservice = await catalogProcessClient.getEServiceById({
              headers,
              params: { eServiceId: eserviceId },
            });

            const descriptor = eservice.descriptors.find(
              (d) => d.id === descriptorId
            );
            if (!descriptor) {
              throw eserviceDescriptorNotFound(eservice.id, descriptorId);
            }

            const producer =
              producersById.get(eservice.producerId) ||
              (await tenantProcessClient.tenant.getTenant({
                headers,
                params: { id: eservice.producerId },
              }));
            producersById.set(eservice.producerId, producer);

            return toBffEServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor(
              eserviceDescriptor,
              toCompactPurposeTemplateEService(eservice, producer),
              toCompactDescriptor(descriptor)
            );
          }
        )
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
    async getRiskAnalysisTemplateAnswerAnnotationDocument({
      purposeTemplateId,
      answerId,
      documentId,
      ctx,
    }: {
      purposeTemplateId: string;
      answerId: string;
      documentId: string;
      ctx: WithLogger<BffAppContext>;
    }): Promise<Buffer> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const { headers, logger } = ctx;

      logger.info(
        `Retrieving risk analysis template answer annotation document ${documentId} for purpose template ${purposeTemplateId} and answer ${answerId}`
      );

      const riskAnalysisTemplateAnswerAnnotationDocument =
        await purposeTemplateClient.getRiskAnalysisTemplateAnswerAnnotationDocument(
          {
            params: { purposeTemplateId, answerId, documentId },
            headers,
          }
        );

      const documentBytes = await fileManager.get(
        config.purposeTemplateDocumentsContainer,
        riskAnalysisTemplateAnswerAnnotationDocument.path,
        logger
      );

      return Buffer.from(documentBytes);
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

      return toBffPurposeTemplateWithCompactCreator(
        result,
        creator,
        annotationDocuments
      );
    },
    async publishPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      logger.info(`Publishing purpose template ${purposeTemplateId}`);
      await purposeTemplateClient.publishPurposeTemplate(undefined, {
        params: {
          id: purposeTemplateId,
        },
        headers,
      });
    },
    async unsuspendPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      logger.info(`Unsuspending purpose template ${purposeTemplateId}`);
      await purposeTemplateClient.unsuspendPurposeTemplate(undefined, {
        params: {
          id: purposeTemplateId,
        },
        headers,
      });
    },
    async suspendPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      logger.info(`Suspending purpose template ${purposeTemplateId}`);
      await purposeTemplateClient.suspendPurposeTemplate(undefined, {
        params: {
          id: purposeTemplateId,
        },
        headers,
      });
    },
    async archivePurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      logger.info(`Archiving purpose template ${purposeTemplateId}`);
      await purposeTemplateClient.archivePurposeTemplate(undefined, {
        params: {
          id: purposeTemplateId,
        },
        headers,
      });
    },
    async updatePurposeTemplate(
      id: PurposeTemplateId,
      seed: bffApi.PurposeTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      logger.info(`Updating purpose template ${id}`);
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");
      return await purposeTemplateClient.updatePurposeTemplate(seed, {
        headers,
        params: { id },
      });
    },
    async addRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: PurposeTemplateId,
      answerId: string,
      body: bffApi.addRiskAnalysisTemplateAnswerAnnotationDocument_Body,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisTemplateAnswerAnnotationDocument> {
      logger.info(
        `Adding annotation document to purpose template with id ${purposeTemplateId}`
      );
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const documentId = randomUUID();

      return await validateAndStorePDFDocument(
        fileManager,
        purposeTemplateId,
        body.doc,
        documentId,
        config.purposeTemplateDocumentsContainer,
        config.purposeTemplateDocumentsPath,
        body.prettyName,
        async (
          documentId: string,
          fileName: string,
          filePath: string,
          prettyName: string,
          contentType: string,
          checksum: string
        ): Promise<purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument> =>
          await purposeTemplateClient.addRiskAnalysisTemplateAnswerAnnotationDocument(
            {
              documentId,
              name: fileName,
              path: filePath,
              prettyName,
              contentType,
              checksum,
            },
            {
              headers,
              params: {
                id: purposeTemplateId,
                answerId,
              },
            }
          ),
        logger
      );
    },
    async createRiskAnalysisAnswer(
      purposeTemplateId: PurposeTemplateId,
      seed: bffApi.RiskAnalysisTemplateAnswerRequest,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisTemplateAnswerResponse> {
      logger.info(
        `Creating risk analysis answer for purpose template ${purposeTemplateId}`
      );
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");
      return await purposeTemplateClient.addRiskAnalysisAnswerForPurposeTemplate(
        seed,
        {
          params: {
            id: purposeTemplateId,
          },
          headers,
        }
      );
    },
    async addRiskAnalysisAnswerAnnotation(
      purposeTemplateId: PurposeTemplateId,
      answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
      seed: bffApi.RiskAnalysisTemplateAnswerAnnotationSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisTemplateAnswerAnnotation> {
      logger.info(
        `Adding risk analysis answer annotation for purpose template ${purposeTemplateId}`
      );
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");
      return await purposeTemplateClient.addRiskAnalysisAnswerAnnotationForPurposeTemplate(
        seed,
        {
          params: {
            purposeTemplateId,
            answerId,
          },
          headers,
        }
      );
    },
    async deletePurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      logger.info(`Deleting purpose template ${purposeTemplateId}`);

      await purposeTemplateClient.deletePurposeTemplate(undefined, {
        params: {
          id: purposeTemplateId,
        },
        headers,
      });
    },
    async deleteRiskAnalysisTemplateAnswerAnnotation({
      purposeTemplateId,
      answerId,
      ctx,
    }: {
      purposeTemplateId: PurposeTemplateId;
      answerId: PurposeTemplateId;
      ctx: WithLogger<BffAppContext>;
    }): Promise<void> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const { headers, logger } = ctx;

      logger.info(
        `Deleting risk analysis template answer annotation for purpose template ${purposeTemplateId} and answer ${answerId}`
      );

      await purposeTemplateClient.deleteRiskAnalysisTemplateAnswerAnnotation(
        undefined,
        {
          params: {
            purposeTemplateId,
            answerId,
          },
          headers,
        }
      );
    },
    async deleteRiskAnalysisTemplateAnswerAnnotationDocument({
      purposeTemplateId,
      answerId,
      documentId,
      ctx,
    }: {
      purposeTemplateId: PurposeTemplateId;
      answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
      documentId: string;
      ctx: WithLogger<BffAppContext>;
    }): Promise<void> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const { headers, logger } = ctx;

      logger.info(
        `Deleting risk analysis template answer annotation document ${documentId} for purpose template ${purposeTemplateId} and answer ${answerId}`
      );

      await purposeTemplateClient.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        undefined,
        {
          params: {
            purposeTemplateId,
            answerId,
            documentId,
          },
          headers,
        }
      );
    },
    async updateRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: PurposeTemplateId,
      answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
      documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
      body: bffApi.UpdateRiskAnalysisTemplateAnswerAnnotationDocumentSeed,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisTemplateAnswerAnnotationDocument> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const { headers, logger } = ctx;

      logger.info(
        `Updating risk analysis template answer annotation document ${documentId} for purpose template ${purposeTemplateId} and answer ${answerId}`
      );

      return await purposeTemplateClient.updateRiskAnalysisTemplateAnswerAnnotationDocument(
        body,
        {
          headers,
          params: {
            purposeTemplateId,
            answerId,
            documentId,
          },
        }
      );
    },
    async getPublishedPurposeTemplateCreators(
      name: string | undefined,
      offset: number,
      limit: number,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      logger.info(
        `Getting Purpose Templates creators with name ${name}, limit ${limit}, offset ${offset}`
      );
      const { results, totalCount } =
        await purposeTemplateClient.getPublishedPurposeTemplateCreators({
          queries: {
            creatorName: name,
            offset,
            limit,
          },
          headers,
        });

      return {
        results: results.map((t) => ({ id: t.id, name: t.name })),
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
  };
}
export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
