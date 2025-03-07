/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from "crypto";
import {
  bffApi,
  catalogApi,
  delegationApi,
  eserviceTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  RiskAnalysisId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { CreatedResource } from "../../../api-clients/dist/bffApi.js";
import { toBffCompactOrganization } from "../api/agreementApiConverter.js";
import {
  apiTechnologyToTechnology,
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiDescriptorDoc,
} from "../api/catalogApiConverter.js";
import {
  toBffCatalogEServiceTemplate,
  toBffEServiceTemplateDetails,
  toBffProducerEServiceTemplate,
} from "../api/eserviceTemplateApiConverter.js";
import {
  AttributeProcessClient,
  CatalogProcessClient,
  DelegationProcessClient,
  EServiceTemplateProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { BffProcessConfig, config } from "../config/config.js";
import {
  eServiceNotFound,
  eserviceTemplateDataNotFound,
  eserviceTemplateInterfaceNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  tenantNotFound,
} from "../model/errors.js";
import { BffAppContext } from "../utilities/context.js";
import {
  createOpenApiInterfaceByTemplate,
  verifyAndCreateDocument,
} from "../utilities/eserviceDocumentUtils.js";
import { getAllBulkAttributes } from "./attributeService.js";
import { retrieveEserviceDescriptor } from "./catalogService.js";
import {
  assertIsDraftEservice,
  assertTemplateIsPublished,
  verifyRequesterIsProducerOrDelegateProducer,
} from "./validators.js";

export function eserviceTemplateServiceBuilder(
  eserviceTemplateClient: EServiceTemplateProcessClient,
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  catalogProcessClient: CatalogProcessClient,
  delegationClients: DelegationProcessClient,
  fileManager: FileManager,
  bffConfig: BffProcessConfig
) {
  return {
    createEServiceTemplate: async (
      seed: eserviceTemplateApi.EServiceTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<eserviceTemplateApi.EServiceTemplate> => {
      logger.info(`Creating new EService template with name ${seed.name}`);
      return await eserviceTemplateClient.createEServiceTemplate(seed, {
        headers,
      });
    },
    updateEServiceTemplate: async (
      templateId: EServiceTemplateId,
      seed: eserviceTemplateApi.UpdateEServiceTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Updating EService template with id ${templateId}`);
      await eserviceTemplateClient.updateEServiceTemplate(seed, {
        headers,
        params: {
          templateId,
        },
      });
    },
    updateDraftTemplateVersion: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      seed: bffApi.UpdateEServiceTemplateVersionSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating draft version ${templateVersionId} of EService template ${templateId}`
      );
      await eserviceTemplateClient.updateDraftTemplateVersion(seed, {
        headers,
        params: {
          templateId,
          templateVersionId,
        },
      });
    },
    suspendEServiceTemplateVersion: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Suspending version ${templateVersionId} of EService template ${templateId}`
      );
      await eserviceTemplateClient.suspendTemplateVersion(undefined, {
        headers,
        params: {
          templateId,
          templateVersionId,
        },
      });
    },
    activateEServiceTemplateVersion: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Activating version ${templateVersionId} of EService template ${templateId}`
      );
      await eserviceTemplateClient.activateTemplateVersion(undefined, {
        headers,
        params: {
          templateId,
          templateVersionId,
        },
      });
    },
    publishEServiceTemplateVersion: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Publishing version ${templateVersionId} of EService template ${templateId}`
      );
      await eserviceTemplateClient.publishTemplateVersion(undefined, {
        headers,
        params: {
          templateId,
          templateVersionId,
        },
      });
    },
    deleteEServiceTemplateVersion: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting version ${templateVersionId} of EService template ${templateId}`
      );
      await eserviceTemplateClient.deleteDraftTemplateVersion(undefined, {
        headers,
        params: {
          templateId,
          templateVersionId,
        },
      });
    },
    updateEServiceTemplateName: async (
      templateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateNameUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Updating EService template ${templateId} name`);
      await eserviceTemplateClient.updateEServiceTemplateName(seed, {
        headers,
        params: {
          templateId,
        },
      });
    },
    updateEServiceIntendedTarget: async (
      templateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateDescriptionUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${templateId} intended target description`
      );
      await eserviceTemplateClient.updateEServiceIntendedTarget(seed, {
        headers,
        params: {
          templateId,
        },
      });
    },
    updateEServiceTemplateDescription: async (
      templateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateDescriptionUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${templateId} e-service description`
      );
      await eserviceTemplateClient.updateEServiceTemplateDescription(seed, {
        headers,
        params: {
          templateId,
        },
      });
    },
    updateEServiceTemplateVersionQuotas: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      seed: bffApi.EServiceTemplateVersionQuotasUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${templateId} version ${templateVersionId} quotas`
      );
      await eserviceTemplateClient.updateTemplateVersionQuotas(seed, {
        headers,
        params: {
          templateId,
          templateVersionId,
        },
      });
    },
    updateEServiceTemplateVersionAttributes: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      seed: bffApi.DescriptorAttributesSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${templateId} version ${templateVersionId} attributes`
      );
      await eserviceTemplateClient.updateTemplateVersionAttributes(seed, {
        headers,
        params: {
          templateId,
          templateVersionId,
        },
      });
    },
    getEServiceTemplateVersion: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceTemplateVersionDetails> => {
      logger.info(
        `Retrieving EService template version for templateId = ${templateId}, templateVersionId = ${templateVersionId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        templateId,
        eserviceTemplateClient,
        headers
      );

      const eserviceTemplateVersion = retrieveEServiceTemplateVersion(
        eserviceTemplate,
        templateVersionId
      );

      const eserviceTemplateVersionAttributeIds = getAttributeIds(
        eserviceTemplateVersion
      );

      const attributes = await getAllBulkAttributes(
        attributeProcessClient,
        headers,
        eserviceTemplateVersionAttributeIds
      );

      const eserviceTemplateVersionAttributes =
        toBffCatalogApiDescriptorAttributes(
          attributes,
          eserviceTemplateVersion.attributes
        );

      const creatorTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: eserviceTemplate.creatorId,
        },
      });

      return {
        id: eserviceTemplateVersion.id,
        version: eserviceTemplateVersion.version,
        description: eserviceTemplateVersion.description,
        interface:
          eserviceTemplateVersion.interface &&
          toBffCatalogApiDescriptorDoc(eserviceTemplateVersion.interface),
        docs: eserviceTemplateVersion.docs.map(toBffCatalogApiDescriptorDoc),
        state: eserviceTemplateVersion.state,
        voucherLifespan: eserviceTemplateVersion.voucherLifespan,
        dailyCallsPerConsumer: eserviceTemplateVersion.dailyCallsPerConsumer,
        dailyCallsTotal: eserviceTemplateVersion.dailyCallsTotal,
        agreementApprovalPolicy:
          eserviceTemplateVersion.agreementApprovalPolicy,
        attributes: eserviceTemplateVersionAttributes,
        eserviceTemplate: toBffEServiceTemplateDetails(
          eserviceTemplate,
          creatorTenant
        ),
      };
    },
    getEServiceTemplate: async (
      templateId: EServiceTemplateId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceTemplateDetails> => {
      logger.info(
        `Retrieving EService template for templateId = ${templateId}`
      );

      const eserviceTemplate: eserviceTemplateApi.EServiceTemplate =
        await eserviceTemplateClient.getEServiceTemplateById({
          params: {
            templateId,
          },
          headers,
        });

      const creatorTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: eserviceTemplate.creatorId,
        },
      });

      return toBffEServiceTemplateDetails(eserviceTemplate, creatorTenant);
    },
    getCatalogEServiceTemplates: async (
      name: string | undefined,
      creatorsIds: string[],
      offset: number,
      limit: number,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CatalogEServiceTemplates> => {
      logger.info(
        `Retrieving Catalog EService templates for name = ${name}, creatorsIds = ${creatorsIds}, offset = ${offset}, limit = ${limit}`
      );
      const eserviceTemplatesResponse: eserviceTemplateApi.EServiceTemplates =
        await eserviceTemplateClient.getEServiceTemplates({
          headers,
          queries: {
            name,
            states: [
              eserviceTemplateApi.EServiceTemplateVersionState.Values.PUBLISHED,
            ],
            creatorsIds,
            limit,
            offset,
          },
        });

      const creatorTenantsMap = await getTenantsFromEServiceTemplates(
        tenantProcessClient,
        eserviceTemplatesResponse.results,
        headers
      );

      const results = eserviceTemplatesResponse.results.map((template) => {
        const creator = creatorTenantsMap.get(template.creatorId);

        if (!creator) {
          throw tenantNotFound(template.creatorId);
        }

        return toBffCatalogEServiceTemplate(template, creator);
      });

      return {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eserviceTemplatesResponse.totalCount,
        },
      };
    },
    getProducerEServiceTemplates: async (
      name: string | undefined,
      offset: number,
      limit: number,
      { headers, logger, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceTemplates> => {
      logger.info(
        `Retrieving EService templates for creator ${authData.organizationId}, for name = ${name}, offset = ${offset}, limit = ${limit}`
      );
      const eserviceTemplatesResponse: eserviceTemplateApi.EServiceTemplates =
        await eserviceTemplateClient.getEServiceTemplates({
          headers,
          queries: {
            name,
            creatorsIds: [authData.organizationId],
            limit,
            offset,
          },
        });

      return {
        results: eserviceTemplatesResponse.results.map(
          toBffProducerEServiceTemplate
        ),
        pagination: {
          offset,
          limit,
          totalCount: eserviceTemplatesResponse.totalCount,
        },
      };
    },
    createEServiceTemplateEServiceRiskAnalysis: async (
      templateId: EServiceTemplateId,
      seed: bffApi.EServiceRiskAnalysisSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Creating EService template ${templateId} risk analysis`);
      await eserviceTemplateClient.createEServiceTemplateRiskAnalysis(seed, {
        headers,
        params: {
          templateId,
        },
      });
    },
    updateEServiceTemplateEServiceRiskAnalysis: async (
      templateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      seed: bffApi.EServiceRiskAnalysisSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${templateId} risk analysis ${riskAnalysisId}`
      );
      await eserviceTemplateClient.updateEServiceTemplateRiskAnalysis(seed, {
        headers,
        params: {
          templateId,
          riskAnalysisId,
        },
      });
    },
    deleteEServiceTemplateEServiceRiskAnalysis: async (
      templateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting EService template ${templateId} risk analysis ${riskAnalysisId}`
      );
      await eserviceTemplateClient.deleteEServiceTemplateRiskAnalysis(
        undefined,
        {
          headers,
          params: {
            templateId,
            riskAnalysisId,
          },
        }
      );
    },
    createEServiceTemplateVersion: async (
      templateId: EServiceTemplateId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(`Creating new version for EService template ${templateId}`);

      const { id } = await eserviceTemplateClient.createEServiceTemplateVersion(
        undefined,
        {
          headers,
          params: {
            templateId,
          },
        }
      );

      return { id };
    },
    getEServiceTemplateCreators: async (
      {
        creatorName,
        offset,
        limit,
      }: { creatorName: string | undefined; offset: number; limit: number },
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> => {
      logger.info(`Retrieving EService template creators`);

      const res = await eserviceTemplateClient.getEServiceTemplateCreators({
        headers,
        queries: {
          creatorName,
          offset,
          limit,
        },
      });

      return {
        results: res.results.map(toBffCompactOrganization),
        pagination: {
          offset,
          limit,
          totalCount: res.totalCount,
        },
      };
    },
    createEServiceTemplateDocument: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      doc: bffApi.createEServiceDocument_Body,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      ctx.logger.info(
        `Creating EService Template Document for EService template ${templateId} and Version ${templateVersionId}`
      );
      const eserviceTemplate =
        await eserviceTemplateClient.getEServiceTemplateById({
          params: { templateId },
          headers: ctx.headers,
        });

      retrieveEServiceTemplateVersion(eserviceTemplate, templateVersionId);

      const documentId = randomUUID();

      await verifyAndCreateDocument(
        fileManager,
        eserviceTemplate.id,
        apiTechnologyToTechnology(eserviceTemplate.technology),
        doc.prettyName,
        doc.kind,
        doc.doc,
        documentId,
        config.eserviceDocumentsContainer,
        config.eserviceDocumentsPath,
        async (filePath, serverUrls, checksum) => {
          await eserviceTemplateClient.createEServiceTemplateDocument(
            {
              documentId,
              prettyName: doc.prettyName,
              fileName: doc.doc.name,
              filePath,
              kind: doc.kind,
              contentType: doc.doc.type,
              checksum,
              serverUrls,
            },
            {
              headers: ctx.headers,
              params: {
                templateId: eserviceTemplate.id,
                templateVersionId,
              },
            }
          );
        },
        ctx.logger
      );

      return { id: documentId };
    },
    getEServiceTemplateDocument: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ contentType: string; document: Buffer }> => {
      logger.info(
        `Retrieving EService Template Document for EService template ${templateId} and Version ${templateVersionId} and Document ${documentId}`
      );
      const { path, contentType } =
        await eserviceTemplateClient.getEServiceTemplateDocumentById({
          params: {
            templateId,
            templateVersionId,
            documentId,
          },
          headers,
        });

      const stream = await fileManager.get(
        config.eserviceTemplateDocumentsContainer,
        path,
        logger
      );

      return { contentType, document: Buffer.from(stream) };
    },

    updateEServiceTemplateDocumentById: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      updateEServiceTemplateVersionDocumentSeed: bffApi.UpdateEServiceTemplateVersionDocumentSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceDoc> => {
      logger.info(
        `Updating document ${documentId} of version ${templateVersionId} of EServiceTemplate ${templateId}`
      );
      const { id, name, contentType, prettyName, checksum } =
        await eserviceTemplateClient.updateEServiceTemplateDocumentById(
          updateEServiceTemplateVersionDocumentSeed,
          {
            params: {
              templateId,
              templateVersionId,
              documentId,
            },
            headers,
          }
        );

      return { id, name, contentType, prettyName, checksum };
    },
    addEserviceInterfaceByTemplate: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      eserviceInstanceInterfaceData: bffApi.EserviceInterfaceTemplatePayload,
      ctx: WithLogger<BffAppContext>
    ): Promise<CreatedResource> => {
      const { logger, authData, headers } = ctx;
      logger.info(
        `Adding interface by template to EService ${eServiceId} with descriptor ${descriptorId}`
      );

      const eservice = await retrieveEService(
        eServiceId,
        catalogProcessClient,
        headers
      );
      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);
      assertIsDraftEservice(eservice);

      const delegations = await delegationClients.delegation.getDelegations({
        queries: {
          limit: 1,
          offset: 1,
          delegationStates: [delegationApi.DelegationState.Values.ACTIVE],
          kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
          eserviceIds: [eServiceId],
        },
        headers,
      });
      verifyRequesterIsProducerOrDelegateProducer(
        authData.organizationId,
        eservice,
        delegations.results
      );

      const { eserviceTemplateId, eserviceTemplateVersionId } =
        getTemplateDataFromEservice(eservice, descriptor);

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        eserviceTemplateClient,
        headers
      );

      const eserviceTemplateVersion = retrieveEServiceTemplateVersion(
        eserviceTemplate,
        eserviceTemplateVersionId
      );

      assertTemplateIsPublished(eserviceTemplate, eserviceTemplateVersionId);

      const templateInterface = eserviceTemplateVersion.interface;
      if (!templateInterface) {
        throw eserviceTemplateInterfaceNotFound(
          eserviceTemplateId,
          eserviceTemplateVersionId
        );
      }

      const resourceId = await createOpenApiInterfaceByTemplate(
        eservice,
        eserviceTemplateVersionId,
        templateInterface,
        eserviceInstanceInterfaceData,
        bffConfig.eserviceTemplateDocumentsContainer,
        fileManager,
        catalogProcessClient,
        ctx
      );

      return { id: resourceId };
    },
    deleteEServiceTemplateDocumentById: async (
      templateId: EServiceTemplateId,
      templateVersionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting document ${documentId} of version ${templateVersionId} of EServiceTemplate ${templateId}`
      );
      await eserviceTemplateClient.deleteEServiceTemplateDocumentById(
        undefined,
        {
          params: {
            templateId,
            templateVersionId,
            documentId,
          },
          headers,
        }
      );
    },
  };
}

