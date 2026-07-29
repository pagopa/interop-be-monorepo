import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  or,
} from "drizzle-orm";
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
  DeclaredTenantAttribute,
  CertifiedTenantAttribute,
  VerifiedTenantAttribute,
  tenantAttributeType,
  stringToDate,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  AttributeReadModelService,
  CatalogReadModelService,
  DelegationReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  attributeInReadmodelAttribute,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantRemoteIdInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

import { ApiGetTenantsFilters } from "../model/domain/models.js";

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
    async getTenantDeclaredAttributes(
      tenantId: TenantId,
      {
        delegationId,
        offset,
        limit,
      }: { delegationId?: DelegationId; offset: number; limit: number }
    ): Promise<ListResult<DeclaredTenantAttribute>> {
      const rows = await readModelDB
        .select(
          withTotalCount(
            getTableColumns(tenantDeclaredAttributeInReadmodelTenant)
          )
        )
        .from(tenantDeclaredAttributeInReadmodelTenant)
        .where(
          and(
            eq(tenantDeclaredAttributeInReadmodelTenant.tenantId, tenantId),
            delegationId
              ? eq(
                  tenantDeclaredAttributeInReadmodelTenant.delegationId,
                  delegationId
                )
              : undefined
          )
        )
        .orderBy(
          asc(tenantDeclaredAttributeInReadmodelTenant.assignmentTimestamp)
        )
        .offset(offset)
        .limit(limit);

      const totalCount = rows[0]?.totalCount ?? 0;
      const results: DeclaredTenantAttribute[] = rows.map((r) => ({
        id: unsafeBrandId<AttributeId>(r.attributeId),
        type: tenantAttributeType.DECLARED,
        assignmentTimestamp: stringToDate(r.assignmentTimestamp),
        ...(r.revocationTimestamp
          ? { revocationTimestamp: stringToDate(r.revocationTimestamp) }
          : {}),
        ...(r.delegationId
          ? { delegationId: unsafeBrandId<DelegationId>(r.delegationId) }
          : {}),
      }));

      return createListResult(results, totalCount);
    },
    async getTenantCertifiedAttributes(
      tenantId: TenantId,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<CertifiedTenantAttribute>> {
      const rows = await readModelDB
        .select(
          withTotalCount(
            getTableColumns(tenantCertifiedAttributeInReadmodelTenant)
          )
        )
        .from(tenantCertifiedAttributeInReadmodelTenant)
        .where(eq(tenantCertifiedAttributeInReadmodelTenant.tenantId, tenantId))
        .orderBy(
          asc(tenantCertifiedAttributeInReadmodelTenant.assignmentTimestamp)
        )
        .offset(offset)
        .limit(limit);

      const totalCount = rows[0]?.totalCount ?? 0;
      const results: CertifiedTenantAttribute[] = rows.map((r) => ({
        id: unsafeBrandId<AttributeId>(r.attributeId),
        type: tenantAttributeType.CERTIFIED,
        assignmentTimestamp: stringToDate(r.assignmentTimestamp),
        ...(r.revocationTimestamp
          ? { revocationTimestamp: stringToDate(r.revocationTimestamp) }
          : {}),
      }));

      return createListResult(results, totalCount);
    },
    async getTenantVerifiedAttributes(
      tenantId: TenantId,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<VerifiedTenantAttribute>> {
      const attributesSQL = await readModelDB
        .select(
          withTotalCount(
            getTableColumns(tenantVerifiedAttributeInReadmodelTenant)
          )
        )
        .from(tenantVerifiedAttributeInReadmodelTenant)
        .where(eq(tenantVerifiedAttributeInReadmodelTenant.tenantId, tenantId))
        .orderBy(
          asc(tenantVerifiedAttributeInReadmodelTenant.assignmentTimestamp)
        )
        .offset(offset)
        .limit(limit);

      const totalCount = attributesSQL[0]?.totalCount ?? 0;

      if (attributesSQL.length === 0) {
        return createListResult([], totalCount);
      }

      const attributeIds = attributesSQL.map((a) => a.attributeId);
      const [verifiersSQL, revokersSQL] = await Promise.all([
        readModelDB
          .select()
          .from(tenantVerifiedAttributeVerifierInReadmodelTenant)
          .where(
            and(
              eq(
                tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId,
                tenantId
              ),
              inArray(
                tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId,
                attributeIds
              )
            )
          ),
        readModelDB
          .select()
          .from(tenantVerifiedAttributeRevokerInReadmodelTenant)
          .where(
            and(
              eq(
                tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId,
                tenantId
              ),
              inArray(
                tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId,
                attributeIds
              )
            )
          ),
      ]);

      const results: VerifiedTenantAttribute[] = attributesSQL.map(
        (attributeSQL) => {
          const verifiedBy: TenantVerifier[] = verifiersSQL
            .filter(
              (v) => v.tenantVerifiedAttributeId === attributeSQL.attributeId
            )
            .map((v) => ({
              id: unsafeBrandId(v.tenantVerifierId),
              verificationDate: stringToDate(v.verificationDate),
              ...(v.expirationDate
                ? { expirationDate: stringToDate(v.expirationDate) }
                : {}),
              ...(v.extensionDate
                ? { extensionDate: stringToDate(v.extensionDate) }
                : {}),
              ...(v.delegationId
                ? { delegationId: unsafeBrandId<DelegationId>(v.delegationId) }
                : {}),
            }));

          const revokedBy: TenantRevoker[] = revokersSQL
            .filter(
              (r) => r.tenantVerifiedAttributeId === attributeSQL.attributeId
            )
            .map((r) => ({
              id: unsafeBrandId(r.tenantRevokerId),
              verificationDate: stringToDate(r.verificationDate),
              ...(r.expirationDate
                ? { expirationDate: stringToDate(r.expirationDate) }
                : {}),
              ...(r.extensionDate
                ? { extensionDate: stringToDate(r.extensionDate) }
                : {}),
              revocationDate: stringToDate(r.revocationDate),
              ...(r.delegationId
                ? { delegationId: unsafeBrandId<DelegationId>(r.delegationId) }
                : {}),
            }));

          return {
            id: unsafeBrandId<AttributeId>(attributeSQL.attributeId),
            type: tenantAttributeType.VERIFIED,
            assignmentTimestamp: stringToDate(attributeSQL.assignmentTimestamp),
            verifiedBy,
            revokedBy,
          };
        }
      );

      return createListResult(results, totalCount);
    },
    async getTenants({
      name,
      features,
      externalIdOrigin,
      externalIdValue,
      offset,
      limit,
    }: ApiGetTenantsFilters): Promise<ListResult<Tenant>> {
      return await readModelDB.transaction(async (tx) => {
        const queryResult = await tx
          .selectDistinct(
            withTotalCount({
              tenantId: tenantInReadmodelTenant.id,
              nameLowerCase: lowerCase(tenantInReadmodelTenant.name),
            })
          )
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
              name
                ? ilikeEscaped(
                    tenantInReadmodelTenant.name,
                    `%${escapeSqlLike(name)}%`
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
        return createListResult(
          tenants.map((tenantWithMetadata) => tenantWithMetadata.data),
          queryResult[0]?.totalCount
        );
      });
    },
    async getTenantById(
      id: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return await tenantReadModelService.getTenantById(id);
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
    }): Promise<ListResult<Tenant>> {
      return await readModelDB.transaction(async (tx) => {
        const queryResult = await tx
          .select(
            withTotalCount({
              tenantId: tenantInReadmodelTenant.id,
            })
          )
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
                ? ilikeEscaped(
                    tenantInReadmodelTenant.name,
                    `%${escapeSqlLike(consumerName)}%`
                  )
                : undefined,
              isNotNull(tenantInReadmodelTenant.selfcareId)
            )
          )
          .groupBy(tenantInReadmodelTenant.id)
          .orderBy(ascLower(tenantInReadmodelTenant.name))
          .limit(limit)
          .offset(offset);

        const tenantIds = queryResult.map((item) => item.tenantId);
        const tenants = await tenantReadModelService.getTenantsByIds(
          tenantIds,
          tx
        );
        return createListResult(
          tenants.map((tenantWithMetadata) => tenantWithMetadata.data),
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
    }): Promise<ListResult<Tenant>> {
      return await readModelDB.transaction(async (tx) => {
        const queryResult = await tx
          .select(
            withTotalCount({
              tenantId: tenantInReadmodelTenant.id,
            })
          )
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
                ? ilikeEscaped(
                    tenantInReadmodelTenant.name,
                    `%${escapeSqlLike(producerName)}%`
                  )
                : undefined,
              isNotNull(tenantInReadmodelTenant.selfcareId)
            )
          )
          .groupBy(tenantInReadmodelTenant.id)
          .orderBy(ascLower(tenantInReadmodelTenant.name))
          .limit(limit)
          .offset(offset);

        const tenantIds = queryResult.map((item) => item.tenantId);
        const tenants = await tenantReadModelService.getTenantsByIds(
          tenantIds,
          tx
        );
        return createListResult(
          tenants.map((tenantWithMetadata) => tenantWithMetadata.data),
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
        .selectDistinct(
          withTotalCount({
            id: tenantInReadmodelTenant.id,
            name: tenantInReadmodelTenant.name,
            nameLowerCase: lowerCase(tenantInReadmodelTenant.name),
            attributeId: tenantCertifiedAttributeInReadmodelTenant.attributeId,
            attributeName: attributeInReadmodelAttribute.name,
          })
        )
        .from(tenantCertifiedAttributeInReadmodelTenant)
        .innerJoin(
          attributeInReadmodelAttribute,
          and(
            eq(
              tenantCertifiedAttributeInReadmodelTenant.attributeId,
              attributeInReadmodelAttribute.id
            ),
            eq(attributeInReadmodelAttribute.origin, certifierId),
            eq(attributeInReadmodelAttribute.kind, attributeKind.certified),
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
