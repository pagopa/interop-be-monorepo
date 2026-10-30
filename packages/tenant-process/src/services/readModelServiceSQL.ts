import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  ascLower,
  createListResult,
  escapeSqlLike,
  ilikeEscaped,
  lowerCase,
  withTotalCount,
} from "pagopa-interop-commons";
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
  unsafeBrandId,
  TenantVerifier,
  TenantRevoker,
  TenantUnitType,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  AttributeReadModelService,
  CatalogReadModelService,
  DelegationReadModelService,
  TenantReadModelService,
  aggregateTenantHierarchy,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  attributeInReadmodelAttribute,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantCertifiedDiscreteAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantRemoteIdInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

import {
  ApiGetTenantsFilters,
  TenantWithHierarchy,
} from "../model/domain/models.js";
import {
  addTenantHierarchy,
  tenantHierarchySelection,
  getHierarchyByTenantId,
  parentTenantTable,
  rootTenantTable,
} from "./tenantHierarchySQL.js";

const certifiedAttributeKind: {
  standard: tenantApi.CertifiedAttributeKind;
  discrete: tenantApi.CertifiedAttributeKind;
} = {
  standard: "CERTIFIED",
  discrete: "CERTIFIED_DISCRETE",
};

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
      externalIdOrigin,
      externalIdValue,
      offset,
      limit,
    }: ApiGetTenantsFilters): Promise<ListResult<TenantWithHierarchy>> {
      return await readModelDB.transaction(async (tx) => {
        const queryResult = await tx
          .selectDistinct({
            ...withTotalCount({
              tenantId: tenantInReadmodelTenant.id,
              nameLowerCase: lowerCase(tenantInReadmodelTenant.name),
            }),
            ...tenantHierarchySelection,
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
          .leftJoin(
            parentTenantTable,
            eq(tenantInReadmodelTenant.parentTenantId, parentTenantTable.id)
          )
          .leftJoin(
            rootTenantTable,
            eq(tenantInReadmodelTenant.rootTenantId, rootTenantTable.id)
          )
          .where(
            and(
              features.length > 0
                ? inArray(tenantFeatureInReadmodelTenant.kind, features)
                : undefined,
              name
                ? or(
                    ilikeEscaped(
                      tenantInReadmodelTenant.name,
                      `%${escapeSqlLike(name)}%`
                    ),
                    ilikeEscaped(
                      parentTenantTable.name,
                      `%${escapeSqlLike(name)}%`
                    ),
                    ilikeEscaped(
                      rootTenantTable.name,
                      `%${escapeSqlLike(name)}%`
                    )
                  )
                : undefined,
              externalIdOrigin
                ? eq(tenantInReadmodelTenant.externalIdOrigin, externalIdOrigin)
                : undefined,
              externalIdValue
                ? eq(tenantInReadmodelTenant.externalIdValue, externalIdValue)
                : undefined,
              isNotNull(tenantInReadmodelTenant.selfcareId)
            )
          )
          .orderBy(ascLower(tenantInReadmodelTenant.name))
          .limit(limit)
          .offset(offset);

        const tenantIds = queryResult.map((item) => item.tenantId);
        const tenants = await tenantReadModelService.getTenantsByIds(
          tenantIds,
          tx
        );
        const hierarchyById = getHierarchyByTenantId(queryResult);
        return createListResult(
          tenants.map(({ data }) => ({
            ...data,
            parentTenant: hierarchyById.get(data.id),
          })),
          queryResult[0]?.totalCount
        );
      });
    },
    async getTenantById(
      id: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return await tenantReadModelService.getTenantById(id);
    },

    async getTenantByIdWithHierarchy(
      id: TenantId
    ): Promise<WithMetadata<TenantWithHierarchy> | undefined> {
      const result = await tenantReadModelService.getTenantById(id);
      return result
        ? {
            ...result,
            data: (await addTenantHierarchy(readModelDB, [result.data]))[0],
          }
        : undefined;
    },

    async getTenantByName(
      name: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      const tenantSQL = await readModelDB
        .select()
        .from(tenantInReadmodelTenant)
        .where(ilikeEscaped(tenantInReadmodelTenant.name, escapeSqlLike(name)));

      if (tenantSQL.length === 0) {
        return undefined;
      }
      return await tenantReadModelService.getTenantById(
        unsafeBrandId(tenantSQL[0].id)
      );
    },

    async getTenantByExternalId(
      externalId: ExternalId
    ): Promise<WithMetadata<Tenant> | undefined> {
      const tenantSQL = await readModelDB
        .select()
        .from(tenantInReadmodelTenant)
        .where(
          and(
            eq(tenantInReadmodelTenant.externalIdOrigin, externalId.origin),
            eq(tenantInReadmodelTenant.externalIdValue, externalId.value)
          )
        );

      if (tenantSQL.length === 0) {
        return undefined;
      }
      return await tenantReadModelService.getTenantById(
        unsafeBrandId(tenantSQL[0].id)
      );
    },

    async getTenantByRemoteId(remoteId: {
      origin: string;
      value: string;
    }): Promise<WithMetadata<Tenant> | undefined> {
      const tenantSQL = await readModelDB
        .select()
        .from(tenantRemoteIdInReadmodelTenant)
        .where(
          and(
            eq(tenantRemoteIdInReadmodelTenant.origin, remoteId.origin),
            eq(tenantRemoteIdInReadmodelTenant.value, remoteId.value)
          )
        );

      if (tenantSQL.length === 0) {
        return undefined;
      }
      return await tenantReadModelService.getTenantById(
        unsafeBrandId(tenantSQL[0].tenantId)
      );
    },

    async getTenantBySelfcareId(
      selfcareId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      const tenantSQL = await readModelDB
        .select()
        .from(tenantInReadmodelTenant)
        .where(eq(tenantInReadmodelTenant.selfcareId, selfcareId));

      if (tenantSQL.length === 0) {
        return undefined;
      }
      return await tenantReadModelService.getTenantById(
        unsafeBrandId(tenantSQL[0].id)
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
    }): Promise<ListResult<TenantWithHierarchy>> {
      return await readModelDB.transaction(async (tx) => {
        const queryResult = await tx
          .select({
            ...withTotalCount({
              tenantId: tenantInReadmodelTenant.id,
            }),
            ...tenantHierarchySelection,
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
          .leftJoin(
            parentTenantTable,
            eq(tenantInReadmodelTenant.parentTenantId, parentTenantTable.id)
          )
          .leftJoin(
            rootTenantTable,
            eq(tenantInReadmodelTenant.rootTenantId, rootTenantTable.id)
          )
          .where(
            and(
              consumerName
                ? or(
                    ilikeEscaped(
                      tenantInReadmodelTenant.name,
                      `%${escapeSqlLike(consumerName)}%`
                    ),
                    ilikeEscaped(
                      parentTenantTable.name,
                      `%${escapeSqlLike(consumerName)}%`
                    ),
                    ilikeEscaped(
                      rootTenantTable.name,
                      `%${escapeSqlLike(consumerName)}%`
                    )
                  )
                : undefined,
              isNotNull(tenantInReadmodelTenant.selfcareId)
            )
          )
          .groupBy(
            tenantInReadmodelTenant.id,
            parentTenantTable.id,
            parentTenantTable.name,
            parentTenantTable.subUnitType,
            rootTenantTable.id,
            rootTenantTable.name
          )
          .orderBy(ascLower(tenantInReadmodelTenant.name))
          .limit(limit)
          .offset(offset);

        const tenantIds = queryResult.map((item) => item.tenantId);
        const tenants = await tenantReadModelService.getTenantsByIds(
          tenantIds,
          tx
        );
        const hierarchyById = getHierarchyByTenantId(queryResult);
        return createListResult(
          tenants.map(({ data }) => ({
            ...data,
            parentTenant: hierarchyById.get(data.id),
          })),
          queryResult[0]?.totalCount
        );
      });
    },

    async getProducers({
      producerName,
      offset,
      limit,
    }: {
      producerName: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<TenantWithHierarchy>> {
      return await readModelDB.transaction(async (tx) => {
        const queryResult = await tx
          .select({
            ...withTotalCount({
              tenantId: tenantInReadmodelTenant.id,
            }),
            ...tenantHierarchySelection,
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
          .leftJoin(
            parentTenantTable,
            eq(tenantInReadmodelTenant.parentTenantId, parentTenantTable.id)
          )
          .leftJoin(
            rootTenantTable,
            eq(tenantInReadmodelTenant.rootTenantId, rootTenantTable.id)
          )
          .where(
            and(
              producerName
                ? or(
                    ilikeEscaped(
                      tenantInReadmodelTenant.name,
                      `%${escapeSqlLike(producerName)}%`
                    ),
                    ilikeEscaped(
                      parentTenantTable.name,
                      `%${escapeSqlLike(producerName)}%`
                    ),
                    ilikeEscaped(
                      rootTenantTable.name,
                      `%${escapeSqlLike(producerName)}%`
                    )
                  )
                : undefined,
              isNotNull(tenantInReadmodelTenant.selfcareId)
            )
          )
          .groupBy(
            tenantInReadmodelTenant.id,
            parentTenantTable.id,
            parentTenantTable.name,
            parentTenantTable.subUnitType,
            rootTenantTable.id,
            rootTenantTable.name
          )
          .orderBy(ascLower(tenantInReadmodelTenant.name))
          .limit(limit)
          .offset(offset);

        const tenantIds = queryResult.map((item) => item.tenantId);
        const tenants = await tenantReadModelService.getTenantsByIds(
          tenantIds,
          tx
        );
        const hierarchyById = getHierarchyByTenantId(queryResult);
        return createListResult(
          tenants.map(({ data }) => ({
            ...data,
            parentTenant: hierarchyById.get(data.id),
          })),
          queryResult[0]?.totalCount
        );
      });
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

    async getCertifiedAttributesByCertifier({
      certifierId,
      offset,
      limit,
    }: {
      certifierId: string;
      offset: number;
      limit: number;
    }): Promise<ListResult<tenantApi.CertifiedAttribute>> {
      const res = await readModelDB
        .select(
          withTotalCount({
            id: tenantInReadmodelTenant.id,
            name: tenantInReadmodelTenant.name,
            subUnitType: tenantInReadmodelTenant.subUnitType,
            parentTenantId: tenantInReadmodelTenant.parentTenantId,
            parentTenantName: parentTenantTable.name,
            parentTenantSubUnitType: parentTenantTable.subUnitType,
            rootTenantId: tenantInReadmodelTenant.rootTenantId,
            rootTenantName: rootTenantTable.name,
            attributeId: attributeInReadmodelAttribute.id,
            attributeName: attributeInReadmodelAttribute.name,
            kind: sql<tenantApi.CertifiedAttributeKind>`CASE
              WHEN ${attributeInReadmodelAttribute.kind} = ${attributeKind.certified}
                THEN ${certifiedAttributeKind.standard}
              ELSE ${certifiedAttributeKind.discrete}
            END`.as("kind"),
            discreteValue:
              tenantCertifiedDiscreteAttributeInReadmodelTenant.discreteValue,
          })
        )
        .from(attributeInReadmodelAttribute)
        .leftJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          and(
            eq(
              tenantCertifiedAttributeInReadmodelTenant.attributeId,
              attributeInReadmodelAttribute.id
            ),
            eq(attributeInReadmodelAttribute.kind, attributeKind.certified),
            isNull(
              tenantCertifiedAttributeInReadmodelTenant.revocationTimestamp
            )
          )
        )
        .leftJoin(
          tenantCertifiedDiscreteAttributeInReadmodelTenant,
          and(
            eq(
              tenantCertifiedDiscreteAttributeInReadmodelTenant.attributeId,
              attributeInReadmodelAttribute.id
            ),
            eq(
              attributeInReadmodelAttribute.kind,
              attributeKind.certifiedDiscrete
            ),
            isNull(
              tenantCertifiedDiscreteAttributeInReadmodelTenant.revocationTimestamp
            )
          )
        )
        .innerJoin(
          tenantInReadmodelTenant,
          or(
            eq(
              tenantInReadmodelTenant.id,
              tenantCertifiedAttributeInReadmodelTenant.tenantId
            ),
            eq(
              tenantInReadmodelTenant.id,
              tenantCertifiedDiscreteAttributeInReadmodelTenant.tenantId
            )
          )
        )
        .leftJoin(
          parentTenantTable,
          eq(tenantInReadmodelTenant.parentTenantId, parentTenantTable.id)
        )
        .leftJoin(
          rootTenantTable,
          eq(tenantInReadmodelTenant.rootTenantId, rootTenantTable.id)
        )
        .where(
          and(
            eq(attributeInReadmodelAttribute.origin, certifierId),
            inArray(attributeInReadmodelAttribute.kind, [
              attributeKind.certified,
              attributeKind.certifiedDiscrete,
            ])
          )
        )
        .orderBy(
          ascLower(tenantInReadmodelTenant.name),
          asc(attributeInReadmodelAttribute.name)
        )
        .limit(limit)
        .offset(offset);

      return createListResult(
        res.map((row) => ({
          id: row.id,
          name: row.name,
          subUnitType: row.subUnitType
            ? TenantUnitType.parse(row.subUnitType)
            : undefined,
          parentTenant: aggregateTenantHierarchy(row),
          attributeId: row.attributeId,
          attributeName: row.attributeName,
          kind: row.kind,
          discreteValue: row.discreteValue ?? undefined,
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
    async getTenantVerifiedAttributeVerifiers(
      tenantId: TenantId,
      attributeId: AttributeId,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<TenantVerifier>> {
      const queryResult = await readModelDB
        .select(
          withTotalCount({
            verifierId:
              tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifierId,
            verificationDate:
              tenantVerifiedAttributeVerifierInReadmodelTenant.verificationDate,
            expirationDate:
              tenantVerifiedAttributeVerifierInReadmodelTenant.expirationDate,
            extensionDate:
              tenantVerifiedAttributeVerifierInReadmodelTenant.extensionDate,
            delegationId:
              tenantVerifiedAttributeVerifierInReadmodelTenant.delegationId,
          })
        )
        .from(tenantVerifiedAttributeVerifierInReadmodelTenant)
        .where(
          and(
            eq(
              tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId,
              tenantId
            ),
            eq(
              tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId,
              attributeId
            )
          )
        )
        .orderBy(
          asc(tenantVerifiedAttributeVerifierInReadmodelTenant.verificationDate)
        )
        .offset(offset)
        .limit(limit);

      return createListResult(
        queryResult.map((result) => ({
          id: unsafeBrandId<TenantId>(result.verifierId),
          verificationDate: new Date(result.verificationDate),
          expirationDate: result.expirationDate
            ? new Date(result.expirationDate)
            : undefined,
          extensionDate: result.extensionDate
            ? new Date(result.extensionDate)
            : undefined,
          delegationId: result.delegationId
            ? unsafeBrandId<DelegationId>(result.delegationId)
            : undefined,
        })),
        queryResult.length > 0 ? queryResult[0].totalCount : 0
      );
    },
    async getTenantVerifiedAttributeRevokers(
      tenantId: TenantId,
      attributeId: AttributeId,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<TenantRevoker>> {
      const queryResult = await readModelDB
        .select(
          withTotalCount({
            revokerId:
              tenantVerifiedAttributeRevokerInReadmodelTenant.tenantRevokerId,
            verificationDate:
              tenantVerifiedAttributeRevokerInReadmodelTenant.verificationDate,
            expirationDate:
              tenantVerifiedAttributeRevokerInReadmodelTenant.expirationDate,
            extensionDate:
              tenantVerifiedAttributeRevokerInReadmodelTenant.extensionDate,
            revocationDate:
              tenantVerifiedAttributeRevokerInReadmodelTenant.revocationDate,
            delegationId:
              tenantVerifiedAttributeRevokerInReadmodelTenant.delegationId,
          })
        )
        .from(tenantVerifiedAttributeRevokerInReadmodelTenant)
        .where(
          and(
            eq(
              tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId,
              tenantId
            ),
            eq(
              tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId,
              attributeId
            )
          )
        )
        .orderBy(
          asc(tenantVerifiedAttributeRevokerInReadmodelTenant.revocationDate)
        )
        .offset(offset)
        .limit(limit);

      return createListResult(
        queryResult.map((result) => ({
          id: unsafeBrandId<TenantId>(result.revokerId),
          verificationDate: new Date(result.verificationDate),
          expirationDate: result.expirationDate
            ? new Date(result.expirationDate)
            : undefined,
          extensionDate: result.extensionDate
            ? new Date(result.extensionDate)
            : undefined,
          revocationDate: new Date(result.revocationDate),
          delegationId: result.delegationId
            ? unsafeBrandId<DelegationId>(result.delegationId)
            : undefined,
        })),
        queryResult.length > 0 ? queryResult[0].totalCount : 0
      );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
