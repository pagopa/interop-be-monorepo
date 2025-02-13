/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  RiskAnalysisId,
} from "pagopa-interop-models";
import { bffApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  AttributeProcessClient,
  EServiceTemplateProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiDescriptorDoc,
} from "../api/catalogApiConverter.js";
import { toBffEServiceTemplateApiEServiceTemplateDetails } from "../api/eserviceTemplateApiConverter.js";
import {
  eserviceTemplateVersionNotFound,
  noVersionInEServiceTemplate,
} from "../model/errors.js";
import { cloneEServiceDocument } from "../utilities/fileUtils.js";
import { config } from "../config/config.js";
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
          documentsContainer: config.eserviceDocumentsContainer,
          documentsPath: config.eserviceDocumentsPath,
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
