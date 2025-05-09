/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  AttributeId,
  EService,
  Tenant,
  Attribute,
  descriptorState,
} from "pagopa-interop-models";
import { eq, inArray } from "drizzle-orm";
import {
  attributeInReadmodelAttribute,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  aggregateEserviceArray,
  TenantReadModelService,
  toEServiceAggregatorArray,
} from "pagopa-interop-readmodel";
import { DrizzleReturnType } from "../../../readmodel-models/dist/types.js";
import { AttributeReadModelService } from "../../../readmodel/dist/attributeReadModelService.js";

export function readModelServiceBuilderSQL(
  readModelDB: DrizzleReturnType,
  attributeReadModelService: AttributeReadModelService,
  tenantReadModelService: TenantReadModelService
) {
  return {
    /**
     * Fetches all active e-services from the database, validates them and returns them.
     * The e-services is considered active if it has at least one descriptor with state "Published" or "Suspended".
     *
     * @returns The array of e-services
     */
    async getActiveEServices(): Promise<EService[]> {
      const queryResult = await readModelDB
        .select({
          eservice: eserviceInReadmodelCatalog,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          interface: eserviceDescriptorInterfaceInReadmodelCatalog,
          document: eserviceDescriptorDocumentInReadmodelCatalog,
          attribute: eserviceDescriptorAttributeInReadmodelCatalog,
          rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
          riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
          riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
          templateVersionRef:
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .where(
          inArray(eserviceDescriptorInReadmodelCatalog.state, [
            descriptorState.published,
            descriptorState.suspended,
          ])
        )
        .leftJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceDescriptorInterfaceInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorInterfaceInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorDocumentInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorAttributeInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorRejectionReasonInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceRiskAnalysisAnswerInReadmodelCatalog,
          eq(
            eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
            eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
          )
        );

      const eservicesWithMetadata = aggregateEserviceArray(
        toEServiceAggregatorArray(queryResult)
      );
      return eservicesWithMetadata.map(
        (eserviceWithMetadata) => eserviceWithMetadata.data
      );
    },

    /**
     * Fetches all the attributes from the database filtering by the passed attribute ids;
     *
     * @param attributeIds - The array of attributes ids
     * @returns The array of attributes
     * */
    async getAttributes(attributeIds: AttributeId[]): Promise<Attribute[]> {
      const attributesWithMetadata =
        await attributeReadModelService.getAttributesByFilter(
          inArray(attributeInReadmodelAttribute.id, attributeIds)
        );

      return attributesWithMetadata.map(
        (attributeWithMetadata) => attributeWithMetadata.data
      );
    },

    /**
     * Fetches all the tenants from the database filtering by the passed tenant ids;
     *
     * @param tenantIds - The array of tenant ids to retrieve
     * @returns The array of tenants
     * */
    async getTenantsByIds(tenantIds: string[]): Promise<Tenant[]> {
      const tenantsWithMetadata =
        await tenantReadModelService.getTenantsByFilter(
          inArray(tenantInReadmodelTenant.id, tenantIds)
        );

      return tenantsWithMetadata.map(
        (tenantWithMetadata) => tenantWithMetadata.data
      );
    },

    /**
     * Fetches all tenants from the database
     *
     * @returns The array of all tenants
     */
    async getAllTenants(): Promise<Tenant[]> {
      const tenantsWithMetadata =
        await tenantReadModelService.getTenantsByFilter(undefined);

      return tenantsWithMetadata.map(
        (tenantWithMetadata) => tenantWithMetadata.data
      );
    },
  };
}
