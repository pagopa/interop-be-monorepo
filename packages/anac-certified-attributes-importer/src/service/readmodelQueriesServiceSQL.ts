import {
  Attribute,
  genericInternalError,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  TenantId,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  aggregateTenantArray,
  AttributeReadModelService,
  TenantReadModelService,
  toTenantAggregatorArray,
} from "pagopa-interop-readmodel";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { AnacReadModelTenant } from "../model/tenant.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelQueriesBuilderSQL(
  readModelDB: DrizzleReturnType,
  tenantReadModelService: TenantReadModelService,
  attributeReadModelService: AttributeReadModelService
) {
  return {
    /**
     * Retrieve all PA tenants that matches the given IPA codes, with their unrevoked certified attribute
     */
    async getPATenants(ipaCodes: string[]): Promise<AnacReadModelTenant[]> {
      const queryResult = await readModelDB
        .select({
          tenant: tenantInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          and(
            eq(
              tenantInReadmodelTenant.id,
              tenantCertifiedAttributeInReadmodelTenant.tenantId
            ),
            isNull(
              tenantCertifiedAttributeInReadmodelTenant.revocationTimestamp
            )
          )
        )
        .leftJoin(
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )
        .where(
          and(
            eq(
              tenantInReadmodelTenant.externalIdOrigin,
              PUBLIC_ADMINISTRATIONS_IDENTIFIER
            ),
            inArray(tenantInReadmodelTenant.externalIdValue, ipaCodes)
          )
        );

      const tenants = aggregateTenantArray(
        toTenantAggregatorArray(
          queryResult.map((entry) => ({
            ...entry,
            mail: null,
            declaredAttribute: null,
            verifiedAttribute: null,
            verifier: null,
            revoker: null,
          }))
        )
      );

      return tenants.map(tenantToAnacTenant);
    },

    /**
     * Retrieve all non-PA tenants that matches the given tax codes, with their unrevoked certified attribute
     */
    async getNonPATenants(taxCodes: string[]): Promise<AnacReadModelTenant[]> {
      const queryResult = await readModelDB
        .select({
          tenant: tenantInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          and(
            eq(
              tenantInReadmodelTenant.id,
              tenantCertifiedAttributeInReadmodelTenant.tenantId
            ),
            isNull(
              tenantCertifiedAttributeInReadmodelTenant.revocationTimestamp
            )
          )
        )
        .leftJoin(
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )
        .where(
          and(
            ne(
              tenantInReadmodelTenant.externalIdOrigin,
              PUBLIC_ADMINISTRATIONS_IDENTIFIER
            ),
            inArray(tenantInReadmodelTenant.externalIdValue, taxCodes)
          )
        );

      const tenants = aggregateTenantArray(
        toTenantAggregatorArray(
          // eslint-disable-next-line sonarjs/no-identical-functions
          queryResult.map((entry) => ({
            ...entry,
            mail: null,
            declaredAttribute: null,
            verifiedAttribute: null,
            verifier: null,
            revoker: null,
          }))
        )
      );

      return tenants.map(tenantToAnacTenant);
    },

    async getTenantById(tenantId: string): Promise<AnacReadModelTenant> {
      const tenantWithMetadata = await tenantReadModelService.getTenantById(
        unsafeBrandId<TenantId>(tenantId)
      );

      if (tenantWithMetadata === undefined) {
        throw genericInternalError(`Tenant with id ${tenantId} not found`);
      }

      return tenantWithMetadata.data;
    },

    async getTenantByIdWithMetadata(tenantId: string) {
      return tenantReadModelService.getTenantById(unsafeBrandId<TenantId>(
        tenantId
      ));
    },

    async getAttributeByExternalId(
      origin: string,
      code: string
    ): Promise<Attribute> {
      const attributeWithMetadata =
        await attributeReadModelService.getAttributeByFilter(
          and(
            eq(attributeInReadmodelAttribute.origin, origin),
            eq(attributeInReadmodelAttribute.code, code)
          )
        );

      if (attributeWithMetadata === undefined) {
        throw genericInternalError(
          `Attribute with origin ${origin} and code ${code} not found`
        );
      }

      return attributeWithMetadata.data;
    },

    async getTenantsWithAttributes(
      attributeIds: string[]
    ): Promise<AnacReadModelTenant[]> {
      const queryResult = await readModelDB
        .select({
          tenant: tenantInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          and(
            eq(
              tenantInReadmodelTenant.id,
              tenantCertifiedAttributeInReadmodelTenant.tenantId
            ),
            isNull(
              tenantCertifiedAttributeInReadmodelTenant.revocationTimestamp
            )
          )
        )
        .leftJoin(
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )
        .where(
          inArray(
            tenantCertifiedAttributeInReadmodelTenant.attributeId,
            attributeIds
          )
        );

      const tenants = aggregateTenantArray(
        toTenantAggregatorArray(
          // eslint-disable-next-line sonarjs/no-identical-functions
          queryResult.map((entry) => ({
            ...entry,
            mail: null,
            declaredAttribute: null,
            verifiedAttribute: null,
            verifier: null,
            revoker: null,
          }))
        )
      );

      return tenants.map(tenantToAnacTenant);
    },
  };
}

const tenantToAnacTenant = (
  tenant: WithMetadata<Tenant>
): AnacReadModelTenant => ({
  id: tenant.data.id,
  externalId: tenant.data.externalId,
  features: tenant.data.features,
  attributes: tenant.data.attributes,
});

export type ReadModelQueriesSQL = ReturnType<typeof readModelQueriesBuilderSQL>;
