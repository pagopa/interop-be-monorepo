/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from "crypto";
import {
  bffApi,
  eserviceTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  FileManager,
  verifyAndCreateDocument,
  WithLogger,
} from "pagopa-interop-commons";
import {
  EServiceDocumentId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  RiskAnalysisId,
  tenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
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
  EServiceTemplateProcessClient,
  InAppNotificationManagerClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { config } from "../config/config.js";
import {
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  noVersionInEServiceTemplate,
  tenantNotFound,
} from "../model/errors.js";
import { BffAppContext } from "../utilities/context.js";
import { cloneEServiceDocument } from "../utilities/fileUtils.js";
import { filterUnreadNotifications } from "../utilities/filterUnreadNotifications.js";
import { getAllBulkAttributes } from "./attributeService.js";

export function eserviceTemplateServiceBuilder(
  eserviceTemplateClient: EServiceTemplateProcessClient,
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  catalogProcessClient: CatalogProcessClient,
  inAppNotificationManagerClient: InAppNotificationManagerClient,
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
      templateId: EServiceTemplateId,
      seed: eserviceTemplateApi.UpdateEServiceTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Updating EService template with id ${templateId}`);
      await eserviceTemplateClient.updateDraftEServiceTemplate(seed, {
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
    updateEServiceTemplateIntendedTarget: async (
      templateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateIntendedTargetUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${templateId} intended target description`
      );
      await eserviceTemplateClient.updateEServiceTemplateIntendedTarget(seed, {
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
      { headers, logger, authData }: WithLogger<BffAppContext>
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

      const callerTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: authData.organizationId,
        },
      });

      const isAlreadyInstantiated =
        (
          await catalogProcessClient.getEServices({
            headers,
            queries: {
              templatesIds: [eserviceTemplate.id],
              producersIds: [callerTenant.id],
              limit: 1,
              offset: 0,
            },
          })
        ).totalCount > 0;

      const hasRequesterRiskAnalysis = match(eserviceTemplate.mode)
        .with(eserviceTemplateApi.EServiceMode.Values.DELIVER, () => null)
        .with(eserviceTemplateApi.EServiceMode.Values.RECEIVE, () =>
          eserviceTemplate.riskAnalysis.some((r) =>
            match(callerTenant.kind)
              .with(tenantKind.PA, () => r.tenantKind === tenantKind.PA)
              .with(
                tenantKind.GSP,
                tenantKind.PRIVATE,
                tenantKind.SCP,
                () =>
                  r.tenantKind === tenantKind.GSP ||
                  r.tenantKind === tenantKind.PRIVATE ||
                  r.tenantKind === tenantKind.SCP
              )
              .otherwise(() => false)
          )
        )
        .exhaustive();

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
        isAlreadyInstantiated,
        ...(hasRequesterRiskAnalysis !== null && { hasRequesterRiskAnalysis }),
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
      personalData: bffApi.PersonalDataFilter | undefined,
      offset: number,
      limit: number,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CatalogEServiceTemplates> => {
      logger.info(
        `Retrieving Catalog EService templates for name = ${name}, creatorsIds = ${creatorsIds}, personalData = ${personalData}, offset = ${offset}, limit = ${limit}`
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
    getCreatorEServiceTemplates: async (
      name: string | undefined,
      offset: number,
      limit: number,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceTemplates> => {
      const { headers, logger, authData } = ctx;
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

      const notifications = await filterUnreadNotifications(
        inAppNotificationManagerClient,
        eserviceTemplatesResponse.results.map((a) => a.id),
        ctx
      );

      return {
        results: eserviceTemplatesResponse.results.map((template) =>
          toBffProducerEServiceTemplate(template, notifications)
        ),
        pagination: {
          offset,
          limit,
          totalCount: eserviceTemplatesResponse.totalCount,
        },
      };
    },
    createEServiceTemplateRiskAnalysis: async (
      templateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateRiskAnalysisSeed,
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
    updateEServiceTemplateRiskAnalysis: async (
      templateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      seed: bffApi.EServiceTemplateRiskAnalysisSeed,
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

      const eserviceTemplate =
        await eserviceTemplateClient.getEServiceTemplateById({
          params: {
            templateId,
          },
          headers,
        });

      if (eserviceTemplate.versions.length === 0) {
        throw noVersionInEServiceTemplate(eserviceTemplate.id);
      }

      const previousVersion = eserviceTemplate.versions.reduce(
        (latestVersions, curr) =>
          curr.version > latestVersions.version ? curr : latestVersions,
        eserviceTemplate.versions[0]
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

      const response =
        await eserviceTemplateClient.createEServiceTemplateVersion(
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
              templateId,
            },
          }
        );

      return { id: response.createdEServiceTemplateVersionId };
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
        results: res.results.map((r) => toBffCompactOrganization(r)),
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
        { id: eserviceTemplate.id, isEserviceTemplate: true },
        apiTechnologyToTechnology(eserviceTemplate.technology),
        doc.kind,
        doc.doc,
        documentId,
        config.eserviceDocumentsContainer,
        config.eserviceDocumentsPath,
        doc.prettyName,
        async (
          documentId,
          fileName,
          filePath,
          prettyName,
          kind,
          serverUrls,
          contentType,
          checksum
        ) => {
          await eserviceTemplateClient.createEServiceTemplateDocument(
            {
              documentId,
              prettyName,
              fileName,
              filePath,
              kind,
              contentType,
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
    updateEServiceTemplatePersonalDataFlag: async (
      { logger, headers }: WithLogger<BffAppContext>,
      templateId: EServiceTemplateId,
      personalDataSeed: bffApi.EServiceTemplatePersonalDataFlagUpdateSeed
    ): Promise<void> => {
      logger.info(
        `Set personal flag for E-Service Template with id = ${templateId} to ${personalDataSeed.personalData}`
      );
      await eserviceTemplateClient.updateEServiceTemplatePersonalDataFlagAfterPublication(
        personalDataSeed,
        {
          headers,
          params: {
            templateId,
          },
        }
      );
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
