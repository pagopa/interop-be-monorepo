/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  genericError,
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
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiDescriptorDoc,
} from "../api/catalogApiConverter.js";
import {
  toBffCatalogEServiceTemplate,
  toBffEServiceTemplateApiEServiceTemplateDetails,
} from "../api/eserviceTemplateApiConverter.js";
import {
  eserviceTemplateVersionNotFound,
  tenantNotFound,
} from "../model/errors.js";
import { toBffCompactOrganization } from "../api/agreementApiConverter.js";
import { getAllBulkAttributes } from "./attributeService.js";

export function eserviceTemplateServiceBuilder(
  eserviceTemplateClient: EServiceTemplateProcessClient,
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  _fileManager: FileManager
) {
  return {
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

      const results = await enhanceCatalogEServiceTemplates(
        eserviceTemplatesResponse.results,
        tenantProcessClient,
        headers
      );

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

      const results = await enhanceCatalogEServiceTemplates(
        eserviceTemplatesResponse.results,
        tenantProcessClient,
        headers
      );

      return {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eserviceTemplatesResponse.totalCount,
        },
      };
    },
  };
}

async function enhanceCatalogEServiceTemplates(
  eserviceTemplates: eserviceTemplateApi.EServiceTemplates["results"],
  tenantProcessClient: TenantProcessClient,
  headers: BffAppContext["headers"]
): Promise<bffApi.CatalogEServiceTemplate[]> {
  const creatorsIds = Array.from(
    new Set(eserviceTemplates.map((t) => t.creatorId))
  );

  const tenants = await Promise.all(
    creatorsIds.map(async (id) =>
      tenantProcessClient.tenant.getTenant({ headers, params: { id } })
    )
  );

  const tenantsMap: Map<string, tenantApi.Tenant> = new Map(
    tenants.map((t) => [t.id, t])
  );

  return eserviceTemplates.map((eserviceTemplate) =>
    enhanceCatalogEServiceTemplate(eserviceTemplate, tenantsMap)
  );
}

function enhanceCatalogEServiceTemplate(
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate,
  tenantsMap: Map<string, tenantApi.Tenant>
): bffApi.CatalogEServiceTemplate {
  const creator = tenantsMap.get(eserviceTemplate.creatorId);
  if (!creator) {
    throw tenantNotFound(eserviceTemplate.creatorId);
  }

  const activeVersion = eserviceTemplate.versions.find(
    (v) =>
      v.state ===
      eserviceTemplateApi.EServiceTemplateVersionState.Values.PUBLISHED
  );

  if (!activeVersion) {
    throw genericError(
      `Active version not found for EService template ${eserviceTemplate.id}`
    );
  }

  return toBffCatalogEServiceTemplate(eserviceTemplate, activeVersion, creator);
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
