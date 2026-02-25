import {
  createListResult,
  escapeRegExp,
  withTotalCount,
} from "pagopa-interop-commons";
import {
  Agreement,
  agreementState,
  Delegation,
  DelegationId,
  delegationKind,
  DelegationKind,
  delegationState,
  DelegationState,
  EService,
  EServiceId,
  genericInternalError,
  ListResult,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import { z } from "zod";
import { delegationApi } from "pagopa-interop-api-clients";
import {
  agreementInReadmodelAgreement,
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationSignedContractDocumentInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  aggregateDelegationArray,
  AgreementReadModelService,
  CatalogReadModelService,
  DelegationReadModelService,
  TenantReadModelService,
  toDelegationAggregatorArray,
} from "pagopa-interop-readmodel";
import { and, countDistinct, eq, ilike, inArray } from "drizzle-orm";
import { PgSelect } from "drizzle-orm/pg-core";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  delegationReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  delegationReadModelServiceSQL: DelegationReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  agreementReadModelServiceSQL: AgreementReadModelService;
}) {
  return {
    async getDelegationById(
      id: DelegationId,
      kind?: DelegationKind
    ): Promise<WithMetadata<Delegation> | undefined> {
      return delegationReadModelServiceSQL.getDelegationByFilter(
        and(
          eq(delegationInReadmodelDelegation.id, id),
          kind ? eq(delegationInReadmodelDelegation.kind, kind) : undefined
        )
      );
    },
    async findDelegations(filters: {
      eserviceId?: EServiceId;
      delegatorId?: TenantId;
      delegateId?: TenantId;
      delegationKind: DelegationKind;
      states: DelegationState[];
    }): Promise<Delegation[]> {
      return (
        await delegationReadModelServiceSQL.getDelegationsByFilter(
          and(
            filters.delegatorId
              ? eq(
                  delegationInReadmodelDelegation.delegatorId,
                  filters.delegatorId
                )
              : undefined,
            filters.eserviceId
              ? eq(
                  delegationInReadmodelDelegation.eserviceId,
                  filters.eserviceId
                )
              : undefined,
            filters.delegateId
              ? eq(
                  delegationInReadmodelDelegation.delegateId,
                  filters.delegateId
                )
              : undefined,
            eq(delegationInReadmodelDelegation.kind, filters.delegationKind),
            filters.states.length > 0
              ? inArray(delegationInReadmodelDelegation.state, filters.states)
              : undefined
          )
        )
      ).map((d) => d.data);
    },
    async getEServiceById(
      id: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      return await catalogReadModelServiceSQL.getEServiceById(id);
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
    },
    async getDelegations({
      delegateIds,
      delegatorIds,
      eserviceIds,
      delegationStates,
      kind,
      offset,
      limit,
    }: {
      delegateIds: TenantId[];
      delegatorIds: TenantId[];
      eserviceIds: EServiceId[];
      delegationStates: DelegationState[];
      kind: DelegationKind | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Delegation>> {
      return await readModelDB.transaction(async (tx) => {
        const totalCountQuery = tx
          .select({
            count: countDistinct(delegationInReadmodelDelegation.id),
          })
          .from(delegationInReadmodelDelegation)
          .$dynamic();

        const idsQuery = tx
          .select({
            id: delegationInReadmodelDelegation.id,
          })
          .from(delegationInReadmodelDelegation)
          .$dynamic();

        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const buildQuery = <T extends PgSelect>(query: T) => {
          const subqueryWithFilters = tx
            .selectDistinctOn([delegationInReadmodelDelegation.id], {
              id: delegationInReadmodelDelegation.id,
            })
            .from(delegationInReadmodelDelegation)
            .where(
              and(
                delegateIds.length > 0
                  ? inArray(
                      delegationInReadmodelDelegation.delegateId,
                      delegateIds
                    )
                  : undefined,
                delegatorIds.length > 0
                  ? inArray(
                      delegationInReadmodelDelegation.delegatorId,
                      delegatorIds
                    )
                  : undefined,
                eserviceIds.length > 0
                  ? inArray(
                      delegationInReadmodelDelegation.eserviceId,
                      eserviceIds
                    )
                  : undefined,
                delegationStates.length > 0
                  ? inArray(
                      delegationInReadmodelDelegation.state,
                      delegationStates
                    )
                  : undefined,
                kind
                  ? eq(delegationInReadmodelDelegation.kind, kind)
                  : undefined
              )
            )
            .as("subqueryWithFilters");

          return query
            .innerJoin(
              subqueryWithFilters,
              eq(subqueryWithFilters.id, delegationInReadmodelDelegation.id)
            )
            .$dynamic();
        };

        const idsSQLquery = buildQuery(idsQuery)
          .groupBy(delegationInReadmodelDelegation.id)
          .orderBy(delegationInReadmodelDelegation.createdAt)
          .limit(limit)
          .offset(offset);

        const ids = (await idsSQLquery).map((result) => result.id);

        const [queryResult, totalCount] = await Promise.all([
          tx
            .select({
              delegation: delegationInReadmodelDelegation,
              delegationStamp: delegationStampInReadmodelDelegation,
              delegationContractDocument:
                delegationContractDocumentInReadmodelDelegation,
              delegationSignedContractDocument:
                delegationSignedContractDocumentInReadmodelDelegation,
            })
            .from(delegationInReadmodelDelegation)
            .where(inArray(delegationInReadmodelDelegation.id, ids))
            .leftJoin(
              delegationStampInReadmodelDelegation,
              eq(
                delegationInReadmodelDelegation.id,
                delegationStampInReadmodelDelegation.delegationId
              )
            )
            .leftJoin(
              delegationContractDocumentInReadmodelDelegation,
              eq(
                delegationInReadmodelDelegation.id,
                delegationContractDocumentInReadmodelDelegation.delegationId
              )
            )
            .leftJoin(
              delegationSignedContractDocumentInReadmodelDelegation,
              eq(
                delegationInReadmodelDelegation.id,
                delegationSignedContractDocumentInReadmodelDelegation.delegationId
              )
            )
            .orderBy(delegationInReadmodelDelegation.createdAt),
          buildQuery(totalCountQuery),
        ]);

        const delegations = aggregateDelegationArray(
          toDelegationAggregatorArray(queryResult)
        );
        return createListResult(
          delegations.map((d) => d.data),
          totalCount[0].count
        );
      });
    },
    async getConsumerDelegators(filters: {
      delegateId: TenantId;
      delegatorName?: string;
      eserviceIds: EServiceId[];
      limit: number;
      offset: number;
    }): Promise<delegationApi.CompactTenants> {
      return await readModelDB.transaction(async (tx) => {
        const whereCondition = and(
          // DELEGATION FILTERS
          eq(
            delegationInReadmodelDelegation.kind,
            delegationKind.delegatedConsumer
          ),
          eq(delegationInReadmodelDelegation.state, delegationState.active),
          eq(delegationInReadmodelDelegation.delegateId, filters.delegateId),
          filters.eserviceIds.length > 0
            ? inArray(
                delegationInReadmodelDelegation.eserviceId,
                filters.eserviceIds
              )
            : undefined,
          // TENANT FILTERS
          filters.delegatorName
            ? ilike(
                tenantInReadmodelTenant.name,
                `%${escapeRegExp(filters.delegatorName)}%`
              )
            : undefined
        );

        const [queryResult, totalCount] = await Promise.all([
          tx
            .select({
              id: tenantInReadmodelTenant.id,
              name: tenantInReadmodelTenant.name,
            })
            .from(tenantInReadmodelTenant)
            .innerJoin(
              delegationInReadmodelDelegation,
              eq(
                tenantInReadmodelTenant.id,
                delegationInReadmodelDelegation.delegatorId
              )
            )
            .where(whereCondition)
            .groupBy(tenantInReadmodelTenant.id)
            .orderBy(tenantInReadmodelTenant.name)
            .limit(filters.limit)
            .offset(filters.offset),
          tx
            .select({ count: countDistinct(tenantInReadmodelTenant.id) })
            .from(tenantInReadmodelTenant)
            .innerJoin(
              delegationInReadmodelDelegation,
              eq(
                tenantInReadmodelTenant.id,
                delegationInReadmodelDelegation.delegatorId
              )
            )
            .where(whereCondition),
        ]);

        const data: delegationApi.CompactTenant[] = queryResult.map((d) => ({
          id: d.id,
          name: d.name,
        }));

        const result = z.array(delegationApi.CompactTenant).safeParse(data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse compact delegation tenants: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)}`
          );
        }

        return createListResult(result.data, totalCount[0].count);
      });
    },
    async getConsumerDelegatorsWithAgreements(filters: {
      delegateId: TenantId;
      delegatorName?: string;
      limit: number;
      offset: number;
    }): Promise<delegationApi.CompactTenants> {
      const queryResult = await readModelDB
        .select(
          withTotalCount({
            id: tenantInReadmodelTenant.id,
            name: tenantInReadmodelTenant.name,
          })
        )
        .from(tenantInReadmodelTenant)
        .innerJoin(
          delegationInReadmodelDelegation,
          eq(
            tenantInReadmodelTenant.id,
            delegationInReadmodelDelegation.delegatorId
          )
        )
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            delegationInReadmodelDelegation.eserviceId,
            eserviceInReadmodelCatalog.id
          )
        )
        .innerJoin(
          agreementInReadmodelAgreement,
          eq(
            delegationInReadmodelDelegation.eserviceId,
            agreementInReadmodelAgreement.eserviceId
          )
        )
        .where(
          and(
            // DELEGATION FILTERS
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            ),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(delegationInReadmodelDelegation.delegateId, filters.delegateId),
            // AGREEMENT FILTERS
            eq(
              agreementInReadmodelAgreement.producerId,
              eserviceInReadmodelCatalog.producerId
            ),
            eq(
              agreementInReadmodelAgreement.consumerId,
              delegationInReadmodelDelegation.delegatorId
            ),
            eq(agreementInReadmodelAgreement.state, agreementState.active),
            // TENANT FILTERS
            filters.delegatorName
              ? ilike(
                  tenantInReadmodelTenant.name,
                  `%${escapeRegExp(filters.delegatorName)}%`
                )
              : undefined
          )
        )
        .groupBy(tenantInReadmodelTenant.id)
        .orderBy(tenantInReadmodelTenant.name)
        .limit(filters.limit)
        .offset(filters.offset);

      const data: delegationApi.CompactTenant[] = queryResult.map((d) => ({
        id: d.id,
        name: d.name,
      }));

      const result = z.array(delegationApi.CompactTenant).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse compact delegation tenants: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)}`
        );
      }

      return createListResult(result.data, queryResult[0]?.totalCount);
    },
    async getConsumerEservices(filters: {
      delegateId: TenantId;
      delegatorId: TenantId;
      limit: number;
      offset: number;
      eserviceName?: string;
    }): Promise<delegationApi.CompactEServices> {
      return await readModelDB.transaction(async (tx) => {
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const addJoins = <T extends PgSelect>(query: T) =>
          query
            .innerJoin(
              delegationInReadmodelDelegation,
              eq(
                eserviceInReadmodelCatalog.id,
                delegationInReadmodelDelegation.eserviceId
              )
            )
            .innerJoin(
              agreementInReadmodelAgreement,
              eq(
                delegationInReadmodelDelegation.eserviceId,
                agreementInReadmodelAgreement.eserviceId
              )
            )
            .$dynamic();
        const whereCondition = and(
          // DELEGATION FILTERS
          eq(
            delegationInReadmodelDelegation.kind,
            delegationKind.delegatedConsumer
          ),
          eq(delegationInReadmodelDelegation.state, delegationState.active),
          eq(delegationInReadmodelDelegation.delegateId, filters.delegateId),
          eq(delegationInReadmodelDelegation.delegatorId, filters.delegatorId),
          // E-SERVICE FILTER
          filters.eserviceName
            ? ilike(
                eserviceInReadmodelCatalog.name,
                `%${escapeRegExp(filters.eserviceName)}%`
              )
            : undefined,
          // AGREEMENT FILTERS
          eq(
            agreementInReadmodelAgreement.producerId,
            eserviceInReadmodelCatalog.producerId
          ),
          eq(
            agreementInReadmodelAgreement.consumerId,
            delegationInReadmodelDelegation.delegatorId
          ),
          eq(agreementInReadmodelAgreement.state, agreementState.active)
        );

        const [queryResult, totalCount] = await Promise.all([
          addJoins(
            tx
              .select({
                id: eserviceInReadmodelCatalog.id,
                name: eserviceInReadmodelCatalog.name,
                producerId: eserviceInReadmodelCatalog.producerId,
              })
              .from(eserviceInReadmodelCatalog)
              .$dynamic()
          )
            .where(whereCondition)
            .groupBy(eserviceInReadmodelCatalog.id)
            .orderBy(eserviceInReadmodelCatalog.name)
            .limit(filters.limit)
            .offset(filters.offset),
          addJoins(
            tx
              .select({ count: countDistinct(eserviceInReadmodelCatalog.id) })
              .from(eserviceInReadmodelCatalog)
              .$dynamic()
          ).where(whereCondition),
        ]);

        const data: delegationApi.CompactEService[] = queryResult.map((e) => ({
          id: e.id,
          name: e.name,
          producerId: e.producerId,
        }));

        const result = z.array(delegationApi.CompactEService).safeParse(data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse compact delegation eservices: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)}`
          );
        }

        return createListResult(result.data, totalCount[0].count);
      });
    },
    async getDelegationRelatedAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | null> {
      return (
        (
          await agreementReadModelServiceSQL.getAgreementByFilter(
            and(
              eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
              eq(agreementInReadmodelAgreement.consumerId, consumerId),
              inArray(agreementInReadmodelAgreement.state, [
                agreementState.active,
                agreementState.suspended,
                agreementState.pending,
              ])
            )
          )
        )?.data || null
      );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
