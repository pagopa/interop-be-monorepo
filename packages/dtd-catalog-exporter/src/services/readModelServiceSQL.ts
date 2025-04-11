/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  AttributeId,
  EService,
  Tenant,
  Attribute,
  descriptorState,
} from "pagopa-interop-models";
import { exists, inArray } from "drizzle-orm";
import {
  attributeInReadmodelAttribute,
  eserviceDescriptorInReadmodelCatalog,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  CatalogReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import { DrizzleReturnType } from "../../../readmodel-models/dist/types.js";
import { AttributeReadModelService } from "../../../readmodel/dist/attributeReadModelService.js";

export function readModelServiceBuilderSQL(
  readModelDB: DrizzleReturnType,
  attributeReadModelService: AttributeReadModelService,
  tenantReadModelService: TenantReadModelService,
  catalogReadModelService: CatalogReadModelService
) {
  return {
    /**
     * Fetches all active e-services from the database, validates them and returns them.
     * The e-services is considered active if it has at least one descriptor with state "Published" or "Suspended".
     *
     * @returns The array of e-services
     */
    async getActiveEServices(): Promise<EService[]> {
      const eservicesWithMetadata =
        await catalogReadModelService.getEServicesByFilter(
          exists(
            readModelDB
              .select()
              .from(eserviceDescriptorInReadmodelCatalog)
              .where(
                inArray(eserviceDescriptorInReadmodelCatalog.state, [
                  descriptorState.published,
                  descriptorState.suspended,
                ])
              )
          )
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
