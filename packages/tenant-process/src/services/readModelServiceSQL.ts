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
} from "drizzle-orm";
import { tenantApi } from "pagopa-interop-api-clients";
import { ascLower, createListResult } from "pagopa-interop-commons";

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
      const subquery = readModelDB
        .selectDistinct({
          tenantId: tenantInReadmodelTenant.id,
          nameLowerCase: ascLower(tenantInReadmodelTenant.name),
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          tenantFeatureInReadmodelTenant,
          and(
            eq(
              tenantInReadmodelTenant.id,
              tenantFeatureInReadmodelTenant.tenantId
            )
          )
        )
        .where(
          and(
            features.length > 0
              ? inArray(tenantFeatureInReadmodelTenant.kind, features)
              : undefined,
            name ? ilike(tenantInReadmodelTenant.name, `%${name}%`) : undefined,
            isNotNull(tenantInReadmodelTenant.selfcareId)
          )
        )
        .orderBy(ascLower(tenantInReadmodelTenant.name))
        .limit(limit)
        .offset(offset)
        .as("subquery");

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
          totalCount: subquery.totalCount,
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(subquery, eq(tenantInReadmodelTenant.id, subquery.tenantId))
        .leftJoin(
          tenantMailInReadmodelTenant,
          eq(tenantInReadmodelTenant.id, tenantMailInReadmodelTenant.tenantId)
        )
        .leftJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeVerifierInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeRevokerInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )
        .orderBy(ascLower(tenantInReadmodelTenant.name));

      const tenants = aggregateTenantArray(
        toTenantAggregatorArray(queryResult)
      );
      return createListResult(
        tenants.map((tenantWithMetadata) => tenantWithMetadata.data),
        queryResult[0]?.totalCount
      );
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
      const subquery = readModelDB
        .selectDistinct({
          tenantId: tenantInReadmodelTenant.id,
          nameLowerCase: ascLower(tenantInReadmodelTenant.name),
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(
          agreementInReadmodelAgreement,
          and(
            eq(
              tenantInReadmodelTenant.id,
              agreementInReadmodelAgreement.consumerId
            ),
            eq(agreementInReadmodelAgreement.producerId, producerId),
            inArray(agreementInReadmodelAgreement.state, [
              agreementState.active,
              agreementState.suspended,
            ])
          )
        )
        .where(
          and(
            consumerName
              ? ilike(tenantInReadmodelTenant.name, consumerName)
              : undefined,
            isNotNull(tenantInReadmodelTenant.selfcareId)
          )
        )
        .orderBy(ascLower(tenantInReadmodelTenant.name))
        .limit(limit)
        .offset(offset)
        .as("subquery");

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
          totalCount: subquery.totalCount,
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(subquery, eq(tenantInReadmodelTenant.id, subquery.tenantId))
        .leftJoin(
          tenantMailInReadmodelTenant,
          eq(tenantInReadmodelTenant.id, tenantMailInReadmodelTenant.tenantId)
        )
        .leftJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeVerifierInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeRevokerInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )
        .orderBy(ascLower(tenantInReadmodelTenant.name));

      const tenants = aggregateTenantArray(
        toTenantAggregatorArray(queryResult)
      );
      return createListResult(
        tenants.map((tenantWithMetadata) => tenantWithMetadata.data),
        queryResult[0]?.totalCount
      );
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
      const subquery = readModelDB
        .selectDistinct({
          tenantId: tenantInReadmodelTenant.id,
          nameLowerCase: ascLower(tenantInReadmodelTenant.name),
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
        .orderBy(ascLower(tenantInReadmodelTenant.name))
        .limit(limit)
        .offset(offset)
        .as("subquery");

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
          totalCount: subquery.totalCount,
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(subquery, eq(tenantInReadmodelTenant.id, subquery.tenantId))
        .leftJoin(
          tenantMailInReadmodelTenant,
          eq(tenantInReadmodelTenant.id, tenantMailInReadmodelTenant.tenantId)
        )
        .leftJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeVerifierInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeRevokerInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )

        .orderBy(ascLower(tenantInReadmodelTenant.name));

      const tenants = aggregateTenantArray(
        toTenantAggregatorArray(queryResult)
      );
      return createListResult(
        tenants.map((tenantWithMetadata) => tenantWithMetadata.data),
        queryResult[0]?.totalCount
      );
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
          nameLowerCase: ascLower(tenantInReadmodelTenant.name),
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
          ascLower(tenantInReadmodelTenant.name),
          attributeInReadmodelAttribute.name
        )
        .limit(limit)
        .offset(offset);

      return createListResult(
        res.map((row) => ({
          id: row.id,
          name: row.name,
          attributeId: row.attributeId,
          attributeName: row.attributeName,
        })),
        res[0]?.totalCount
      );
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
          )
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
          )
        );

      return delegationWithMetadata?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
