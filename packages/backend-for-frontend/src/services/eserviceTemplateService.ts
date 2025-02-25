/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from "crypto";
import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  RiskAnalysisId,
} from "pagopa-interop-models";
import {
  bffApi,
  eserviceTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  AttributeProcessClient,
  EServiceTemplateProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  apiTechnologyToTechnology,
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiDescriptorDoc,
} from "../api/catalogApiConverter.js";
import {
  toBffCatalogEServiceTemplate,
  toBffEServiceTemplateApiEServiceTemplateDetails,
  toBffProducerEServiceTemplate,
} from "../api/eserviceTemplateApiConverter.js";
import {
  eserviceTemplateVersionNotFound,
  tenantNotFound,
} from "../model/errors.js";
import { verifyAndCreateDocument } from "../utilities/eserviceDocumentUtils.js";
import { getAllBulkAttributes } from "./attributeService.js";

export function eserviceTemplateServiceBuilder(
  eserviceTemplateClient: EServiceTemplateProcessClient,
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  fileManager: FileManager
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

      const eserviceTemplate: eserviceTemplateApi.EServiceTemplate =
        await eserviceTemplateClient.getEServiceTemplateById({
          params: {
            eServiceTemplateId,
          },
          headers,
        });

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
        eserviceTemplate: toBffEServiceTemplateApiEServiceTemplateDetails(
          eserviceTemplate,
          creatorTenant
        ),
      };
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
        doc.prettyName,
        doc.kind,
        doc.doc,
        documentId,
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
