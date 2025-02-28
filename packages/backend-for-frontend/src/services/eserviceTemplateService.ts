/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from "crypto";
import {
  bffApi,
  catalogApi,
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
  noVersionInEServiceTemplate,
  tenantNotFound,
} from "../model/errors.js";
import { BffAppContext } from "../utilities/context.js";
import {
  createOpenApiInterfaceByTemplate,
  verifyAndCreateDocument,
} from "../utilities/eserviceDocumentUtils.js";
import { cloneEServiceDocument } from "../utilities/fileUtils.js";
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
      eServiceTemplateId: EServiceTemplateId,
      seed: eserviceTemplateApi.UpdateEServiceTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Updating EService template with id ${eServiceTemplateId}`);
      await eserviceTemplateClient.updateEServiceTemplate(seed, {
        headers,
        params: {
          eServiceTemplateId,
        },
      });
    },
    updateDraftTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      seed: bffApi.UpdateEServiceTemplateVersionSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating draft version ${eServiceTemplateVersionId} of EService template ${eServiceTemplateId}`
      );
      await eserviceTemplateClient.updateDraftTemplateVersion(seed, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    suspendEServiceTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Suspending version ${eServiceTemplateVersionId} of EService template ${eServiceTemplateId}`
      );
      await eserviceTemplateClient.suspendTemplateVersion(undefined, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    activateEServiceTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Activating version ${eServiceTemplateVersionId} of EService template ${eServiceTemplateId}`
      );
      await eserviceTemplateClient.activateTemplateVersion(undefined, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    publishEServiceTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Publishing version ${eServiceTemplateVersionId} of EService template ${eServiceTemplateId}`
      );
      await eserviceTemplateClient.publishTemplateVersion(undefined, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    deleteEServiceTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting version ${eServiceTemplateVersionId} of EService template ${eServiceTemplateId}`
      );
      await eserviceTemplateClient.deleteDraftTemplateVersion(undefined, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    updateEServiceTemplateName: async (
      eServiceTemplateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateNameUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Updating EService template ${eServiceTemplateId} name`);
      await eserviceTemplateClient.updateEServiceTemplateName(seed, {
        headers,
        params: {
          eServiceTemplateId,
        },
      });
    },
    updateEServiceTemplateAudienceDescription: async (
      eServiceTemplateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateDescriptionUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${eServiceTemplateId} audience description`
      );
      await eserviceTemplateClient.updateEServiceTemplateAudienceDescription(
        seed,
        {
          headers,
          params: {
            eServiceTemplateId,
          },
        }
      );
    },
    updateEServiceTemplateEServiceDescription: async (
      eServiceTemplateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateDescriptionUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${eServiceTemplateId} e-service description`
      );
      await eserviceTemplateClient.updateEServiceTemplateEServiceDescription(
        seed,
        {
          headers,
          params: {
            eServiceTemplateId,
          },
        }
      );
    },
    updateEServiceTemplateVersionQuotas: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      seed: bffApi.EServiceTemplateVersionQuotasUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${eServiceTemplateId} version ${eServiceTemplateVersionId} quotas`
      );
      await eserviceTemplateClient.updateTemplateVersionQuotas(seed, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    updateEServiceTemplateVersionAttributes: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      seed: bffApi.DescriptorAttributesSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${eServiceTemplateId} version ${eServiceTemplateVersionId} attributes`
      );
      await eserviceTemplateClient.updateTemplateVersionAttributes(seed, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    getEServiceTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceTemplateVersionDetails> => {
      logger.info(
        `Retrieving EService template version for eServiceTemplateId = ${eServiceTemplateId}, eServiceTemplateVersionId = ${eServiceTemplateVersionId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eServiceTemplateId,
        eserviceTemplateClient,
        headers
      );

      const eserviceTemplateVersion = retrieveEServiceTemplateVersion(
        eserviceTemplate,
        eServiceTemplateVersionId
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
      eServiceTemplateId: EServiceTemplateId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceTemplateDetails> => {
      logger.info(
        `Retrieving EService template for eServiceTemplateId = ${eServiceTemplateId}`
      );

      const eserviceTemplate: eserviceTemplateApi.EServiceTemplate =
        await eserviceTemplateClient.getEServiceTemplateById({
          params: {
            eServiceTemplateId,
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
      eServiceTemplateId: EServiceTemplateId,
      seed: bffApi.EServiceRiskAnalysisSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Creating EService template ${eServiceTemplateId} risk analysis`
      );
      await eserviceTemplateClient.createEServiceTemplateRiskAnalysis(seed, {
        headers,
        params: {
          eServiceTemplateId,
        },
      });
    },
    updateEServiceTemplateEServiceRiskAnalysis: async (
      eServiceTemplateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      seed: bffApi.EServiceRiskAnalysisSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${eServiceTemplateId} risk analysis ${riskAnalysisId}`
      );
      await eserviceTemplateClient.updateEServiceTemplateRiskAnalysis(seed, {
        headers,
        params: {
          eServiceTemplateId,
          riskAnalysisId,
        },
      });
    },
    deleteEServiceTemplateEServiceRiskAnalysis: async (
      eServiceTemplateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting EService template ${eServiceTemplateId} risk analysis ${riskAnalysisId}`
      );
      await eserviceTemplateClient.deleteEServiceTemplateRiskAnalysis(
        undefined,
        {
          headers,
          params: {
            eServiceTemplateId,
            riskAnalysisId,
          },
        }
      );
    },
    createEServiceTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Creating new version for EService template ${eServiceTemplateId}`
      );
      const eServiceTemplate =
        await eserviceTemplateClient.getEServiceTemplateById({
          params: { eServiceTemplateId },
          headers,
        });

      if (eServiceTemplate.versions.length === 0) {
        throw noVersionInEServiceTemplate(eServiceTemplateId);
      }

      const retrieveLatestEServiceTemplateVersion = (
        versions: eserviceTemplateApi.EServiceTemplateVersion[]
      ): eserviceTemplateApi.EServiceTemplateVersion =>
        versions.reduce(
          (latestVersions, curr) =>
            curr.version > latestVersions.version ? curr : latestVersions,
          versions[0]
        );

      const previousVersion = retrieveLatestEServiceTemplateVersion(
        eServiceTemplate.versions
      );

      const clonedDocumentsCalls = previousVersion.docs.map((doc) =>
        cloneEServiceDocument({
          doc,
          documentsContainer: config.eserviceTemplateDocumentsContainer,
          documentsPath: config.eserviceTemplateDocumentsPath,
          fileManager,
          logger,
        })
      );

      const clonedDocuments = await Promise.all(clonedDocumentsCalls);

      const { id } = await eserviceTemplateClient.createEServiceTemplateVersion(
        {
          description: previousVersion.description,
          voucherLifespan: previousVersion.voucherLifespan,
          dailyCallsPerConsumer: previousVersion.dailyCallsPerConsumer,
          dailyCallsTotal: previousVersion.dailyCallsTotal,
          agreementApprovalPolicy: previousVersion.agreementApprovalPolicy,
          attributes: previousVersion.attributes,
          docs: clonedDocuments,
        },
        {
          headers,
          params: {
            eServiceTemplateId,
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
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      doc: bffApi.createEServiceDocument_Body,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      ctx.logger.info(
        `Creating EService Template Document for EService template ${eServiceTemplateId} and Version ${eServiceTemplateVersionId}`
      );
      const eserviceTemplate =
        await eserviceTemplateClient.getEServiceTemplateById({
          params: { eServiceTemplateId },
          headers: ctx.headers,
        });

      retrieveEServiceTemplateVersion(
        eserviceTemplate,
        eServiceTemplateVersionId
      );

      const documentId = randomUUID();

      await verifyAndCreateDocument(
        fileManager,
        eserviceTemplate.id,
        apiTechnologyToTechnology(eserviceTemplate.technology),
        doc.prettyName, // It's correct ???
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
                eServiceTemplateId: eserviceTemplate.id,
                eServiceTemplateVersionId,
              },
            }
          );
        },
        ctx.logger
      );

      return { id: documentId };
    },
    getEServiceTemplateDocument: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ contentType: string; document: Buffer }> => {
      logger.info(
        `Retrieving EService Template Document for EService template ${eServiceTemplateId} and Version ${eServiceTemplateVersionId} and Document ${documentId}`
      );
      const { path, contentType } =
        await eserviceTemplateClient.getEServiceTemplateDocumentById({
          params: {
            eServiceTemplateId,
            eServiceTemplateVersionId,
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
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      updateEServiceTemplateVersionDocumentSeed: bffApi.UpdateEServiceTemplateVersionDocumentSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceDoc> => {
      logger.info(
        `Updating document ${documentId} of version ${eServiceTemplateVersionId} of EServiceTemplate ${eServiceTemplateId}`
      );
      const { id, name, contentType, prettyName } =
        await eserviceTemplateClient.updateEServiceTemplateDocumentById(
          updateEServiceTemplateVersionDocumentSeed,
          {
            params: {
              eServiceTemplateId,
              eServiceTemplateVersionId,
              documentId,
            },
            headers,
          }
        );

      return { id, name, contentType, prettyName };
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
          delegationStates: ["ACTIVE"],
          kind: "DELEGATED_PRODUCER",
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
  eServiceTemplateId: string,
  eserviceTemplateClient: EServiceTemplateProcessClient,
  headers: BffAppContext["headers"]
): Promise<eserviceTemplateApi.EServiceTemplate> => {
  const eserviceTemplate = await eserviceTemplateClient.getEServiceTemplateById(
    {
      params: {
        eServiceTemplateId,
      },
      headers,
    }
  );

  if (!eserviceTemplate) {
    throw eserviceTemplateNotFound(eServiceTemplateId);
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
