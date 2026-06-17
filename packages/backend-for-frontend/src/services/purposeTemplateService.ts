/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-params */
import { randomUUID } from "crypto";
import {
  bffApi,
  catalogApi,
  eserviceTemplateApi,
  purposeTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  FileManager,
  validateAndStorePDFDocument,
  WithLogger,
} from "pagopa-interop-commons";
import {
  PurposeTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { TenantProcessClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";
import {
  toBffCatalogPurposeTemplate,
  toBffCreatorPurposeTemplate,
  toBffEServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor,
  toBffPurposeTemplate,
  toBffPurposeTemplateWithCompactCreator,
  toBffLinkableEService,
  toBffLinkableEServiceTemplate,
  toCompactPurposeTemplateEService,
  toCompactPurposeTemplateEServiceTemplate,
} from "../api/purposeTemplateApiConverter.js";
import {
  eserviceDescriptorNotFound,
  eServiceNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  tenantNotFound,
} from "../model/errors.js";
import { toCompactDescriptor } from "../api/catalogApiConverter.js";
import { toBffCompactEServiceTemplateVersion } from "../api/eserviceTemplateApiConverter.js";

const FETCH_ALL_PAGE = 50;

type LinkableResourceRow =
  | {
      kind: "ESERVICE";
      link: purposeTemplateApi.EServiceDescriptorPurposeTemplate;
    }
  | {
      kind: "ESERVICE_TEMPLATE";
      link: purposeTemplateApi.EServiceTemplateVersionPurposeTemplate;
    };

export function purposeTemplateServiceBuilder(
  purposeTemplateClient: purposeTemplateApi.PurposeTemplateProcessClient,
  tenantProcessClient: TenantProcessClient,
  catalogProcessClient: catalogApi.CatalogProcessClient,
  eserviceTemplateProcessClient: eserviceTemplateApi.EServiceTemplateProcessClient,
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

  async function fetchAllConcreteLinks(
    purposeTemplateId: string,
    publisherIds: string[],
    q: string | undefined,
    headers: BffAppContext["headers"]
  ): Promise<purposeTemplateApi.EServiceDescriptorPurposeTemplate[]> {
    const acc: purposeTemplateApi.EServiceDescriptorPurposeTemplate[] = [];
    // eslint-disable-next-line functional/no-let
    let offset = 0;
    while (true) {
      const data = await purposeTemplateClient.getPurposeTemplateEServices({
        params: { id: purposeTemplateId },
        queries: {
          producerIds: publisherIds,
          eserviceName: q,
          offset,
          limit: FETCH_ALL_PAGE,
        },
        headers,
      });
      acc.push(...data.results);
      if (
        data.results.length < FETCH_ALL_PAGE ||
        acc.length >= data.totalCount
      ) {
        break;
      }
      offset += FETCH_ALL_PAGE;
    }
    return acc;
  }

  async function fetchAllTemplateLinks(
    purposeTemplateId: string,
    publisherIds: string[],
    q: string | undefined,
    headers: BffAppContext["headers"]
  ): Promise<purposeTemplateApi.EServiceTemplateVersionPurposeTemplate[]> {
    const acc: purposeTemplateApi.EServiceTemplateVersionPurposeTemplate[] = [];
    // eslint-disable-next-line functional/no-let
    let offset = 0;
    while (true) {
      const data =
        await purposeTemplateClient.getPurposeTemplateEServiceTemplates({
          params: { id: purposeTemplateId },
          queries: {
            creatorIds: publisherIds,
            eserviceTemplateName: q,
            offset,
            limit: FETCH_ALL_PAGE,
          },
          headers,
        });
      acc.push(...data.results);
      if (
        data.results.length < FETCH_ALL_PAGE ||
        acc.length >= data.totalCount
      ) {
        break;
      }
      offset += FETCH_ALL_PAGE;
    }
    return acc;
  }

  async function fetchEServicesByIds(
    eserviceIds: string[],
    headers: BffAppContext["headers"]
  ): Promise<catalogApi.EService[]> {
    const uniqueIds = Array.from(new Set(eserviceIds));
    const pages = Array.from(
      { length: Math.ceil(uniqueIds.length / FETCH_ALL_PAGE) },
      (_, index) =>
        uniqueIds.slice(index * FETCH_ALL_PAGE, (index + 1) * FETCH_ALL_PAGE)
    );

    const results = await Promise.all(
      pages.map(async (page) =>
        page.length === 0
          ? []
          : (
              await catalogProcessClient.getEServices({
                headers,
                queries: {
                  eservicesIds: page,
                  offset: 0,
                  limit: page.length,
                },
              })
            ).results
      )
    );

    return results.flat();
  }

  async function enrichLinkableResourcePage(
    page: LinkableResourceRow[],
    headers: BffAppContext["headers"],
    preloadedEServiceById: Map<string, catalogApi.EService> = new Map()
  ): Promise<bffApi.LinkableResource[]> {
    const eserviceIds = Array.from(
      new Set(
        page.flatMap((p) =>
          p.kind === "ESERVICE" && !preloadedEServiceById.has(p.link.eserviceId)
            ? [p.link.eserviceId]
            : []
        )
      )
    );
    const eserviceTemplateIds = Array.from(
      new Set(
        page.flatMap((p) =>
          p.kind === "ESERVICE_TEMPLATE" ? [p.link.eserviceTemplateId] : []
        )
      )
    );

    const [eservices, eserviceTemplates] = await Promise.all([
      fetchEServicesByIds(eserviceIds, headers),
      eserviceTemplateIds.length === 0
        ? Promise.resolve([] as eserviceTemplateApi.EServiceTemplate[])
        : eserviceTemplateProcessClient
            .getEServiceTemplates({
              headers,
              queries: {
                eserviceTemplatesIds: eserviceTemplateIds,
                offset: 0,
                limit: eserviceTemplateIds.length,
              },
            })
            .then(({ results }) => results),
    ]);

    const eserviceById = new Map([
      ...preloadedEServiceById,
      ...eservices.map((e) => [e.id, e] as const),
    ]);
    const eserviceTemplateById = new Map(
      eserviceTemplates.map((t) => [t.id, t])
    );
    const pageEServices = page.flatMap((p) =>
      p.kind === "ESERVICE"
        ? [eserviceById.get(p.link.eserviceId)].filter(
            (e): e is catalogApi.EService => e !== undefined
          )
        : []
    );

    const tenantIds = Array.from(
      new Set([
        ...pageEServices.map((e) => e.producerId),
        ...eserviceTemplates.map((t) => t.creatorId),
      ])
    );
    const tenants = await Promise.all(
      tenantIds.map((id) =>
        tenantProcessClient.tenant.getTenant({ headers, params: { id } })
      )
    );
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    return page.map((entry) =>
      match(entry)
        .with({ kind: "ESERVICE" }, ({ link }) => {
          const eservice = eserviceById.get(link.eserviceId);
          if (!eservice) {
            throw eServiceNotFound(link.eserviceId);
          }
          const descriptor = eservice.descriptors.find(
            (d) => d.id === link.descriptorId
          );
          if (!descriptor) {
            throw eserviceDescriptorNotFound(eservice.id, link.descriptorId);
          }
          const producer = tenantById.get(eservice.producerId);
          if (!producer) {
            throw tenantNotFound(eservice.producerId);
          }
          return toBffLinkableEService(
            link,
            toCompactPurposeTemplateEService(eservice, producer),
            toCompactDescriptor(descriptor)
          );
        })
        .with({ kind: "ESERVICE_TEMPLATE" }, ({ link }) => {
          const eserviceTemplate = eserviceTemplateById.get(
            link.eserviceTemplateId
          );
          if (!eserviceTemplate) {
            throw eserviceTemplateNotFound(link.eserviceTemplateId);
          }
          const version = eserviceTemplate.versions.find(
            (v) => v.id === link.eserviceTemplateVersionId
          );
          if (!version) {
            throw eserviceTemplateVersionNotFound(
              link.eserviceTemplateId,
              link.eserviceTemplateVersionId
            );
          }
          const creator = tenantById.get(eserviceTemplate.creatorId);
          if (!creator) {
            throw tenantNotFound(eserviceTemplate.creatorId);
          }
          return toBffLinkableEServiceTemplate(
            link,
            toCompactPurposeTemplateEServiceTemplate(eserviceTemplate, creator),
            toBffCompactEServiceTemplateVersion(version)
          );
        })
        .exhaustive()
    );
  }

  async function filterDeliverConcreteLinks(
    concreteLinks: purposeTemplateApi.EServiceDescriptorPurposeTemplate[],
    headers: BffAppContext["headers"]
  ): Promise<{
    concreteLinks: purposeTemplateApi.EServiceDescriptorPurposeTemplate[];
    eserviceById: Map<string, catalogApi.EService>;
  }> {
    const eservices = await fetchEServicesByIds(
      concreteLinks.map((link) => link.eserviceId),
      headers
    );

    const eserviceById = new Map(eservices.map((e) => [e.id, e] as const));
    const deliverConcreteLinks = concreteLinks.filter((link) => {
      const eservice = eserviceById.get(link.eserviceId);
      return (
        eservice === undefined ||
        eservice.mode !== catalogApi.EServiceMode.Values.RECEIVE
      );
    });

    return {
      concreteLinks: deliverConcreteLinks,
      eserviceById,
    };
  }

  return {
    async createPurposeTemplate(
      seed: bffApi.PurposeTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
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
    async linkResourceToPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      body: bffApi.LinkableResourceRequest,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.LinkedResource> {
      return await match(body)
        .with(
          { resourceKind: "ESERVICE" },
          async ({ eserviceId }): Promise<bffApi.LinkedResource> => {
            logger.info(
              `Linking e-service ${eserviceId} to purpose template ${purposeTemplateId}`
            );
            const result =
              await purposeTemplateClient.linkEServicesToPurposeTemplate(
                { eserviceIds: [eserviceId] },
                { params: { id: purposeTemplateId }, headers }
              );
            const link = result[0];
            if (!link) {
              throw new Error(
                `Unexpected empty response from purpose-template-process while linking e-service ${eserviceId} to purpose template ${purposeTemplateId}`
              );
            }
            return { resourceKind: "ESERVICE", ...link };
          }
        )
        .with(
          { resourceKind: "ESERVICE_TEMPLATE" },
          async ({ eserviceTemplateId }): Promise<bffApi.LinkedResource> => {
            logger.info(
              `Linking e-service template ${eserviceTemplateId} to purpose template ${purposeTemplateId}`
            );
            const result =
              await purposeTemplateClient.linkEServiceTemplatesToPurposeTemplate(
                { eserviceTemplateIds: [eserviceTemplateId] },
                { params: { id: purposeTemplateId }, headers }
              );
            const link = result[0];
            if (!link) {
              throw new Error(
                `Unexpected empty response from purpose-template-process while linking e-service template ${eserviceTemplateId} to purpose template ${purposeTemplateId}`
              );
            }
            return { resourceKind: "ESERVICE_TEMPLATE", ...link };
          }
        )
        .exhaustive();
    },
    async unlinkResourceFromPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      body: bffApi.LinkableResourceRequest,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await match(body)
        .with({ resourceKind: "ESERVICE" }, async ({ eserviceId }) => {
          logger.info(
            `Unlinking e-service ${eserviceId} from purpose template ${purposeTemplateId}`
          );
          await purposeTemplateClient.unlinkEServicesFromPurposeTemplate(
            { eserviceIds: [eserviceId] },
            { params: { id: purposeTemplateId }, headers }
          );
        })
        .with(
          { resourceKind: "ESERVICE_TEMPLATE" },
          async ({ eserviceTemplateId }) => {
            logger.info(
              `Unlinking e-service template ${eserviceTemplateId} from purpose template ${purposeTemplateId}`
            );
            await purposeTemplateClient.unlinkEServiceTemplatesFromPurposeTemplate(
              { eserviceTemplateIds: [eserviceTemplateId] },
              { params: { id: purposeTemplateId }, headers }
            );
          }
        )
        .exhaustive();
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
      targetTenantKind: bffApi.TargetTenantKind | undefined;
      creatorIds: string[];
      eserviceIds: string[];
      excludeExpiredRiskAnalysis: boolean;
      handlesPersonalData: boolean | undefined;
      offset: number;
      limit: number;
      ctx: WithLogger<BffAppContext>;
    }): Promise<bffApi.CatalogPurposeTemplates> {
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
    async getPurposeTemplateLinkableResources({
      purposeTemplateId,
      publisherIds,
      q,
      offset,
      limit,
      ctx,
    }: {
      purposeTemplateId: string;
      publisherIds: string[];
      q?: string;
      offset: number;
      limit: number;
      ctx: WithLogger<BffAppContext>;
    }): Promise<bffApi.LinkableResources> {
      const { headers, logger } = ctx;

      logger.info(
        `Retrieving linkable resources (concrete + templates) for purpose template ${purposeTemplateId} with q ${q}, publisherIds ${publisherIds.toString()}, offset ${offset}, limit ${limit}`
      );

      // Multi round-trip pagination is not snapshot-isolated: concurrent
      // writes during the iteration may cause individual links to be skipped
      // (a delete shifts subsequent items into offsets we already fetched)
      // or missed (an insert lands past the loop's bound). Accepted at the
      // target dimension (<200 links per purpose template, ~100ms total);
      // subsequent client calls converge.
      const [concreteLinks, templateLinks] = await Promise.all([
        fetchAllConcreteLinks(purposeTemplateId, publisherIds, q, headers),
        fetchAllTemplateLinks(purposeTemplateId, publisherIds, q, headers),
      ]);

      const { concreteLinks: deliverConcreteLinks, eserviceById } =
        await filterDeliverConcreteLinks(concreteLinks, headers);

      const merged: LinkableResourceRow[] = [
        ...deliverConcreteLinks.map(
          (link): LinkableResourceRow => ({ kind: "ESERVICE", link })
        ),
        ...templateLinks.map(
          (link): LinkableResourceRow => ({ kind: "ESERVICE_TEMPLATE", link })
        ),
      ];

      // eslint-disable-next-line functional/immutable-data
      merged.sort((a, b) => b.link.createdAt.localeCompare(a.link.createdAt));

      const pageLinks = merged.slice(offset, offset + limit);

      const results = await enrichLinkableResourcePage(
        pageLinks,
        headers,
        eserviceById
      );

      return {
        results,
        pagination: {
          offset,
          limit,
          totalCount: merged.length,
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
      const updatedPurposeTemplate =
        await purposeTemplateClient.updatePurposeTemplate(seed, {
          headers,
          params: { id },
        });

      return toBffPurposeTemplate(updatedPurposeTemplate);
    },
    async addRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: PurposeTemplateId,
      answerId: string,
      body: bffApi.addRiskAnalysisTemplateAnswerAnnotationDocument_Body,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisTemplateAnswerAnnotationDocument> {
      logger.info(
        `Adding annotation document to purpose template ${purposeTemplateId} and answer ${answerId}`
      );

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
    async getRiskAnalysisTemplateDocument(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<Uint8Array> {
      logger.info(
        `Downloading risk analysis template document from purpose template ${purposeTemplateId}`
      );

      const unsignedDocument =
        await purposeTemplateClient.getRiskAnalysisTemplateDocument({
          params: {
            purposeTemplateId,
          },
          headers,
        });

      return await fileManager.get(
        config.riskAnalysisTemplateDocumentsContainer,
        unsignedDocument.path,
        logger
      );
    },
    async getRiskAnalysisTemplateSignedDocument(
      purposeTemplateId: PurposeTemplateId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<Uint8Array> {
      logger.info(
        `Downloading signed risk analysis template document from purpose template ${purposeTemplateId}`
      );

      const signedDocument =
        await purposeTemplateClient.getRiskAnalysisTemplateSignedDocument({
          params: {
            purposeTemplateId,
          },
          headers,
        });

      return await fileManager.get(
        config.riskAnalysisTemplateSignedDocumentsContainer,
        signedDocument.path,
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