export const retrieveEServiceTemplateVersion = (
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate,
  eserviceTemplateVersionId: EServiceTemplateVersionId
): eserviceTemplateApi.EServiceTemplateVersion => {
  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (v) => v.id === eserviceTemplateVersionId
  );

  if (!eserviceTemplateVersion) {
    throw eserviceTemplateVersionNotFound(
      eserviceTemplate.id,
      eserviceTemplateVersionId
    );
  }

  return eserviceTemplateVersion;
};

async function getTenantsFromEServiceTemplates(
  tenantClient: TenantProcessClient,
  eserviceTemplates: eserviceTemplateApi.EServiceTemplate[],
  headers: BffAppContext["headers"]
): Promise<Map<string, tenantApi.Tenant>> {
  const creatorsIds = Array.from(
    new Set(eserviceTemplates.map((t) => t.creatorId))
  );

  const tenants = await Promise.all(
    creatorsIds.map(async (id) =>
      tenantClient.tenant.getTenant({ headers, params: { id } })
    )
  );

  return new Map(tenants.map((t) => [t.id, t]));
}
export const retrieveEServiceTemplate = async (
  templateId: string,
  eserviceTemplateClient: EServiceTemplateProcessClient,
  headers: BffAppContext["headers"]
): Promise<eserviceTemplateApi.EServiceTemplate> => {
  const eserviceTemplate = await eserviceTemplateClient.getEServiceTemplateById(
    {
      params: {
        templateId,
      },
      headers,
    }
  );

  if (!eserviceTemplate) {
    throw eserviceTemplateNotFound(templateId);
  }
  return eserviceTemplate;
};

