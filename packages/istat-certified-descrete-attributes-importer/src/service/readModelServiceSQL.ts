import {
  genericInternalError,
  Tenant,
  TenantId,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  AttributeReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import { and, eq, isNull } from "drizzle-orm";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantRemoteIdInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { IvassReadModelTenant } from "../model/tenant.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelQueriesBuilderSQL(
  readModelDB: DrizzleReturnType,
  tenantReadModelService: TenantReadModelService,
  attributeReadModelService: AttributeReadModelService
) {
  return {
    async getAttributeByExternalId(origin: string, code: string) {
      return await attributeReadModelService.getAttributeByFilter(
        and(
          eq(attributeInReadmodelAttribute.origin, origin),
          eq(attributeInReadmodelAttribute.code, code)
        )
      );
    },

    async getTenantById(tenantId: string): Promise<IvassReadModelTenant> {
      const tenantWithMetadata = await tenantReadModelService.getTenantById(
        unsafeBrandId<TenantId>(tenantId)
      );

      if (tenantWithMetadata === undefined) {
        throw genericInternalError(`Tenant with id ${tenantId} not found`);
      }

      return tenantWithMetadata.data;
    },

    async getTenantByRemoteId({
      origin,
      value,
    }: {
      origin: string;
      value: string;
    }): Promise<WithMetadata<Tenant> | undefined> {
      const tenantSQL = await readModelDB
        .select({ id: tenantRemoteIdInReadmodelTenant.tenantId })
        .from(tenantRemoteIdInReadmodelTenant)
        .where(
          and(
            eq(tenantRemoteIdInReadmodelTenant.origin, origin),
            eq(tenantRemoteIdInReadmodelTenant.value, value)
          )
        )
        .limit(1);

      if (tenantSQL.length === 0) {
        return undefined;
      }
      return await tenantReadModelService.getTenantById(
        unsafeBrandId(tenantSQL[0].id)
      );
    },

    async getTenantsWithDiscreteAttribute(
      certifierId: string,
      attributeCode: string
    ) {
      const tenantSQL = await readModelDB
        .selectDistinct({ id: tenantInReadmodelTenant.id })
        .from(tenantInReadmodelTenant)
        .innerJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .innerJoin(
          attributeInReadmodelAttribute,
          and(
            eq(
              tenantCertifiedAttributeInReadmodelTenant.attributeId,
              attributeInReadmodelAttribute.id
            ),
            eq(attributeInReadmodelAttribute.origin, certifierId),
            eq(attributeInReadmodelAttribute.code, attributeCode),
            isNull(
              tenantCertifiedAttributeInReadmodelTenant.revocationTimestamp
            )
          )
        );

      if (tenantSQL.length === 0) {
        return [];
      }

      const tenantIds = tenantSQL.map((row) => unsafeBrandId(row.id));

      return await readModelDB.transaction(
        async (tx) =>
          await tenantReadModelService.getTenantsByIds(tenantIds, tx)
      );
    },

    async getTenantByIdWithMetadata(
      tenantId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return tenantReadModelService.getTenantById(
        unsafeBrandId<TenantId>(tenantId)
      );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelQueriesBuilderSQL>;
