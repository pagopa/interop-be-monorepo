/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  genericInternalError,
  AttributeId,
  EService,
  Tenant,
  Attribute,
} from "pagopa-interop-models";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import {
  attributeInReadmodelAttribute,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { TenantReadModelService } from "pagopa-interop-readmodel";
import { DrizzleReturnType } from "../../../readmodel-models/dist/types.js";
import { AttributeReadModelService } from "../../../readmodel/dist/attributeReadModelService.js";

export function readModelServiceBuilder(
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
      const data = await eservices
        .find({ "data.descriptors.state": { $in: ["Published", "Suspended"] } })
        .map(({ data }) => data)
        .toArray();

      const result = z.array(EService).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse eservices items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
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