const retrieveEService = async (
  eServiceId: EServiceId,
  catalogProcessClient: CatalogProcessClient,
  headers: BffAppContext["headers"]
): Promise<catalogApi.EService> => {
  const eservice = await catalogProcessClient.getEServiceById({
    params: { eServiceId },
    headers,
  });

  if (eservice === undefined) {
    throw eServiceNotFound(eServiceId);
  }
  return eservice;
};

const getTemplateDataFromEservice = (
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor
): {
  eserviceTemplateId: EServiceTemplateId;
  eserviceTemplateVersionId: EServiceTemplateVersionId;
} => {
  const eserviceTemplateId = eservice.templateRef?.id;
  const eserviceTemplateVersionId = descriptor.templateVersionRef?.id;

  if (!eserviceTemplateId || !eserviceTemplateVersionId) {
    throw eserviceTemplateDataNotFound(eservice.id);
  }

  return {
    eserviceTemplateId: unsafeBrandId(eserviceTemplateId),
    eserviceTemplateVersionId: unsafeBrandId(eserviceTemplateVersionId),
  };
};

const getAttributeIds = (
  eserviceTemplateVersion: eserviceTemplateApi.EServiceTemplateVersion
): string[] => [
  ...eserviceTemplateVersion.attributes.certified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...eserviceTemplateVersion.attributes.declared.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...eserviceTemplateVersion.attributes.verified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
];

export type EServiceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;
