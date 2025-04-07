import {
  WithMetadata,
  Tenant,
  Attribute,
  ExternalId,
  EService,
  ListResult,
  agreementState,
  AttributeId,
  TenantId,
  EServiceId,
  attributeKind,
  Agreement,
  AgreementId,
  DelegationId,
  Delegation,
  delegationKind,
  delegationState,
  TenantFeatureType,
} from "pagopa-interop-models";
import {
  aggregateTenantArray,
  AgreementReadModelService,
  AttributeReadModelService,
  CatalogReadModelService,
  DelegationReadModelService,
  TenantReadModelService,
  toTenantAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  attributeInReadmodelAttribute,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  and,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  SQL,
} from "drizzle-orm";
import { tenantApi } from "pagopa-interop-api-clients";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function readModelServiceBuilderSQL(
  readModelDB: DrizzleReturnType,
  tenantReadModelService: TenantReadModelService,
  agreementReadModelService: AgreementReadModelService,
  attributeReadModelService: AttributeReadModelService,
  catalogReadModelService: CatalogReadModelService,
  delegationReadModelService: DelegationReadModelService
) {
  return {
    async getTenants({
      name,
      features,
      offset,
      limit,
    }: {
      name: string | undefined;
      features: TenantFeatureType[];
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const subquery = await readModelDB
        .select({
          tenantId: tenantInReadmodelTenant.id,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(
          agreementInReadmodelAgreement,
          and(
            eq(
              tenantInReadmodelTenant.id,
              agreementInReadmodelAgreement.producerId
            ),
            inArray(agreementInReadmodelAgreement.state, [
              agreementState.active,
              agreementState.suspended,
            ])
          )
        )
        .innerJoin(
          tenantFeatureInReadmodelTenant,
          and(
            eq(
              tenantInReadmodelTenant.id,
              tenantFeatureInReadmodelTenant.tenantId
            ),
            inArray(tenantFeatureInReadmodelTenant.kind, features)
          )
        )
        .where(
          and(
            name ? ilike(tenantInReadmodelTenant.name, name) : undefined,
            isNotNull(tenantInReadmodelTenant.selfcareId)
          )
        )
        .orderBy(sql`LOWER(${tenantInReadmodelTenant.name})`)
        .limit(limit)
        .offset(offset);

      const queryResult = await readModelDB
        .select({
          tenant: tenantInReadmodelTenant,
          mail: tenantMailInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          declaredAttribute: tenantDeclaredAttributeInReadmodelTenant,
          verifiedAttribute: tenantVerifiedAttributeInReadmodelTenant,
          verifier: tenantVerifiedAttributeVerifierInReadmodelTenant,
          revoker: tenantVerifiedAttributeRevokerInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          // 1
          tenantMailInReadmodelTenant,
          eq(tenantInReadmodelTenant.id, tenantMailInReadmodelTenant.tenantId)
        )
        .leftJoin(
          // 2
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 3
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 4
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 5
          tenantVerifiedAttributeVerifierInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 6
          tenantVerifiedAttributeRevokerInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 7
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )
        .where(
          inArray(
            tenantInReadmodelTenant.id,
            subquery.map((row) => row.tenantId)
          )
        )
        .orderBy(sql`LOWER(${tenantInReadmodelTenant.name})`);

      return {
        results: aggregateTenantArray(toTenantAggregatorArray(queryResult)).map(
          (tenantWithMetadata) => tenantWithMetadata.data
        ),
        totalCount: subquery[0]?.totalCount || 0,
      };
    },

    async getTenantById(
      id: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return await tenantReadModelService.getTenantById(id);
    },

    async getTenantByName(
      name: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return await tenantReadModelService.getTenantByFilter(
        ilike(tenantInReadmodelTenant.name, name)
      );
    },

    async getTenantByExternalId(
      externalId: ExternalId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return await tenantReadModelService.getTenantByFilter(
        and(
          eq(tenantInReadmodelTenant.externalIdOrigin, externalId.origin),
          eq(tenantInReadmodelTenant.externalIdValue, externalId.value)
        )
      );
    },

    async getTenantBySelfcareId(
      selfcareId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return await tenantReadModelService.getTenantByFilter(
        eq(tenantInReadmodelTenant.selfcareId, selfcareId)
      );
    },

    async getAttributeByOriginAndCode({
      origin,
      code,
    }: {
      origin: string;
      code: string;
    }): Promise<Attribute | undefined> {
      const attributeWithMetadata =
        await attributeReadModelService.getAttributeByFilter(
          and(
            eq(attributeInReadmodelAttribute.origin, origin),
            eq(attributeInReadmodelAttribute.code, code)
          )
        );

      if (!attributeWithMetadata) {
        return undefined;
      }

      return attributeWithMetadata.data;
    },

    async getConsumers({
      consumerName,
      producerId,
      offset,
      limit,
    }: {
      consumerName: string | undefined;
      producerId: string;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const subquery = await readModelDB
        .select({
          tenantId: tenantInReadmodelTenant.id,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(
          agreementInReadmodelAgreement,
          and(
            eq(
              tenantInReadmodelTenant.id,
              agreementInReadmodelAgreement.producerId
            ),
            inArray(agreementInReadmodelAgreement.state, [
              agreementState.active,
              agreementState.suspended,
            ])
          )
        )
        .where(
          and(
            eq(tenantInReadmodelTenant.id, producerId),
            consumerName
              ? ilike(tenantInReadmodelTenant.name, consumerName)
              : undefined,
            isNotNull(tenantInReadmodelTenant.selfcareId)
          )
        )
        .orderBy(sql`LOWER(${tenantInReadmodelTenant.name})`)
        .limit(limit)
        .offset(offset);

      const queryResult = await readModelDB
        .select({
          tenant: tenantInReadmodelTenant,
          mail: tenantMailInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          declaredAttribute: tenantDeclaredAttributeInReadmodelTenant,
          verifiedAttribute: tenantVerifiedAttributeInReadmodelTenant,
          verifier: tenantVerifiedAttributeVerifierInReadmodelTenant,
          revoker: tenantVerifiedAttributeRevokerInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          // 1
          tenantMailInReadmodelTenant,
          eq(tenantInReadmodelTenant.id, tenantMailInReadmodelTenant.tenantId)
        )
        .leftJoin(
          // 2
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 3
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 4
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 5
          tenantVerifiedAttributeVerifierInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 6
          tenantVerifiedAttributeRevokerInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 7
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )
        .where(
          inArray(
            tenantInReadmodelTenant.id,
            subquery.map((row) => row.tenantId)
          )
        )
        .orderBy(sql`LOWER(${tenantInReadmodelTenant.name})`);

      return {
        results: aggregateTenantArray(toTenantAggregatorArray(queryResult)).map(
          (tenantWithMetadata) => tenantWithMetadata.data
        ),
        totalCount: subquery[0]?.totalCount || 0,
      };
    },

    async getProducers({
      producerName,
      offset,
      limit,
    }: {
      producerName: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const subquery = await readModelDB
        .select({
          tenantId: tenantInReadmodelTenant.id,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(
          eserviceInReadmodelCatalog,
          and(
            eq(
              tenantInReadmodelTenant.id,
              eserviceInReadmodelCatalog.producerId
            )
          )
        )
        .where(
          and(
            producerName
              ? ilike(tenantInReadmodelTenant.name, producerName)
              : undefined,
            isNotNull(tenantInReadmodelTenant.selfcareId)
          )
        )
        .orderBy(sql`LOWER(${tenantInReadmodelTenant.name})`)
        .limit(limit)
        .offset(offset);

      const queryResult = await readModelDB
        .select({
          tenant: tenantInReadmodelTenant,
          mail: tenantMailInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          declaredAttribute: tenantDeclaredAttributeInReadmodelTenant,
          verifiedAttribute: tenantVerifiedAttributeInReadmodelTenant,
          verifier: tenantVerifiedAttributeVerifierInReadmodelTenant,
          revoker: tenantVerifiedAttributeRevokerInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          // 1
          tenantMailInReadmodelTenant,
          eq(tenantInReadmodelTenant.id, tenantMailInReadmodelTenant.tenantId)
        )
        .leftJoin(
          // 2
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 3
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 4
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 5
          tenantVerifiedAttributeVerifierInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 6
          tenantVerifiedAttributeRevokerInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 7
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )
        .where(
          inArray(
            tenantInReadmodelTenant.id,
            subquery.map((row) => row.tenantId)
          )
        )
        .orderBy(sql`LOWER(${tenantInReadmodelTenant.name})`);

      return {
        results: aggregateTenantArray(toTenantAggregatorArray(queryResult)).map(
          (tenantWithMetadata) => tenantWithMetadata.data
        ),
        totalCount: subquery[0]?.totalCount || 0,
      };
    },

    async getAttributesByExternalIds(
      externalIds: ExternalId[]
    ): Promise<Attribute[]> {
      const filter = or(
        ...externalIds.map((externalId) =>
          and(
            eq(attributeInReadmodelAttribute.origin, externalId.origin),
            eq(attributeInReadmodelAttribute.code, externalId.value)
          )
        )
      );

      const attributesWithMetadata =
        await attributeReadModelService.getAttributesByFilter(filter);

      return attributesWithMetadata.map((attr) => attr.data);
    },

    async getAttributesById(attributeIds: AttributeId[]): Promise<Attribute[]> {
      const attributesWithMetadata =
        await attributeReadModelService.getAttributesByFilter(
          inArray(attributeInReadmodelAttribute.id, attributeIds)
        );

      return attributesWithMetadata.map((attr) => attr.data);
    },

    async getAttributeById(
      attributeId: AttributeId
    ): Promise<Attribute | undefined> {
      const attributeWithMetadata =
        await attributeReadModelService.getAttributeById(attributeId);

      if (!attributeWithMetadata) {
        return undefined;
      }
      return attributeWithMetadata.data;
    },

    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      const eserviceWithMetadata =
        await catalogReadModelService.getEServiceById(id);

      return eserviceWithMetadata?.data;
    },

    async getAgreementById(
      agreementId: AgreementId
    ): Promise<Agreement | undefined> {
      const agreementWithMetadata =
        await agreementReadModelService.getAgreementById(agreementId);

      return agreementWithMetadata?.data;
    },

    async getCertifiedAttributes({
      certifierId,
      offset,
      limit,
    }: {
      certifierId: string;
      offset: number;
      limit: number;
    }): Promise<ListResult<tenantApi.CertifiedAttribute>> {
      const res = await readModelDB
        .selectDistinct({
          id: tenantInReadmodelTenant.id,
          name: tenantInReadmodelTenant.name,
          nameLowerCase: sql`LOWER(${tenantInReadmodelTenant.name})`,
          attributeId: tenantCertifiedAttributeInReadmodelTenant.attributeId,
          attributeName: attributeInReadmodelAttribute.name,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
        })
        .from(tenantCertifiedAttributeInReadmodelTenant)
        .innerJoin(
          attributeInReadmodelAttribute,
          and(
            eq(
              tenantCertifiedAttributeInReadmodelTenant.attributeId,
              attributeInReadmodelAttribute.id
            ),
            eq(attributeInReadmodelAttribute.origin, certifierId),
            isNull(
              tenantCertifiedAttributeInReadmodelTenant.revocationTimestamp
            )
          )
        )
        .innerJoin(
          tenantInReadmodelTenant,
          eq(
            tenantCertifiedAttributeInReadmodelTenant.tenantId,
            tenantInReadmodelTenant.id
          )
        )
        .orderBy(
          sql`LOWER(${tenantInReadmodelTenant.name})`,
          attributeInReadmodelAttribute.name
        )
        .limit(limit)
        .offset(offset);

      return {
        results: res.map((row) => ({
          id: row.id,
          name: row.name,
          attributeId: row.attributeId,
          attributeName: row.attributeName,
        })),
        totalCount: res[0]?.totalCount || 0,
      };
    },

    async getOneCertifiedAttributeByCertifier({
      certifierId,
    }: {
      certifierId: string;
    }): Promise<Attribute | undefined> {
      const attributesWithMetadata =
        await attributeReadModelService.getAttributesByFilter(
          and(
            eq(attributeInReadmodelAttribute.kind, attributeKind.certified),
            eq(attributeInReadmodelAttribute.origin, certifierId)
          )
        );
      if (attributesWithMetadata.length === 0) {
        return undefined;
      }

      return attributesWithMetadata[0].data;
    },
    async getActiveProducerDelegationByEservice(
      eserviceId: EServiceId
    ): Promise<Delegation | undefined> {
      const delegationWithMetadata =
        await delegationReadModelService.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedProducer
            )
          ) as SQL
        );

      return delegationWithMetadata?.data;
    },
    async getActiveConsumerDelegation(
      delegationId: DelegationId
    ): Promise<Delegation | undefined> {
      const delegationWithMetadata =
        await delegationReadModelService.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.id, delegationId),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            )
          ) as SQL
        );

      return delegationWithMetadata?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
